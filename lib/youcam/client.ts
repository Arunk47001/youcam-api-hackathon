/**
 * Low-level YouCam S2S REST client.
 *
 * Perfect Corp. documents two auth schemes across their API versions, and
 * which one your account/endpoints expect isn't confirmable without a real
 * key, so this client supports both:
 *
 *   - V2 (simple): `Authorization: Bearer <API key>` on every call. Used
 *     when only YOUCAM_API_KEY is set. This is what the hackathon's own
 *     published Quick Start guide (docs.perfectcorp.com/develop/quick_start_guide)
 *     describes.
 *   - V1-style (signed): the API secret is an RSA public key (X.509,
 *     base64). Encrypt `client_id=<key>&timestamp=<ms>` with it (PKCS1
 *     padding) to get an `id_token`, POST it to `/client/auth` to get a
 *     short-lived `access_token`, and Bearer *that* instead. Used when
 *     YOUCAM_API_SECRET is also set. The access token is cached in-process
 *     and refreshed shortly before it expires.
 *
 * Beyond auth, the flow is: ask the File API for an upload slot -> upload
 * bytes -> POST a task -> poll GET .../{task_id} until "success"/"error" ->
 * read the result URL. Exact endpoint paths and JSON field names for each
 * task kind are behind Perfect Corp.'s JS-rendered API reference and are
 * best confirmed against your own API Playground. Everything task-kind- and
 * auth-specific is centralized in this file so verification is a one-file
 * change.
 *
 * Set MOCK_YOUCAM=1 to bypass all network calls with canned data (see
 * lib/mock/*) while building/demoing the UI.
 */

import { constants as cryptoConstants, publicEncrypt } from "node:crypto";

export type YouCamTaskKind = "skin-analysis" | "apparel-vto";

export const MOCK_YOUCAM = process.env.MOCK_YOUCAM === "1";

const BASE_URL = (process.env.YOUCAM_API_BASE_URL ?? "https://yce-api-01.perfectcorp.com/s2s/v2.0").replace(/\/$/, "");
const AUTH_URL = (process.env.YOUCAM_AUTH_URL ?? "https://yce-api-01.perfectcorp.com/s2s/v1.0/client/auth");

// Confirmed against a live account (skin-analysis) and against a working
// reference implementation of this same API (apparel-vto — the real task
// name is "cloth", not "apparel-vto"; our internal YouCamTaskKind name is
// kept as "apparel-vto" for readability and mapped here).
const ENDPOINTS: Record<YouCamTaskKind, { uploadPath: string; taskPath: string; pollPath: (taskId: string) => string }> = {
  "skin-analysis": {
    uploadPath: "/file/skin-analysis",
    taskPath: "/task/skin-analysis",
    pollPath: (taskId) => `/task/skin-analysis/${taskId}`,
  },
  "apparel-vto": {
    uploadPath: "/file/cloth",
    taskPath: "/task/cloth",
    pollPath: (taskId) => `/task/cloth/${taskId}`,
  },
};

export class YouCamApiError extends Error {
  constructor(message: string, public status?: number, public body?: unknown) {
    super(message);
    this.name = "YouCamApiError";
  }
}

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

let cachedToken: CachedToken | null = null;

/**
 * Builds an `id_token` by RSA-encrypting `client_id=<key>&timestamp=<ms>`
 * with the API secret as an X.509 (SubjectPublicKeyInfo) public key.
 */
function buildIdToken(apiKey: string, apiSecret: string): string {
  const pem = `-----BEGIN PUBLIC KEY-----\n${apiSecret.match(/.{1,64}/g)?.join("\n")}\n-----END PUBLIC KEY-----`;
  const message = `client_id=${apiKey}&timestamp=${Date.now()}`;
  const encrypted = publicEncrypt(
    { key: pem, padding: cryptoConstants.RSA_PKCS1_PADDING },
    Buffer.from(message, "utf8")
  );
  return encrypted.toString("base64");
}

