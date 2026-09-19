export const DISPLAY_NAME_MAX_LENGTH = 80;

export type DisplayNameValidation =
  | { ok: true; value: string }
  | { ok: false; message: string };

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
