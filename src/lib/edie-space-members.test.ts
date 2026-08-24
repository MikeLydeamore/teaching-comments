import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryMock, neonMock, fsMock } = vi.hoisted(() => ({
  neonMock: vi.fn(),
  queryMock: vi.fn(),
  fsMock: {
    mkdir: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
  },
}));

vi.mock("server-only", () => ({}));
vi.mock("@neondatabase/serverless", () => ({ neon: neonMock }));
vi.mock("node:fs/promises", () => fsMock);

import { localStore } from "./edie-local-store";
import { neonStore } from "./edie-neon-store";

const memberRow = {
  space_code: "stats-101",
  email: "owner@example.com",
  role: "owner",
  status: "active",
  created_at: new Date("2026-01-02T03:04:06.000Z"),
};

function seededLocalData() {
  return {
    groupQuestions: [],
    pollResponses: [],
    pollQuestionBank: [],
    polls: [],
    promptHistory: [],
    questionBank: [],
    sessions: [],
    submissions: [],
    teacherSpaces: [
      {
        code: "stats-101",
        name: "Stats 101",
        pinHash: "scrypt:salt:hash",
        createdAt: "2026-01-02T03:04:05.000Z",
      },
    ],
    spaceMembers: [
      {
        spaceCode: "stats-101",
        email: "owner@example.com",
        role: "owner",
        createdAt: "2026-01-02T03:04:06.000Z",
      },
    ],
  };
}

beforeEach(() => {
  process.env.DATABASE_URL = "postgresql://test.invalid/test";
  neonMock.mockReset();
  queryMock.mockReset();
  neonMock.mockReturnValue({ query: queryMock });
  fsMock.mkdir.mockReset();
  fsMock.readFile.mockReset();
  fsMock.writeFile.mockReset();
  fsMock.writeFile.mockResolvedValue(undefined);
});

