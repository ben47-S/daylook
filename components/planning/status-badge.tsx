import type { PlanStatus } from "@/lib/prisma";

// Badge de statut d'une tenue planifiée, partagé par l'accueil et
// l'onglet Planning (composant présentiel, sans "use client").

const STATUS_LABELS: Record<
  PlanStatus,
  { label: string; className: string }
> = {
  PLANNED: { label: "Prévue", className: "bg-zinc-100 text-zinc-600" },
  CONFIRMED: {
    label: "Confirmée",
    className: "bg-emerald-100 text-emerald-700",
  },
  CANCELLED: { label: "Annulée", className: "bg-red-100 text-red-600" },
};

export function StatusBadge({ status }: { status: PlanStatus }) {
  const { label, className } = STATUS_LABELS[status];
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${className}`}
    >
      {label}
    </span>
  );
}
