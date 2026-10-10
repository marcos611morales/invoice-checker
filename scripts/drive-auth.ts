/**
 * One-time owner authorization for the Drive plane (D-01).
 *
 * Run by the OWNER in their own terminal: `pnpm drive:auth`.
 * Loopback + PKCE + state. Prints DRIVE_REFRESH_TOKEN to stdout only; it never
 * writes the token (or the code / access token) to disk or logs.
 *
 * `--dry-run` prints the consent URL and exits 0 without listening.
 */
import { createServer, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";
import { CodeChallengeMethod, OAuth2Client } from "google-auth-library";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const CALLBACK_PATH = "/oauth2callback";

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const dryRun = process.argv.includes("--dry-run");
const clientId = process.env.DRIVE_CLIENT_ID;
const clientSecret = process.env.DRIVE_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  fail(
    "Faltan DRIVE_CLIENT_ID o DRIVE_CLIENT_SECRET (cliente OAuth tipo Desktop). Defínelos en .env.local y vuelve a ejecutar.",
  );
}

const state = randomUUID();

function buildClient(redirectUri: string): OAuth2Client {
  return new OAuth2Client(clientId, clientSecret, redirectUri);
}

function printInstructions(url: string): void {
  console.log(
    "Abre esta URL con la cuenta del dueño, acepta la advertencia de app no verificada y concede acceso a Drive:\n",
  );
  console.log(url);
  console.log("");
}

async function consentUrl(
  client: OAuth2Client,
): Promise<{ url: string; codeVerifier: string }> {
  const { codeVerifier, codeChallenge } =
    await client.generateCodeVerifierAsync();
  if (!codeVerifier || !codeChallenge) {
    return fail("No se pudo generar el desafío PKCE.");
  }
  const url = client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [DRIVE_SCOPE],
    state,
    code_challenge: codeChallenge,
    code_challenge_method: CodeChallengeMethod.S256,
  });
  return { url, codeVerifier };
}

async function dryRunMode(): Promise<void> {
  const client = buildClient(`http://127.0.0.1:0${CALLBACK_PATH}`);
  const { url } = await consentUrl(client);
  printInstructions(url);
}

async function interactiveMode(): Promise<void> {
  const server = createServer();
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = (server.address() as AddressInfo).port;
  const redirectUri = `http://127.0.0.1:${String(port)}${CALLBACK_PATH}`;
  const client = buildClient(redirectUri);
  const { url, codeVerifier } = await consentUrl(client);
  printInstructions(url);
  console.log(`Esperando la respuesta de Google en ${redirectUri} ...`);

  server.on("request", (req, res) => {
    void handleCallback(req.url ?? "/", res);
  });

  async function handleCallback(
    rawUrl: string,
    res: ServerResponse,
  ): Promise<void> {
    const reqUrl = new URL(rawUrl, redirectUri);
    if (reqUrl.pathname !== CALLBACK_PATH) {
      res.writeHead(404).end();
      return;
    }
    const returnedState = reqUrl.searchParams.get("state");
    const code = reqUrl.searchParams.get("code");
    if (returnedState !== state || !code) {
      reply(
        res,
        400,
        "Respuesta no válida. Vuelve a ejecutar pnpm drive:auth.",
      );
      server.close();
      fail("El parámetro state no coincide o falta el code. Abortado.");
    }
    try {
      const { tokens } = await client.getToken({ code, codeVerifier });
      reply(
        res,
        200,
        "Listo. Puedes cerrar esta pestaña y volver a la terminal.",
      );
      server.close();
      if (!tokens.refresh_token) {
        fail(
          "No llegó refresh_token: revoca el acceso previo en myaccount.google.com/permissions y vuelve a ejecutar",
        );
      }
      console.log(`DRIVE_REFRESH_TOKEN=${tokens.refresh_token}`);
      console.log(
        "Pégalo en .env.local y en Vercel (Production). No lo compartas en chats.",
      );
      process.exit(0);
    } catch {
      reply(res, 500, "No se pudo intercambiar el código. Revisa la terminal.");
      server.close();
      fail("No se pudo intercambiar el código por un token.");
    }
  }
}

function reply(res: ServerResponse, status: number, text: string): void {
  res.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
  res.end(text);
}

(dryRun ? dryRunMode() : interactiveMode()).catch(() => {
  fail("Error inesperado durante la autorización.");
});
