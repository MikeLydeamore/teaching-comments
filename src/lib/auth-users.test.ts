import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("pg", () => ({
  Pool: class {
    query = mocks.query;
  },
}));
vi.mock("./auth-database-url", () => ({
  resolveAuthDatabaseUrl: () => "postgres://auth.test/edie",
}));

import {
  findUserProfileById,
  findUserProfileByUsername,
  findUserProfilesByEmail,
} from "./auth-users";

const profile = {
  id: "user-1",
  email: "private@example.com",
  name: "Private Teacher",
  image: null,
  username: "private_teacher",
  displayUsername: "Private_Teacher",
};

describe("auth user profile lookups", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.query.mockResolvedValue({ rows: [profile] });
  });

  it("looks up usernames exactly by their canonical lowercase value", async () => {
    await expect(findUserProfileByUsername("Private_Teacher")).resolves.toEqual(profile);
    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE username = $1"),
      ["private_teacher"],
    );
  });

  it("resolves an opaque account ID server-side", async () => {
    await expect(findUserProfileById("user-1")).resolves.toEqual(profile);
    expect(mocks.query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE id = $1"),
      ["user-1"],
    );
  });

  it("fails closed when bulk member profiles cannot be loaded", async () => {
    mocks.query.mockRejectedValue(new Error("database unavailable"));

    const result = await findUserProfilesByEmail([profile.email]);
    expect(result.ok).toBe(false);
    expect(result.profiles.size).toBe(0);
  });
});
