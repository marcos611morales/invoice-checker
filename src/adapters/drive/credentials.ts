import "server-only";
import { drive, type drive_v3 } from "@googleapis/drive";
import { OAuth2Client } from "google-auth-library";
import { DriveError } from "./drive-errors";

export interface DriveEnv {
  DRIVE_CLIENT_ID?: string | undefined;
  DRIVE_CLIENT_SECRET?: string | undefined;
  DRIVE_REFRESH_TOKEN?: string | undefined;
}

/**
 * Builds the Drive client from the owner's refresh token (D-01). The token only
 * ever lives in server env vars; google-auth-library refreshes the access token
 * itself, and we neither cache nor log it.
 */
export function makeDriveClient(env: DriveEnv): drive_v3.Drive {
  const id = env.DRIVE_CLIENT_ID;
  const secret = env.DRIVE_CLIENT_SECRET;
  const refreshToken = env.DRIVE_REFRESH_TOKEN;
  if (!id || !secret || !refreshToken) {
    throw new DriveError("no_configurado");
  }
  const auth = new OAuth2Client(id, secret);
  auth.setCredentials({ refresh_token: refreshToken });
  return drive({ version: "v3", auth });
}
