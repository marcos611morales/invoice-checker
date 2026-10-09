import "server-only";
import { betterAuth } from "better-auth";
import { env } from "@/env";
import { buildAuthOptions } from "@/auth/auth-config";

export const auth = betterAuth(buildAuthOptions(env));
