"use client";

import { useActionState } from "react";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { DISPLAY_NAME_MAX_LENGTH } from "@/lib/user-profile";
import {
  updateDisplayName,
  type ProfileFormState,
} from "./actions";

const initialState: ProfileFormState = { status: "idle", message: "" };

export function ProfileForm({ displayName }: { displayName: string }) {
  const [state, formAction] = useActionState(updateDisplayName, initialState);

  return (
    <form
      action={formAction}
      className="grid grid-cols-[minmax(0,1fr)_7rem] items-start gap-3 py-4 sm:grid-cols-[7rem_minmax(0,1fr)_7rem]"
    >
      <label
        className="col-span-2 text-sm font-semibold text-slate-700 sm:col-span-1 sm:pt-2.5"
        htmlFor="display-name"
      >
        Display name
      </label>
      <input
        autoComplete="name"
        className="h-10 min-w-0 rounded-md border border-slate-300 px-3 text-slate-950 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
        defaultValue={displayName}
        id="display-name"
        maxLength={DISPLAY_NAME_MAX_LENGTH}
        name="displayName"
        required
        type="text"
      />
      <PendingSubmitButton
        className="h-10 w-28 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700"
        pendingChildren="Saving..."
      >
        Save
      </PendingSubmitButton>

      {state.message ? (
        <p
          className={`col-span-2 rounded-md border px-3 py-2 text-sm font-medium sm:col-start-2 ${
            state.status === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