/**
 * Exchanges a freshly-built id_token for a short-lived access_token. Only
 * used when YOUCAM_API_SECRET is configured (the V1-style signed flow).
 */
async function fetchAccessToken(apiKey: string, apiSecret: string): Promise<CachedToken> {
  const idToken = buildIdToken(apiKey, apiSecret);
  const resp = await fetch(AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: apiKey, id_token: idToken }),
  });
  const data = await safeJson(resp);
  if (!resp.ok) {
    throw new YouCamApiError("YouCam auth exchange (id_token -> access_token) failed", resp.status, data);
  }

  const accessToken: string | undefined = data?.result?.access_token ?? data?.access_token;
  if (!accessToken) {
    throw new YouCamApiError("Unexpected YouCam auth response shape", resp.status, data);
  }

  // Docs say the token is valid for 2 hours; refresh a minute early and
  // honor an explicit expires_in if the response includes one.
  const expiresInMs = (data?.result?.expires_in ?? data?.expires_in ?? 7200) * 1000;
  return { accessToken, expiresAt: Date.now() + expiresInMs - 60_000 };
}

async function authHeaders(): Promise<Record<string, string>> {
  const apiKey = process.env.YOUCAM_API_KEY;
  if (!apiKey) {
    throw new YouCamApiError(
      "YOUCAM_API_KEY is not set. Add it to .env.local, or set MOCK_YOUCAM=1 to develop without real API calls."
    );
  }

  const apiSecret = process.env.YOUCAM_API_SECRET;
  if (!apiSecret) {
    // V2 simple flow: the API key itself is the bearer token.
    return { Authorization: `Bearer ${apiKey}` };
  }

  // V1-style signed flow: exchange (and cache) a short-lived access_token.
  if (!cachedToken || cachedToken.expiresAt <= Date.now()) {
    cachedToken = await fetchAccessToken(apiKey, apiSecret);
  }
  return { Authorization: `Bearer ${cachedToken.accessToken}` };
}

export interface UploadableFile {
  buffer: Buffer;
  contentType: string;
  fileName: string;
}

/**
 * Uploads a file for the given task kind and returns the YouCam file_id.
 */
export async function uploadFile(kind: YouCamTaskKind, file: UploadableFile): Promise<string> {
  if (MOCK_YOUCAM) {
    return `mock-${kind}-file-${hashSeed(file.fileName + file.buffer.byteLength)}`;
  }

  const endpoint = ENDPOINTS[kind];
  const initResp = await fetch(`${BASE_URL}${endpoint.uploadPath}`, {
    method: "POST",
    headers: { ...(await authHeaders()), "Content-Type": "application/json" },
    body: JSON.stringify({
      files: [{ content_type: file.contentType, file_name: file.fileName, file_size: file.buffer.byteLength }],
    }),
  });
  const initData = await safeJson(initResp);
  if (!initResp.ok) {
    throw new YouCamApiError(`YouCam upload-init failed (${kind})`, initResp.status, initData);
  }

  // Confirmed shape (2026-08, via live account): top-level `data` (not
  // `result`), `data.files[0].file_id`, and a `requests` array of presigned
  // upload requests (S3, typically one entry) each with their own
  // method/url/headers — the headers (Content-Length, Content-Type, etc.)
  // are part of the S3 signature, so they must be sent verbatim rather than
  // reconstructed.
  const fileEntry = initData?.data?.files?.[0] ?? initData?.result?.files?.[0] ?? initData?.files?.[0];
  const fileId: string | undefined = fileEntry?.file_id ?? fileEntry?.fileId;
  const uploadRequest = fileEntry?.requests?.[0];

  if (!fileId || !uploadRequest?.url) {
    throw new YouCamApiError(`Unexpected YouCam upload-init response shape (${kind})`, initResp.status, initData);
  }

  const putResp = await fetch(uploadRequest.url, {
    method: uploadRequest.method ?? "PUT",
    headers: uploadRequest.headers ?? { "Content-Type": file.contentType },
    // Buffer is a Uint8Array at runtime; cast needed because the DOM lib's
    // BodyInit type (from @types/node's fetch augmentation) doesn't include
    // node's Buffer type directly.
    body: file.buffer as unknown as BodyInit,
  });
  if (!putResp.ok) {
    throw new YouCamApiError(`YouCam file upload PUT failed (${kind})`, putResp.status);
  }

  return fileId;
}

