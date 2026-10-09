import { redirect } from "next/navigation";
import { SignInButton } from "@/components/auth/auth-buttons";
import { getAccess } from "@/auth/require-user";

export default async function LoginPage() {
  const access = await getAccess();
  if (access.kind === "allowed") redirect("/");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-center text-3xl font-semibold">
        Facturas — Análisis de gastos
      </h1>
      <SignInButton label="Iniciar sesión con Google" />
    </main>
  );
}
