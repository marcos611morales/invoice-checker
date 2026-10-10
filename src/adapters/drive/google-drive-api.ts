import "server-only";
import { Readable } from "node:stream";
import type { drive_v3 } from "@googleapis/drive";
import pRetry from "p-retry";
import type { DriveApi, DriveEntry } from "@/ports/drive-api";
import { DriveError, toDriveError } from "./drive-errors";

const FILE_FIELDS =
  "id,name,mimeType,md5Checksum,modifiedTime,createdTime,size,parents,trashed";
const LIST_FIELDS = `nextPageToken,files(${FILE_FIELDS})`;

/** Builds a DriveEntry omitting absent optionals (exactOptionalPropertyTypes). */
function toEntry(f: drive_v3.Schema$File): DriveEntry {
  const entry: DriveEntry = {
    id: f.id ?? "",
    name: f.name ?? "",
    mimeType: f.mimeType ?? "",
    modifiedTime: f.modifiedTime ?? "",
  };
  if (f.md5Checksum) entry.md5Checksum = f.md5Checksum;
  if (f.createdTime) entry.createdTime = f.createdTime;
  if (f.size) entry.size = f.size;
  if (f.parents) entry.parents = f.parents;
  if (typeof f.trashed === "boolean") entry.trashed = f.trashed;
  return entry;
}

function toMediaBody(body: Uint8Array | string): string | Readable {
  return typeof body === "string" ? body : Readable.from(Buffer.from(body));
}

/**
 * Production DriveApi over `@googleapis/drive`. gaxios retries idempotent reads
 * itself but NOT PATCH/POST (RESEARCH Pitfall 5), so writes are wrapped in
 * p-retry. This is the only module that talks to the Drive SDK.
 */
export class GoogleDriveApi implements DriveApi {
  constructor(private readonly client: drive_v3.Drive) {}

  async list(q: string): Promise<DriveEntry[]> {
    try {
      const out: DriveEntry[] = [];
      let pageToken: string | undefined;
      do {
        const res = await this.client.files.list({
          q,
          pageSize: 1000,
          spaces: "drive",
          fields: LIST_FIELDS,
          ...(pageToken ? { pageToken } : {}),
        });
        for (const f of res.data.files ?? []) out.push(toEntry(f));
        pageToken = res.data.nextPageToken ?? undefined;
      } while (pageToken);
      return out;
    } catch (e) {
      throw toDriveError(e);
    }
  }

  async getMeta(fileId: string): Promise<DriveEntry> {
    try {
      const res = await this.client.files.get({ fileId, fields: FILE_FIELDS });
      return toEntry(res.data);
    } catch (e) {
      throw toDriveError(e);
    }
  }

  async getBytes(fileId: string): Promise<Uint8Array> {
    try {
      const res = await this.client.files.get(
        { fileId, alt: "media" },
        { responseType: "arraybuffer" },
      );
      return new Uint8Array(res.data as unknown as ArrayBuffer);
    } catch (e) {
      throw toDriveError(e);
    }
  }

  async createFile(args: {
    name: string;
    parentId: string;
    mimeType: string;
    body?: Uint8Array | string;
  }): Promise<DriveEntry> {
    return this.withRetry(async () => {
      const res = await this.client.files.create({
        requestBody: {
          name: args.name,
          parents: [args.parentId],
          mimeType: args.mimeType,
        },
        fields: FILE_FIELDS,
        ...(args.body === undefined
          ? {}
          : {
              media: {
                mimeType: args.mimeType,
                body: toMediaBody(args.body),
              },
            }),
      });
      return toEntry(res.data);
    });
  }

  async updateFile(
    fileId: string,
    body: Uint8Array | string,
    mimeType: string,
  ): Promise<DriveEntry> {
    return this.withRetry(async () => {
      const res = await this.client.files.update({
        fileId,
        fields: FILE_FIELDS,
        media: { mimeType, body: toMediaBody(body) },
      });
      return toEntry(res.data);
    });
  }

  async about(): Promise<{ emailAddress: string }> {
    try {
      const res = await this.client.about.get({ fields: "user(emailAddress)" });
      return { emailAddress: res.data.user?.emailAddress ?? "" };
    } catch (e) {
      throw toDriveError(e);
    }
  }

  /** Retries only errors that `toDriveError` marks retryable; always rejects with a DriveError. */
  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await pRetry(
        async () => {
          try {
            return await fn();
          } catch (e) {
            throw toDriveError(e);
          }
        },
        {
          retries: 3,
          randomize: true,
          minTimeout: 500,
          factor: 2,
          shouldRetry: ({ error }) =>
            error instanceof DriveError && error.retryable,
        },
      );
    } catch (e) {
      throw toDriveError(e);
    }
  }
}
