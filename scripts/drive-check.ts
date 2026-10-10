/**
 * Read-only real-Drive diagnostic: `pnpm drive:check [--folder <id|url>]`.
 * Prints the token owner's account and the XML count under the folder. Never
 * prints env values.
 */
import { makeDriveClient } from "../src/adapters/drive/credentials";
import { DriveError, toDriveError } from "../src/adapters/drive/drive-errors";
import { GoogleDriveApi } from "../src/adapters/drive/google-drive-api";
import { listXmlTree } from "../src/adapters/drive/tree";

/** Accepts a bare id or a `.../folders/<id>` URL. */
function extractFolderId(input: string): string {
  const match = /\/folders\/([A-Za-z0-9_-]+)/.exec(input);
  return match?.[1] ?? input.trim();
}

function folderArg(): string | undefined {
  const idx = process.argv.indexOf("--folder");
  const fromFlag = idx >= 0 ? process.argv[idx + 1] : undefined;
  return fromFlag ?? process.env.DRIVE_FOLDER_ID;
}

async function main(): Promise<void> {
  const api = new GoogleDriveApi(
    makeDriveClient({
      DRIVE_CLIENT_ID: process.env.DRIVE_CLIENT_ID,
      DRIVE_CLIENT_SECRET: process.env.DRIVE_CLIENT_SECRET,
      DRIVE_REFRESH_TOKEN: process.env.DRIVE_REFRESH_TOKEN,
    }),
  );
  const { emailAddress } = await api.about();
  console.log(`Cuenta: ${emailAddress}`);

  const rawFolder = folderArg();
  if (!rawFolder) return;
  const folderId = extractFolderId(rawFolder);

  const meta = await api.getMeta(folderId);
  console.log(`Carpeta: ${meta.name}`);
  const tree = await listXmlTree(api, folderId);
  console.log(
    `XML encontrados: ${String(tree.files.length)} (incluye subcarpetas)`,
  );
  console.log(
    `Atajos ignorados: ${String(tree.ignoredShortcuts)}; archivos nativos de Google ignorados: ${String(tree.ignoredNative)}`,
  );
}

main().catch((err: unknown) => {
  const e = err instanceof DriveError ? err : toDriveError(err);
  console.error(`${e.code}: ${e.mensaje}`);
  process.exit(2);
});