describe("space membership (Neon backend)", () => {
  beforeEach(() => {
    queryMock.mockImplementation(
      async (statement: string, values: unknown[] = []) => {
        if (statement.includes("m.status = 'pending'")) {
          return [{
            code: "stats-101",
            name: "Stats 101",
            created_at: new Date("2026-01-02T03:04:05.000Z"),
            role: "editor",
            invited_at: new Date("2026-01-02T03:04:06.000Z"),
          }];
        }
        if (statement.startsWith("SELECT s.code")) {
          return [{
            code: "stats-101",
            name: "Stats 101",
            created_at: new Date("2026-01-02T03:04:05.000Z"),
            role: "owner",
          }];
        }
        if (statement.startsWith("SELECT role FROM edie_space_members")) {
          return [{ role: "owner" }];
        }
        if (statement.startsWith("SELECT space_code, email")) {
          return [memberRow];
        }
        if (statement.startsWith("SELECT 1 FROM edie_teacher_spaces")) {
          return [{ "?column?": 1 }];
        }
        if (statement.startsWith("INSERT INTO edie_space_members")) {
          return [{ ...memberRow, email: String(values[1]), role: String(values[2]), status: String(values[3]) }];
        }
        if (statement.startsWith("UPDATE edie_space_members SET status")) {
          return [{ space_code: "stats-101" }];
        }
        if (statement.startsWith("UPDATE edie_space_members SET role")) {
          return [{ ...memberRow, role: "editor" }];
        }
        if (statement.startsWith("DELETE FROM edie_space_members")) {
          return values[1] === "owner@example.com"
            ? [{ space_code: "stats-101" }]
            : [];
        }
        return [];
      },
    );
  });

  it("lists spaces joined with the member role", async () => {
    const spaces = await neonStore.listTeacherSpacesForUser(
      "Owner@Example.com",
    );

    expect(spaces).toEqual([
      {
        code: "stats-101",
        name: "Stats 101",
        createdAt: "2026-01-02T03:04:05.000Z",
        role: "owner",
      },
    ]);
    const call = queryMock.mock.calls.find(([statement]) =>
      String(statement).startsWith("SELECT s.code"),
    );
    expect(call?.[1]).toEqual(["owner@example.com"]);
    expect(call?.[0]).toContain("m.status = 'active'");
  });

  it("lists pending invitations separately from active spaces", async () => {
    const invitations = await neonStore.listPendingSpaceInvitationsForUser(
      "Invitee@Example.com",
    );

    expect(invitations).toEqual([{
      code: "stats-101",
      name: "Stats 101",
      createdAt: "2026-01-02T03:04:05.000Z",
      role: "editor",
      invitedAt: "2026-01-02T03:04:06.000Z",
    }]);
    const call = queryMock.mock.calls.find(([statement]) =>
      String(statement).includes("m.status = 'pending'"),
    );
    expect(call?.[1]).toEqual(["invitee@example.com"]);
  });

  it("normalizes emails and returns the role", async () => {
    const role = await neonStore.getSpaceMemberRole(
      "Stats-101",
      "OWNER@example.com",
    );

    expect(role).toBe("owner");
    const call = queryMock.mock.calls.find(([statement]) =>
      String(statement).startsWith("SELECT role FROM edie_space_members"),
    );
    expect(call?.[1]).toEqual(["stats-101", "owner@example.com"]);
    expect(call?.[0]).toContain("status = 'active'");
  });

  it("creates pending invitations by default", async () => {
    const member = await neonStore.addSpaceMember(
      "stats-101",
      "Guest@Example.com",
    );

    expect(member.status).toBe("pending");
    const call = queryMock.mock.calls.find(([statement]) =>
      String(statement).startsWith("INSERT INTO edie_space_members"),
    );
    expect(call?.[1]).toEqual([
      "stats-101",
      "guest@example.com",
      "editor",
      "pending",
    ]);
  });

  it("conditions invite responses and leaving on membership status", async () => {
    await expect(
      neonStore.acceptSpaceInvitation("stats-101", "owner@example.com"),
    ).resolves.toBe(true);
    await expect(
      neonStore.declineSpaceInvitation("stats-101", "owner@example.com"),
    ).resolves.toBe(true);
    await expect(
      neonStore.leaveSpace("stats-101", "owner@example.com"),
    ).resolves.toBe(true);

    const statements = queryMock.mock.calls.map(([statement]) => String(statement));
    expect(statements).toContainEqual(expect.stringContaining("status = 'pending'"));
    expect(statements).toContainEqual(expect.stringContaining("member.status = 'active'"));
    expect(statements).toContainEqual(expect.stringContaining("other.role = 'owner'"));
  });

  it("rejects an unknown role on update", async () => {
    await expect(
      neonStore.updateSpaceMemberRole("stats-101", "owner@example.com", "admin" as never),
    ).rejects.toThrow("Unknown space role.");
  });

  it("reports removal success by deleted row count", async () => {
    await expect(
      neonStore.removeSpaceMember("stats-101", "owner@example.com"),
    ).resolves.toBe(true);
    await expect(
      neonStore.removeSpaceMember("stats-101", "missing@example.com"),
    ).resolves.toBe(false);
  });

  it("maps duplicate membership inserts to a friendly error", async () => {
    const conflict = Object.assign(new Error("dup"), { code: "23505" });
    queryMock.mockImplementation(async (statement: string) => {
      if (statement.startsWith("SELECT 1 FROM edie_teacher_spaces")) {
        return [{ "?column?": 1 }];
      }
      throw conflict;
    });

    await expect(
      neonStore.addSpaceMember("stats-101", "owner@example.com"),
    ).rejects.toThrow("That person is already a member of this space.");
  });
});

