import { pathToFileURL } from "node:url";
import pg from "pg";

const { Pool } = pg;

export function planOrganizationMigration(spaces, memberships, users, organizations = []) {
  const errors = [];
  const usersByEmail = new Map();

  for (const user of users) {
    const email = String(user.email).trim().toLowerCase();
    if (usersByEmail.has(email)) errors.push(`Multiple auth users have email ${email}.`);
    usersByEmail.set(email, user);
  }

  const organizationOwnerById = new Map(
    organizations.map((organization) => [organization.id, organization.personal_owner_user_id]),
  );
  const active = memberships.filter((membership) => membership.status === "active");
  const pending = memberships
    .filter((membership) => membership.status === "pending")
    .map((membership) => {
      const email = String(membership.email).trim().toLowerCase();
      return { ...membership, email, inviteeUserId: usersByEmail.get(email)?.id ?? null };
    });
  const mappedMemberships = [];
  const spaceOwners = new Map();

  for (const membership of active) {
    const email = String(membership.email).trim().toLowerCase();
    const user = usersByEmail.get(email);
    if (!user) {
      errors.push(`Active membership ${membership.space_code}/${email} has no auth user.`);
      continue;
    }
    mappedMemberships.push({ ...membership, email, userId: user.id, userName: user.name || email });
  }

  for (const space of spaces) {
    const owners = mappedMemberships.filter(
      (membership) => membership.space_code === space.code && membership.role === "owner",
    );
    if (owners.length !== 1) {
      errors.push(`Space ${space.code} has ${owners.length} mapped active owners; exactly one is required.`);
      continue;
    }
    const owner = owners[0];
    const existingOwner = space.organization_id
      ? organizationOwnerById.get(space.organization_id)
      : null;
    if (space.organization_id && existingOwner !== owner.userId) {
      errors.push(`Space ${space.code} is linked to an organization owned by a different user.`);
      continue;
    }
    spaceOwners.set(space.code, owner);
  }

  const seenSpaceUsers = new Set();
  for (const membership of mappedMemberships) {
    const key = `${membership.space_code}\0${membership.userId}`;
    if (seenSpaceUsers.has(key)) errors.push(`Space ${membership.space_code} maps more than one active email to user ${membership.userId}.`);
    seenSpaceUsers.add(key);
  }

  return { errors, mappedMemberships, pending, spaceOwners };
}

export function resolveMigrationUrls(env) {
  return {
    applicationUrl: env.DATABASE_OWNER_URL || env.DATABASE_URL || "",
    authUrl: env.AUTH_DATABASE_URL || env.DATABASE_URL || "",
  };
}

async function loadState(app, auth) {
  const [spaces, memberships, users, organizations] = await Promise.all([
    app.query("SELECT code, name, organization_id FROM edie_teacher_spaces ORDER BY code"),
    app.query("SELECT space_code, lower(email::text) AS email, role, status, created_at FROM edie_space_members ORDER BY space_code, email"),
    auth.query('SELECT id, lower(email) AS email, name FROM "user" ORDER BY email'),
    app.query("SELECT id::text, personal_owner_user_id FROM edie_organizations"),
  ]);
  return {
    spaces: spaces.rows,
    memberships: memberships.rows,
    users: users.rows,
    organizations: organizations.rows,
  };
}

async function applyPlan(app, plan) {
  const client = await app.connect();
  try {
    await client.query("BEGIN");
    const organizationIds = new Map();

    for (const owner of plan.spaceOwners.values()) {
      if (organizationIds.has(owner.userId)) continue;
      const name = `${String(owner.userName || "Teacher").trim().slice(0, 95)}'s organization`;
      const result = await client.query(
        `INSERT INTO edie_organizations (name, kind, personal_owner_user_id)
         VALUES ($1, 'personal', $2)
         ON CONFLICT (personal_owner_user_id) WHERE personal_owner_user_id IS NOT NULL
         DO UPDATE SET personal_owner_user_id = EXCLUDED.personal_owner_user_id
         RETURNING id::text`,
        [name, owner.userId],
      );
      organizationIds.set(owner.userId, result.rows[0].id);
    }

    for (const [spaceCode, owner] of plan.spaceOwners) {
      await client.query(
        "UPDATE edie_teacher_spaces SET organization_id = $2 WHERE code = $1 AND (organization_id IS NULL OR organization_id = $2::uuid)",
        [spaceCode, organizationIds.get(owner.userId)],
      );
    }

    for (const membership of plan.mappedMemberships) {
      await client.query(
        "UPDATE edie_space_members SET user_id = $3 WHERE space_code = $1 AND email = $2 AND status = 'active'",
        [membership.space_code, membership.email, membership.userId],
      );
    }

    for (const invitation of plan.pending) {
      const normalizedEmail = String(invitation.email).trim().toLowerCase();
      await client.query(
        `INSERT INTO edie_space_invitations (space_code, email, invitee_user_id, role, created_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (space_code, email) DO UPDATE
         SET invitee_user_id = EXCLUDED.invitee_user_id, role = EXCLUDED.role`,
        [invitation.space_code, normalizedEmail, invitation.inviteeUserId, invitation.role, invitation.created_at],
      );
    }

    const validation = await client.query(
      `SELECT
         count(*) FILTER (WHERE organization_id IS NULL)::integer AS spaces_without_organization,
         (SELECT count(*) FROM edie_space_members WHERE status = 'active' AND user_id IS NULL)::integer AS active_members_without_user
       FROM edie_teacher_spaces`,
    );
    const result = validation.rows[0];
    if (result.spaces_without_organization || result.active_members_without_user) {
      throw new Error(`Validation failed: ${JSON.stringify(result)}`);
    }
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  const apply = process.argv.includes("--apply");
  const { applicationUrl, authUrl } = resolveMigrationUrls(process.env);
  if (!applicationUrl || !authUrl) throw new Error("DATABASE_OWNER_URL (or DATABASE_URL) and AUTH_DATABASE_URL (or DATABASE_URL) are required.");

  const app = new Pool({ connectionString: applicationUrl });
  const auth = authUrl === applicationUrl ? app : new Pool({ connectionString: authUrl });
  try {
    const state = await loadState(app, auth);
    const plan = planOrganizationMigration(state.spaces, state.memberships, state.users, state.organizations);
    const summary = {
      mode: apply ? "apply" : "dry-run",
      spaces: state.spaces.length,
      activeMemberships: plan.mappedMemberships.length,
      pendingInvitations: plan.pending.length,
      owners: new Set([...plan.spaceOwners.values()].map((owner) => owner.userId)).size,
      errors: plan.errors,
    };
    console.log(JSON.stringify(summary, null, 2));
    if (plan.errors.length) throw new Error("Organization migration preflight failed; no changes were made.");
    if (apply) console.log(JSON.stringify({ validation: await applyPlan(app, plan) }, null, 2));
  } finally {
    if (auth !== app) await auth.end();
    await app.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
