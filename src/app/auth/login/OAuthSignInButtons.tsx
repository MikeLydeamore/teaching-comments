"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

type Provider = "google" | "github";

const providers: Array<{ id: Provider; label: string }> = [
  { id: "google", label: "Continue with Google" },
  { id: "github", label: "Continue with GitHub" },
];

export function OAuthSignInButtons({ returnTo }: { returnTo: string }) {
  const [pending, setPending] = useState<Provider | null>(null);
  const [error, setError] = useState(false);

  async function signIn(provider: Provider) {
    setError(false);
    setPending(provider);

    try {
      const result = await authClient.signIn.social({
        provider,
        callbackURL: returnTo,
      });

      if (result.error) {
        setError(true);
        setPending(null);
      }
    } catch {
      setError(true);
      setPending(null);
    }
  }

  return (
    <div className="mt-5 space-y-3">
      {providers.map((provider) => (
        <button
          key={provider.id}
          type="button"
          disabled={pending !== null}
          onClick={() => signIn(provider.id)}
          className="h-11 w-full rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending === provider.id ? "Redirecting..." : provider.label}
        </button>
      ))}
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
          Sign-in did not complete. Please try again.
        </p>
      ) : null}
    </div>
  );
}
