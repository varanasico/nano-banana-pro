import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NANO BANANA PRO Studio",
  description: "Vlastní studio pro generování obrázků přes Nano Banana Pro API",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-neutral-950 text-neutral-100">{children}</body>
    </html>
  );
}
