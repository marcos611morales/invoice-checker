import { requireUser } from "@/auth/require-user";

export default async function HomePage() {
  // A layout does not guard its pages' data: every page calls the DAL itself (D-19).
  const { email } = await requireUser();

  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold">Hola, {email}</h1>
      <p className="text-muted-foreground">
        Siguiente paso: elegir la carpeta de facturas en Ajustes.
      </p>
    </section>
  );
}
