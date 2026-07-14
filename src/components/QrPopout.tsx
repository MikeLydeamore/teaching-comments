"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { QrCode } from "@/components/QrCode";

type QrPopoutProps = {
  dashboardUrl: string;
  sessionTitle: string;
  studentUrl: string;
};

function getBrowserOrigin() {
  return window.location.origin;
}

function getServerOrigin() {
  return "";
}

function subscribeToNoop() {
  return () => {};
}

export function QrPopout({
  dashboardUrl,
  sessionTitle,
  studentUrl,
}: QrPopoutProps) {
  const origin = useSyncExternalStore(
    subscribeToNoop,
    getBrowserOrigin,
    getServerOrigin,
  );
  const studentShareUrl = origin ? `${origin}${studentUrl}` : "";

  return (
    <main className="min-h-screen bg-white px-5 py-5 text-slate-950">
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-6xl flex-col items-center justify-center gap-5 text-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
            Ed.ie
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-normal sm:text-5xl">
            Scan to join {sessionTitle}
          </h1>
        </div>

        <div
          className="aspect-square bg-white"
          style={{ width: "clamp(260px, 72vmin, 720px)" }}
        >
          {studentShareUrl ? (
            <QrCode className="size-full" value={studentShareUrl} />
          ) : (
            <div className="flex size-full items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-sm text-slate-500">
              Preparing QR code...
            </div>
          )}
        </div>

        <code className="max-w-full overflow-x-auto rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {studentShareUrl || studentUrl}
        </code>

        <Link
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-800"
          href={dashboardUrl}
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
