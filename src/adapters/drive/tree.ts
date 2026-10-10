import {
  FOLDER_MIME,
  SHORTCUT_MIME,
  isDriveId,
  type DriveApi,
  type DriveEntry,
} from "@/ports/drive-api";

export interface XmlTree {
  files: DriveEntry[];
  ignoredShortcuts: number;
  ignoredNative: number;
}

/** Name of the app's own working folder; never walked for invoices. */
const APP_FOLDER_NAME = "_app";
const GOOGLE_NATIVE_PREFIX = "application/vnd.google-apps.";

/**
 * Query for the direct, non-trashed children of a folder. The id is validated
 * so no quote or operator can reach the `q` string (T-01-10).
 */
export function folderChildrenQuery(folderId: string): string {
  if (!isDriveId(folderId)) {
    throw new Error("Identificador de carpeta de Drive no válido.");
  }
  return `'${folderId}' in parents and trashed = false`;
}

/**
 * Breadth-first walk from `rootFolderId`: collects `.xml` files in every
 * subfolder (year folders), skips the `_app` folder, counts and skips shortcuts
 * and Google-native files, and ignores PDFs (Phase 2 pairs them).
 */
export async function listXmlTree(
  api: DriveApi,
  rootFolderId: string,
): Promise<XmlTree> {
  const files: DriveEntry[] = [];
  let ignoredShortcuts = 0;
  let ignoredNative = 0;
  const seenFolders = new Set<string>([rootFolderId]);
  const queue: string[] = [rootFolderId];

  for (let folderId = queue.shift(); folderId; folderId = queue.shift()) {
    const children = await api.list(folderChildrenQuery(folderId));
    for (const child of children) {
      if (child.mimeType === FOLDER_MIME) {
        if (child.name !== APP_FOLDER_NAME && !seenFolders.has(child.id)) {
          seenFolders.add(child.id);
          queue.push(child.id);
        }
      } else if (child.mimeType === SHORTCUT_MIME) {
        ignoredShortcuts += 1;
      } else if (child.mimeType.startsWith(GOOGLE_NATIVE_PREFIX)) {
        ignoredNative += 1;
      } else if (child.name.toLowerCase().endsWith(".xml")) {
        files.push(child);
      }
    }
  }

  files.sort((a, b) => {
    if (a.name !== b.name) return a.name < b.name ? -1 : 1;
    if (a.id === b.id) return 0;
    return a.id < b.id ? -1 : 1;
  });
  return { files, ignoredShortcuts, ignoredNative };
}
