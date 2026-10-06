import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_SPACE_CODE,
  DEFAULT_PROMPT,
  applySessionPatch,
  defaultSubmissionViewSettings,
  assertSubmissionUsesEnabledInputs,
  assertSubmissionHasContent,
  calculateStats,
  normalizeSessionCode,
  normalizeQuestionBankText,
  normalizeSpaceCode,
  normalizeStudentName,
  normalizeSubmissionPatch,
  normalizeSubmissionViewSettingsPatch,
  now,
  titleFromCode,
  validateGroupQuestionText,
  validateGroupQuestionVoterId,
  validatePollDefinition,
  validatePollExtension,
  validatePollParticipantId,
  validatePollQuestionDefinition,
  validateCorrectOptionIndexes,
  validatePollQuestionTitle,
  validateQuestionTitle,
  validateSubmissionContent,
  normalizeSubmissionImageData,
  validateQuestionText,
  validateTeacherSpaceName,
  spacePurgeAt,
  normalizeSpaceEmail,
  validateSpaceRole,
  type GroupQuestion,
  type PromptHistoryItem,
  type PollResponse,
  type PollQuestionBankItem,
  QuestionBankConflictError,
  type QuestionBankItem,
  type EdieStore,
  type Session,
  type SessionPoll,
  type Submission,
  type SubmissionViewSettings,
  type SubmissionViewSettingsPatch,
  type TeacherSpace,
  type Organization,
  type OrganizationMember,
  type OrganizationSubscription,
  type SpaceMember,
  type SpaceInvitation,
  type SpaceInvitationRecord,
  type SpaceWithRole,
} from "./edie-store-model";
import { assertCapacity } from "./entitlement-model";

type StoreData = {
  groupQuestions: StoredGroupQuestion[];
  pollResponses: PollResponse[];
  pollQuestionBank: PollQuestionBankItem[];
  polls: SessionPoll[];
  promptHistory: PromptHistoryItem[];
  questionBank: QuestionBankItem[];
  sessions: Session[];
  submissionViewSettings: SubmissionViewSettings[];
  submissions: Submission[];
  teacherSpaces: TeacherSpace[];
  organizations: Organization[];
  organizationMembers: OrganizationMember[];
  subscriptions: OrganizationSubscription[];
  spaceMembers: SpaceMember[];
  spaceInvitations: SpaceInvitationRecord[];
};

type StoredGroupQuestion = Omit<GroupQuestion, "hasVoted" | "voteCount"> & {
  voterIds: string[];
};

const DATA_DIR = path.join(process.cwd(), ".data");
const STORE_PATH = path.join(DATA_DIR, "edie-store.json");
const DEFAULT_ORGANIZATION_ID = "00000000-0000-4000-8000-000000000001";

function defaultStore(): StoreData {
  const createdAt = now();
  const promptHistoryId = randomUUID();

  return {
    groupQuestions: [],
    pollResponses: [],
    pollQuestionBank: [],
    polls: [],
    spaceMembers: [],
    spaceInvitations: [],
    organizationMembers: [],
    subscriptions: [],
    organizations: [
      {
        id: DEFAULT_ORGANIZATION_ID,
        name: "Ed.ie system",
        kind: "system",
        personalOwnerUserId: null,
        createdAt,
      },
    ],
    promptHistory: [
      {
        id: promptHistoryId,
        sessionCode: "demo-lecture",
        prompt: DEFAULT_PROMPT,
        startedAt: createdAt,
        endedAt: null,
      },
    ],
    questionBank: [],
    teacherSpaces: [
      {
        code: DEFAULT_SPACE_CODE,
        name: "Default Space",
        organizationId: DEFAULT_ORGANIZATION_ID,
        createdAt,
        deletedAt: null,
        purgeAfter: null,
      },
    ],
    sessions: [
      {
        id: "demo-lecture",
        code: "demo-lecture",
        spaceCode: DEFAULT_SPACE_CODE,
        title: "Demo Lecture",
        prompt: DEFAULT_PROMPT,
        isOpen: true,
        groupQuestionsScreeningEnabled: false,
        submissionsScreeningEnabled: false,
        textInputEnabled: true,
        gifInputEnabled: true,
        drawingInputEnabled: true,
        imageInputEnabled: true,
        imageEmbedsEnabled: true,
        createdAt,
        promptUpdatedAt: createdAt,
        timerDurationSeconds: 0,
        timerEndsAt: null,
      },
    ],
    submissionViewSettings: [],
    submissions: [
      {
        id: randomUUID(),
        sessionCode: "demo-lecture",
        studentName: "Anonymous",
        text: "There is no evidence against the null model, so the observed difference could be due to random variation.",
        drawingData: null,
        gifData: null,
        imageData: null,
        status: "visible",
        version: 1,
        archivedAt: null,
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: randomUUID(),
        sessionCode: "demo-lecture",
        studentName: "Anonymous",
        text: "The p-value is 0.28, which is not small enough to suggest the bird type proportions are different.",
        drawingData: null,
        gifData: null,
        imageData: null,
        status: "visible",
        version: 1,
        archivedAt: null,
        createdAt,
        updatedAt: createdAt,
      },
    ],
  };
}

async function ensureStore() {
  await mkdir(DATA_DIR, { recursive: true });

  try {
    await readFile(STORE_PATH, "utf8");
  } catch {
    await writeStore(defaultStore());
  }
}

function legacyPromptHistoryId(session: Session) {
  return `legacy-${session.id}-${session.promptUpdatedAt.replace(/[^a-zA-Z0-9]/g, "")}`;
}

function promptHistoryContainsSubmission(
  promptHistory: PromptHistoryItem,
  submission: Submission,
) {
  const createdAt = new Date(submission.createdAt).getTime();
  const startedAt = new Date(promptHistory.startedAt).getTime();
  const endedAt = promptHistory.endedAt
    ? new Date(promptHistory.endedAt).getTime()
    : Infinity;

  return createdAt >= startedAt && createdAt < endedAt;
}

