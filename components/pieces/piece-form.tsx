"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Piece } from "@/lib/prisma";
import { compressImage } from "@/lib/photos/compress";
import {
  PIECE_TYPE_LABELS,
  type PieceFormState,
} from "@/lib/pieces/schemas";

// Formulaire d'ajout (sans props) ou de modification (avec `piece`) d'une
// pièce. Écrit via les routes API du §8 : POST /api/pieces, PATCH/DELETE
// /api/pieces/:id, POST /api/pieces/:id/photo.

type Props = { piece?: Piece };

const INPUT =
  "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500";
const LABEL = "text-sm font-medium";

export function PieceForm({ piece }: Props) {
  const router = useRouter();
  const [state, setState] = useState<PieceFormState>(undefined);
  const [pending, setPending] = useState(false);
  const [type, setType] = useState<"TOP" | "BOTTOM">(piece?.type ?? "TOP");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  // Marqueur posé juste après un enregistrement réussi : le formulaire doit
  // repartir de zéro à la prochaine visite (voir useLayoutEffect plus bas).
  const shouldReset = useRef(false);
  // Miroir de photoPreview pour pouvoir révoquer l'URL dans un cleanup sans
  // la figer dans la closure.
  const photoPreviewRef = useRef<string | null>(null);

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    const next = file ? URL.createObjectURL(file) : null;
    photoPreviewRef.current = next;
    setPhotoPreview(next);
  }

  // cacheComponents : Next ne démonte plus les pages à la navigation, il les
  // masque avec React <Activity> (DOM conservé). Sans remise à zéro, la
  // visite suivante du formulaire retrouve les champs de la pièce
  // précédente et le bouton bloqué sur « Enregistrement… ».
  // On réinitialise au moment précis où la page est masquée : ni avant (ça
  // clignoterait), ni jamais (l'état stagnerait). Les brouillons non
  // envoyés restent conservés — seul un enregistrement réussi vide le
  // formulaire, comme recommandé par la doc Next (preserving-ui-state).
  useLayoutEffect(() => {
    const form = formRef.current;
    return () => {
      // Messages d'erreur/succès périmés : toujours à jeter.
      setState(undefined);
      setPending(false);
      if (!shouldReset.current) return;
      shouldReset.current = false;

      // Mode création : on repart d'un formulaire vierge.
      // Mode modification : on garde les champs, ils valent ce qui vient
      // d'être enregistré.
      if (!piece) {
        setType("TOP");
        form?.reset();
      }
      if (photoPreviewRef.current) {
        URL.revokeObjectURL(photoPreviewRef.current);
        photoPreviewRef.current = null;
        setPhotoPreview(null);
      }
    };
  }, [piece]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setState(undefined);

    const formData = new FormData(event.currentTarget);
    const file = formData.get("photo");
    const payload = {
      type: formData.get("type"),
      title: formData.get("title"),
      color: formData.get("color"),
      difference: formData.get("difference"),
      washThreshold: formData.get("washThreshold"),
    };

    // 1. Création ou modification des champs
    const response = await fetch(
      piece ? `/api/pieces/${piece.id}` : "/api/pieces",
      {
        method: piece ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as PieceFormState;
      setState(data);
      setPending(false);
      return;
    }

    // 2. Photo si un fichier a été choisi
    let pieceId = piece?.id;
    if (!piece) {
      const data = (await response.json()) as { piece: { id: string } };
      pieceId = data.piece.id;
    }

    if (file instanceof File && file.size > 0 && pieceId) {
      // Compression avant envoi (1024 px max, JPEG 0.82) : le serveur ne
      // reçoit jamais la photo brute du téléphone.
      const optimized = await compressImage(file);
      const photoForm = new FormData();
      photoForm.append("file", optimized);
      const photoResponse = await fetch(`/api/pieces/${pieceId}/photo`, {
        method: "POST",
        body: photoForm,
      });

      if (!photoResponse.ok) {
        const data = (await photoResponse.json().catch(() => ({}))) as {
          message?: string;
        };
        if (piece) {
          // Mode modification : les champs sont sauvés, on reste pour réessayer
          setState({
            message: `Champs enregistrés, mais la photo a échoué : ${data.message ?? "erreur inconnue"}.`,
          });
          setPending(false);
          return;
        }
        // Mode création : la pièce existe, on laisse le soin de l'ajouter
        // depuis sa fiche plutôt que de bloquer sur un écran « nouvelle ».
      }
    }

    // Enregistré : on vide le formulaire à la mise en cache de la page
    // (cf. useLayoutEffect), puis on retourne à la garde-robe.
    shouldReset.current = true;
    router.push("/garde-robe");
    router.refresh();
  }

  async function handleArchive() {
    if (!piece) return;
    const confirmed = window.confirm(
      "Archiver cette pièce ? Elle disparaît de la garde-robe mais l'historique est conservé.",
    );
    if (!confirmed) return;

    setPending(true);
    const response = await fetch(`/api/pieces/${piece.id}`, {
      method: "DELETE",
    });
    if (response.ok) {
      router.push("/garde-robe");
      router.refresh();
      return;
    }
    setState({ message: "Impossible d'archiver la pièce." });
    setPending(false);
  }

  const currentPhoto = photoPreview
    ? photoPreview
    : piece?.photoPath
      ? `/api/photos/${piece.id}`
      : null;

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="flex w-full flex-col gap-4 lg:max-w-2xl"
    >
      {/* Photo */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100">
          {currentPhoto ? (
            photoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentPhoto}
                alt="Aperçu de la photo"
                className="h-full w-full object-cover"
              />
            ) : (
              <Image
                src={currentPhoto}
                alt={piece?.title ?? "Photo de la pièce"}
                unoptimized
                width={96}
                height={96}
                className="h-full w-full object-cover"
              />
            )
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-zinc-400">
              Pas de photo
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <label htmlFor="photo" className={LABEL}>
            Photo
          </label>
          <input
            id="photo"
            ref={photoRef}
            type="file"
            name="photo"
            accept="image/jpeg,image/png,image/webp"
            onChange={handlePhotoChange}
            className="w-full max-w-full text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-200"
          />
          <p className="text-xs text-zinc-500">
            JPEG, PNG ou WebP — 10 Mo max, compressée automatiquement.
          </p>
        </div>
      </div>

      {/* Type */}
      <fieldset className="flex flex-col gap-1.5">
        <legend className={`${LABEL} mb-1.5`}>Type</legend>
        <div className="flex gap-3">
          {(
            Object.entries(PIECE_TYPE_LABELS) as Array<
              ["TOP" | "BOTTOM", string]
            >
          ).map(([value, label]) => (
            <label
              key={value}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-sm ${
                type === value
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-300 bg-white text-zinc-700"
              }`}
            >
              <input
                type="radio"
                name="type"
                value={value}
                checked={type === value}
                onChange={() => setType(value)}
                className="sr-only"
                required
              />
              {label}
            </label>
          ))}
        </div>
        {state?.errors?.type && (
          <p className="text-sm text-red-600">{state.errors.type[0]}</p>
        )}
      </fieldset>

      {/* Titre */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="title" className={LABEL}>
          Titre
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          maxLength={80}
          defaultValue={piece?.title ?? ""}
          placeholder="Ex. Pantalon gris de travail"
          className={INPUT}
        />
        {state?.errors?.title && (
          <p className="text-sm text-red-600">{state.errors.title[0]}</p>
        )}
      </div>

      {/* Couleur */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="color" className={LABEL}>
          Couleur
        </label>
        <input
          id="color"
          name="color"
          type="text"
          required
          maxLength={40}
          defaultValue={piece?.color ?? ""}
          placeholder="Ex. Gris anthracite"
          className={INPUT}
        />
        {state?.errors?.color && (
          <p className="text-sm text-red-600">{state.errors.color[0]}</p>
        )}
      </div>

      {/* Description de différence */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="difference" className={LABEL}>
          Description de différence{" "}
          <span className="font-normal text-zinc-500">(facultatif)</span>
        </label>
        <textarea
          id="difference"
          name="difference"
          rows={2}
          maxLength={200}
          defaultValue={piece?.difference ?? ""}
          placeholder="Ex. Poche déchirée à droite, seul ce pantalon a ce détail"
          className={INPUT}
        />
        {state?.errors?.difference && (
          <p className="text-sm text-red-600">{state.errors.difference[0]}</p>
        )}
      </div>

      {/* Seuil de lavage */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="washThreshold" className={LABEL}>
          Seuil de ports avant lavage{" "}
          <span className="font-normal text-zinc-500">(facultatif)</span>
        </label>
        <input
          id="washThreshold"
          name="washThreshold"
          type="number"
          min={1}
          max={999}
          defaultValue={piece?.washThreshold ?? ""}
          placeholder="Ex. 5"
          className={`${INPUT} max-w-32`}
        />
        {state?.errors?.washThreshold && (
          <p className="text-sm text-red-600">{state.errors.washThreshold[0]}</p>
        )}
      </div>

      {state?.message && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.message}
        </p>
      )}

      {/* Actions */}
      <div className="mt-2 flex flex-col gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-60"
        >
          {pending
            ? "Enregistrement…"
            : piece
              ? "Enregistrer les modifications"
              : "Ajouter la pièce"}
        </button>
        <Link
          href="/garde-robe"
          className="rounded-lg border border-zinc-300 px-4 py-2.5 text-center text-sm font-medium text-zinc-700 transition hover:bg-zinc-100"
        >
          Annuler
        </Link>
      </div>

      {piece && (
        <div className="mt-4 border-t border-zinc-200 pt-4">
          <button
            type="button"
            onClick={handleArchive}
            disabled={pending}
            className="w-full rounded-lg border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60"
          >
            Archiver la pièce
          </button>
          <p className="mt-1.5 text-xs text-zinc-500">
            Elle disparaît de la garde-robe, l&apos;historique de ports est
            conservé.
          </p>
        </div>
      )}
    </form>
  );
}
