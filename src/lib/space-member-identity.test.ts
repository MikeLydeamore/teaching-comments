import { describe, expect, it } from "vitest";
import { parseMemberInviteIdentity } from "./space-member-identity";

describe("parseMemberInviteIdentity", () => {
  it.each(["@Jane_Smith", "Jane_Smith"])(
    "parses %s as an exact normalized username",
    (value) => {
      expect(parseMemberInviteIdentity(value)).toEqual({
        ok: true,
        kind: "username",
        username: "jane_smith",
      });
    },
  );

  it("keeps email invitations available", () => {
    expect(parseMemberInviteIdentity(" Teacher@Example.com ")).toEqual({
      ok: true,
      kind: "email",
      email: "teacher@example.com",
    });
  });

  it.each(["", "@no", "not an identity", "teacher@invalid"])(
    "rejects invalid identity %s",
    (value) => {
      expect(parseMemberInviteIdentity(value).ok).toBe(false);
    },
  );
});
