import { describe, expect, it } from "vitest";
import { planOrganizationMigration, resolveMigrationUrls } from "../../tools/migrate-organizations.mjs";

const spaces = [{ code: "stats", name: "Stats", organization_id: null }];
const users = [
  { id: "owner-id", email: "owner@example.com", name: "Owner" },
  { id: "editor-id", email: "editor@example.com", name: "Editor" },
];

describe("organization migration planning", () => {
  it("maps stable IDs, one owner, and pending invitations without writing", () => {
    const plan = planOrganizationMigration(spaces, [
      { space_code: "stats", email: "OWNER@example.com", role: "owner", status: "active" },
      { space_code: "stats", email: "editor@example.com", role: "editor", status: "active" },
      { space_code: "stats", email: "future@example.com", role: "editor", status: "pending" },
    ], users);

    expect(plan.errors).toEqual([]);
    expect(plan.spaceOwners.get("stats")?.userId).toBe("owner-id");
    expect(plan.mappedMemberships.map((member: { userId: string }) => member.userId)).toEqual(["owner-id", "editor-id"]);
    expect(plan.pending[0]).toMatchObject({ email: "future@example.com", inviteeUserId: null });
  });

  it("rejects unmapped identities and ambiguous ownership", () => {
    const plan = planOrganizationMigration(spaces, [
      { space_code: "stats", email: "missing@example.com", role: "owner", status: "active" },
      { space_code: "stats", email: "owner@example.com", role: "owner", status: "active" },
      { space_code: "stats", email: "editor@example.com", role: "owner", status: "active" },
    ], users);

    expect(plan.errors).toEqual(expect.arrayContaining([
      expect.stringContaining("has no auth user"),
      expect.stringContaining("exactly one is required"),
    ]));
  });

  it("is clean when rerun against the same owner's organization", () => {
    const plan = planOrganizationMigration(
      [{ ...spaces[0], organization_id: "org-1" }],
      [{ space_code: "stats", email: "owner@example.com", role: "owner", status: "active" }],
      users,
      [{ id: "org-1", personal_owner_user_id: "owner-id" }],
    );
    expect(plan.errors).toEqual([]);
  });

  it("supports separate auth and application databases", () => {
    expect(resolveMigrationUrls({
      DATABASE_OWNER_URL: "postgres://application-owner",
      DATABASE_URL: "postgres://application-runtime",
      AUTH_DATABASE_URL: "postgres://auth",
    })).toEqual({
      applicationUrl: "postgres://application-owner",
      authUrl: "postgres://auth",
    });
  });
});
