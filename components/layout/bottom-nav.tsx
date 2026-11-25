"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SVGProps } from "react";

// Barre de navigation fixe en bas (PWA) : Accueil, Garde-robe, Planning.
// Onglet actif déterminé côté client via le chemin courant.

function HomeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M3.5 10.5 12 3.5l8.5 7" />
      <path d="M5.5 9.5V19a1.5 1.5 0 0 0 1.5 1.5h10A1.5 1.5 0 0 0 18.5 19V9.5" />
      <path d="M9.5 20.5v-5.5h5v5.5" />
    </svg>
  );
}

function HangerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M12 5.5a1.8 1.8 0 1 1 1.8 1.8c-1 0-1.8.8-1.8 1.8v.9" />
      <path d="M12 10 4 16.6A1.6 1.6 0 0 0 4.9 19.5h14.2a1.6 1.6 0 0 0 .9-2.9L12 10Z" />
    </svg>
  );
}

function CalendarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 9.5h17" />
      <path d="M8 3.25v3.5" />
      <path d="M16 3.25v3.5" />
    </svg>
  );
}

const TABS = [
  { href: "/", label: "Accueil", Icon: HomeIcon },
  { href: "/garde-robe", label: "Garde-robe", Icon: HangerIcon },
  { href: "/planning", label: "Planning", Icon: CalendarIcon },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto grid w-full max-w-none grid-cols-3 px-4 sm:px-6 lg:max-w-5xl xl:max-w-7xl">
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 py-2.5 transition-colors ${
                  active
                    ? "text-zinc-900"
                    : "text-zinc-400 hover:text-zinc-600"
                }`}
              >
                <Icon className="h-6 w-6" />
                <span
                  className={`text-[11px] ${active ? "font-medium" : ""}`}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
