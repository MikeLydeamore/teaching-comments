"use client";

import { useRef, useState } from "react";
import { deleteHostedSpace } from "@/app/host/[sessionCode]/settings/actions";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";

export function DeleteSpaceDialog({
  spaceCode,
  spaceName,
  retentionDays,
}: {
  spaceCode: string;
  spaceName: string;
  retentionDays: number;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [confirmation, setConfirmation] = useState("");

  function close() {
    dialogRef.current?.close();
    setConfirmation("");
  }

  return (
    <>
      <button
        className="rounded-md border border-red-300 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:border-red-500 hover:bg-red-50"
        onClick={() => dialogRef.current?.showModal()}
        type="button"
      >
        Delete space
      </button>
      <dialog
        aria-labelledby="delete-space-title"
        className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-md border border-red-200 bg-white p-0 text-slate-950 shadow-2xl backdrop:bg-slate-950/50"
        ref={dialogRef}
      >
        <form action={deleteHostedSpace} className="p-6">
          <input name="spaceCode" type="hidden" value={spaceCode} />
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-red-700">
            Recoverable deletion
          </p>
          <h2 className="mt-2 text-2xl font-semibold" id="delete-space-title">
            Delete {spaceName}?
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            This immediately hides the hosted space and closes its sessions. An Ed.ie admin can restore it for {retentionDays} days; after that, the space and all its data are permanently deleted.
          </p>
          <label className="mt-5 block text-sm font-semibold text-slate-700" htmlFor="delete-space-confirmation">
            Type <span className="font-mono text-red-700">{spaceCode}</span> to confirm
          </label>
          <input
            autoCapitalize="none"
            autoComplete="off"
            className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 font-mono outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100"
            id="delete-space-confirmation"
            name="confirmation"
            onChange={(event) => setConfirmation(event.target.value)}
            required
            spellCheck={false}
            value={confirmation}
          />
          <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5">
            <button
              className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-teal-500 hover:text-teal-800"
              onClick={close}
              type="button"
            >
              Cancel
            </button>
            <PendingSubmitButton
              className="edie-danger-button rounded-md bg-red-700 px-4 py-2.5 text-sm font-semibold text-white enabled:hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={confirmation !== spaceCode}
              pendingChildren="Deleting..."
            >
              Delete space
            </PendingSubmitButton>
          </div>
        </form>
      </dialog>
    </>
  );
}
