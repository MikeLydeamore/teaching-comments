export const DISPLAY_NAME_MAX_LENGTH = 80;
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;

const USERNAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_]*$/;
const RESERVED_USERNAMES = new Set([
  "admin",
  "administrator",
  "edie",
  "support",
  "system",
]);

export type DisplayNameValidation =
  | { ok: true; value: string }
  | { ok: false; message: string };

export type UsernameValidation =
  | { ok: true; username: string; displayUsername: string }
  | { ok: false; message: string };

export function isValidUsernameValue(value: string) {
  return (
    value.length >= USERNAME_MIN_LENGTH &&
    value.length <= USERNAME_MAX_LENGTH &&
    USERNAME_PATTERN.test(value) &&
    !RESERVED_USERNAMES.has(value.toLowerCase())
  );
}

export function validateUsername(value: unknown): UsernameValidation {
  if (typeof value !== "string") {
    return { ok: false, message: "Enter a username." };
  }

  const displayUsername = value.trim().replace(/^@/, "");

  if (!displayUsername) {
    return { ok: false, message: "Enter a username." };
  }

  if (
    displayUsername.length < USERNAME_MIN_LENGTH ||
    displayUsername.length > USERNAME_MAX_LENGTH
  ) {
    return {
      ok: false,
      message: `Usernames must be ${USERNAME_MIN_LENGTH}–${USERNAME_MAX_LENGTH} characters.`,
    };
  }

  if (!USERNAME_PATTERN.test(displayUsername)) {
    return {
      ok: false,
      message:
        "Use letters, numbers, and underscores, starting with a letter or number.",
    };
  }

  const username = displayUsername.toLowerCase();

  if (RESERVED_USERNAMES.has(username)) {
    return { ok: false, message: "That username is reserved." };
  }

  return { ok: true, username, displayUsername };
}

export function validateDisplayName(value: unknown): DisplayNameValidation {
  if (typeof value !== "string") {
    return { ok: false, message: "Enter a display name." };
  }

  const displayName = value.trim();

  if (!displayName) {
    return { ok: false, message: "Enter a display name." };
  }

  if (displayName.length > DISPLAY_NAME_MAX_LENGTH) {
    return {
      ok: false,
      message: `Display names must be ${DISPLAY_NAME_MAX_LENGTH} characters or fewer.`,
    };
  }

  if (/\p{Cc}/u.test(displayName)) {
    return { ok: false, message: "Display names cannot contain line breaks or control characters." };
  }

  return { ok: true, value: displayName };
}
