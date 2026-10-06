"use client";

import { useRef, useState } from "react";
import { createHostedSpace } from "@/app/host/actions";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";

function codeFromName(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function CreateSpaceDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [spaceCode, setSpaceCode] = useState("");
  const [codeEdited, setCodeEdited] = useState(false);

  return (
    <>
      <button
        className="rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
        onClick={() => dialogRef.current?.showModal()}
        type="button"
      >
        Create space
      </button>
      <dialog
        aria-labelledby="create-space-title"
        className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-md border border-slate-200 bg-white p-0 text-slate-950 shadow-2xl backdrop:bg-slate-950/50"
        ref={dialogRef}
      >
        <form action={createHostedSpace} className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-teal-700">
                New hosted space
              </p>
              <h2 className="mt-2 text-2xl font-semibold" id="create-space-title">
                Create a space
              </h2>
            </div>
            <button
              aria-label="Close"
              className="flex h-9 w-9 items-center justify-center rounded-md text-2xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              onClick={() => dialogRef.current?.close()}
              type="button"
            >
              ×
            </button>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            A space code is permanent and is used in join links. Your plan&apos;s hosted-space limit applies.
          </p>
          <div className="mt-5">
            <label className="text-sm font-semibold text-slate-700" htmlFor="new-space-name">
              Space name
            </label>
            <input
              autoFocus
              className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
              id="new-space-name"
              maxLength={120}
              name="spaceName"
              onChange={(event) => {
                if (!codeEdited) setSpaceCode(codeFromName(event.target.value));
              }}
              placeholder="Year 10 Science"
              required
            />
          </div>
          <div className="mt-4">
            <label className="text-sm font-semibold text-slate-700" htmlFor="new-space-code">
              Space code
            </label>
            <input
              autoCapitalize="none"
              className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 font-mono outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
              id="new-space-code"
              name="spaceCode"
              onChange={(event) => {
                setCodeEdited(true);
                setSpaceCode(codeFromName(event.target.value));
              }}
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              placeholder="year-10-science"
              required
              spellCheck={false}
              value={spaceCode}
            />
            <p className="mt-1.5 text-xs text-slate-500">Lowercase letters, numbers, and single hyphens only.</p>
          </div>
          <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5">
            <button
              className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-teal-500 hover:text-teal-800"
              onClick={() => dialogRef.current?.close()}
              type="button"
            >
              Cancel
            </button>
            <PendingSubmitButton
              className="rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
              pendingChildren="Creating..."
            >
              Create space
            </PendingSubmitButton>
          </div>
        </form>
      </dialog>
    </>
  );
}
