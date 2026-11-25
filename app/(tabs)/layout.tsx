import { Suspense, type ReactNode } from "react";
import { BottomNav } from "@/components/layout/bottom-nav";
import { PushManager } from "@/components/push/push-manager";
import { PendingPromptAlert } from "@/components/push/pending-prompt-alert";

// Structure commune des 3 onglets : contenu + barre de navigation fixe.
// Pas de vérification de session ici — un layout ne se re-rend pas à chaque
// navigation ; proxy.ts protège déjà /garde-robe et /planning.
// pb-16 laisse la place à la barre fixe.

// Contenu centré et borné : mobile d'abord (pleine largeur), puis il
// s'ouvre progressivement sur les grands écrans (lg : 56rem, xl : 72rem)
// pour devenir large sur PC au lieu de rester en colonne étroite.
// pb-24 : hauteur réelle de la barre (icône + label + safe-area) + marge.

// La barre utilise usePathname(), indisponible pendant le prerender des
// routes dynamiques (/garde-robe/[id]) : elle est donc enveloppée dans un
// <Suspense> (correctif [stream] du message blocking-prerender-client-hook).
// Le fallback reprend la forme exacte de la barre pour éviter tout saut.
export default function TabsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col pb-24">
      <div className="mx-auto flex w-full max-w-none flex-1 flex-col px-4 sm:px-6 lg:max-w-5xl xl:max-w-7xl">
        <PushManager />
        <PendingPromptAlert />
        {children}
      </div>
      <Suspense fallback={<BottomNavSkeleton />}>
        <BottomNav />
      </Suspense>
    </div>
  );
}

function BottomNavSkeleton() {
  return (
    <nav
      aria-hidden="true"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto grid w-full max-w-none grid-cols-3 px-4 sm:px-6 lg:max-w-5xl xl:max-w-7xl">
        {[0, 1, 2].map((index) => (
          <li
            key={index}
            className="flex flex-col items-center gap-0.5 py-2.5"
          >
            <span className="h-6 w-6 rounded bg-zinc-100" />
            <span className="h-4 w-12 rounded bg-zinc-100" />
          </li>
        ))}
      </ul>
    </nav>
  );
}
