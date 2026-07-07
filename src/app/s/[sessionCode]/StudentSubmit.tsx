"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DrawingPad } from "@/components/DrawingPad";
import type { DrawingData } from "@/lib/qwt-store";

type StudentSubmitProps = {
  initialStudentName: string;
  sessionCode: string;
  prompt: string;
};

type SavedSubmission = {
  id: string;
  text: string;
  drawingData: DrawingData | null;
  createdAt: string;
};

export function StudentSubmit({
  initialStudentName,
  sessionCode,
  prompt,
}: StudentSubmitProps) {
  const [currentPrompt, setCurrentPrompt] = useState(prompt);
  const [sessionIsOpen, setSessionIsOpen] = useState(true);
  const [promptUpdatedAt, setPromptUpdatedAt] = useState<Date | null>(null);
  const [studentName, setStudentName] = useState(initialStudentName);
  const [text, setText] = useState("");
  const [drawingData, setDrawingData] = useState<DrawingData | null>(null);
  const [drawingResetSignal, setDrawingResetSignal] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [website, setWebsite] = useState("");
  const [saved, setSaved] = useState<SavedSubmission | null>(null);

  const remaining = useMemo(() => 2000 - text.length, [text]);
  const hasSubmissionContent = text.trim().length >= 1 || drawingData !== null;

  const refreshSession = useCallback(async () => {
    const response = await fetch(`/api/sessions/${sessionCode}/student`);

    if (!response.ok) {
      return;
    }

    const payload = await response.json();
    const nextPrompt = payload.session?.prompt;
    const nextIsOpen = payload.session?.isOpen;

    if (typeof nextPrompt === "string") {
      setCurrentPrompt((previousPrompt) => {
        if (previousPrompt !== nextPrompt) {
          setPromptUpdatedAt(new Date());
        }

        return nextPrompt;
      });
    }

    if (typeof nextIsOpen === "boolean") {
      setSessionIsOpen(nextIsOpen);
    }
  }, [sessionCode]);

  useEffect(() => {
    const firstRefresh = window.setTimeout(() => {
      void refreshSession();
    }, 0);
    const timer = window.setInterval(() => {
      void refreshSession();
    }, 3000);

    return () => {
      window.clearTimeout(firstRefresh);
      window.clearInterval(timer);
    };
  }, [refreshSession]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSaving(true);

    const response = await fetch(`/api/sessions/${sessionCode}/submissions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        drawingData,
        privacyAccepted,
        studentName,
        text,
        website,
      }),
    });

    const payload = await response.json();
    setIsSaving(false);

    if (!response.ok) {
      setError(payload.error ?? "Could not save your writing.");
      return;
    }

    setSaved(payload.submission);
    setText("");
    setDrawingData(null);
    setDrawingResetSignal((currentSignal) => currentSignal + 1);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-5 py-8">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-teal-700">
            Quick Write
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-normal text-slate-950">
            Write a response
          </h1>
        </div>
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-right text-sm shadow-sm">
          <p className="font-medium text-slate-900">{sessionCode}</p>
          <p className="text-slate-500">session</p>
        </div>
      </div>

      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-500">Prompt</p>
          {promptUpdatedAt ? (
            <p className="rounded-md bg-teal-50 px-2 py-1 text-xs font-medium text-teal-800">
              Updated {promptUpdatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          ) : (
            <p className="text-xs text-slate-500">Updates automatically</p>
          )}
        </div>
        <p className="mt-2 text-lg leading-7 text-slate-900">{currentPrompt}</p>
        {!sessionIsOpen ? (
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
            This session is closed. You can still read the prompt, but new
            submissions are not being accepted.
          </p>
        ) : null}
      </section>

      <form className="mt-5 rounded-md border border-slate-200 bg-white p-5 shadow-sm" onSubmit={handleSubmit}>
        <label className="text-sm font-semibold text-slate-700" htmlFor="student-name">
          Name
        </label>
        <input
          autoComplete="name"
          className="mt-3 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-slate-950 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
          id="student-name"
          maxLength={80}
          placeholder="Anonymous"
          value={studentName}
          onChange={(event) => setStudentName(event.target.value)}
        />
        <p className="mt-2 text-xs leading-5 text-slate-500">
          Optional. Leave blank to submit as Anonymous.
        </p>
        <label className="mt-5 block text-sm font-semibold text-slate-700" htmlFor="quick-write">
          Your writing
        </label>
        <input
          aria-hidden="true"
          autoComplete="off"
          className="hidden"
          name="website"
          tabIndex={-1}
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
        />
        <textarea
          id="quick-write"
          className="mt-3 min-h-40 w-full resize-y rounded-md border border-slate-300 bg-white p-4 text-lg leading-7 text-slate-950 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
          maxLength={2000}
          placeholder="Type your response here..."
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <DrawingPad
          disabled={!sessionIsOpen || isSaving}
          key={drawingResetSignal}
          onChange={setDrawingData}
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className={`text-sm ${remaining < 100 ? "text-amber-700" : "text-slate-500"}`}>
            {remaining} characters remaining
          </p>
          <button
            className="inline-flex h-11 items-center justify-center rounded-md bg-amber-300 px-5 text-base font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSaving || !sessionIsOpen || !hasSubmissionContent}
            type="submit"
          >
            {isSaving ? "Submitting..." : "Submit writing"}
          </button>
        </div>
        <label className="mt-4 flex gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
          <input
            checked={privacyAccepted}
            className="mt-1 size-4 rounded border-slate-300"
            type="checkbox"
            onChange={(event) => setPrivacyAccepted(event.target.checked)}
          />
          <span>
            I understand my writing or drawing, timestamp, and session code
            will be stored for this teaching activity. If I provide a name,
            that name will also be stored and visible to teaching staff. I will
            avoid including student IDs or other identifying details.{" "}
            <Link className="font-semibold text-teal-700 underline" href="/privacy">
              Read the privacy notice
            </Link>
            .
          </span>
        </label>
        {error ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800" role="alert">
            {error}
          </p>
        ) : null}
      </form>

      {saved ? (
        <aside className="mt-5 rounded-md border border-teal-200 bg-teal-50 p-4 text-teal-950" role="status">
          <p className="font-semibold">Saved. Thanks.</p>
          <p className="mt-1 text-sm">
            Submitted at {new Date(saved.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.
          </p>
        </aside>
      ) : null}
    </main>
  );
}
