import "server-only";

import { Pool } from "pg";
import { resolveAuthDatabaseUrl } from "./auth-database-url";

let pool: Pool | null = null;

function userPool(connectionString: string) {
  if (!pool) {
    pool = new Pool({
      connectionString,
    });
  }

  return pool;
}

export type MemberProfile = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  username: string | null;
  displayUsername: string | null;
};

export type MemberProfilesResult =
  | { ok: true; profiles: Map<string, MemberProfile> }
  | { ok: false; profiles: Map<string, MemberProfile> };

const PROFILE_COLUMNS =
  'id, lower(email) AS email, name, image, username, "displayUsername" AS "displayUsername"';

function memberProfileFromRow(row: MemberProfile): MemberProfile {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    image: row.image,
    username: row.username,
    displayUsername: row.displayUsername,
  };
}

export async function findUserProfileByUsername(
  username: string,
): Promise<MemberProfile | null> {
  const databaseUrl = resolveAuthDatabaseUrl();

  if (!databaseUrl) {
    throw new Error("The auth database is not configured.");
  }

  const result = await userPool(databaseUrl).query<MemberProfile>(
    `SELECT ${PROFILE_COLUMNS} FROM "user" WHERE username = $1 LIMIT 1`,
    [username.toLowerCase()],
  );

  return result.rows[0] ? memberProfileFromRow(result.rows[0]) : null;
}

export async function findUserProfileById(
  userId: string,
): Promise<MemberProfile | null> {
  const databaseUrl = resolveAuthDatabaseUrl();

  if (!databaseUrl) {
    throw new Error("The auth database is not configured.");
  }

  const result = await userPool(databaseUrl).query<MemberProfile>(
    `SELECT ${PROFILE_COLUMNS} FROM "user" WHERE id = $1 LIMIT 1`,
    [userId],
  );

  return result.rows[0] ? memberProfileFromRow(result.rows[0]) : null;
}

/**
 * Looks up Better Auth user profiles by email. Google/GitHub provide a
 * display name and avatar at sign-in; invited members who have never signed
 * in have no profile row yet.
 */
export async function findUserProfilesByEmail(
  emails: string[],
): Promise<MemberProfilesResult> {
  const profiles = new Map<string, MemberProfile>();
  const databaseUrl = resolveAuthDatabaseUrl();

  if (!emails.length) {
    return { ok: true, profiles };
  }

  if (!databaseUrl) {
    return { ok: false, profiles };
  }

  try {
    const result = await userPool(databaseUrl).query<MemberProfile>(
      `SELECT ${PROFILE_COLUMNS} FROM "user" WHERE lower(email) = ANY($1::text[])`,
      [emails.map((email) => email.toLowerCase())],
    );

    for (const row of result.rows) {
      profiles.set(row.email, memberProfileFromRow(row));
    }
  } catch {
    return { ok: false, profiles: new Map() };
  }

  return { ok: true, profiles };
}
