"use client";

import { useEffect, useRef, useState } from "react";
import { formatTimerSeconds } from "@/components/SessionTimer";
import type { ParticipantPoll } from "@/lib/qwt-store";

type ParticipantPollOverlayProps = {
  participantId: string;
  poll: ParticipantPoll;
};

function selectionsMatch(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every((optionId, index) => optionId === right[index])
  );
}

export function ParticipantPollOverlay({
  participantId,
  poll,
}: ParticipantPollOverlayProps) {
  const [nowMs, setNowMs] = useState(0);
  const [selectedOptionIds, setSelectedOptionIds] = useState(
    poll.selectedOptionIds,
  );
  const selectedOptionIdsRef = useRef(poll.selectedOptionIds);
  const savedOptionIdsRef = useRef(poll.selectedOptionIds);
  const saveInFlightRef = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const updateTime = () => setNowMs(Date.now());
    const firstUpdate = window.setTimeout(updateTime, 0);
    const timer = window.setInterval(updateTime, 250);

    return () => {
      window.clearTimeout(firstUpdate);
      window.clearInterval(timer);
    };
  }, [poll.endsAt]);

  const endTime = new Date(poll.endsAt).getTime();
  const isOpen = nowMs === 0 || endTime > nowMs;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const remainingSeconds =
    nowMs > 0 ? Math.max(0, (endTime - nowMs) / 1000) : poll.durationSeconds;

  async function saveSelection(nextOptionIds: string[]) {
    selectedOptionIdsRef.current = nextOptionIds;
    setSelectedOptionIds(nextOptionIds);
    setStatus("Saving...");

    if (saveInFlightRef.current) {
      return;
    }

    saveInFlightRef.current = true;
    setIsSaving(true);

    try {
      while (true) {
        const selectionToSave = selectedOptionIdsRef.current;
        const response = await fetch(`/api/polls/${poll.id}/response`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            participantId,
            optionIds: selectionToSave,
          }),
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          selectedOptionIdsRef.current = savedOptionIdsRef.current;
          setSelectedOptionIds(savedOptionIdsRef.current);
          setStatus(payload.error ?? "Could not save answer.");
          break;
        }

        const savedOptionIds = payload.response?.optionIds ?? selectionToSave;
        savedOptionIdsRef.current = savedOptionIds;

        if (selectionsMatch(selectedOptionIdsRef.current, selectionToSave)) {
          selectedOptionIdsRef.current = savedOptionIds;
          setSelectedOptionIds(savedOptionIds);
          setStatus("Saved");
          break;
        }
      }
    } catch {
      selectedOptionIdsRef.current = savedOptionIdsRef.current;
      setSelectedOptionIds(savedOptionIdsRef.current);
      setStatus("Could not save answer.");
    } finally {
      saveInFlightRef.current = false;
      setIsSaving(false);
    }
  }

  function toggleOption(optionId: string) {
    const nextOptionIds =
      poll.selectionMode === "single"
        ? [optionId]
        : selectedOptionIdsRef.current.includes(optionId)
          ? selectedOptionIdsRef.current.filter(
              (selectedId) => selectedId !== optionId,
            )
          : [...selectedOptionIdsRef.current, optionId];

    void saveSelection(nextOptionIds);
  }

  return (
    <div
      aria-describedby="participant-poll-instructions"
      aria-labelledby="participant-poll-question"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-100 p-4 sm:p-6"
      role="dialog"
    >
      <section
        aria-busy={isSaving}
        className="my-auto w-full max-w-2xl rounded-md border border-slate-200 bg-white p-5 shadow-xl sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-teal-700">
              Live poll
            </p>
            <p
              className="mt-2 text-sm text-slate-500"
              id="participant-poll-instructions"
            >
              {poll.selectionMode === "single"
                ? "Choose one answer. You can change it while the poll is open."
                : "Choose any answers that apply. You can change them while the poll is open."}
            </p>
          </div>
          <div className="shrink-0 rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-center text-teal-950">
            <p className="text-xs font-semibold uppercase tracking-[0.12em]">
              Remaining
            </p>
            <p className="text-2xl font-semibold tabular-nums">
              {formatTimerSeconds(remainingSeconds)}
            </p>
          </div>
        </div>

        <h2
          className="mt-5 text-2xl font-semibold leading-8 text-slate-950"
          id="participant-poll-question"
        >
          {poll.question}
        </h2>

        <div className="mt-5 space-y-3">
          {poll.options.map((option) => {
            const isSelected = selectedOptionIds.includes(option.id);

            return (
              <label
                className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-md border px-4 py-3 text-base font-medium transition ${
                  isSelected
                    ? "border-teal-500 bg-teal-50 text-teal-950"
                    : "border-slate-300 bg-white text-slate-800 hover:border-teal-400"
                }`}
                key={option.id}
              >
                <input
                  checked={isSelected}
                  className="size-5 shrink-0 accent-teal-700"
                  name={`poll-${poll.id}`}
                  type={poll.selectionMode === "single" ? "radio" : "checkbox"}
                  onChange={() => toggleOption(option.id)}
                />
                <span className="min-w-0 break-words">{option.label}</span>
              </label>
            );
          })}
        </div>

        <div className="mt-5 flex min-h-6 items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            {selectedOptionIds.length
              ? `${selectedOptionIds.length} selected`
              : "No answer selected"}
          </p>
          <p
            aria-live="polite"
            className={`text-sm font-semibold ${
              status.startsWith("Could not") ? "text-red-700" : "text-teal-700"
            }`}
          >
            {status}
          </p>
        </div>
      </section>
    </div>
  );
}
