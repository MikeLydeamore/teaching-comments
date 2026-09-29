import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PublicSiteFooter } from "@/components/PublicSiteFooter";
import { PublicSiteHeader } from "@/components/PublicSiteHeader";

export const metadata: Metadata = {
  title: "Ed.ie | Live classroom engagement",
  description:
    "Bring every voice into the lesson with live responses, polls, group questions, and classroom check-ins from Ed.ie.",
};

const focusRing =
  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-200 focus-visible:ring-offset-2";

const benefits = [
  {
    title: "Hear from the whole room",
    description:
      "Give quieter participants a clear way in, with optional anonymous responses and group questions that can be voted up.",
    icon: (
      <svg aria-hidden="true" className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.1 9.1 0 0 0 3.74-.48 3 3 0 0 0-4.68-2.5m.94 2.98v-.75c0-.8-.15-1.56-.44-2.26m.44 3.01v.03c0 .22-.01.44-.04.65A11.95 11.95 0 0 1 12 21c-2.17 0-4.2-.58-5.96-1.6A6.7 6.7 0 0 1 6 18.75v-.78c0-.8.15-1.56.44-2.26m11.12 0a5.97 5.97 0 0 0-11.12 0m11.12 0a9.04 9.04 0 0 1-5.56 1.82 9.04 9.04 0 0 1-5.56-1.82M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
      </svg>
    ),
  },
  {
    title: "Invite more than words",
    description:
      "Collect text, drawings, GIFs, and images so participants can respond in the form that best fits the activity.",
    icon: (
      <svg aria-hidden="true" className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.16-5.16a2.25 2.25 0 0 1 3.18 0l5.16 5.16m-1.5-1.5 1.41-1.41a2.25 2.25 0 0 1 3.18 0l2.91 2.91m-18 3h16.5A1.5 1.5 0 0 0 21.75 17.25V6.75a1.5 1.5 0 0 0-1.5-1.5H3.75a1.5 1.5 0 0 0-1.5 1.5v10.5a1.5 1.5 0 0 0 1.5 1.5Zm12-10.5h.008v.008h-.008V8.25Z" />
      </svg>
    ),
  },
  {
    title: "Teach from live signals",
    description:
      "See responses arrive, run a quick poll, spot common themes, and adjust the lesson while it can still make a difference.",
    icon: (
      <svg aria-hidden="true" className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75Zm6.75-4.5c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625Zm6.75-4.5C16.5 3.504 17.004 3 17.625 3h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
      </svg>
    ),
  },
];

