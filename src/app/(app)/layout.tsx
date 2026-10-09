import { SignOutButton } from "@/components/auth/auth-buttons";
import { requireUser } from "@/auth/require-user";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { email } = await requireUser();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <span className="font-semibold">Facturas — Análisis de gastos</span>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-sm">{email}</span>
          <SignOutButton />
        </div>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
