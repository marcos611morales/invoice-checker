import { redirect } from "next/navigation";
import {
  SignOutButton,
  SwitchAccountButton,
} from "@/components/auth/auth-buttons";
import { getAccess } from "@/auth/require-user";

// This page reads the session only. It shows the signed-in account's own email
// and nothing else: the denied session is accepted by no other entry point.
export default async function AccesoDenegadoPage() {
  const access = await getAccess();
  if (access.kind === "anonymous") redirect("/login");
  if (access.kind === "allowed") redirect("/");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-3xl font-semibold">Acceso denegado</h1>
      <p className="text-muted-foreground max-w-md">
        Tu cuenta <strong className="text-foreground">{access.email}</strong>{" "}
        no tiene acceso.
      </p>
      <p className="text-muted-foreground max-w-md text-sm">
        Cierra sesión o prueba con otra cuenta de Google.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <SignOutButton label="Cerrar sesión" />
        <SwitchAccountButton label="Usar otra cuenta" />
      </div>
    </main>
  );
}