const hostSteps = [
  {
    title: "Create your host account",
    description:
      "Continue with Google, Microsoft, or GitHub, then choose the Ed.ie username other hosts can use to invite you.",
  },
  {
    title: "Get access to a hosted space",
    description:
      "An Ed.ie administrator can create one for you, or an existing owner can invite you to their space.",
  },
  {
    title: "Open the room",
    description:
      "Start a session, show a prompt, and share its QR code or two short access codes with the room.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <PublicSiteHeader />

      <main>
      <section className="overflow-hidden border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 lg:grid-cols-[0.8fr_1.2fr] lg:py-24">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
              Live classroom engagement
            </p>
            <h1 className="mt-5 max-w-xl text-5xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-6xl sm:leading-[1.05]">
              Make every voice part of the lesson.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
              Ed.ie gives educators one calm place to gather live responses,
              run polls, collect questions, and see what the room understands.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-700 ${focusRing}`}
                href="/auth/login?returnTo=/host"
              >
                Login
                <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
                </svg>
              </Link>
              <Link
                className={`inline-flex min-h-12 items-center justify-center rounded-md border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-800 ${focusRing}`}
                href="/join"
              >
                Join a session
              </Link>
            </div>
            <p className="mt-4 flex items-start gap-2 text-sm leading-6 text-slate-500">
              <svg aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-teal-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              Participants join with a QR code or access codes. No participant
              account is needed.
            </p>
          </div>

          <figure className="relative">
            <div aria-hidden="true" className="absolute -inset-4 rounded-md bg-teal-50" />
            <div className="relative overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
              <div className="flex items-center gap-1.5 border-b border-slate-200 bg-slate-50 px-4 py-3">
                <span className="size-2.5 rounded-full bg-slate-300" />
                <span className="size-2.5 rounded-full bg-slate-300" />
                <span className="size-2.5 rounded-full bg-teal-500" />
                <span className="ml-2 text-xs font-medium text-slate-500">Live host dashboard</span>
              </div>
              <Image
                alt="Ed.ie host dashboard showing a live classroom prompt, response controls, timer, and session totals"
                className="h-auto w-full"
                height={930}
                priority
                sizes="(min-width: 1024px) 58vw, 100vw"
                src="/help/screenshots/session-dashboard.png"
                width={1320}
              />
            </div>
            <figcaption className="sr-only">
              Hosts control a live prompt, participant access, polls, timers,
              and response displays from one dashboard.
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="mx-auto max-w-7xl scroll-mt-24 px-5 py-16 lg:py-20" id="features">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
            Participation with purpose
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            More ways to take part. Better signals for you.
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Make space for quick checks, thoughtful questions, and creative
            responses without stitching together several classroom tools.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {benefits.map((benefit) => (
            <article
              className="rounded-md border border-slate-200 bg-white p-6 shadow-sm"
              key={benefit.title}
            >
              <span className="flex size-11 items-center justify-center rounded-md bg-teal-50 text-teal-800 ring-1 ring-teal-200">
                {benefit.icon}
              </span>
              <h3 className="mt-5 text-xl font-semibold text-slate-950">
                {benefit.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {benefit.description}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <article className="grid overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm sm:grid-cols-[0.9fr_1.1fr]">
            <div className="flex flex-col justify-center p-6 sm:p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-teal-700">
                Live polls
              </p>
              <h3 className="mt-3 text-2xl font-semibold text-slate-950">
                Check understanding while it matters
              </h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Build single- or multiple-choice questions, set a timer, and
                reveal the result when the room is ready.
              </p>
            </div>
            <div className="border-t border-slate-200 bg-slate-50 p-5 sm:border-l sm:border-t-0">
              <div className="mx-auto h-80 max-w-56 overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
                <Image
                  alt="Ed.ie poll builder with answer choices, timing, and solution settings"
                  className="h-auto w-full"
                  height={1120}
                  sizes="224px"
                  src="/help/screenshots/poll-builder.png"
                  width={768}
                />
              </div>
            </div>
          </article>

          <article className="grid overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm sm:grid-cols-[0.9fr_1.1fr]">
            <div className="flex flex-col justify-center p-6 sm:p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-teal-700">
                Room controls
              </p>
              <h3 className="mt-3 text-2xl font-semibold text-slate-950">
                Keep the activity focused
              </h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Choose response formats, screen new submissions, filter the
                stream, and decide what appears on the shared display.
              </p>
            </div>
            <div className="border-t border-slate-200 bg-slate-50 p-5 sm:border-l sm:border-t-0">
              <div className="mx-auto h-80 max-w-56 overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
                <Image
                  alt="Ed.ie room controls for response formats, screening, filtering, and display settings"
                  className="h-auto w-full"
                  height={1000}
                  sizes="224px"
                  src="/help/screenshots/room-controls.png"
                  width={448}
                />
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="scroll-mt-24 border-y border-slate-200 bg-white" id="how-it-works">
        <div className="mx-auto max-w-7xl px-5 py-16 lg:py-20">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
              Start hosting
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              From account to live activity in three steps
            </h2>
          </div>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {hostSteps.map((step, index) => (
              <li className="relative border-t border-slate-200 pt-6" key={step.title}>
                <span className="flex size-10 items-center justify-center rounded-full bg-teal-50 text-sm font-bold text-teal-800 ring-1 ring-teal-200">
                  {index + 1}
                </span>
                <h3 className="mt-5 text-xl font-semibold text-slate-950">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
          <div className="mt-8">
            <Link
              className={`inline-flex items-center gap-2 rounded-md text-sm font-semibold text-teal-700 underline decoration-teal-300 underline-offset-4 transition hover:text-teal-800 ${focusRing}`}
              href="/help/run-your-first-session"
            >
              Read the first-session guide
              <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 lg:py-20">
        <div className="grid items-center gap-10 rounded-md border border-teal-200 bg-teal-50 p-7 shadow-sm md:grid-cols-[1fr_auto] md:p-10">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
              Joining as a participant?
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              Take part without creating an account
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              Scan the host&apos;s QR code or enter the hosted-space and session
              codes. Your name is optional, and you can respond, draw, vote in
              polls, or ask a group question whenever your host enables them.
            </p>
          </div>
          <Link
            className={`inline-flex min-h-12 items-center justify-center rounded-md bg-slate-900 px-6 text-sm font-semibold text-white transition hover:bg-slate-700 ${focusRing}`}
            href="/join"
          >
            Join a session
          </Link>
        </div>
      </section>

      <section className="bg-slate-900 px-5 py-16 text-center">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-300">
            Ready for the next question?
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Bring the whole room into the conversation.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-300">
            Create your Ed.ie host account with Google, Microsoft, or GitHub.
            Once a hosted space is assigned or shared with you, you can start
            running sessions.
          </p>
          <Link
            className={`mt-8 inline-flex min-h-12 items-center justify-center rounded-md bg-white px-6 text-sm font-semibold text-slate-900 transition hover:bg-teal-50 ${focusRing}`}
            href="/auth/login?returnTo=/host"
          >
            Login
          </Link>
        </div>
      </section>
      </main>

      <PublicSiteFooter />
    </div>
  );
}
