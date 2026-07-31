import { getRuntimeEnv } from "../db";

export const AUTH_SESSION_COOKIE = "lumo_session";
export const GOOGLE_STATE_COOKIE = "lumo_google_state";
export const GOOGLE_CALLBACK_PATH = "/api/auth/google/callback";
export const GOOGLE_SIGN_IN_PATH = "/api/auth/google/start";
export const GOOGLE_SIGN_OUT_PATH = "/api/auth/logout";

const encoder = new TextEncoder();

export type GoogleProfile = {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
};

export function getGoogleOAuthConfig(requestUrl: string) {
  const runtime = getRuntimeEnv();
  const clientId = runtime.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = runtime.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  const redirectUri =
    runtime.GOOGLE_OAUTH_REDIRECT_URI?.trim() ||
    `${new URL(requestUrl).origin}${GOOGLE_CALLBACK_PATH}`;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Google OAuth chưa được cấu hình. Hãy thêm GOOGLE_OAUTH_CLIENT_ID và GOOGLE_OAUTH_CLIENT_SECRET."
    );
  }

  return { clientId, clientSecret, redirectUri };
}

export function googleSignInPath(returnTo = "/") {
  return `${GOOGLE_SIGN_IN_PATH}?returnTo=${encodeURIComponent(
    safeRelativeReturnPath(returnTo)
  )}`;
}

export function safeRelativeReturnPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";

  try {
    const url = new URL(value, "https://lumo.local");
    if (url.origin !== "https://lumo.local") return "/";
    if (url.pathname.startsWith("/api/auth/")) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

export function readCookie(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName === name) return decodeURIComponent(rawValue.join("="));
  }
  return null;
}

export function createOpaqueToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return toBase64Url(bytes);
}

export async function hashOpaqueToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  return toBase64Url(new Uint8Array(digest));
}

export async function encryptGoogleRefreshToken(refreshToken: string) {
  const key = await getGoogleTokenEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(refreshToken)
  );
  return {
    encryptedRefreshToken: toBase64Url(new Uint8Array(encrypted)),
    tokenIv: toBase64Url(iv),
  };
}

export async function decryptGoogleRefreshToken(
  encryptedRefreshToken: string,
  tokenIv: string
) {
  const key = await getGoogleTokenEncryptionKey();
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64Url(tokenIv) },
    key,
    fromBase64Url(encryptedRefreshToken)
  );
  return new TextDecoder().decode(decrypted);
}

export function serializeCookie(
  name: string,
  value: string,
  options: {
    maxAge?: number;
    path?: string;
    secure?: boolean;
  } = {}
) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${options.path || "/"}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (options.secure) parts.push("Secure");
  if (typeof options.maxAge === "number") {
    parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  }
  return parts.join("; ");
}

export function isSecureRequest(request: Request) {
  return new URL(request.url).protocol === "https:";
}

export function redirectHomeWithAuthError(request: Request, message: string) {
  const url = new URL("/", request.url);
  url.searchParams.set("authError", message);
  return Response.redirect(url, 302);
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "="
  );
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function getGoogleTokenEncryptionKey() {
  const secret = getRuntimeEnv().GOOGLE_TOKEN_ENCRYPTION_KEY?.trim();
  if (!secret || secret.length < 32) {
    throw new Error(
      "GOOGLE_TOKEN_ENCRYPTION_KEY phải có ít nhất 32 ký tự để kết nối Google Calendar."
    );
  }
  const keyBytes = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}
