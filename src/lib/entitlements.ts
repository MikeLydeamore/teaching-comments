import "server-only";

import { selectedStorageBackend } from "./edie-storage-backend";
import { getOrganizationSubscription } from "./edie-store";
import type { EntitlementProvider, Entitlements } from "./entitlement-model";

export { EntitlementLimitError, assertCapacity } from "./entitlement-model";
export type { EntitlementProvider, Entitlements, LimitKey, PlanKey } from "./entitlement-model";

type Environment = Record<string, string | undefined>;

function parseLimit(env: Environment, key: string) {
  const raw = env[key]?.trim().toLowerCase();
  if (raw === "unlimited") return null;
  if (!raw || !/^\d+$/.test(raw)) {
    throw new Error(`${key} must be a non-negative integer or "unlimited".`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${key} must be a safe integer.`);
  }
  return value;
}

function cloudPlan(plan: "free" | "pro", env: Environment): Entitlements {
  const prefix = `EDIE_CLOUD_${plan.toUpperCase()}`;
  return {
    plan,
    limits: {
      ownedSpaces: parseLimit(env, `${prefix}_OWNED_SPACES_LIMIT`),
      teacherSeats: parseLimit(env, `${prefix}_TEACHER_SEATS_LIMIT`),
    },
  };
}

export function deploymentMode(env: Environment = process.env): "community" | "cloud" {
  const requested = env.EDIE_DEPLOYMENT_MODE?.trim().toLowerCase();
  if (requested === "community" || requested === "cloud") return requested;
  if (!requested && env.NODE_ENV !== "production") return "community";
  throw new Error("EDIE_DEPLOYMENT_MODE must be set to community or cloud.");
}

export function validateEntitlementConfiguration(env: Environment = process.env) {
  const mode = deploymentMode(env);
  if (mode === "community") return;
  if (env.NODE_ENV === "production" && selectedStorageBackend(env) !== "neon") {
    throw new Error("Cloud production requires Neon/Postgres storage.");
  }
  if (!env.DATABASE_URL?.trim()) {
    throw new Error("Cloud mode requires DATABASE_URL.");
  }
  cloudPlan("free", env);
  cloudPlan("pro", env);
}

export class CommunityEntitlementProvider implements EntitlementProvider {
  async forOrganization(organizationId: string): Promise<Entitlements> {
    void organizationId;
    return {
      plan: "community",
      limits: { ownedSpaces: null, teacherSeats: null },
    };
  }
}

export class CloudEntitlementProvider implements EntitlementProvider {
  constructor(private readonly env: Environment = process.env) {}

  async forOrganization(organizationId: string): Promise<Entitlements> {
    validateEntitlementConfiguration(this.env);
    const subscription = await getOrganizationSubscription(organizationId);
    const plan = subscription && (subscription.status === "active" || subscription.status === "trialing")
      ? subscription.plan
      : "free";
    return cloudPlan(plan, this.env);
  }
}

export function entitlementProvider(
  env: Environment = process.env,
): EntitlementProvider {
  return deploymentMode(env) === "cloud"
    ? new CloudEntitlementProvider(env)
    : new CommunityEntitlementProvider();
}

export async function entitlementsForOrganization(organizationId: string) {
  return entitlementProvider().forOrganization(organizationId);
}
