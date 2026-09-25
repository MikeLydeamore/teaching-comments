import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuth: vi.fn(),
  getCurrentTeacher: vi.fn(),
  ensurePersonalOrganization: vi.fn(),
  headers: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
  revalidatePath: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth", () => ({ getAuth: mocks.getAuth }));
vi.mock("@/lib/auth-server", () => ({
  getCurrentTeacher: mocks.getCurrentTeacher,
}));
vi.mock("@/lib/edie-store", () => ({
  ensurePersonalOrganization: mocks.ensurePersonalOrganization,
}));
vi.mock("@/lib/teacher-session-auth", () => ({
  loginRedirectPath: (path: string) => `/auth/login?returnTo=${encodeURIComponent(path)}`,
}));

import { updateDisplayName, updateUsername } from "./actions";

const initialState = { status: "idle" as const, message: "" };
const teacher = {
  id: "teacher-id",
  name: "Jane Smith",
  email: "jane@example.com",
  emailVerified: true,
  image: null,
  username: "jane_smith",
  displayUsername: "Jane_Smith",
};

function profileForm(displayName: string) {
  const formData = new FormData();
  formData.set("displayName", displayName);
  return formData;
}

function usernameForm(username: string) {
  const formData = new FormData();
  formData.set("username", username);
  return formData;
}

describe("updateDisplayName", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentTeacher.mockResolvedValue(teacher);
    mocks.headers.mockResolvedValue(new Headers());
    mocks.updateUser.mockResolvedValue({ status: true });
    mocks.ensurePersonalOrganization.mockResolvedValue({});
    mocks.getAuth.mockReturnValue({ api: { updateUser: mocks.updateUser } });
  });

  it("requires an authenticated teacher", async () => {
    mocks.getCurrentTeacher.mockResolvedValue(null);

    await expect(
      updateDisplayName(initialState, profileForm("Dr Jane Smith")),
    ).rejects.toThrow("redirect:/auth/login?returnTo=%2Fhost%2Fprofile");
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("returns validation errors without updating the account", async () => {
    await expect(updateDisplayName(initialState, profileForm("   "))).resolves.toEqual({
      status: "error",
      message: "Enter a display name.",
    });
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("does not write an unchanged display name", async () => {
    await expect(
      updateDisplayName(initialState, profileForm(teacher.name)),
    ).resolves.toEqual({
      status: "success",
      message: "Your display name is already up to date.",
    });
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("updates Better Auth with the trimmed display name", async () => {
    await expect(
      updateDisplayName(initialState, profileForm("  Dr Jane Smith  ")),
    ).resolves.toEqual({
      status: "success",
      message: "Your display name has been updated.",
    });
    expect(mocks.updateUser).toHaveBeenCalledWith({
      body: { name: "Dr Jane Smith" },
      headers: expect.any(Headers),
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/host", "layout");
  });

  it("returns a retryable error when Better Auth fails", async () => {
    mocks.updateUser.mockRejectedValue(new Error("database unavailable"));

    await expect(
      updateDisplayName(initialState, profileForm("Dr Jane Smith")),
    ).resolves.toEqual({
      status: "error",
      message: "We could not update your display name. Please try again.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("updateUsername", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentTeacher.mockResolvedValue(teacher);
    mocks.headers.mockResolvedValue(new Headers());
    mocks.updateUser.mockResolvedValue({ status: true });
    mocks.ensurePersonalOrganization.mockResolvedValue({});
    mocks.getAuth.mockReturnValue({ api: { updateUser: mocks.updateUser } });
  });

  it("requires an authenticated teacher", async () => {
    mocks.getCurrentTeacher.mockResolvedValue(null);

    await expect(
      updateUsername(initialState, usernameForm("New_Name")),
    ).rejects.toThrow("redirect:/auth/login?returnTo=%2Fhost%2Fprofile");
  });

  it("returns username validation errors without updating", async () => {
    await expect(
      updateUsername(initialState, usernameForm("bad-name")),
    ).resolves.toMatchObject({ status: "error" });
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("does not write an unchanged username and display case", async () => {
    await expect(
      updateUsername(initialState, usernameForm("@Jane_Smith")),
    ).resolves.toEqual({
      status: "success",
      message: "Your username is already up to date.",
    });
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(mocks.ensurePersonalOrganization).toHaveBeenCalledWith("teacher-id", "Jane Smith");
  });

  it("updates the canonical and case-preserving username", async () => {
    await expect(
      updateUsername(initialState, usernameForm("@New_Name")),
    ).resolves.toEqual({
      status: "success",
      message: "Your username is now @New_Name.",
    });
    expect(mocks.updateUser).toHaveBeenCalledWith({
      body: { username: "new_name", displayUsername: "New_Name" },
      headers: expect.any(Headers),
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout");
    expect(mocks.ensurePersonalOrganization).toHaveBeenCalledWith("teacher-id", "Jane Smith");
  });

  it("allows a display-case-only username change", async () => {
    await expect(
      updateUsername(initialState, usernameForm("Jane_SMITH")),
    ).resolves.toEqual({
      status: "success",
      message: "Your username is now @Jane_SMITH.",
    });
    expect(mocks.updateUser).toHaveBeenCalledWith({
      body: { username: "jane_smith", displayUsername: "Jane_SMITH" },
      headers: expect.any(Headers),
    });
  });

  it("maps uniqueness races to a useful error", async () => {
    mocks.updateUser.mockRejectedValue(new Error("Username is already taken"));

    await expect(
      updateUsername(initialState, usernameForm("New_Name")),
    ).resolves.toEqual({
      status: "error",
      message: "That username is already taken.",
    });
  });

  it("reports incomplete organization provisioning separately", async () => {
    mocks.ensurePersonalOrganization.mockRejectedValue(
      new Error("storage unavailable"),
    );

    await expect(
      updateUsername(initialState, usernameForm("New_Name")),
    ).resolves.toEqual({
      status: "error",
      message:
        "Your username was saved, but account setup could not be completed. Please try again.",
    });
    expect(mocks.updateUser).toHaveBeenCalled();
  });
});
