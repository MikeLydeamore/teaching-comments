"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { GroupQuestion } from "@/lib/qwt-store";

type GroupQuestionsPanelProps = {
  canAsk?: boolean;
  sessionCode: string;
  variant?: "student" | "teacher";
};

const voterIdStorageKey = "qwt_group_question_voter_id";

function createVoterId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function getOrCreateVoterId() {
  const existing = window.localStorage.getItem(voterIdStorageKey);

  if (existing) {
    return existing;
  }

  const nextVoterId = createVoterId();
  window.localStorage.setItem(voterIdStorageKey, nextVoterId);
  return nextVoterId;
}

function questionAge(value: string) {
  const elapsedMinutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 60000),
  );

  if (elapsedMinutes < 1) return "just now";
  if (elapsedMinutes === 1) return "1 min ago";
  return `${elapsedMinutes} min ago`;
}

function ThumbsUpIcon({ isActive = false }: { isActive?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill={isActive ? "currentColor" : "none"}
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <path d="M7 10v11" />
      <path d="M15 5.4 14 10h5.2a2 2 0 0 1 2 2.3l-1.2 7a2 2 0 0 1-2 1.7H7V10l4.6-7.1a2 2 0 0 1 3.4 2.5Z" />
      <path d="M3 10h4v11H3z" />
    </svg>
  );
}

