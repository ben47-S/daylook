"use client";

import { useRouter } from "next/navigation";

// Bouton de déconnexion → POST /api/auth/logout puis retour à /connexion.

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/connexion");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100"
    >
      Se déconnecter
    </button>
  );
}
