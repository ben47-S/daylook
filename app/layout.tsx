import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tenues",
  description:
    "Gestion des tenues de travail : pièces, associations, planning et suivi des ports.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
