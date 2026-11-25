import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Connexion",
};

export default function ConnexionPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold">Tenues</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Connectez-vous pour gérer vos tenues.
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
