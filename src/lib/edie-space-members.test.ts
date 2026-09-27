import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryMock, neonMock, fsMock } = vi.hoisted(() => ({
  neonMock: vi.fn(), queryMock: vi.fn(),
  fsMock: { mkdir: vi.fn(), readFile: vi.fn(), writeFile: vi.fn() },
}));

vi.mock("server-only", () => ({}));
vi.mock("@neondatabase/serverless", () => ({ neon: neonMock }));
vi.mock("node:fs/promises", () => fsMock);

import { localStore } from "./edie-local-store";
import { neonStore } from "./edie-neon-store";
import { EntitlementLimitError } from "./entitlement-model";

const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function seededLocalData() {
  return {
    groupQuestions: [], pollResponses: [], pollQuestionBank: [], polls: [],
    promptHistory: [], questionBank: [], sessions: [], submissions: [],
    submissionViewSettings: [],
    organizations: [{ id: organizationId, name: "Owner's organization", kind: "personal", personalOwnerUserId: "user-owner", createdAt: "2026-01-02T03:04:04.000Z" }],
    teacherSpaces: [{ code: "stats-101", name: "Stats 101", organizationId, createdAt: "2026-01-02T03:04:05.000Z" }],
    spaceMembers: [{ spaceCode: "stats-101", userId: "user-owner", role: "owner", createdAt: "2026-01-02T03:04:06.000Z" }],
    spaceInvitations: [],
  };
}

beforeEach(() => {
  process.env.DATABASE_URL = "postgresql://test.invalid/test";
  queryMock.mockReset(); neonMock.mockReset();
  neonMock.mockReturnValue({
    query: queryMock,
    transaction: async (callback: (tx: { query: typeof queryMock }) => Promise<unknown>[]) =>
      Promise.all(callback({ query: queryMock })),
  });
  fsMock.mkdir.mockReset(); fsMock.readFile.mockReset(); fsMock.writeFile.mockReset();
});

describe("space membership (Neon backend)", () => {
  beforeEach(() => {
    queryMock.mockImplementation(async (statement: string) => {
      if (statement.startsWith("SELECT s.code") && statement.includes("edie_space_invitations")) return [{ code: "stats-101", name: "Stats 101", organization_id: organizationId, created_at: new Date("2026-01-02T03:04:05.000Z"), role: "editor", invited_at: new Date("2026-01-02T03:04:06.000Z") }];
      if (statement.startsWith("SELECT s.code")) return [{ code: "stats-101", name: "Stats 101", organization_id: organizationId, created_at: new Date("2026-01-02T03:04:05.000Z"), role: "owner" }];
      if (statement.includes("SELECT member.role")) return [{ role: "owner" }];
      if (statement.includes("INSERT INTO edie_teacher_spaces") && statement.includes("created_space")) return [{ code: "new-space", name: "New Space", organization_id: organizationId, created_at: new Date("2026-01-02T03:04:05.000Z") }];
      if (statement.includes("INSERT INTO edie_organizations")) return [{ id: organizationId, name: "Owner's organization", kind: "personal", personal_owner_user_id: "user-owner", created_at: new Date("2026-01-02T03:04:04.000Z") }];
      if (statement.includes("INSERT INTO edie_space_invitations")) return [{ space_code: "stats-101", email: "guest@example.com", invitee_user_id: "user-guest", role: "editor", created_at: new Date("2026-01-02T03:04:06.000Z") }];
      if (statement.includes("DELETE FROM edie_space_invitations")) return [{ space_code: "stats-101" }];
      return [];
    });
  });

  it("keys space access by stable user ID and returns organization context", async () => {
    const spaces = await neonStore.listTeacherSpacesForUser("user-owner");
    expect(spaces).toEqual([expect.objectContaining({ code: "stats-101", organizationId, role: "owner" })]);
    expect(queryMock.mock.calls.find(([sql]) => String(sql).startsWith("SELECT s.code"))?.[1]).toEqual(["user-owner"]);
    await expect(neonStore.getSpaceMemberRole("stats-101", "user-owner")).resolves.toBe("owner");
  });

  it("lists and accepts separated invitations using ID or normalized email", async () => {
    await expect(neonStore.listPendingSpaceInvitationsForUser("user-guest", "Guest@Example.com")).resolves.toEqual([expect.objectContaining({ code: "stats-101", organizationId, role: "editor" })]);
    await expect(neonStore.acceptSpaceInvitation("stats-101", "user-guest", "Guest@Example.com")).resolves.toBe(true);
    const acceptance = queryMock.mock.calls.map(([sql]) => String(sql)).find((sql) => sql.includes("ON CONFLICT (space_code, user_id)"));
    expect(acceptance).toContain("invitee_user_id = $2 OR email = $3");
    expect(acceptance).toContain("INSERT INTO edie_space_members (space_code, user_id, role)");
    expect(acceptance).not.toContain("status");
  });

  it("creates a personal organization, space, and owner in one statement", async () => {
    const space = await neonStore.createTeacherSpaceForOwner("new-space", "New Space", { userId: "user-owner", name: "Owner" });
    expect(space.organizationId).toBe(organizationId);
    const call = queryMock.mock.calls.find(([sql]) => String(sql).includes("created_space"));
    expect(call?.[0]).toContain("membership AS");
    expect(call?.[0]).toContain("INSERT INTO edie_space_members (space_code, user_id, role)");
    expect(call?.[0]).not.toContain("email, role, status");
    expect(call?.[1]).toEqual(["new-space", "New Space", "Owner's organization", "user-owner", null]);
  });

  it("keeps pending invitations out of the membership table", async () => {
    const invitation = await neonStore.inviteSpaceMember("stats-101", "Guest@Example.com", "user-guest");
    expect(invitation).toMatchObject({ email: "guest@example.com", userId: "user-guest" });
    expect(queryMock.mock.calls.at(-1)?.[0]).not.toContain("edie_space_members (");
  });
});