export function GroupQuestionsPanel({
  canAsk = false,
  sessionCode,
  variant = "student",
}: GroupQuestionsPanelProps) {
  const [questions, setQuestions] = useState<GroupQuestion[]>([]);
  const [voterId] = useState(() =>
    typeof window === "undefined" ? "" : getOrCreateVoterId(),
  );
  const [isAskOpen, setIsAskOpen] = useState(false);
  const [questionDraft, setQuestionDraft] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [votingQuestionId, setVotingQuestionId] = useState<string | null>(null);
  const [answeringQuestionId, setAnsweringQuestionId] = useState<string | null>(null);
  const [showAnswered, setShowAnswered] = useState(false);

  const remaining = useMemo(() => 500 - questionDraft.length, [questionDraft]);
  const canSaveQuestion =
    questionDraft.trim().length >= 5 && questionDraft.trim().length <= 500;
  const canMarkAnswered = variant === "teacher";
  const activeQuestionCount = questions.filter((question) => !question.isAnswered).length;
  const answeredQuestionCount = questions.length - activeQuestionCount;

  const refreshQuestions = useCallback(async () => {
    if (!voterId) {
      return;
    }

    const query = new URLSearchParams({
      voterId,
      ...(canMarkAnswered && showAnswered ? { includeAnswered: "true" } : {}),
    });
    const response = await fetch(
      `/api/sessions/${sessionCode}/group-questions?${query.toString()}`,
    );
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setStatus(payload.error ?? "Could not load questions.");
      return;
    }

    setQuestions(payload.questions ?? []);
  }, [canMarkAnswered, sessionCode, showAnswered, voterId]);

  useEffect(() => {
    if (!voterId) {
      return;
    }

    const firstRefresh = window.setTimeout(() => {
      void refreshQuestions();
    }, 0);
    const timer = window.setInterval(() => {
      void refreshQuestions();
    }, 3000);

    return () => {
      window.clearTimeout(firstRefresh);
      window.clearInterval(timer);
    };
  }, [refreshQuestions, voterId]);

  async function submitQuestion() {
    setStatus("");
    setIsSaving(true);

    const response = await fetch(`/api/sessions/${sessionCode}/group-questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: questionDraft,
        website,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    setIsSaving(false);

    if (!response.ok) {
      setStatus(payload.error ?? "Could not save question.");
      return;
    }

    setQuestionDraft("");
    setWebsite("");
    setIsAskOpen(false);
    setStatus("Question added.");
    await refreshQuestions();
  }

  async function toggleVote(question: GroupQuestion) {
    if (!voterId) {
      return;
    }

    setVotingQuestionId(question.id);
    setStatus("");

    const response = await fetch(`/api/group-questions/${question.id}/vote`, {
      method: question.hasVoted ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voterId }),
    });
    const payload = await response.json().catch(() => ({}));
    setVotingQuestionId(null);

    if (!response.ok) {
      setStatus(payload.error ?? "Could not save vote.");
      return;
    }

    const nextQuestion = payload.question as GroupQuestion;
    setQuestions((currentQuestions) =>
      currentQuestions
        .map((question) =>
          question.id === nextQuestion.id ? nextQuestion : question,
        )
        .sort(
          (a, b) =>
            Number(a.isAnswered) - Number(b.isAnswered) ||
            b.voteCount - a.voteCount ||
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
    );
  }

  async function setAnswered(question: GroupQuestion, isAnswered: boolean) {
    const questionId = question.id;
    setAnsweringQuestionId(questionId);
    setStatus("");

    const response = await fetch(`/api/group-questions/${questionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isAnswered }),
    });
    const payload = await response.json().catch(() => ({}));
    setAnsweringQuestionId(null);

    if (!response.ok) {
      setStatus(payload.error ?? "Could not update question.");
      return;
    }

    const nextQuestion = payload.question as GroupQuestion;
    setQuestions((currentQuestions) => {
      const nextQuestions =
        nextQuestion.isAnswered && !showAnswered
          ? currentQuestions.filter((currentQuestion) => currentQuestion.id !== questionId)
          : currentQuestions.map((currentQuestion) =>
              currentQuestion.id === questionId ? nextQuestion : currentQuestion,
            );

      return nextQuestions.sort(
        (a, b) =>
          Number(a.isAnswered) - Number(b.isAnswered) ||
          b.voteCount - a.voteCount ||
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    });
    setStatus(isAnswered ? "Question marked answered." : "Question re-shown.");
  }

  return (
    <section
      className={`rounded-md border border-slate-200 bg-white p-4 shadow-sm ${
        variant === "student" ? "mt-5" : ""
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-500">Group questions</p>
          <p className="mt-1 text-xs text-slate-500">
            {activeQuestionCount} active
            {showAnswered ? `, ${answeredQuestionCount} answered` : ""}
          </p>
        </div>
        {canMarkAnswered ? (
          <button
            className={`h-10 rounded-md border px-3 text-sm font-semibold transition ${
              showAnswered
                ? "border-teal-300 bg-teal-50 text-teal-800 hover:border-teal-500"
                : "border-slate-300 text-slate-700 hover:border-teal-500 hover:text-teal-800"
            }`}
            type="button"
            onClick={() => {
              setShowAnswered((isShowingAnswered) => !isShowingAnswered);
              setStatus("");
            }}
          >
            {showAnswered ? "Hide answered" : "Show answered"}
          </button>
        ) : null}
        {canAsk ? (
          <button
            className="h-10 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canAsk}
            type="button"
            onClick={() => {
              setQuestionDraft("");
              setStatus("");
              setIsAskOpen(true);
            }}
          >
            Ask a question
          </button>
        ) : null}
      </div>

      <div className="mt-3 space-y-2">
        {questions.length ? (
          questions.map((question) => (
            <article
              className={`rounded-md border p-3 ${
                question.isAnswered
                  ? "border-emerald-200 bg-emerald-50/60"
                  : "border-slate-200 bg-slate-50"
              }`}
              key={question.id}
            >
              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-900">
                {question.text}
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs font-medium text-slate-500">
                  {question.isAnswered ? "Answered" : questionAge(question.createdAt)}
                </p>
                <div className="flex flex-wrap gap-2">
                  {canMarkAnswered ? (
                    <button
                      className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-emerald-500 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-70"
                      disabled={answeringQuestionId === question.id}
                      type="button"
                      onClick={() => {
                        void setAnswered(question, !question.isAnswered);
                      }}
                    >
                      {answeringQuestionId === question.id
                        ? "Saving..."
                        : question.isAnswered
                          ? "Re-show"
                          : "Mark answered"}
                    </button>
                  ) : null}
                  <button
                    aria-label={question.hasVoted ? "Remove upvote" : "Upvote"}
                    className={`h-9 rounded-md border px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 ${
                      question.hasVoted
                        ? "border-teal-300 bg-teal-50 text-teal-800 hover:border-teal-500"
                        : "border-slate-300 bg-white text-slate-700 hover:border-teal-500 hover:text-teal-800"
                    }`}
                    disabled={votingQuestionId === question.id}
                    title={question.hasVoted ? "Remove upvote" : "Upvote"}
                    type="button"
                    onClick={() => {
                      void toggleVote(question);
                    }}
                  >
                    <span className="flex items-center gap-1.5">
                      <ThumbsUpIcon isActive={question.hasVoted} />
                      <span>{question.voteCount}</span>
                    </span>
                  </button>
                </div>
              </div>
            </article>
          ))
        ) : (
          <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500">
            No questions yet.
          </p>
        )}
      </div>

      {status ? (
        <p className="mt-3 text-sm font-medium text-slate-600">{status}</p>
      ) : null}

      {isAskOpen ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-5"
          role="dialog"
        >
          <div className="w-full max-w-lg rounded-md bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  Ask a question
                </h2>
              </div>
              <button
                aria-label="Close"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500"
                disabled={isSaving}
                type="button"
                onClick={() => setIsAskOpen(false)}
              >
                Close
              </button>
            </div>
            <label className="mt-4 block text-sm font-semibold text-slate-700" htmlFor="group-question">
              Question
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
              className="mt-2 min-h-32 w-full resize-y rounded-md border border-slate-300 bg-white p-3 text-base leading-7 text-slate-950 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
              id="group-question"
              maxLength={500}
              value={questionDraft}
              onChange={(event) => {
                setQuestionDraft(event.target.value);
                setStatus("");
              }}
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className={`text-sm ${remaining < 50 ? "text-amber-700" : "text-slate-500"}`}>
                {remaining} characters remaining
              </p>
              <div className="flex gap-2">
                <button
                  className="h-9 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isSaving}
                  type="button"
                  onClick={() => setIsAskOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="h-9 rounded-md bg-slate-900 px-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!canSaveQuestion || isSaving}
                  type="button"
                  onClick={() => {
                    void submitQuestion();
                  }}
                >
                  {isSaving ? "Adding..." : "Add question"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
