/**
 * Port over Google Drive. Pure: no imports from adapters. The production
 * implementation is `GoogleDriveApi`; tests use an in-memory fake (STOR-03).
 */

export const FOLDER_MIME = "application/vnd.google-apps.folder";
export const SHORTCUT_MIME = "application/vnd.google-apps.shortcut";

/** Drive ids are URL-safe base64-ish tokens; anything else never reaches a `q`. */
export const DRIVE_ID_PATTERN = /^[A-Za-z0-9_-]{10,}$/;

export function isDriveId(s: string): boolean {
  return DRIVE_ID_PATTERN.test(s);
}

export interface DriveEntry {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  md5Checksum?: string;
  createdTime?: string;
  size?: string;
  parents?: string[];
  trashed?: boolean;
}

export interface DriveApi {
  /** Follows `nextPageToken` (pageSize 1000) and returns every match. */
  list(q: string): Promise<DriveEntry[]>;
  getMeta(fileId: string): Promise<DriveEntry>;
  /** `alt=media` download. */
  getBytes(fileId: string): Promise<Uint8Array>;
  createFile(args: {
    name: string;
    parentId: string;
    mimeType: string;
    body?: Uint8Array | string;
  }): Promise<DriveEntry>;
  /** Media update of an existing file. */
  updateFile(
    fileId: string,
    body: Uint8Array | string,
    mimeType: string,
  ): Promise<DriveEntry>;
  about(): Promise<{ emailAddress: string }>;
}
