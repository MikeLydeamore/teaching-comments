import { beforeEach, describe, expect, it, vi } from "vitest";

const { getOrganizationSubscription } = vi.hoisted(() => ({
  getOrganizationSubscription: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("./edie-store", () => ({ getOrganizationSubscription }));

import {
  CloudEntitlementProvider,
  CommunityEntitlementProvider,
  deploymentMode,
  validateEntitlementConfiguration,
} from "./entitlements";

const cloudEnvironment = {
  NODE_ENV: "production",
  EDIE_DEPLOYMENT_MODE: "cloud",
  EDIE_STORAGE_BACKEND: "neon",
  DATABASE_URL: "postgresql://example.invalid/edie",
  REDIS_URL: "rediss://example.invalid",
  EDIE_CLOUD_FREE_CONCURRENT_PARTICIPANTS_LIMIT: "30",
  EDIE_CLOUD_FREE_OWNED_SPACES_LIMIT: "1",
  EDIE_CLOUD_FREE_TEACHER_SEATS_LIMIT: "1",
  EDIE_CLOUD_PRO_CONCURRENT_PARTICIPANTS_LIMIT: "unlimited",
  EDIE_CLOUD_PRO_OWNED_SPACES_LIMIT: "10",
  EDIE_CLOUD_PRO_TEACHER_SEATS_LIMIT: "5",
};

describe("entitlement providers", () => {
  beforeEach(() => getOrganizationSubscription.mockReset());

  it("gives Community unlimited quotas without Cloud configuration", async () => {
    await expect(new CommunityEntitlementProvider().forOrganization("org-1"))
      .resolves.toEqual({
        plan: "community",
        limits: {
          concurrentParticipants: null,
          ownedSpaces: null,
          teacherSeats: null,
        },
      });
    expect(deploymentMode({ NODE_ENV: "test" })).toBe("community");
  });

  it("requires an explicit deployment mode in production", () => {
    expect(() => deploymentMode({ NODE_ENV: "production" })).toThrow(
      "EDIE_DEPLOYMENT_MODE",
    );
  });

  it("rejects malformed Cloud quotas and local production storage", () => {
    expect(() => validateEntitlementConfiguration({
      ...cloudEnvironment,
      EDIE_STORAGE_BACKEND: "local",
    })).toThrow("requires Neon/Postgres");
    expect(() => validateEntitlementConfiguration({
      ...cloudEnvironment,
      DATABASE_URL: "",
    })).toThrow("DATABASE_URL");
    expect(() => validateEntitlementConfiguration({
      ...cloudEnvironment,
      REDIS_URL: "",
    })).toThrow("REDIS_URL");
    expect(() => validateEntitlementConfiguration({
      ...cloudEnvironment,
      EDIE_CLOUD_PRO_TEACHER_SEATS_LIMIT: "many",
    })).toThrow("EDIE_CLOUD_PRO_TEACHER_SEATS_LIMIT");
    expect(() => validateEntitlementConfiguration({
      ...cloudEnvironment,
      EDIE_CLOUD_FREE_CONCURRENT_PARTICIPANTS_LIMIT: undefined,
    })).toThrow("EDIE_CLOUD_FREE_CONCURRENT_PARTICIPANTS_LIMIT");
  });

  it("defaults missing and inactive subscriptions to Free", async () => {
    getOrganizationSubscription.mockResolvedValueOnce(null).mockResolvedValueOnce({
      plan: "pro",
      status: "past_due",
    });
    const provider = new CloudEntitlementProvider(cloudEnvironment);
    await expect(provider.forOrganization("org-1")).resolves.toMatchObject({
      plan: "free",
      limits: {
        concurrentParticipants: 30,
        ownedSpaces: 1,
        teacherSeats: 1,
      },
    });
    await expect(provider.forOrganization("org-2")).resolves.toMatchObject({
      plan: "free",
    });
  });

  it("uses configured Pro quotas for active subscriptions", async () => {
    getOrganizationSubscription.mockResolvedValue({ plan: "pro", status: "active" });
    await expect(new CloudEntitlementProvider(cloudEnvironment).forOrganization("org-1"))
      .resolves.toEqual({
        plan: "pro",
        limits: {
          concurrentParticipants: null,
          ownedSpaces: 10,
          teacherSeats: 5,
        },
      });
  });

  it("accepts zero and unlimited participant limits and rejects malformed values", async () => {
    getOrganizationSubscription.mockResolvedValue({ plan: "free", status: "active" });
    await expect(new CloudEntitlementProvider({
      ...cloudEnvironment,
      EDIE_CLOUD_FREE_CONCURRENT_PARTICIPANTS_LIMIT: "0",
    }).forOrganization("org-1")).resolves.toMatchObject({
      limits: { concurrentParticipants: 0 },
    });
    expect(() => validateEntitlementConfiguration({
      ...cloudEnvironment,
      EDIE_CLOUD_FREE_CONCURRENT_PARTICIPANTS_LIMIT: "many",
    })).toThrow("EDIE_CLOUD_FREE_CONCURRENT_PARTICIPANTS_LIMIT");
  });
});
