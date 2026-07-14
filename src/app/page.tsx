import Link from "next/link";
import { HomeNavCard } from "@/components/HomeNavCard";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-100 px-5 py-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 rounded-md border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-teal-700">
            Ed.ie
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal text-slate-950">
            Ask, answer, understand
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
            Ed.ie is a friendly helper for quick questions, short
            responses, drawings, polls, and live check-ins. It helps participants
            speak up and helps hosts see what is making sense.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          <HomeNavCard
            href="/join"
            kicker="Participant view"
            pendingLabel="Opening join page..."
            title="Join an Ed.ie session"
          >
            Enter the space and session code from your host to respond, draw,
            ask a question, or vote on questions from the room.
          </HomeNavCard>

          <HomeNavCard
            href="/host"
            kicker="Host view"
            pendingLabel="Opening host view..."
            title="Manage your hosted space"
          >
            Choose a session, update the prompt, show a QR code, and watch
            responses and questions arrive live.
          </HomeNavCard>
        </section>

        <div className="mt-5">
          <Link
            className="text-sm font-semibold text-teal-700 underline"
            href="/privacy"
          >
            Privacy notice
          </Link>
        </div>
      </div>
    </main>
  );
}
