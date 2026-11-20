import { createHash, randomBytes } from "node:crypto";

/** A bearer token: 32 random bytes, base64url. Only its SHA-256 is stored. */
export const newToken = () => randomBytes(32).toString("base64url");
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
