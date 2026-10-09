"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { authClient } from "@/auth/client";

export function SignInButton({
  label = "Iniciar sesión con Google",
}: {
  label?: string;
}) {
  return (
    <Button
      size="lg"
      onClick={() => {
        void authClient.signIn.social({ provider: "google", callbackURL: "/" });
      }}
    >
      {label}
    </Button>
  );
}

export function SignOutButton({
  label = "Cerrar sesión",
  variant = "outline",
}: {
  label?: string;
  variant?: "outline" | "default" | "ghost";
}) {
  const router = useRouter();
  return (
    <Button
      variant={variant}
      onClick={() => {
        void authClient.signOut().then(() => {
          router.replace("/login");
        });
      }}
    >
      {label}
    </Button>
  );
}

/** Signs out, then starts Google sign-in with the account picker. */
export function SwitchAccountButton({
  label = "Usar otra cuenta",
}: {
  label?: string;
}) {
  return (
    <Button
      onClick={() => {
        void authClient.signOut().then(() => {
          void authClient.signIn.social({ provider: "google", callbackURL: "/" });
        });
      }}
    >
      {label}
    </Button>
  );
}
