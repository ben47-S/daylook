import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Tenues",
    template: "%s — Tenues",
  },
  description:
    "Gestion des tenues de travail : pièces, associations, planning et suivi des ports.",
};

// viewportFit: cover — requis pour que env(safe-area-inset-bottom) (barre du
// bas, iPhone avec barre domestique) vaille autre chose que 0.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
