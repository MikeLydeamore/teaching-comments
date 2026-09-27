export type PlanKey = "community" | "free" | "pro";
export type LimitKey = "ownedSpaces" | "teacherSeats";

export type Entitlements = {
  plan: PlanKey;
  limits: Record<LimitKey, number | null>;
};

export interface EntitlementProvider {
  forOrganization(organizationId: string): Promise<Entitlements>;
}

export class EntitlementLimitError extends Error {
  constructor(
    readonly limitKey: LimitKey,
    readonly limit: number,
  ) {
    super(
      limitKey === "ownedSpaces"
        ? `This organisation has reached its limit of ${limit} hosted ${limit === 1 ? "space" : "spaces"}.`
        : `This organisation has reached its limit of ${limit} teacher ${limit === 1 ? "seat" : "seats"}.`,
    );
    this.name = "EntitlementLimitError";
  }
}

export function assertCapacity(
  key: LimitKey,
  limit: number | null,
  current: number,
) {
  if (limit !== null && current >= limit) {
    throw new EntitlementLimitError(key, limit);
  }
}
