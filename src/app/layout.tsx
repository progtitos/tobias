import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tobias — seu planejador financeiro pessoal",
  description:
    "Você conversa. O Tobias entende. O plano acontece. Um agente de planejamento financeiro pessoal com IA.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f3d2e",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-cream-50 text-ink-900 font-sans">
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
