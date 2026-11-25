import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = {
  title: "Inscription",
};

export default function InscriptionPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold">Tenues</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Créez votre compte pour commencer.
          </p>
        </div>
        <RegisterForm />
      </div>
    </main>
  );
}
