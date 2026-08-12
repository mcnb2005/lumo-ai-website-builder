const encoder = new TextEncoder();
const PASSWORD_HASH_VERSION = "pbkdf2_sha256";
const PASSWORD_ITERATIONS = 210_000;
const PASSWORD_KEY_BITS = 256;
const TEMP_PASSWORD_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";

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

async function derivePasswordHash(
  password: string,
  salt: Uint8Array,
  iterations: number
) {
  const saltBytes = new Uint8Array(salt.byteLength);
  saltBytes.set(salt);
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: saltBytes,
      iterations,
    },
    keyMaterial,
    PASSWORD_KEY_BITS
  );
  return new Uint8Array(bits);
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

export function generateTemporaryPassword(length = 14) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let password = "";
  for (const byte of bytes) {
    password += TEMP_PASSWORD_ALPHABET[byte % TEMP_PASSWORD_ALPHABET.length];
  }
  return password;
}

export function isAcceptablePassword(password: string) {
  return password.length >= 8;
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePasswordHash(password, salt, PASSWORD_ITERATIONS);
  return [
    PASSWORD_HASH_VERSION,
    String(PASSWORD_ITERATIONS),
    toBase64Url(salt),
    toBase64Url(hash),
  ].join("$");
}

export async function verifyPassword(password: string, storedHash: string) {
  const [version, rawIterations, rawSalt, rawHash] = storedHash.split("$");
  const iterations = Number(rawIterations);
  if (
    version !== PASSWORD_HASH_VERSION ||
    !Number.isInteger(iterations) ||
    iterations < 100_000 ||
    !rawSalt ||
    !rawHash
  ) {
    return false;
  }

  const salt = fromBase64Url(rawSalt);
  const expected = fromBase64Url(rawHash);
  const actual = await derivePasswordHash(password, salt, iterations);
  return timingSafeEqual(actual, expected);
}
