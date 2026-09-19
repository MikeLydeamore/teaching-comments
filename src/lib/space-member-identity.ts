import { normalizeSpaceEmail } from "./edie-store-model";
import { validateUsername } from "./user-profile";

export type MemberInviteIdentity =
  | { ok: true; kind: "email"; email: string }
  | { ok: true; kind: "username"; username: string }
  | { ok: false; message: string };

export function parseMemberInviteIdentity(value: unknown): MemberInviteIdentity {
  if (typeof value !== "string" || !value.trim()) {
    return { ok: false, message: "Enter a username or email address." };
  }

  const trimmed = value.trim();

  if (trimmed.startsWith("@") || !trimmed.includes("@")) {
    const username = validateUsername(trimmed);
    return username.ok
      ? { ok: true, kind: "username", username: username.username }
      : username;
  }

  try {
    return { ok: true, kind: "email", email: normalizeSpaceEmail(trimmed) };
  } catch {
    return { ok: false, message: "Enter a valid username or email address." };
  }
}
