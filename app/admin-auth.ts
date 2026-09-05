import { env } from "cloudflare:workers";

const ADMIN_COOKIE = "odiin_admin_access";
const ADMIN_CODE = "03121432";

function secureEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

function cookieValue(cookieHeader: string, name: string) {
  const match = cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return match?.slice(name.length + 1) ?? "";
}

async function sessionToken() {
  const input = new TextEncoder().encode(`odiin-admin-session:${ADMIN_CODE}`);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function isValidAdminCode(value: string) {
  return secureEqual(value.trim(), ADMIN_CODE);
}

export async function hasAdminAccess(requestHeaders: Headers) {
  const runtime = env as unknown as Record<string, string | undefined>;
  const ownerEmail = (runtime.ODIIN_OWNER_EMAIL ?? "ots.ent.g@gmail.com").toLowerCase();
  const visitorEmail = requestHeaders.get("oai-authenticated-user-email")?.trim().toLowerCase() ?? "";
  if (visitorEmail === ownerEmail) return true;

  const suppliedKey = requestHeaders.get("x-odiin-admin-key") ?? "";
  const legacyKey = runtime.ODIIN_ADMIN_KEY ?? "";
  if (isValidAdminCode(suppliedKey) || (legacyKey && secureEqual(suppliedKey, legacyKey))) return true;

  const token = cookieValue(requestHeaders.get("cookie") ?? "", ADMIN_COOKIE);
  return Boolean(token && secureEqual(token, await sessionToken()));
}

export async function adminSessionCookie() {
  return `${ADMIN_COOKIE}=${await sessionToken()}; Path=/; Max-Age=28800; HttpOnly; Secure; SameSite=Strict`;
}
