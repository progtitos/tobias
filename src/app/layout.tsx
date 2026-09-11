import type { Metadata, Viewport } from "next";
import { Sora, Work_Sans } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

// next/font/google downloads these at BUILD time and self-hosts the files
// from the app's own domain — the browser never requests fonts.googleapis.com
// or fonts.gstatic.com at all. The previous <link>-tag approach fetched from
// Google directly at runtime, which privacy-focused browsers (Brave's
// Shields, many ad-blockers) block by default — silently falling back to a
// system font and producing exactly the dated look reported. Self-hosting
// sidesteps that entirely, on every browser.
//
// Sora (display) + Work Sans (body) is the "Ardósia Solar" type pairing:
// a confident geometric sans for headings instead of the old serif, paired
// with a plain, dense-friendly body face — no serif anywhere anymore.
const sora = Sora({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-sora",
  display: "swap",
});
const workSans = Work_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-work-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tobias: seu planejador financeiro pessoal",
  description:
    "Você conversa. O Tobias entende. O plano acontece. Um agente de planejamento financeiro pessoal com IA.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#14181c",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`h-full antialiased ${sora.variable} ${workSans.variable}`}>
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
