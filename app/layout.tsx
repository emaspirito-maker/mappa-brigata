import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mappa la tua Brigata",
  description: "Esercizio digitale — Mappa la tua Brigata",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
