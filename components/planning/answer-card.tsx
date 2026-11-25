"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

// Carte « Repassée ? » de l'accueil (§3, §5) : boutons Oui, Non (avec
// motif), Plus tard (5 ou 30 min). Appelle POST /api/planning/:date/answer
// puis rafraîchit la page serveur pour afficher le nouveau statut.

type Props = {
  /** Jour concerné (clé "YYYY-MM-DD"). */
  dateKey: string;
  /** Libellé du jour pour la question (« la tenue d'aujourd'hui »…). */
  dayQuestion: string;
};

const BUTTON =
  "rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-60";
const PRIMARY = `${BUTTON} bg-zinc-900 text-white hover:bg-zinc-700`;
const DANGER = `${BUTTON} border border-red-200 text-red-600 hover:bg-red-50`;
const NEUTRAL = `${BUTTON} border border-zinc-300 text-zinc-700 hover:bg-zinc-100`;

export function AnswerCard({ dateKey, dayQuestion }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [mode, setMode] = useState<"idle" | "later">("idle");
  const [reason, setReason] = useState("");
  const [showReason, setShowReason] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(payload: Record<string, unknown>) {
    setPending(true);
    setError(null);
    const response = await fetch(`/api/planning/${dateKey}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setPending(false);
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as {
        message?: string;
      };
      setError(data.message ?? "Erreur lors de l'enregistrement.");
      return;
    }
    setShowReason(false);
    setMode("idle");
    router.refresh();
  }

  function handleNoSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = reason.trim();
    if (!trimmed) return;
    void send({ answer: "no", reason: trimmed });
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <p className="text-sm font-medium">
        As-tu repassé {dayQuestion} et comptes-tu la porter ?
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => void send({ answer: "yes" })}
          className={PRIMARY}
        >
          Oui
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setShowReason((value) => !value);
            setMode("idle");
          }}
          className={DANGER}
        >
          Non
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setMode((value) => (value === "later" ? "idle" : "later"));
            setShowReason(false);
          }}
          className={NEUTRAL}
        >
          Plus tard
        </button>
      </div>

      {showReason && (
        <form onSubmit={handleNoSubmit} className="mt-3 flex flex-col gap-2">
          <label htmlFor="reason" className="text-sm font-medium">
            Pourquoi ? <span className="font-normal text-zinc-500">(motif)</span>
          </label>
          <textarea
            id="reason"
            rows={2}
            maxLength={200}
            required
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ex. Tenue mouillée, machine en panne…"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500"
          />
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className={DANGER}>
              {pending ? "Envoi…" : "Valider le refus"}
            </button>
            <button
              type="button"
              onClick={() => setShowReason(false)}
              className={NEUTRAL}
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {mode === "later" && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-zinc-500">Me redemander dans :</span>
          <button
            type="button"
            disabled={pending}
            onClick={() => void send({ answer: "later", delay: 5 })}
            className={NEUTRAL}
          >
            5 min
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => void send({ answer: "later", delay: 30 })}
            className={NEUTRAL}
          >
            30 min
          </button>
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
