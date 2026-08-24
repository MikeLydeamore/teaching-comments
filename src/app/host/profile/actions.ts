"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { getCurrentTeacher } from "@/lib/auth-server";
import { loginRedirectPath } from "@/lib/teacher-session-auth";
import { validateDisplayName } from "../../../lib/user-profile";

export type ProfileFormState = {
  status: "idle" | "error" | "success";
  message: string;
};

export async function updateDisplayName(
  _previousState: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const teacher = await getCurrentTeacher();

  if (!teacher) {
    redirect(loginRedirectPath("/host/profile"));
  }

  const result = validateDisplayName(formData.get("displayName"));

  if (!result.ok) {
    return { status: "error", message: result.message };
  }

  if (result.value === teacher.name) {
    return {
      status: "success",
      message: "Your display name is already up to date.",
    };
  }

  try {
    await getAuth().api.updateUser({
      body: { name: result.value },
      headers: await headers(),
    });
  } catch {
    return {
      status: "error",
      message: "We could not update your display name. Please try again.",
    };
  }

  revalidatePath("/host", "layout");

  return {
    status: "success",
    message: "Your display name has been updated.",
  };
}
