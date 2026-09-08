"use client";

import { useState } from "react";
import Image from "next/image";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/interactive";
import { loginAction } from "./actions";

/* =============================================================================
   Login — the one screen outside the shell, in the same visual system as
   the rest of the console: near-black page, tonal surfaces, no borders,
   brand green reserved for the single CTA.
   ============================================================================= */

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await loginAction(email, password);

      if (result.error || !result.user) {
        setError(result.error || "Login could not be completed.");
        setIsLoading(false);
        return;
      }

      login(result.user);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.message || "Invalid credentials or system error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-page px-4">
      {/* One quiet brand presence at the top — nothing else decorates. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(60%_100%_at_50%_0%,rgb(32_204_1_/_0.07),transparent_70%)]"
      />

      <main className="page-in relative w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <Image
            src="/logo.jpg"
            alt=""
            width={48}
            height={48}
            priority
            className="h-12 w-12 rounded-xl object-contain"
          />
          <h1 className="mt-5 text-[19px] font-semibold tracking-tight text-ink">
            Esporta
          </h1>
          <p className="mt-1 text-[13px] leading-5 text-ink-3">
            Recommendation Control Center
          </p>
        </div>

        <section className="mt-8 rounded-2xl bg-surface p-6">
          {error && (
            <div
              role="alert"
              className="mb-5 rounded-lg bg-danger/15 px-3.5 py-2.5 text-[13px] leading-5 text-danger"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-[13px] font-medium text-ink-2"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@esporta.site"
                className="mt-2 w-full rounded-lg bg-surface-2 px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-4 transition-colors focus:bg-surface-3"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-[13px] font-medium text-ink-2"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-2 w-full rounded-lg bg-surface-2 px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-4 transition-colors focus:bg-surface-3"
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              disabled={isLoading}
              className="w-full py-2.5"
            >
              {isLoading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </section>

        <p className="mt-6 text-center text-[11px] leading-4 text-ink-4">
          Authorized operators only.
        </p>
      </main>
    </div>
  );
}
