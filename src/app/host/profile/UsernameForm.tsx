"use client";

import { useActionState } from "react";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import {
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from "@/lib/user-profile";
import { updateUsername, type UsernameFormState } from "./actions";

const initialState: UsernameFormState = { status: "idle", message: "" };

export function UsernameForm({
  compact = false,
  displayUsername,
}: {
  compact?: boolean;
  displayUsername?: string | null;
}) {
  const [state, formAction] = useActionState(updateUsername, initialState);

  return (
    <form
      action={formAction}
      className={compact
        ? "space-y-4"
        : "grid grid-cols-[minmax(0,1fr)_7rem] items-start gap-3 py-4 sm:grid-cols-[7rem_minmax(0,1fr)_7rem]"}
    >
      <label
        className={compact
          ? "block text-sm font-semibold text-slate-700"
          : "col-span-2 text-sm font-semibold text-slate-700 sm:col-span-1 sm:pt-2.5"}
        htmlFor={compact ? "setup-username" : "profile-username"}
      >
        Username
      </label>
      <div className="relative min-w-0">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-semibold text-slate-500">
          @
        </span>
        <input
          autoCapitalize="none"
          autoComplete="username"
          className="h-10 w-full rounded-md border border-slate-300 pl-8 pr-3 text-slate-950 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
          defaultValue={displayUsername ?? ""}
          id={compact ? "setup-username" : "profile-username"}
          maxLength={USERNAME_MAX_LENGTH + 1}
          minLength={USERNAME_MIN_LENGTH}
          name="username"
          pattern="@?[A-Za-z0-9][A-Za-z0-9_]{2,29}"
          required
          spellCheck={false}
        />
      </div>
      <PendingSubmitButton
        className={compact
          ? "h-10 w-full rounded-md bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700"
          : "h-10 w-28 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700"}
        pendingChildren="Saving..."
      >
        Save
      </PendingSubmitButton>

      <p className={compact
        ? "text-xs leading-5 text-slate-500"
        : "col-span-2 text-xs leading-5 text-slate-500 sm:col-start-2"}
      >
        {USERNAME_MIN_LENGTH}–{USERNAME_MAX_LENGTH} characters. Use letters, numbers,
        and underscores. Other hosts will see this instead of your email.
      </p>
      {state.message ? (
        <p
          className={`${compact ? "" : "col-span-2 sm:col-start-2"} rounded-md border px-3 py-2 text-sm font-medium ${
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
