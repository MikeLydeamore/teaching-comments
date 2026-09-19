"use client";

import { logoutTeacher } from "@/app/host/actions";
import { UsernameForm } from "@/app/host/profile/UsernameForm";

export function UsernameSetupGate({ name }: { name: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-5 py-8">
      <section className="w-full max-w-md rounded-md border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-teal-700">
          One last step
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-normal text-slate-950">
          Choose your Ed.ie username
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Welcome, {name}. Your username lets other hosts invite you without
          sharing your sign-in email.
        </p>
        <div className="mt-5">
          <UsernameForm compact />
        </div>
        <form action={logoutTeacher} className="mt-4 border-t border-slate-200 pt-4">
          <input name="next" type="hidden" value="/auth/login" />
          <button
            className="text-sm font-semibold text-slate-600 transition hover:text-red-700"
            type="submit"
          >
            Sign out
          </button>
        </form>
      </section>
    </main>
  );
}