async function readStore(): Promise<StoreData> {
  await ensureStore();
  const raw = await readFile(STORE_PATH, "utf8");
  const data = JSON.parse(raw) as Partial<StoreData>;
  const createdAt = now();
  const organizations = data.organizations?.length
    ? data.organizations.map((organization) => ({
        ...organization,
        name: organization.kind === "personal"
          ? organization.name.replace(/'s organization$/, "'s organisation")
          : organization.name,
      }))
    : [
        {
          id: DEFAULT_ORGANIZATION_ID,
          name: "Ed.ie system",
          kind: "system" as const,
          personalOwnerUserId: null,
          createdAt,
        },
      ];
  const teacherSpaces = data.teacherSpaces?.length
    ? data.teacherSpaces.map((space) => ({
        code: normalizeSpaceCode(space.code) || DEFAULT_SPACE_CODE,
        name: space.name ?? (titleFromCode(space.code) || "Hosted Space"),
        organizationId: space.organizationId ?? DEFAULT_ORGANIZATION_ID,
        createdAt: space.createdAt ?? createdAt,
        deletedAt: space.deletedAt ?? null,
        purgeAfter: space.purgeAfter ?? null,
      }))
    : [
        {
          code: DEFAULT_SPACE_CODE,
          name: "Default Space",
          organizationId: DEFAULT_ORGANIZATION_ID,
          createdAt,
          deletedAt: null,
          purgeAfter: null,
        },
      ];
  const spaceMembers = (data.spaceMembers ?? []).map((member) => {
    if (!member.userId) {
      throw new Error(
        "The local Ed.ie store contains legacy email memberships. Reset .data/edie-store.json or migrate it before continuing.",
      );
    }

    return {
      spaceCode: normalizeSpaceCode(member.spaceCode),
      userId: member.userId,
      role: validateSpaceRole(member.role),
      createdAt: member.createdAt ?? now(),
    };
  });
  const organizationMembers = data.organizationMembers?.length
    ? data.organizationMembers
    : [...new Map(spaceMembers.map((member) => {
        const space = teacherSpaces.find((item) => item.code === member.spaceCode);
        const organization = organizations.find((item) => item.id === space?.organizationId);
        const key = `${space?.organizationId}\0${member.userId}`;
        return [key, {
          organizationId: space?.organizationId ?? DEFAULT_ORGANIZATION_ID,
          userId: member.userId,
          role: organization?.personalOwnerUserId === member.userId ? "owner" as const : "member" as const,
          createdAt: member.createdAt,
        }];
      })).values()];
  const sessions = (data.sessions ?? []).map((session) => ({
    ...session,
    id: session.id ?? session.code,
    spaceCode: session.spaceCode ?? DEFAULT_SPACE_CODE,
    groupQuestionsScreeningEnabled:
      session.groupQuestionsScreeningEnabled ?? false,
    submissionsScreeningEnabled: session.submissionsScreeningEnabled ?? false,
    textInputEnabled: session.textInputEnabled ?? true,
    gifInputEnabled: session.gifInputEnabled ?? true,
    drawingInputEnabled: session.drawingInputEnabled ?? true,
    imageInputEnabled: session.imageInputEnabled ?? true,
    imageEmbedsEnabled: session.imageEmbedsEnabled ?? true,
    promptUpdatedAt: session.promptUpdatedAt ?? session.createdAt,
    timerDurationSeconds: session.timerDurationSeconds ?? 0,
    timerEndsAt: session.timerEndsAt ?? null,
  }));
  const promptHistory = data.promptHistory ?? [];
  const sessionCodesWithHistory = new Set(
    promptHistory.map((item) => item.sessionCode),
  );

  return {
    ...data,
    groupQuestions: (data.groupQuestions ?? []).map((question) => ({
      ...question,
      isAnswered: question.isAnswered ?? false,
      isVisible: question.isVisible ?? true,
      studentName: question.studentName ?? "Anonymous",
      archivedAt: question.archivedAt ?? null,
      updatedAt: question.updatedAt ?? question.createdAt,
      voterIds: question.voterIds ?? [],
    })),
    pollResponses: data.pollResponses ?? [],
    pollQuestionBank: (data.pollQuestionBank ?? []).map((question) => ({
      ...question,
      title: question.title ?? question.question,
      correctOptionIndexes: question.correctOptionIndexes ?? [],
      updatedAt: question.updatedAt ?? question.createdAt,
    })),
    polls: (data.polls ?? []).map((poll) => ({
      ...poll,
      correctOptionIds: poll.correctOptionIds ?? [],
      solutionRevealed: poll.solutionRevealed ?? false,
      votingEndedAt: poll.votingEndedAt ?? null,
      endedAt: poll.endedAt ?? null,
    })),
    teacherSpaces,
    organizations,
    spaceMembers,
    organizationMembers,
    subscriptions: data.subscriptions ?? [],
    spaceInvitations: (data.spaceInvitations ?? []).map((invitation) => ({
      spaceCode: normalizeSpaceCode(invitation.spaceCode),
      email: normalizeSpaceEmail(invitation.email),
      userId: invitation.userId ?? null,
      role: validateSpaceRole(invitation.role),
      createdAt: invitation.createdAt ?? now(),
    })),
    questionBank: (data.questionBank ?? []).map((question) => ({
      ...question,
      title: question.title ?? question.text,
      updatedAt: question.updatedAt ?? question.createdAt,
    })),
    promptHistory: [
      ...promptHistory.map((item) => ({
        ...item,
        endedAt: item.endedAt ?? null,
        startedAt: item.startedAt,
      })),
      ...sessions
        .filter((session) => !sessionCodesWithHistory.has(session.id))
        .map((session) => ({
          id: legacyPromptHistoryId(session),
          sessionCode: session.id,
          prompt: session.prompt,
          startedAt: session.promptUpdatedAt ?? session.createdAt,
          endedAt: null,
        })),
    ],
    sessions,
    submissionViewSettings: (data.submissionViewSettings ?? []).map(
      ({
        sessionCode,
        promptHistoryId,
        expandedSubmissionId,
        minutes,
        sortOrder,
        revision,
        updatedAt,
      }) => ({
        sessionCode,
        promptHistoryId,
        expandedSubmissionId: expandedSubmissionId ?? null,
        minutes,
        sortOrder,
        revision,
        updatedAt,
      }),
    ),
    submissions: (data.submissions ?? []).map((submission) => ({
      id: submission.id,
      sessionCode: submission.sessionCode,
      studentName: submission.studentName ?? "Anonymous",
      text: submission.text,
      drawingData: submission.drawingData ?? null,
      gifData: submission.gifData ?? null,
      imageData: normalizeSubmissionImageData(submission.imageData),
      status: submission.status,
      version: submission.version,
      archivedAt: submission.archivedAt ?? null,
      createdAt: submission.createdAt,
      updatedAt: submission.updatedAt,
    })),
  };
}

async function writeStore(data: StoreData) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(STORE_PATH, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

let bankMutationTail = Promise.resolve();
let submissionViewMutationTail = Promise.resolve();
let storeMutationTail = Promise.resolve();

async function serializeStoreMutation<T>(operation: () => Promise<T>) {
  const previousMutation = storeMutationTail;
  let finishMutation = () => {};

  storeMutationTail = new Promise<void>((resolve) => {
    finishMutation = resolve;
  });

  await previousMutation;

  try {
    return await operation();
  } finally {
    finishMutation();
  }
}

function personalOrganizationName(ownerName: string) {
  const name = ownerName.trim() || "Teacher";
  return `${name.slice(0, 95)}'s organisation`;
}

function ensurePersonalOrganizationInData(
  data: StoreData,
  userId: string,
  ownerName: string,
) {
  const existing = data.organizations.find(
    (organization) => organization.personalOwnerUserId === userId,
  );

  if (existing) {
    if (!data.organizationMembers.some(
      (member) => member.organizationId === existing.id && member.userId === userId,
    )) {
      data.organizationMembers.push({
        organizationId: existing.id,
        userId,
        role: "owner",
        createdAt: existing.createdAt,
      });
    }
    return existing;
  }

  const organization: Organization = {
    id: randomUUID(),
    name: personalOrganizationName(ownerName),
    kind: "personal",
    personalOwnerUserId: userId,
    createdAt: now(),
  };
  data.organizations.push(organization);
  data.organizationMembers.push({
    organizationId: organization.id,
    userId,
    role: "owner",
    createdAt: organization.createdAt,
  });
  return organization;
}

function permanentlyRemoveSpace(data: StoreData, spaceCode: string) {
  const sessionIds = new Set(
    data.sessions
      .filter((session) => session.spaceCode === spaceCode)
      .map((session) => session.id),
  );
  const pollIds = new Set(
    data.polls
      .filter((poll) => sessionIds.has(poll.sessionCode))
      .map((poll) => poll.id),
  );

  data.groupQuestions = data.groupQuestions.filter((item) => !sessionIds.has(item.sessionCode));
  data.pollResponses = data.pollResponses.filter((item) => !pollIds.has(item.pollId));
  data.pollQuestionBank = data.pollQuestionBank.filter((item) => !sessionIds.has(item.sessionCode));
  data.polls = data.polls.filter((item) => !sessionIds.has(item.sessionCode));
  data.promptHistory = data.promptHistory.filter((item) => !sessionIds.has(item.sessionCode));
  data.questionBank = data.questionBank.filter((item) => !sessionIds.has(item.sessionCode));
  data.submissionViewSettings = data.submissionViewSettings.filter((item) => !sessionIds.has(item.sessionCode));
  data.submissions = data.submissions.filter((item) => !sessionIds.has(item.sessionCode));
  data.sessions = data.sessions.filter((session) => session.spaceCode !== spaceCode);
  data.spaceInvitations = data.spaceInvitations.filter((item) => item.spaceCode !== spaceCode);
  data.spaceMembers = data.spaceMembers.filter((item) => item.spaceCode !== spaceCode);
  data.teacherSpaces = data.teacherSpaces.filter((space) => space.code !== spaceCode);
}

function organizationForSpace(data: StoreData, spaceCode: string) {
  const space = data.teacherSpaces.find((item) => item.code === spaceCode);
  return space?.organizationId ?? null;
}

function ensureOrganizationSeat(
  data: StoreData,
  organizationId: string,
  userId: string,
  teacherSeatsLimit: number | null | undefined,
) {
  const existing = data.organizationMembers.find(
    (member) => member.organizationId === organizationId && member.userId === userId,
  );
  if (existing) return existing;
  const members = data.organizationMembers.filter(
    (member) => member.organizationId === organizationId,
  );
  assertCapacity("teacherSeats", teacherSeatsLimit ?? null, members.length);
  const member: OrganizationMember = {
    organizationId,
    userId,
    role: "member",
    createdAt: now(),
  };
  data.organizationMembers.push(member);
  return member;
}

function releaseUnusedOrganizationSeat(
  data: StoreData,
  organizationId: string,
  userId: string,
) {
  const member = data.organizationMembers.find(
    (item) => item.organizationId === organizationId && item.userId === userId,
  );
  if (!member || member.role === "owner") return;
  const stillAssigned = data.spaceMembers.some((spaceMember) => {
    if (spaceMember.userId !== userId) return false;
    return organizationForSpace(data, spaceMember.spaceCode) === organizationId;
  });
  if (!stillAssigned) {
    data.organizationMembers = data.organizationMembers.filter(
      (item) => item !== member,
    );
  }
}

async function serializeBankMutation<T>(operation: () => Promise<T>) {
  const previousMutation = bankMutationTail;
  let finishMutation = () => {};

  bankMutationTail = new Promise<void>((resolve) => {
    finishMutation = resolve;
  });

  await previousMutation;

  try {
    return await operation();
  } finally {
    finishMutation();
  }
}

async function serializeSubmissionViewMutation<T>(
  operation: () => Promise<T>,
) {
  const previousMutation = submissionViewMutationTail;
  let finishMutation = () => {};

  submissionViewMutationTail = new Promise<void>((resolve) => {
    finishMutation = resolve;
  });

  await previousMutation;

  try {
    return await operation();
  } finally {
    finishMutation();
  }
}

export const localStore: EdieStore = {
  async getPersonalOrganization(userId) {
    const data = await readStore();
    return data.organizations.find(
      (organization) => organization.personalOwnerUserId === userId,
    ) ?? null;
  },

  async ensurePersonalOrganization(userId, ownerName) {
    if (!userId.trim()) throw new Error("User ID is required.");

    return serializeStoreMutation(async () => {
      const data = await readStore();
      const organization = ensurePersonalOrganizationInData(
        data,
        userId,
        ownerName,
      );
      await writeStore(data);
      return { ...organization };
    });
  },

  async getOrganizationMemberRole(organizationId, userId) {
    const data = await readStore();
    return data.organizationMembers.find(
      (member) => member.organizationId === organizationId && member.userId === userId,
    )?.role ?? null;
  },

  async listOrganizationMembers(organizationId) {
    const data = await readStore();
    return data.organizationMembers
      .filter((member) => member.organizationId === organizationId)
      .map((member) => ({ ...member }));
  },

  async removeOrganizationMember(organizationId, userId) {
    return serializeStoreMutation(async () => {
      const data = await readStore();
      const member = data.organizationMembers.find(
        (item) => item.organizationId === organizationId && item.userId === userId,
      );
      if (!member || member.role === "owner") return false;
      const spaceCodes = new Set(
        data.teacherSpaces
          .filter((space) => space.organizationId === organizationId)
          .map((space) => space.code),
      );
      const isSoleSpaceOwner = data.spaceMembers.some((spaceMember) =>
        spaceCodes.has(spaceMember.spaceCode) &&
        spaceMember.userId === userId &&
        spaceMember.role === "owner" &&
        !data.spaceMembers.some((other) =>
          other.spaceCode === spaceMember.spaceCode &&
          other.userId !== userId &&
          other.role === "owner",
        ),
      );
      if (isSoleSpaceOwner) return false;
      data.spaceMembers = data.spaceMembers.filter(
        (spaceMember) => !(spaceMember.userId === userId && spaceCodes.has(spaceMember.spaceCode)),
      );
      data.spaceInvitations = data.spaceInvitations.filter(
        (invitation) => !(invitation.userId === userId && spaceCodes.has(invitation.spaceCode)),
      );
      data.organizationMembers = data.organizationMembers.filter(
        (item) => item !== member,
      );
      await writeStore(data);
      return true;
    });
  },

  async getOrganizationSubscription(organizationId) {
    const data = await readStore();
    return data.subscriptions.find(
      (subscription) => subscription.organizationId === organizationId,
    ) ?? null;
  },

  async createTeacherSpaceForOwner(code, name, owner, ownedSpacesLimit = null) {
    const spaceCode = normalizeSpaceCode(code);

    if (!spaceCode) {
      throw new Error("Space code is required.");
    }

    return serializeStoreMutation(async () => {
      const data = await readStore();
      const existing = data.teacherSpaces.find((space) => space.code === spaceCode);

      if (existing) throw new Error("That space code already exists.");

      const organization = ensurePersonalOrganizationInData(
        data,
        owner.userId,
        owner.name,
      );
      assertCapacity(
        "ownedSpaces",
        ownedSpacesLimit,
        data.teacherSpaces.filter(
          (space) => space.organizationId === organization.id && !space.deletedAt,
        ).length,
      );
      const createdAt = now();
      const space: TeacherSpace = {
        code: spaceCode,
        name: validateTeacherSpaceName(name),
        organizationId: organization.id,
        createdAt,
        deletedAt: null,
        purgeAfter: null,
      };
      data.teacherSpaces.push(space);
      data.spaceMembers.push({
        spaceCode,
        userId: owner.userId,
        role: "owner",
        createdAt,
      });
      await writeStore(data);
      return space;
    });
  },

  async renameTeacherSpace(code, name) {
    const spaceCode = normalizeSpaceCode(code);
    if (!spaceCode) return null;
    const nextName = validateTeacherSpaceName(name);

    return serializeStoreMutation(async () => {
      const data = await readStore();
      const space = data.teacherSpaces.find((item) => item.code === spaceCode && !item.deletedAt);
      if (!space) return null;
      space.name = nextName;
      await writeStore(data);
      return { ...space };
    });
  },

  async softDeleteTeacherSpace(code, deletedAt = now()) {
    const spaceCode = normalizeSpaceCode(code);
    if (!spaceCode || spaceCode === DEFAULT_SPACE_CODE) return null;

    return serializeStoreMutation(async () => {
      const data = await readStore();
      const space = data.teacherSpaces.find((item) => item.code === spaceCode && !item.deletedAt);
      if (!space) return null;
      space.deletedAt = new Date(deletedAt).toISOString();
      space.purgeAfter = spacePurgeAt(space.deletedAt);
      for (const session of data.sessions) {
        if (session.spaceCode === spaceCode) session.isOpen = false;
      }
      await writeStore(data);
      return { ...space };
    });
  },

  async restoreTeacherSpace(code, ownedSpacesLimit = null) {
    const spaceCode = normalizeSpaceCode(code);
    if (!spaceCode) return null;
    return serializeStoreMutation(async () => {
      const data = await readStore();
      const space = data.teacherSpaces.find((item) => item.code === spaceCode && item.deletedAt);
      if (!space) return null;
      assertCapacity(
        "ownedSpaces",
        ownedSpacesLimit,
        data.teacherSpaces.filter(
          (item) => item.organizationId === space.organizationId && !item.deletedAt,
        ).length,
      );
      space.deletedAt = null;
      space.purgeAfter = null;
      await writeStore(data);
      return { ...space };
    });
  },

  async listDeletedTeacherSpaces() {
    const data = await readStore();
    return data.teacherSpaces
      .filter((space) => Boolean(space.deletedAt))
      .map((space) => ({ ...space }))
      .sort((left, right) => (left.purgeAfter ?? "").localeCompare(right.purgeAfter ?? ""));
  },

  async purgeDeletedTeacherSpaces(cutoff = now()) {
    return serializeStoreMutation(async () => {
      const data = await readStore();
      const expired = data.teacherSpaces.filter(
        (space) => space.purgeAfter && space.purgeAfter <= cutoff && space.code !== DEFAULT_SPACE_CODE,
      );
      for (const space of expired) permanentlyRemoveSpace(data, space.code);
      if (expired.length) await writeStore(data);
      return expired.length;
    });
  },

  async getTeacherSpace(code) {
    const spaceCode = normalizeSpaceCode(code);

    if (!spaceCode) {
      return null;
    }

    const data = await readStore();
    return data.teacherSpaces.find((space) => space.code === spaceCode && !space.deletedAt) ?? null;
  },

  async listTeacherSpaces() {
    const data = await readStore();

    return data.teacherSpaces
      .filter((space) => !space.deletedAt)
      .map((space) => ({ ...space }))
      .sort((left, right) => left.name.localeCompare(right.name));
  },

  async listTeacherSpacesForOrganization(organizationId) {
    const data = await readStore();
    return data.teacherSpaces
      .filter((space) => space.organizationId === organizationId && !space.deletedAt)
      .map((space) => ({ ...space }))
      .sort((left, right) => left.name.localeCompare(right.name));
  },

  async listTeacherSpacesForUser(userId) {
    const data = await readStore();

    return data.teacherSpaces
      .filter((summary) => !summary.deletedAt)
      .map((summary) => {
        const organizationMember = data.organizationMembers.find(
          (item) => item.organizationId === summary.organizationId && item.userId === userId,
        );
        const member = data.spaceMembers.find(
          (item) =>
            item.spaceCode === summary.code && item.userId === userId,
        );

        if (!member || !organizationMember) {
          return null;
        }

        return { ...summary, role: member.role };
      })
      .filter((space): space is SpaceWithRole => space !== null)
      .sort((left, right) => left.name.localeCompare(right.name));
  },

  async listPendingSpaceInvitationsForUser(userId, verifiedEmail) {
    const normalizedEmail = verifiedEmail
      ? normalizeSpaceEmail(verifiedEmail)
      : null;
    const data = await readStore();

    return data.spaceInvitations
      .filter(
        (invitation) =>
          invitation.userId === userId ||
          (normalizedEmail !== null && invitation.email === normalizedEmail),
      )
      .map((member) => {
        const space = data.teacherSpaces.find(
          (item) => item.code === member.spaceCode,
        );

        if (!space || space.deletedAt) {
          return null;
        }

        return {
          ...space,
          role: member.role,
          invitedAt: member.createdAt,
        };
      })
      .filter(
        (invitation): invitation is SpaceInvitation => invitation !== null,
      )
      .sort((left, right) => left.name.localeCompare(right.name));
  },

  async getSpaceMemberRole(spaceCode, userId) {
    const normalizedSpaceCode = normalizeSpaceCode(spaceCode);

    if (!normalizedSpaceCode) {
      return null;
    }

    const data = await readStore();
    const member = data.spaceMembers.find(
      (item) =>
        item.spaceCode === normalizedSpaceCode && item.userId === userId,
    );
    const space = data.teacherSpaces.find((item) => item.code === normalizedSpaceCode && !item.deletedAt);
    const organizationMember = data.organizationMembers.find(
      (item) => item.organizationId === space?.organizationId && item.userId === userId,
    );
    return organizationMember ? member?.role ?? null : null;
  },

  async listSpaceMembers(spaceCode) {
    const normalizedSpaceCode = normalizeSpaceCode(spaceCode);

    if (!normalizedSpaceCode) {
      return [];
    }

    const data = await readStore();

    return data.spaceMembers
      .filter((member) => member.spaceCode === normalizedSpaceCode)
      .map((member) => ({ ...member }))
      .sort((left, right) => left.userId.localeCompare(right.userId));
  },

  async listSpaceInvitations(spaceCode) {
    const normalizedSpaceCode = normalizeSpaceCode(spaceCode);
    if (!normalizedSpaceCode) return [];
    const data = await readStore();
    return data.spaceInvitations
      .filter((invitation) => invitation.spaceCode === normalizedSpaceCode)
      .map((invitation) => ({ ...invitation }))
      .sort((left, right) => left.email.localeCompare(right.email));
  },

  async addSpaceMember(
    spaceCode,
    userId,
    role = "editor",
    teacherSeatsLimit = null,
  ) {
    const normalizedSpaceCode = normalizeSpaceCode(spaceCode);
    const normalizedRole = validateSpaceRole(role);

    if (!normalizedSpaceCode) {
      throw new Error("Space code is required.");
    }

    return serializeStoreMutation(async () => {
      const data = await readStore();
      const space = data.teacherSpaces.find(
        (item) => item.code === normalizedSpaceCode,
      );
      if (!space) throw new Error("That space could not be found.");
      if (data.spaceMembers.some((item) => item.spaceCode === normalizedSpaceCode && item.userId === userId)) {
        throw new Error("That person is already a member of this space.");
      }
      ensureOrganizationSeat(data, space.organizationId, userId, teacherSeatsLimit);
      const member: SpaceMember = {
        spaceCode: normalizedSpaceCode,
        userId,
        role: normalizedRole,
        createdAt: now(),
      };
      data.spaceInvitations = data.spaceInvitations.filter(
        (invitation) => !(invitation.spaceCode === normalizedSpaceCode && invitation.userId === userId),
      );
      data.spaceMembers.push(member);
      await writeStore(data);
      return member;
    });
  },

  async inviteSpaceMember(spaceCode, email, userId, role = "editor") {
    const normalizedSpaceCode = normalizeSpaceCode(spaceCode);
    const normalizedEmail = normalizeSpaceEmail(email);
    const normalizedRole = validateSpaceRole(role);
    if (!normalizedSpaceCode) throw new Error("Space code is required.");

    const data = await readStore();
    if (!data.teacherSpaces.some((space) => space.code === normalizedSpaceCode)) {
      throw new Error("That space could not be found.");
    }
    if (userId && data.spaceMembers.some((member) => member.spaceCode === normalizedSpaceCode && member.userId === userId)) {
      throw new Error("That person is already a member of this space.");
    }
    if (data.spaceInvitations.some((invitation) => invitation.spaceCode === normalizedSpaceCode && (invitation.email === normalizedEmail || Boolean(userId && invitation.userId === userId)))) {
      throw new Error("That person is already a member of this space.");
    }

    const invitation: SpaceInvitationRecord = {
      spaceCode: normalizedSpaceCode,
      email: normalizedEmail,
      userId,
      role: normalizedRole,
      createdAt: now(),
    };
    data.spaceInvitations.push(invitation);
    await writeStore(data);
    return invitation;
  },

  async acceptSpaceInvitation(spaceCode, userId, verifiedEmail, teacherSeatsLimit = null) {
    const normalizedSpaceCode = normalizeSpaceCode(spaceCode);
    const normalizedEmail = verifiedEmail
      ? normalizeSpaceEmail(verifiedEmail)
      : null;
    return serializeStoreMutation(async () => {
      const data = await readStore();
      const index = data.spaceInvitations.findIndex(
        (item) => item.spaceCode === normalizedSpaceCode &&
          (item.userId === userId || (normalizedEmail !== null && item.email === normalizedEmail)),
      );
      if (index === -1) return false;
      const organizationId = organizationForSpace(data, normalizedSpaceCode);
      if (!organizationId) return false;
      ensureOrganizationSeat(data, organizationId, userId, teacherSeatsLimit);
      const invitation = data.spaceInvitations[index];
      if (!data.spaceMembers.some((member) => member.spaceCode === normalizedSpaceCode && member.userId === userId)) {
        data.spaceMembers.push({ spaceCode: normalizedSpaceCode, userId, role: invitation.role, createdAt: now() });
      }
      data.spaceInvitations.splice(index, 1);
      await writeStore(data);
      return true;
    });
  },

  async declineSpaceInvitation(spaceCode, userId, verifiedEmail) {
    const normalizedSpaceCode = normalizeSpaceCode(spaceCode);
    const normalizedEmail = verifiedEmail
      ? normalizeSpaceEmail(verifiedEmail)
      : null;
    const data = await readStore();
    const index = data.spaceInvitations.findIndex(
      (item) =>
        item.spaceCode === normalizedSpaceCode &&
        (item.userId === userId ||
          (normalizedEmail !== null && item.email === normalizedEmail)),
    );

    if (index === -1) {
      return false;
    }

    data.spaceInvitations.splice(index, 1);
    await writeStore(data);
    return true;
  },

  async leaveSpace(spaceCode, userId) {
    const normalizedSpaceCode = normalizeSpaceCode(spaceCode);
    return serializeStoreMutation(async () => {
    const data = await readStore();
    const index = data.spaceMembers.findIndex(
      (item) =>
        item.spaceCode === normalizedSpaceCode && item.userId === userId,
    );

    if (index === -1) {
      return false;
    }

    const member = data.spaceMembers[index];

    if (
      member.role === "owner" &&
      !data.spaceMembers.some(
        (item) =>
          item.spaceCode === normalizedSpaceCode &&
          item.userId !== userId &&
          item.role === "owner",
      )
    ) {
      return false;
    }

    data.spaceMembers.splice(index, 1);
    const organizationId = organizationForSpace(data, normalizedSpaceCode);
    if (organizationId) releaseUnusedOrganizationSeat(data, organizationId, userId);
    await writeStore(data);
    return true;
    });
  },

  async updateSpaceMemberRole(spaceCode, userId, role) {
    const normalizedSpaceCode = normalizeSpaceCode(spaceCode);
    const normalizedRole = validateSpaceRole(role);

    if (!normalizedSpaceCode) {
      return null;
    }

    const data = await readStore();
    const member = data.spaceMembers.find(
      (item) =>
        item.spaceCode === normalizedSpaceCode && item.userId === userId,
    );

    if (!member) {
      return null;
    }

    member.role = normalizedRole;
    await writeStore(data);
    return { ...member };
  },

  async removeSpaceMember(spaceCode, userId) {
    const normalizedSpaceCode = normalizeSpaceCode(spaceCode);

    if (!normalizedSpaceCode) {
      return false;
    }

    return serializeStoreMutation(async () => {
    const data = await readStore();
    const index = data.spaceMembers.findIndex(
      (item) =>
        item.spaceCode === normalizedSpaceCode && item.userId === userId,
    );

    if (index === -1) {
      return false;
    }

    data.spaceMembers.splice(index, 1);
    const organizationId = organizationForSpace(data, normalizedSpaceCode);
    if (organizationId) releaseUnusedOrganizationSeat(data, organizationId, userId);
    await writeStore(data);
    return true;
    });
  },

  async removeSpaceInvitation(spaceCode, email) {
    const normalizedSpaceCode = normalizeSpaceCode(spaceCode);
    const normalizedEmail = normalizeSpaceEmail(email);
    if (!normalizedSpaceCode) return false;
    const data = await readStore();
    const index = data.spaceInvitations.findIndex(
      (invitation) => invitation.spaceCode === normalizedSpaceCode && invitation.email === normalizedEmail,
    );
    if (index === -1) return false;
    data.spaceInvitations.splice(index, 1);
    await writeStore(data);
    return true;
  },

  async getSession(code) {
    const sessionCode = normalizeSessionCode(code);

    if (!sessionCode) {
      return null;
    }

    const data = await readStore();
    const activeSpaceCodes = new Set(
      data.teacherSpaces.filter((space) => !space.deletedAt).map((space) => space.code),
    );
    return data.sessions.find(
      (session) => session.id === sessionCode && activeSpaceCodes.has(session.spaceCode),
    ) ?? null;
  },

  async getSessionInSpace(spaceCode, code) {
    const normalizedSpaceCode = normalizeSpaceCode(spaceCode);
    const sessionCode = normalizeSessionCode(code);

    if (!normalizedSpaceCode || !sessionCode) {
      return null;
    }

    const data = await readStore();
    if (!data.teacherSpaces.some(
      (space) => space.code === normalizedSpaceCode && !space.deletedAt,
    )) return null;
    return (
      data.sessions.find(
        (session) =>
          session.spaceCode === normalizedSpaceCode && session.code === sessionCode,
      ) ?? null
    );
  },

  async getOrCreateSession(code) {
    const sessionCode = normalizeSessionCode(code) || "demo-lecture";
    const session = await this.getOrCreateSessionInSpace(
      DEFAULT_SPACE_CODE,
      sessionCode,
    );

    if (!session) {
      throw new Error("Default hosted space is missing.");
    }

    return session;
  },

  async getOrCreateSessionInSpace(spaceCode, code) {
    const normalizedSpaceCode = normalizeSpaceCode(spaceCode) || DEFAULT_SPACE_CODE;
    const sessionCode = normalizeSessionCode(code) || "demo-lecture";
    const data = await readStore();
    const space = data.teacherSpaces.find(
      (teacherSpace) => teacherSpace.code === normalizedSpaceCode && !teacherSpace.deletedAt,
    );

    if (!space) {
      return null;
    }

    const existing = data.sessions.find(
      (session) =>
        session.spaceCode === normalizedSpaceCode && session.code === sessionCode,
    );

    if (existing) {
      return existing;
    }

    const timestamp = now();
    const session: Session = {
      id: randomUUID(),
      code: sessionCode,
      spaceCode: normalizedSpaceCode,
      title: titleFromCode(sessionCode) || "Ed.ie Session",
      prompt: DEFAULT_PROMPT,
      isOpen: true,
      groupQuestionsScreeningEnabled: false,
      submissionsScreeningEnabled: false,
      textInputEnabled: true,
      gifInputEnabled: true,
      drawingInputEnabled: true,
      imageInputEnabled: true,
      imageEmbedsEnabled: true,
      createdAt: timestamp,
      promptUpdatedAt: timestamp,
      timerDurationSeconds: 0,
      timerEndsAt: null,
    };

    data.sessions.push(session);
    data.promptHistory.push({
      id: randomUUID(),
      sessionCode: session.id,
      prompt: session.prompt,
      startedAt: timestamp,
      endedAt: null,
    });
    await writeStore(data);
    return session;
  },

  async listSessions(spaceCode) {
    const normalizedSpaceCode = spaceCode ? normalizeSpaceCode(spaceCode) : "";
    const data = await readStore();
    const activeSpaceCodes = new Set(
      data.teacherSpaces.filter((space) => !space.deletedAt).map((space) => space.code),
    );

    return [...data.sessions]
      .filter((session) =>
        activeSpaceCodes.has(session.spaceCode)
          && (normalizedSpaceCode ? session.spaceCode === normalizedSpaceCode : true),
      )
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  },

  async updateSession(code, patch) {
    const sessionCode = normalizeSessionCode(code);
    const data = await readStore();
    const activeSpaceCodes = new Set(
      data.teacherSpaces.filter((space) => !space.deletedAt).map((space) => space.code),
    );
    const index = data.sessions.findIndex(
      (session) => session.id === sessionCode && activeSpaceCodes.has(session.spaceCode),
    );

    if (index === -1) {
      return null;
    }

    const currentSession = data.sessions[index];
    const nextSession = applySessionPatch(currentSession, patch);
    const promptChanged = nextSession.prompt !== currentSession.prompt;

    data.sessions[index] = nextSession;

    if (promptChanged) {
      data.promptHistory = data.promptHistory.map((item) =>
        item.sessionCode === nextSession.id && !item.endedAt
          ? { ...item, endedAt: nextSession.promptUpdatedAt }
          : item,
      );
      data.promptHistory.push({
        id: randomUUID(),
        sessionCode: nextSession.id,
        prompt: nextSession.prompt,
        startedAt: nextSession.promptUpdatedAt,
        endedAt: null,
      });
    }

    await writeStore(data);
    return data.sessions[index];
  },

  async getSubmissionViewSettings(code) {
    const sessionCode = normalizeSessionCode(code);
    const data = await readStore();
    const session = data.sessions.find((item) => item.id === sessionCode);

    if (!session) {
      return null;
    }

    return (
      data.submissionViewSettings.find(
        (settings) => settings.sessionCode === session.id,
      ) ?? defaultSubmissionViewSettings(session.id, session.createdAt)
    );
  },

  async updateSubmissionViewSettings(
    code,
    patch: SubmissionViewSettingsPatch,
  ) {
    return serializeSubmissionViewMutation(async () => {
      const sessionCode = normalizeSessionCode(code);
      const normalizedPatch = normalizeSubmissionViewSettingsPatch(patch);
      const data = await readStore();
      const session = data.sessions.find((item) => item.id === sessionCode);

      if (!session) {
        return null;
      }

      if (
        normalizedPatch.promptHistoryId &&
        !data.promptHistory.some(
          (item) =>
            item.sessionCode === session.id &&
            item.id === normalizedPatch.promptHistoryId,
        )
      ) {
        throw new Error("Prompt filter does not belong to this session.");
      }

      if (
        normalizedPatch.expandedSubmissionId &&
        !data.submissions.some(
          (item) =>
            item.sessionCode === session.id &&
            item.id === normalizedPatch.expandedSubmissionId,
        )
      ) {
        throw new Error("Expanded submission does not belong to this session.");
      }

      const index = data.submissionViewSettings.findIndex(
        (settings) => settings.sessionCode === session.id,
      );
      const current =
        index === -1
          ? defaultSubmissionViewSettings(session.id, session.createdAt)
          : data.submissionViewSettings[index];
      const next: SubmissionViewSettings = {
        ...current,
        ...normalizedPatch,
        revision: current.revision + 1,
        updatedAt: now(),
      };

      if (index === -1) {
        data.submissionViewSettings.push(next);
      } else {
        data.submissionViewSettings[index] = next;
      }

      await writeStore(data);
      return next;
    });
  },

  async listPromptHistory(code) {
    const sessionCode = normalizeSessionCode(code) || "demo-lecture";
    const data = await readStore();

    return data.promptHistory
      .filter((item) => item.sessionCode === sessionCode)
      .sort(
        (a, b) =>
          new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
      );
  },

  async listSubmissions(code, options = {}) {
    const sessionCode = normalizeSessionCode(code) || "demo-lecture";
    const data = await readStore();
    const promptHistory = options.promptHistoryId
      ? data.promptHistory.find(
          (item) =>
            item.sessionCode === sessionCode && item.id === options.promptHistoryId,
        )
      : null;
    const cutoff =
      typeof options.minutes === "number" && options.minutes > 0
        ? Date.now() - options.minutes * 60 * 1000
        : 0;

    return data.submissions
      .filter((submission) => submission.sessionCode === sessionCode)
      .filter((submission) => options.includeArchived || !submission.archivedAt)
      .filter((submission) => options.includeHidden || submission.status !== "hidden")
      .filter((submission) =>
        promptHistory ? promptHistoryContainsSubmission(promptHistory, submission) : true,
      )
      .filter((submission) => new Date(submission.createdAt).getTime() >= cutoff)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async addSubmission(code, input) {
    const submissionContent = validateSubmissionContent(
      input.text,
      input.drawingData,
      input.gifData,
      normalizeSubmissionImageData(input.imageData),
    );
    const session = await this.getSession(code);

    if (!session) {
      throw new Error("This Ed.ie session does not exist. Check the code from your teacher.");
    }

    if (!session.isOpen) {
      throw new Error("This Ed.ie session is closed.");
    }

    assertSubmissionUsesEnabledInputs(
      session,
      submissionContent.text,
      submissionContent.drawingData,
      submissionContent.gifData,
      normalizeSubmissionImageData(input.imageData),
    );

    const data = await readStore();
    const timestamp = now();
    const submission: Submission = {
      id: input.id ?? randomUUID(),
      sessionCode: session.id,
      studentName: normalizeStudentName(input.studentName ?? ""),
      text: submissionContent.text,
      drawingData: submissionContent.drawingData,
      gifData: submissionContent.gifData,
      imageData: normalizeSubmissionImageData(input.imageData),
      status: session.submissionsScreeningEnabled ? "hidden" : "visible",
      version: 1,
      archivedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const existing = data.submissions.find((item) => item.id === submission.id);
    if (existing) {
      if (
        existing.sessionCode === submission.sessionCode &&
        existing.imageData?.objectKey === submission.imageData?.objectKey &&
        existing.imageData?.contentType === submission.imageData?.contentType &&
        existing.imageData?.byteSize === submission.imageData?.byteSize &&
        existing.imageData?.etag === submission.imageData?.etag
      ) return existing;
      throw new Error("That submission identifier is already in use.");
    }
    data.submissions.push(submission);
    await writeStore(data);
    return submission;
  },

  async getSubmission(id) {
    const data = await readStore();
    return data.submissions.find((submission) => submission.id === id) ?? null;
  },

  async updateSubmission(sessionCode, id, patch) {
    const data = await readStore();
    const index = data.submissions.findIndex(
      (submission) =>
        submission.id === id && submission.sessionCode === sessionCode,
    );

    if (index === -1) {
      return null;
    }

    const current = data.submissions[index];
    const next: Submission = {
      ...current,
      ...normalizeSubmissionPatch(patch),
      version: current.version + 1,
      updatedAt: now(),
    };

    assertSubmissionHasContent(next.text, next.drawingData, next.gifData, next.imageData);

    data.submissions[index] = next;
    await writeStore(data);
    return next;
  },

  async getSessionStats(code) {
    const sessionCode = normalizeSessionCode(code) || "demo-lecture";
    const data = await readStore();
    const submissions = data.submissions.filter(
      (submission) => submission.sessionCode === sessionCode,
    );

    return calculateStats(submissions);
  },

  async listQuestionBank(code) {
    const sessionCode = normalizeSessionCode(code) || "demo-lecture";
    const data = await readStore();

    return data.questionBank
      .filter((question) => question.sessionCode === sessionCode)
      .sort((a, b) => a.title.localeCompare(b.title));
  },

  async addQuestionToBank(code, text, title) {
    const session = await this.getSession(code);

    if (!session) {
      return null;
    }

    const questionText = validateQuestionText(text);
    const questionTitle = validateQuestionTitle(title, questionText);

    return serializeBankMutation(async () => {
      const data = await readStore();
      const questionKey = normalizeQuestionBankText(questionText);

      if (
        data.questionBank.some(
          (question) =>
            question.sessionCode === session.id &&
            normalizeQuestionBankText(question.text) === questionKey,
        )
      ) {
        throw new QuestionBankConflictError(
          "That question is already in the bank.",
        );
      }

      const timestamp = now();
      const question: QuestionBankItem = {
        id: randomUUID(),
        sessionCode: session.id,
        title: questionTitle,
        text: questionText,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      data.questionBank.push(question);
      await writeStore(data);
      return question;
    });
  },

  async getQuestionFromBank(id) {
    const data = await readStore();
    return data.questionBank.find((question) => question.id === id) ?? null;
  },

  async deleteQuestionFromBank(sessionCode, id) {
    return serializeBankMutation(async () => {
      const data = await readStore();
      const nextQuestionBank = data.questionBank.filter(
        (question) =>
          question.id !== id || question.sessionCode !== sessionCode,
      );

      if (nextQuestionBank.length === data.questionBank.length) {
        return false;
      }

      data.questionBank = nextQuestionBank;
      await writeStore(data);
      return true;
    });
  },

  async listPollQuestionBank(code) {
    const sessionCode = normalizeSessionCode(code) || "demo-lecture";
    const data = await readStore();

    return data.pollQuestionBank
      .filter((question) => question.sessionCode === sessionCode)
      .sort((left, right) => left.question.localeCompare(right.question));
  },

  async addPollQuestionToBank(code, title, question, selectionMode, options, correctOptionIndexes) {
    const session = await this.getSession(code);

    if (!session) {
      return null;
    }

    const definition = validatePollQuestionDefinition(
      question,
      selectionMode,
      options,
    );
    const questionTitle = validatePollQuestionTitle(title, definition.question);
    const normalizedCorrectOptionIndexes = validateCorrectOptionIndexes(
      definition.selectionMode,
      definition.optionLabels,
      correctOptionIndexes,
    );

    return serializeBankMutation(async () => {
      const data = await readStore();
      const questionKey = normalizeQuestionBankText(definition.question);

      if (
        data.pollQuestionBank.some(
          (bankQuestion) =>
            bankQuestion.sessionCode === session.id &&
            normalizeQuestionBankText(bankQuestion.question) === questionKey,
        )
      ) {
        throw new QuestionBankConflictError(
          "That poll question is already in the bank.",
        );
      }

      const timestamp = now();
      const bankQuestion: PollQuestionBankItem = {
        id: randomUUID(),
        sessionCode: session.id,
        title: questionTitle,
        question: definition.question,
        selectionMode: definition.selectionMode,
        options: definition.optionLabels,
        correctOptionIndexes: normalizedCorrectOptionIndexes,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      data.pollQuestionBank.push(bankQuestion);
      await writeStore(data);
      return bankQuestion;
    });
  },

  async updatePollQuestionInBank(code, id, question, selectionMode, options, correctOptionIndexes) {
    const sessionCode = normalizeSessionCode(code) || "demo-lecture";
    const definition = validatePollQuestionDefinition(question, selectionMode, options);
    const normalizedCorrectOptionIndexes = validateCorrectOptionIndexes(
      definition.selectionMode,
      definition.optionLabels,
      correctOptionIndexes,
    );

    return serializeBankMutation(async () => {
      const data = await readStore();
      const bankQuestion = data.pollQuestionBank.find(
        (item) => item.id === id && item.sessionCode === sessionCode,
      );

      if (!bankQuestion) {
        return null;
      }

      const questionKey = normalizeQuestionBankText(definition.question);

      if (
        data.pollQuestionBank.some(
          (item) =>
            item.id !== id &&
            item.sessionCode === sessionCode &&
            normalizeQuestionBankText(item.question) === questionKey,
        )
      ) {
        throw new QuestionBankConflictError(
          "That poll question is already in the bank.",
        );
      }

      bankQuestion.question = definition.question;
      bankQuestion.selectionMode = definition.selectionMode;
      bankQuestion.options = definition.optionLabels;
      bankQuestion.correctOptionIndexes = normalizedCorrectOptionIndexes;
      bankQuestion.updatedAt = now();
      await writeStore(data);
      return bankQuestion;
    });
  },

  async deletePollQuestionFromBank(code, id) {
    const sessionCode = normalizeSessionCode(code) || "demo-lecture";

    return serializeBankMutation(async () => {
      const data = await readStore();
      const nextBank = data.pollQuestionBank.filter(
        (question) => question.id !== id || question.sessionCode !== sessionCode,
      );

      if (nextBank.length === data.pollQuestionBank.length) {
        return false;
      }

      data.pollQuestionBank = nextBank;
      await writeStore(data);
      return true;
    });
  },

  async listGroupQuestions(code, voterId, options = {}) {
    const sessionCode = normalizeSessionCode(code) || "demo-lecture";
    const normalizedVoterId = voterId ? validateGroupQuestionVoterId(voterId) : "";
    const data = await readStore();

    return data.groupQuestions
      .filter((question) => question.sessionCode === sessionCode)
      .filter((question) => options.includeArchived || !question.archivedAt)
      .filter((question) => options.includeAnswered || !question.isAnswered)
      .filter((question) => options.includeHidden || question.isVisible)
      .map((question) => ({
        id: question.id,
        sessionCode: question.sessionCode,
        studentName: question.studentName,
        text: question.text,
        isAnswered: question.isAnswered,
        isVisible: question.isVisible,
        voteCount: question.voterIds.length,
        hasVoted: normalizedVoterId
          ? question.voterIds.includes(normalizedVoterId)
          : false,
        archivedAt: question.archivedAt,
        createdAt: question.createdAt,
        updatedAt: question.updatedAt,
      }))
      .sort(
        (a, b) =>
          Number(a.isAnswered) - Number(b.isAnswered) ||
          b.voteCount - a.voteCount ||
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  },

  async addGroupQuestion(code, text, studentName) {
    const session = await this.getSession(code);

    if (!session) {
      return null;
    }

    if (!session.isOpen) {
      throw new Error("This session is closed.");
    }

    const data = await readStore();
    const timestamp = now();
    const question: StoredGroupQuestion = {
      id: randomUUID(),
      sessionCode: session.id,
      studentName: normalizeStudentName(studentName ?? ""),
      text: validateGroupQuestionText(text),
      isAnswered: false,
      isVisible: !session.groupQuestionsScreeningEnabled,
      voterIds: [],
      archivedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    data.groupQuestions.push(question);
    await writeStore(data);

    return {
      ...question,
      hasVoted: false,
      voteCount: 0,
    };
  },

  async getGroupQuestion(id) {
    const data = await readStore();
    const question = data.groupQuestions.find((item) => item.id === id);

    if (!question) {
      return null;
    }

    return {
      id: question.id,
      sessionCode: question.sessionCode,
      studentName: question.studentName,
      text: question.text,
      isAnswered: question.isAnswered,
      isVisible: question.isVisible,
      voteCount: question.voterIds.length,
      hasVoted: false,
      archivedAt: question.archivedAt,
      createdAt: question.createdAt,
      updatedAt: question.updatedAt,
    };
  },

  async upvoteGroupQuestion(id, voterId) {
    const normalizedVoterId = validateGroupQuestionVoterId(voterId);
    const data = await readStore();
    const index = data.groupQuestions.findIndex((question) => question.id === id);

    if (index === -1) {
      return null;
    }

    const question = data.groupQuestions[index];
    const session = data.sessions.find(
      (storedSession) => storedSession.id === question.sessionCode,
    );

    if (!session?.isOpen) {
      throw new Error("This session is closed.");
    }

    if (!question.voterIds.includes(normalizedVoterId)) {
      question.voterIds.push(normalizedVoterId);
      question.updatedAt = now();
      data.groupQuestions[index] = question;
      await writeStore(data);
    }

    return {
      id: question.id,
      sessionCode: question.sessionCode,
      studentName: question.studentName,
      text: question.text,
      isAnswered: question.isAnswered,
      isVisible: question.isVisible,
      voteCount: question.voterIds.length,
      hasVoted: true,
      archivedAt: question.archivedAt,
      createdAt: question.createdAt,
      updatedAt: question.updatedAt,
    };
  },

  async unvoteGroupQuestion(id, voterId) {
    const normalizedVoterId = validateGroupQuestionVoterId(voterId);
    const data = await readStore();
    const index = data.groupQuestions.findIndex((question) => question.id === id);

    if (index === -1) {
      return null;
    }

    const question = data.groupQuestions[index];
    const session = data.sessions.find(
      (storedSession) => storedSession.id === question.sessionCode,
    );

    if (!session?.isOpen) {
      throw new Error("This session is closed.");
    }

    const nextVoterIds = question.voterIds.filter(
      (storedVoterId) => storedVoterId !== normalizedVoterId,
    );

    if (nextVoterIds.length !== question.voterIds.length) {
      question.voterIds = nextVoterIds;
      question.updatedAt = now();
      data.groupQuestions[index] = question;
      await writeStore(data);
    }

    return {
      id: question.id,
      sessionCode: question.sessionCode,
      studentName: question.studentName,
      text: question.text,
      isAnswered: question.isAnswered,
      isVisible: question.isVisible,
      voteCount: question.voterIds.length,
      hasVoted: false,
      archivedAt: question.archivedAt,
      createdAt: question.createdAt,
      updatedAt: question.updatedAt,
    };
  },

  async setGroupQuestionAnswered(sessionCode, id, isAnswered) {
    const data = await readStore();
    const index = data.groupQuestions.findIndex(
      (question) =>
        question.id === id && question.sessionCode === sessionCode,
    );

    if (index === -1) {
      return null;
    }

    const question = data.groupQuestions[index];

    if (question.isAnswered !== isAnswered) {
      question.isAnswered = isAnswered;
      question.updatedAt = now();
      data.groupQuestions[index] = question;
      await writeStore(data);
    }

    return {
      id: question.id,
      sessionCode: question.sessionCode,
      studentName: question.studentName,
      text: question.text,
      isAnswered: question.isAnswered,
      isVisible: question.isVisible,
      voteCount: question.voterIds.length,
      hasVoted: false,
      archivedAt: question.archivedAt,
      createdAt: question.createdAt,
      updatedAt: question.updatedAt,
    };
  },

  async setGroupQuestionVisible(sessionCode, id, isVisible) {
    const data = await readStore();
    const index = data.groupQuestions.findIndex(
      (question) =>
        question.id === id && question.sessionCode === sessionCode,
    );

    if (index === -1) {
      return null;
    }

    const question = data.groupQuestions[index];

    if (question.isVisible !== isVisible) {
      question.isVisible = isVisible;
      question.updatedAt = now();
      data.groupQuestions[index] = question;
      await writeStore(data);
    }

    return {
      id: question.id,
      sessionCode: question.sessionCode,
      studentName: question.studentName,
      text: question.text,
      isAnswered: question.isAnswered,
      isVisible: question.isVisible,
      voteCount: question.voterIds.length,
      hasVoted: false,
      archivedAt: question.archivedAt,
      createdAt: question.createdAt,
      updatedAt: question.updatedAt,
    };
  },

  async getActivePoll(code) {
    const sessionCode = normalizeSessionCode(code) || "demo-lecture";
    const data = await readStore();
    return (
      data.polls
        .filter(
          (poll) =>
            poll.sessionCode === sessionCode &&
            poll.status === "active",
        )
        .sort(
          (left, right) =>
            new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime(),
        )[0] ?? null
    );
  },

  async getLatestPoll(code) {
    const sessionCode = normalizeSessionCode(code) || "demo-lecture";
    const data = await readStore();

    return (
      data.polls
        .filter((poll) => poll.sessionCode === sessionCode)
        .sort(
          (left, right) =>
            new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime(),
        )[0] ?? null
    );
  },

  async getPollHistory(code) {
    const sessionCode = normalizeSessionCode(code) || "demo-lecture";
    const data = await readStore();
    const polls = data.polls
      .filter((poll) => poll.sessionCode === sessionCode)
      .sort(
        (left, right) =>
          new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime(),
      );

    return polls.map((poll) => {
      const responses = data.pollResponses.filter(
        (response) => response.pollId === poll.id,
      );

      return {
        poll,
        responseCount: responses.length,
        options: poll.options.map((option) => ({
          ...option,
          responseCount: responses.filter((response) =>
            response.optionIds.includes(option.id),
          ).length,
        })),
      };
    });
  },

  async getPoll(id) {
    const data = await readStore();
    return data.polls.find((poll) => poll.id === id) ?? null;
  },

  async startPoll(code, question, selectionMode, optionLabels, correctOptionIndexes, durationSeconds) {
    const session = await this.getSession(code);

    if (!session) {
      return null;
    }

    if (!session.isOpen) {
      throw new Error("This session is closed.");
    }

    const definition = validatePollDefinition(
      question,
      selectionMode,
      optionLabels,
      durationSeconds,
    );
    const data = await readStore();
    const timestamp = now();
    const correctIndexes = validateCorrectOptionIndexes(
      definition.selectionMode,
      definition.optionLabels,
      correctOptionIndexes,
    );

    data.polls = data.polls.map((poll) =>
      poll.sessionCode === session.id && poll.status === "active"
        ? {
            ...poll,
            status: "ended",
            votingEndedAt: poll.votingEndedAt ?? timestamp,
            endedAt: timestamp,
            updatedAt: timestamp,
          }
        : poll,
    );

    const poll: SessionPoll = {
      id: randomUUID(),
      sessionCode: session.id,
      question: definition.question,
      selectionMode: definition.selectionMode,
      options: definition.optionLabels.map((label, position) => ({
        id: randomUUID(),
        label,
        position,
      })),
      correctOptionIds: [],
      solutionRevealed: false,
      status: "active",
      durationSeconds: definition.durationSeconds,
      startedAt: timestamp,
      endsAt: new Date(
        new Date(timestamp).getTime() + definition.durationSeconds * 1000,
      ).toISOString(),
      votingEndedAt: null,
      endedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    poll.correctOptionIds = correctIndexes.map((index) => poll.options[index].id);

    data.polls.push(poll);
    await writeStore(data);
    return poll;
  },

  async extendPoll(id, seconds) {
    const extension = validatePollExtension(seconds);
    const data = await readStore();
    const poll = data.polls.find((item) => item.id === id);

    if (!poll) {
      return null;
    }

    if (poll.status !== "active") {
      throw new Error("This poll has been ended.");
    }

    if (poll.votingEndedAt || new Date(poll.endsAt).getTime() <= Date.now()) {
      throw new Error("This poll timer has ended.");
    }

    const timestamp = now();
    const baseTime = Math.max(Date.now(), new Date(poll.endsAt).getTime());
    poll.endsAt = new Date(baseTime + extension * 1000).toISOString();
    poll.durationSeconds += extension;
    poll.updatedAt = timestamp;
    await writeStore(data);
    return poll;
  },

  async finishPoll(id) {
    const data = await readStore();
    const poll = data.polls.find((item) => item.id === id);

    if (!poll) {
      return null;
    }

    if (poll.status !== "active") {
      throw new Error("This poll has been closed.");
    }

    const timestamp = now();

    if (!poll.votingEndedAt) {
      poll.votingEndedAt = timestamp;
      poll.updatedAt = timestamp;
      await writeStore(data);
    }

    return poll;
  },

  async endPoll(id) {
    const data = await readStore();
    const poll = data.polls.find((item) => item.id === id);

    if (!poll) {
      return null;
    }

    if (poll.status === "active") {
      const timestamp = now();
      poll.status = "ended";
      poll.votingEndedAt ??= timestamp;
      poll.endedAt = timestamp;
      poll.updatedAt = timestamp;
      await writeStore(data);
    }

    return poll;
  },

  async restartPoll(id) {
    const data = await readStore();
    const poll = data.polls.find((item) => item.id === id);

    if (!poll) {
      return null;
    }

    const isExpired =
      poll.status === "active" &&
      (poll.votingEndedAt !== null || Date.parse(poll.endsAt) <= Date.now());
    const restartable = poll.status === "ended" || isExpired;

    if (!restartable) {
      throw new Error("Only finished polls can be restarted.");
    }

    const session = data.sessions.find(
      (storedSession) => storedSession.id === poll.sessionCode,
    );

    if (!session?.isOpen) {
      throw new Error("This session is closed.");
    }

    const timestamp = now();
    // Auto-end other active polls for this session (like startPoll)
    data.polls = data.polls.map((item) =>
      item.sessionCode === poll.sessionCode &&
      item.status === "active" &&
      item.id !== id
        ? {
            ...item,
            status: "ended",
            votingEndedAt: item.votingEndedAt ?? timestamp,
            endedAt: timestamp,
            updatedAt: timestamp,
          }
        : item,
    );

    poll.status = "active";
    poll.endedAt = null;
    poll.votingEndedAt = null;
    poll.solutionRevealed = false;
    poll.endsAt = new Date(
      Date.now() + poll.durationSeconds * 1000,
    ).toISOString();
    poll.updatedAt = timestamp;
    await writeStore(data);
    return poll;
  },

  async revealPollSolution(id) {
    const data = await readStore();
    const poll = data.polls.find((item) => item.id === id);

    if (!poll) {
      return null;
    }

    if (!poll.solutionRevealed) {
      poll.solutionRevealed = true;
      poll.updatedAt = now();
      await writeStore(data);
    }

    return poll;
  },

  async getPollResponse(pollId, participantId) {
    const normalizedParticipantId = validatePollParticipantId(participantId);
    const data = await readStore();

    return (
      data.pollResponses.find(
        (response) =>
          response.pollId === pollId &&
          response.participantId === normalizedParticipantId,
      ) ?? null
    );
  },

  async savePollResponse(pollId, participantId, optionIds) {
    const normalizedParticipantId = validatePollParticipantId(participantId);
    const data = await readStore();
    const poll = data.polls.find((item) => item.id === pollId);

    if (!poll) {
      return null;
    }

    const session = data.sessions.find(
      (storedSession) => storedSession.id === poll.sessionCode,
    );

    if (!session?.isOpen) {
      throw new Error("This session is closed.");
    }

    if (
      poll.status !== "active" ||
      poll.solutionRevealed ||
      poll.votingEndedAt !== null ||
      new Date(poll.endsAt).getTime() <= Date.now()
    ) {
      throw new Error("This poll is no longer accepting answers.");
    }

    const selectedOptionIds = [...new Set(optionIds)];
    const validOptionIds = new Set(poll.options.map((option) => option.id));

    if (selectedOptionIds.some((optionId) => !validOptionIds.has(optionId))) {
      throw new Error("That poll answer could not be found.");
    }

    if (poll.selectionMode === "single" && selectedOptionIds.length !== 1) {
      throw new Error("Choose one answer for this poll.");
    }

    const response: PollResponse = {
      pollId: poll.id,
      participantId: normalizedParticipantId,
      optionIds: selectedOptionIds,
      updatedAt: now(),
    };
    const existingIndex = data.pollResponses.findIndex(
      (item) =>
        item.pollId === poll.id &&
        item.participantId === normalizedParticipantId,
    );

    if (existingIndex === -1) {
      data.pollResponses.push(response);
    } else {
      data.pollResponses[existingIndex] = response;
    }

    await writeStore(data);
    return response;
  },

  async getPollResults(id) {
    const data = await readStore();
    const poll = data.polls.find((item) => item.id === id);

    if (!poll) {
      return null;
    }

    const responses = data.pollResponses.filter((response) => response.pollId === id);

    return {
      poll,
      responseCount: responses.length,
      options: poll.options.map((option) => ({
        ...option,
        responseCount: responses.filter((response) =>
          response.optionIds.includes(option.id),
        ).length,
      })),
    };
  },

  async archiveSessionActivity(code) {
    const sessionCode = normalizeSessionCode(code) || "demo-lecture";
    const session = await this.getSession(sessionCode);

    if (!session) {
      return null;
    }

    const data = await readStore();
    const archivedAt = now();
    let submissions = 0;
    let groupQuestions = 0;

    data.submissions = data.submissions.map((submission) => {
      if (submission.sessionCode !== session.id || submission.archivedAt) {
        return submission;
      }

      submissions += 1;
      return {
        ...submission,
        archivedAt,
        updatedAt: archivedAt,
      };
    });

    data.groupQuestions = data.groupQuestions.map((question) => {
      if (question.sessionCode !== session.id || question.archivedAt) {
        return question;
      }

      groupQuestions += 1;
      return {
        ...question,
        archivedAt,
        updatedAt: archivedAt,
      };
    });

    await writeStore(data);

    return {
      archivedAt,
      groupQuestions,
      submissions,
    };
  },

  async unarchiveSessionActivity(code, archivedAt) {
    const sessionCode = normalizeSessionCode(code) || "demo-lecture";
    const session = await this.getSession(sessionCode);

    if (!session) {
      return null;
    }

    const archiveDate = new Date(archivedAt);

    if (!Number.isFinite(archiveDate.getTime())) {
      throw new Error("Archive timestamp could not be read.");
    }

    const data = await readStore();
    const restoredAt = now();
    let submissions = 0;
    let groupQuestions = 0;

    data.submissions = data.submissions.map((submission) => {
      if (
        submission.sessionCode !== session.id ||
        submission.archivedAt !== archivedAt
      ) {
        return submission;
      }

      submissions += 1;
      return {
        ...submission,
        archivedAt: null,
        updatedAt: restoredAt,
      };
    });

    data.groupQuestions = data.groupQuestions.map((question) => {
      if (
        question.sessionCode !== session.id ||
        question.archivedAt !== archivedAt
      ) {
        return question;
      }

      groupQuestions += 1;
      return {
        ...question,
        archivedAt: null,
        updatedAt: restoredAt,
      };
    });

    await writeStore(data);

    return {
      archivedAt,
      groupQuestions,
      submissions,
    };
  },
};