describe("space membership (local JSON backend)", () => {
  let persisted: string;

  beforeEach(() => {
    persisted = JSON.stringify(seededLocalData());
    fsMock.readFile.mockImplementation(async () => persisted);
    fsMock.writeFile.mockImplementation(async (_path: unknown, data: string) => { persisted = data; });
  });

  it("provisions one personal organization under concurrent retries", async () => {
    const [left, right] = await Promise.all([
      localStore.ensurePersonalOrganization("user-new", "New Teacher"),
      localStore.ensurePersonalOrganization("user-new", "New Teacher"),
    ]);
    expect(left.id).toBe(right.id);
    const data = JSON.parse(persisted);
    expect(data.organizations.filter((item: { personalOwnerUserId: string }) => item.personalOwnerUserId === "user-new")).toHaveLength(1);
  });

  it("creates a space with its organization and owner atomically", async () => {
    const space = await localStore.createTeacherSpaceForOwner("new-space", "New Space", { userId: "user-new", name: "New Teacher" });
    expect(space.organizationId).toBeTruthy();
    await expect(localStore.getSpaceMemberRole("new-space", "user-new")).resolves.toBe("owner");
  });

  it("keeps invitations out of access until the matching user accepts", async () => {
    await localStore.inviteSpaceMember("stats-101", "guest@example.com", "user-guest", "editor");
    await expect(localStore.getSpaceMemberRole("stats-101", "user-guest")).resolves.toBeNull();
    await expect(localStore.listPendingSpaceInvitationsForUser("user-guest", "changed@example.com")).resolves.toHaveLength(1);
    await expect(localStore.acceptSpaceInvitation("stats-101", "user-guest", "changed@example.com")).resolves.toBe(true);
    await expect(localStore.getSpaceMemberRole("stats-101", "user-guest")).resolves.toBe("editor");
  });

  it("does not match an email-only invitation without a verified email", async () => {
    await localStore.inviteSpaceMember(
      "stats-101",
      "guest@example.com",
      null,
      "editor",
    );

    await expect(
      localStore.listPendingSpaceInvitationsForUser("user-guest", null),
    ).resolves.toEqual([]);
    await expect(
      localStore.acceptSpaceInvitation("stats-101", "user-guest", null),
    ).resolves.toBe(false);
    await expect(
      localStore.acceptSpaceInvitation(
        "stats-101",
        "user-guest",
        "Guest@Example.com",
      ),
    ).resolves.toBe(true);
  });

  it("does not move a space when another member becomes owner", async () => {
    await localStore.addSpaceMember("stats-101", "user-guest", "editor");
    await localStore.updateSpaceMemberRole("stats-101", "user-guest", "owner");
    expect((await localStore.getTeacherSpace("stats-101"))?.organizationId).toBe(organizationId);
    await expect(localStore.listTeacherSpacesForUser("user-guest")).resolves.toEqual([expect.objectContaining({ code: "stats-101", organizationId, role: "owner" })]);
  });

  it("allows collaboration across organizations without granting sibling-space access", async () => {
    await localStore.createTeacherSpaceForOwner("science", "Science", { userId: "science-owner", name: "Science Owner" });
    await localStore.createTeacherSpaceForOwner("private-science", "Private Science", { userId: "science-owner", name: "Science Owner" });
    await localStore.addSpaceMember("science", "user-guest", "editor");

    const spaces = await localStore.listTeacherSpacesForUser("user-guest");
    expect(spaces.map((space) => space.code)).toEqual(["science"]);
    expect(spaces[0].organizationId).not.toBe(organizationId);
  });

  it("counts one organization seat across several spaces", async () => {
    await localStore.createTeacherSpaceForOwner("stats-102", "Stats 102", {
      userId: "user-owner",
      name: "Owner",
    });
    await localStore.addSpaceMember("stats-101", "user-guest", "editor", 2);
    await expect(
      localStore.addSpaceMember("stats-102", "user-guest", "editor", 2),
    ).resolves.toMatchObject({ userId: "user-guest" });
    await expect(localStore.listOrganizationMembers(organizationId)).resolves.toHaveLength(2);
  });

  it("serializes concurrent seat consumption", async () => {
    const results = await Promise.allSettled([
      localStore.addSpaceMember("stats-101", "user-a", "editor", 2),
      localStore.addSpaceMember("stats-101", "user-b", "editor", 2),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejection = results.find((result) => result.status === "rejected") as PromiseRejectedResult;
    expect(rejection.reason).toBeInstanceOf(EntitlementLimitError);
  });

  it("leaves an invitation pending when acceptance exceeds the seat limit", async () => {
    await localStore.inviteSpaceMember("stats-101", "guest@example.com", "user-guest");
    await expect(
      localStore.acceptSpaceInvitation("stats-101", "user-guest", "guest@example.com", 1),
    ).rejects.toBeInstanceOf(EntitlementLimitError);
    await expect(
      localStore.listPendingSpaceInvitationsForUser("user-guest", "guest@example.com"),
    ).resolves.toHaveLength(1);
  });

  it("serializes concurrent space creation", async () => {
    const results = await Promise.allSettled([
      localStore.createTeacherSpaceForOwner("new-a", "New A", { userId: "user-owner", name: "Owner" }, 2),
      localStore.createTeacherSpaceForOwner("new-b", "New B", { userId: "user-owner", name: "Owner" }, 2),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejection = results.find((result) => result.status === "rejected") as PromiseRejectedResult;
    expect(rejection.reason).toBeInstanceOf(EntitlementLimitError);
  });

  it("requires organization membership as well as space membership", async () => {
    const data = JSON.parse(persisted);
    data.organizationMembers = [{
      organizationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      userId: "someone-else",
      role: "member",
      createdAt: "2026-01-02T03:04:06.000Z",
    }];
    persisted = JSON.stringify(data);
    await expect(localStore.getSpaceMemberRole("stats-101", "user-owner")).resolves.toBeNull();
  });

  it("releases a non-owner seat after its last space assignment is removed", async () => {
    await localStore.addSpaceMember("stats-101", "user-guest", "editor", 2);
    await expect(localStore.listOrganizationMembers(organizationId)).resolves.toHaveLength(2);
    await localStore.removeSpaceMember("stats-101", "user-guest");
    await expect(localStore.listOrganizationMembers(organizationId)).resolves.toHaveLength(1);
  });

  it("removes a seat and all of its organization space access", async () => {
    await localStore.createTeacherSpaceForOwner("stats-102", "Stats 102", {
      userId: "user-owner",
      name: "Owner",
    });
    await localStore.addSpaceMember("stats-101", "user-guest", "editor", 2);
    await localStore.addSpaceMember("stats-102", "user-guest", "editor", 2);
    await expect(
      localStore.removeOrganizationMember(organizationId, "user-guest"),
    ).resolves.toBe(true);
    await expect(localStore.getSpaceMemberRole("stats-101", "user-guest")).resolves.toBeNull();
    await expect(localStore.getSpaceMemberRole("stats-102", "user-guest")).resolves.toBeNull();
    await expect(localStore.listOrganizationMembers(organizationId)).resolves.toHaveLength(1);
  });

  it("protects organization owners from seat removal", async () => {
    await expect(
      localStore.removeOrganizationMember(organizationId, "user-owner"),
    ).resolves.toBe(false);
    await expect(localStore.getSpaceMemberRole("stats-101", "user-owner")).resolves.toBe("owner");
  });

  it("protects the sole owner of a space from organization removal", async () => {
    await localStore.addSpaceMember("stats-101", "user-guest", "owner", 2);
    await localStore.updateSpaceMemberRole("stats-101", "user-owner", "editor");
    await expect(
      localStore.removeOrganizationMember(organizationId, "user-guest"),
    ).resolves.toBe(false);
    await expect(localStore.getSpaceMemberRole("stats-101", "user-guest")).resolves.toBe("owner");
  });
});
