import { beforeEach, describe, expect, it, vi } from "vitest";

const { purgeDeletedTeacherSpaces } = vi.hoisted(() => ({
  purgeDeletedTeacherSpaces: vi.fn(),
}));

vi.mock("@/lib/edie-store", () => ({ purgeDeletedTeacherSpaces }));

import { GET } from "./route";

describe("deleted space purge cron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-cron-secret-long-enough";
    purgeDeletedTeacherSpaces.mockResolvedValue(2);
  });

  it("fails closed without the configured bearer token", async () => {
    const response = await GET(new Request("https://ed.ie/api/maintenance/purge-deleted-spaces"));
    expect(response.status).toBe(401);
    expect(purgeDeletedTeacherSpaces).not.toHaveBeenCalled();
  });

  it("permanently purges expired spaces", async () => {
    const response = await GET(new Request(
      "https://ed.ie/api/maintenance/purge-deleted-spaces",
      { headers: { authorization: "Bearer test-cron-secret-long-enough" } },
    ));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ purged: 2 });
    expect(purgeDeletedTeacherSpaces).toHaveBeenCalledOnce();
  });
});