describe("space membership (local JSON backend)", () => {
  let persisted: string | null;

  beforeEach(() => {
    persisted = JSON.stringify(seededLocalData());
    fsMock.readFile.mockImplementation(async () => {
      if (persisted === null) {
        const error = new Error("no file") as NodeJS.ErrnoException;
        error.code = "ENOENT";
        throw error;
      }
      return persisted;
    });
    fsMock.writeFile.mockImplementation(async (_path: unknown, data: string) => {
      persisted = data;
    });
  });

  it("adds, lists, updates, and removes members", async () => {
    const invitation = await localStore.addSpaceMember(
      "stats-101",
      "Guest@Example.com",
    );
    expect(invitation.status).toBe("pending");

    let members = await localStore.listSpaceMembers("stats-101");
    expect(members).toHaveLength(2);
    expect(members.map((member) => member.email)).toEqual([
      "guest@example.com",
      "owner@example.com",
    ]);

    await localStore.updateSpaceMemberRole(
      "stats-101",
      "guest@example.com",
      "owner",
    );
    members = await localStore.listSpaceMembers("stats-101");
    expect(members.find((member) => member.email === "guest@example.com")?.role).toBe(
      "owner",
    );

    await expect(
      localStore.addSpaceMember("stats-101", "guest@example.com"),
    ).rejects.toThrow("That person is already a member of this space.");

    await expect(
      localStore.removeSpaceMember("stats-101", "guest@example.com"),
    ).resolves.toBe(true);
    members = await localStore.listSpaceMembers("stats-101");
    expect(members).toHaveLength(1);
  });

  it("refuses to add a member to an unknown space", async () => {
    await expect(
      localStore.addSpaceMember("nowhere", "guest@example.com"),
    ).rejects.toThrow("That space could not be found.");
  });

  it("lists only spaces where the user has a membership row", async () => {
    await localStore.createTeacherSpace("other-space", "Other Space");

    const spaces = await localStore.listTeacherSpacesForUser(
      "owner@example.com",
    );
    expect(spaces.map((space) => space.code)).toEqual(["stats-101"]);
    expect(spaces[0].role).toBe("owner");
  });

  it("keeps pending invitations out of access checks until accepted", async () => {
    await localStore.addSpaceMember("stats-101", "guest@example.com");

    await expect(
      localStore.getSpaceMemberRole("stats-101", "guest@example.com"),
    ).resolves.toBeNull();
    await expect(
      localStore.listTeacherSpacesForUser("guest@example.com"),
    ).resolves.toEqual([]);
    await expect(
      localStore.listPendingSpaceInvitationsForUser("guest@example.com"),
    ).resolves.toEqual([
      expect.objectContaining({
        code: "stats-101",
        role: "editor",
      }),
    ]);

    await expect(
      localStore.acceptSpaceInvitation("stats-101", "guest@example.com"),
    ).resolves.toBe(true);
    await expect(
      localStore.getSpaceMemberRole("stats-101", "guest@example.com"),
    ).resolves.toBe("editor");
    await expect(
      localStore.listPendingSpaceInvitationsForUser("guest@example.com"),
    ).resolves.toEqual([]);
  });

  it("declines pending invitations and prevents the last owner from leaving", async () => {
    await localStore.addSpaceMember("stats-101", "guest@example.com");
    await expect(
      localStore.leaveSpace("stats-101", "guest@example.com"),
    ).resolves.toBe(false);
    await expect(
      localStore.declineSpaceInvitation("stats-101", "guest@example.com"),
    ).resolves.toBe(true);
    await expect(
      localStore.acceptSpaceInvitation("stats-101", "guest@example.com"),
    ).resolves.toBe(false);

    await localStore.addSpaceMember(
      "stats-101",
      "guest@example.com",
      "editor",
      "active",
    );
    await expect(
      localStore.leaveSpace("stats-101", "guest@example.com"),
    ).resolves.toBe(true);
    await expect(
      localStore.leaveSpace("stats-101", "owner@example.com"),
    ).resolves.toBe(false);

    await localStore.addSpaceMember(
      "stats-101",
      "co-owner@example.com",
      "owner",
      "active",
    );
    await expect(
      localStore.leaveSpace("stats-101", "owner@example.com"),
    ).resolves.toBe(true);
  });
});