/**
 * Creates an async task and returns its task_id.
 */
export async function createTask(kind: YouCamTaskKind, payload: Record<string, unknown>): Promise<string> {
  if (MOCK_YOUCAM) {
    return `mock-${kind}-task-${hashSeed(JSON.stringify(payload))}`;
  }

  const endpoint = ENDPOINTS[kind];
  const resp = await fetch(`${BASE_URL}${endpoint.taskPath}`, {
    method: "POST",
    headers: { ...(await authHeaders()), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await safeJson(resp);
  if (!resp.ok) {
    throw new YouCamApiError(`YouCam task creation failed (${kind})`, resp.status, data);
  }

  const taskId: string | undefined = data?.data?.task_id ?? data?.result?.task_id ?? data?.task_id;
  if (!taskId) {
    throw new YouCamApiError(`Unexpected YouCam task-creation response shape (${kind})`, resp.status, data);
  }
  return taskId;
}

export interface PollOptions {
  intervalMs?: number;
  timeoutMs?: number;
}

/**
 * Polls a task until it succeeds, errors, or the timeout elapses, and
 * returns the raw parsed response body from the final poll.
 */
export async function pollTask(
  kind: YouCamTaskKind,
  taskId: string,
  { intervalMs = 1500, timeoutMs = 45_000 }: PollOptions = {}
): Promise<any> {
  if (MOCK_YOUCAM) {
    return { status: "success", mock: true, taskId };
  }

  const endpoint = ENDPOINTS[kind];
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const resp = await fetch(`${BASE_URL}${endpoint.pollPath(taskId)}`, {
      method: "GET",
      headers: await authHeaders(),
    });
    const data = await safeJson(resp);
    if (!resp.ok) {
      throw new YouCamApiError(`YouCam task poll failed (${kind})`, resp.status, data);
    }

    // Confirmed shape (2026-08, via live account): `data.task_status`, not
    // `status` — pending values seen: "running"/"processing"/"queued";
    // error: "error" (with `data.error` holding a message). The exact
    // success token wasn't confirmed against a real face photo yet, so
    // treat anything outside the known-pending/known-error sets as done
    // rather than requiring an exact "success" match.
    const status: string | undefined =
      data?.data?.task_status ?? data?.result?.status ?? data?.data?.status ?? data?.status;
    const PENDING = new Set(["running", "processing", "queued", "pending"]);
    const FAILED = new Set(["error", "failed", "fail"]);

    if (status && FAILED.has(status)) {
      // The poll HTTP call itself succeeded (resp.status is 200) even
      // though the task semantically failed — using resp.status here would
      // make this look like an HTTP success to callers (confirmed bug: the
      // API route returned 200 with an error body, and the frontend
      // proceeded as if it had a real profile). 422 signals "the request
      // was valid but the task couldn't complete" regardless of the poll
      // call's own HTTP status.
      const errorCode = data?.data?.error ?? data?.error ?? "unknown";
      const errorMessage = data?.data?.error_message ?? data?.error_message;
      throw new YouCamApiError(
        `YouCam task ${taskId} (${kind}) reported an error: ${errorCode}${errorMessage ? ` — ${errorMessage}` : ""}`,
        422,
        data
      );
    }
    if (status && !PENDING.has(status)) {
      return data;
    }

    await sleep(intervalMs);
  }

  throw new YouCamApiError(`Timed out waiting for YouCam task ${taskId} (${kind})`);
}

async function safeJson(resp: Response): Promise<any> {
  try {
    return await resp.json();
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Small deterministic string hash — only used to make mock IDs stable-ish, not for security. */
function hashSeed(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}
