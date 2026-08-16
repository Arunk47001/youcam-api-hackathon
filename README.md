# Glow & Fit Concierge

An agentic styling assistant built for the **YouCam API Skin AI & Apparel VTO Hackathon** (Skin AI + Apparel VTO combined track).

Most beauty and fashion tools treat skin and clothing as two separate features. Glow & Fit Concierge treats them as one decision: upload a selfie, tell it what you're dressing for, and it reads your skin with **YouCam Skin AI**, reasons about which colors and styles actually complement your tone and concerns, and renders three complete looks on you with **YouCam Apparel VTO** — each with a plain-language explanation of *why* it works.

## Design system

The UI follows the visual language from `docs/Drape Styling App.html` (a downloaded Claude Artifact design reference): Archivo (heavy grotesque sans), a warm off-white/near-black/red palette (`tailwind.config.ts`: `paper` `#e4e2e0`, `ink` `#201e1d`, `accent` `#ec3013`, `muted` `#605d5d`), sharp 0px-radius corners throughout, thin black hairline borders/panels, uppercase tracked-out labels, and numbered "why it works" reasoning — all adapted from that reference rather than copied wholesale. Drape is itself a much larger multi-page product (catalog/filter grid, wardrobe, journal, a full try-on configurator); this app pulled the coherent design language and the component patterns that actually map to our single-flow feature set (upload → analysis → 3 looks), not its full information architecture.

