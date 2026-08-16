import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";

// Matches the "Drape" design reference (docs/Drape Styling App.html): a
// heavy grotesque sans for bold, editorial headlines and labels.
const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Glow & Fit Concierge",
  description: "An agentic styling assistant built on the YouCam Skin AI + Apparel VTO APIs.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={archivo.variable}>
      <body className="min-h-screen font-display">{children}</body>
    </html>
  );
}
