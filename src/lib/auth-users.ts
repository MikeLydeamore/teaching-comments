import "server-only";

import { Pool } from "pg";

let pool: Pool | null = null;

function userPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.AUTH_DATABASE_URL,
    });
  }

  return pool;
}

export type MemberProfile = {
  email: string;
  name: string | null;
  image: string | null;
};

/**
 * Looks up Better Auth user profiles by email. Google/GitHub provide a
 * display name and avatar at sign-in; invited members who have never signed
 * in have no profile row yet.
 */
export async function findUserProfilesByEmail(
  emails: string[],
): Promise<Map<string, MemberProfile>> {
  const profiles = new Map<string, MemberProfile>();

  if (!emails.length || !process.env.AUTH_DATABASE_URL?.trim()) {
    return profiles;
  }

  try {
    const result = await userPool().query<{
      email: string;
      name: string | null;
      image: string | null;
    }>(
      'SELECT lower(email) AS email, name, image FROM "user" WHERE lower(email) = ANY($1::text[])',
      [emails.map((email) => email.toLowerCase())],
    );

    for (const row of result.rows) {
      profiles.set(row.email, {
        email: row.email,
        name: row.name,
        image: row.image,
      });
    }
  } catch {
    // Cosmetic lookup only; fall back to email-only display.
  }

  return profiles;
}