The landing hero's imagery (`components/HeroGraphic.tsx`) is an original abstract SVG composition, not a photo. Drape's own reference used real model photography, and this app was separately handed a few real actors'/actresses' photos to use as hero imagery — both were skipped deliberately: reusing Drape's images means shipping photography with no confirmed license, and using named public figures' likeness (especially somewhere their appearance would be generatively altered, as this app's whole premise does) risks both real publicity-rights issues and the hackathon's own IP/privacy-rights submission rules. An original graphic sidesteps the problem entirely — swap it for licensed photography if you have some before a final demo.

## How it uses the YouCam APIs

| Step | API | What happens |
|---|---|---|
| 1 | **YouCam Skin AI** | User's photo is uploaded and analyzed for 6 concern scores: redness, acne, eye bags, radiance, fine lines, pores. |
| 2 | *Agent layer (this app)* | A rule-based style engine scores a curated garment catalog against the skin profile + chosen occasion (a "complements your top concern" color bonus, plus undertone matching when available), picking 3 looks across distinct categories. If `ANTHROPIC_API_KEY` is set, Claude turns each pick's match reasons into a natural one-sentence stylist rationale; otherwise a templated sentence is used. |
| 3 | **YouCam Apparel VTO** | For each of the 3 picks, the user's photo + the garment reference image are sent to the generative Apparel VTO task and rendered. |

> **Note on skin tone/undertone:** confirmed against a live account — the Skin AI `skin-analysis` task reports skin *condition* (the 6 concerns above, plus an optional `skin_type` like "Normal"/"Oily"), not a color/undertone classification. There's no tone/undertone field in its response at all. The style engine's undertone-based color matching is real code that activates if a `SkinProfile.undertone` is ever supplied (mock mode does, to show the fuller experience) but real calls currently drive matching from concern scores alone — which is still genuinely personalized, just not tone-based. See `types/youcam.ts` for the full note.

The result: one experience where the skin reading actually changes what gets recommended and shown — not two bolted-on demos.

## Getting started

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000.

### Run without spending API units (mock mode)

`.env.example` ships with `MOCK_YOUCAM=1`. In this mode, the app runs the full upload → analyze → style → render flow with canned skin-analysis results and the catalog's own placeholder images standing in for VTO renders — useful for building/demoing the UI, or for verifying the flow before wiring real credentials.

### Run against the real YouCam API

1. Fill in `.env.local`:
   - `YOUCAM_API_KEY` — from the [API Console](https://yce.makeupar.com/api-console/en/api-keys/), after redeeming your hackathon code for 1,000 free units.
   - `YOUCAM_API_SECRET` — only if your console also issued one. Perfect Corp. documents two auth schemes: a simple `Authorization: Bearer <API key>` (V2, no secret needed) and an older signed flow where the secret is an RSA public key used to mint a short-lived access token (V1-style). [`lib/youcam/client.ts`](lib/youcam/client.ts) supports both automatically. **Confirmed against a live account: the signed flow is required** — set both key and secret.
   - `YOUCAM_API_BASE_URL` / `YOUCAM_AUTH_URL` — defaults confirmed working against a live account.
   - `MOCK_YOUCAM=0`
2. (Optional) Set `ANTHROPIC_API_KEY` for LLM-written stylist rationale instead of the templated fallback.

**Status of real-API verification (as of this build): both legs fully confirmed end-to-end against a live account**, including a real successful Apparel VTO render (a rasterized garment silhouette recolored the model's outfit convincingly).

Skin analysis:
- Results aren't inline JSON — the poll response gives a presigned S3 URL to a **ZIP archive** containing `skinanalysisResult/score_info.json` (parsed via `adm-zip`) plus a mask PNG per concern.
- `score_info.json`'s `ui_score` (0–100) is a **health** score — higher means *less* of the concern — so `SkinConcern.severity` is computed as `100 - ui_score`, not `ui_score` directly.
- `"dark_circle"` is not a valid `dst_actions` value; `"eye_bag"` is the closest available concern and is what this app requests.
- `"skin_type"` (Normal/Oily/Dry/Combination) is a valid, real, and separate `dst_actions` value, but is **not** requested by default — adding it alongside the 6 concern actions triggered `CreditInsufficiency` during testing (unclear if it's inherently pricier or the account was just low by then). `mapRawResultToProfile` in [`skinAnalysis.ts`](lib/youcam/skinAnalysis.ts) already reads it if present, so re-adding `SKIN_TYPE_ACTION` to the request is a one-line change once you've confirmed budget.

Apparel VTO:
- The real task name is **`cloth`**, not "apparel-vto" — `/file/cloth` and `/task/cloth` (our internal `YouCamTaskKind` keeps the friendlier "apparel-vto" name, mapped in [`client.ts`](lib/youcam/client.ts)).
- Real field names: `src_file_id` (person photo), `ref_file_id` (garment reference), `garment_category`.
- `garment_category` is a closed enum. Confirmed valid: `upper_body`, `full_body`, `lower_body`. Confirmed **invalid**: `dress`, `outerwear`, `one_piece`, `top`. This app maps `top → upper_body`, `dress → full_body`; `outerwear → upper_body` is an unconfirmed best guess (no dedicated outerwear value found).
- A successful result is a **direct rendered JPEG URL** (`data.results.url`) — unlike skin-analysis, not a ZIP.
- The source photo needs visible chest/shoulders (a tight face crop fails with `error_pose`), and the garment reference needs to actually read as a garment — a flat solid-color swatch fails with `error_editing_failed` / "Output too similar to source"; a garment-shaped silhouette (even a flat illustration, not a photo) was enough to succeed. **Real product photography will render better than the current placeholder SVGs** — see the note below.

## Project structure

```
app/                  Pages + API routes (Next.js App Router)
  api/analyze/         POST: photo -> YouCam Skin AI -> SkinProfile
  api/style/           POST: SkinProfile + occasion -> agent picks -> YouCam Apparel VTO -> Look[]
lib/youcam/           Low-level YouCam REST client + typed task wrappers
lib/agent/            Style-matching engine + rationale generation
lib/catalog/          Curated demo garment catalog
lib/mock/             Canned responses for MOCK_YOUCAM=1
components/           UI building blocks
public/garments/      Placeholder garment images (flat-color SVGs, see note below)
```

## Notes on the demo catalog

`public/garments/*.png` are locally generated flat-color placeholder silhouettes (not third-party photography), so the repo stays clean of licensing issues. They're fine for exercising the UI, for `MOCK_YOUCAM=1` demos, and — confirmed against a live account — they render correctly through the real Apparel VTO task too. **For the best-looking submission demo video, swap these for actual garment photography** — real photos render more convincingly than a flat silhouette, though the silhouette isn't broken.

## Privacy

Uploaded photos are only ever passed through to the YouCam API to fulfill the request; this app has no database and does not persist images. A consent checkbox gates every upload.

## Hackathon submission checklist (not yet done)

- [x] Confirm Skin AI and Apparel VTO field names against real calls (see "Status of real-API verification" above)
- [ ] Confirm the `outerwear → upper_body` category mapping is right (only `top`/`dress` categories have been real-tested)
- [ ] Check remaining API unit balance before further real-mode testing
- [ ] Replace placeholder garment SVGs with real product photography (confirmed: silhouette shapes render, but real photos will look better)
- [ ] Deploy a publicly reachable instance (or prepare local test instructions) for judges
- [ ] Screenshots
- [ ] 1–3 minute demo video (YouTube/Vimeo/Youku), explaining which YouCam APIs are used
- [ ] Text description of features/functionality/consumer value for the Devpost submission
