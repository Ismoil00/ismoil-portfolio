import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import axios from "axios";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

/** Already signed in (valid session)? Then there's nothing to do here. */
async function hasValidSession(): Promise<boolean> {
  const cookieHeader = (await cookies()).toString();
  if (!cookieHeader) return false;
  try {
    await axios.get(`${process.env.API_URL ?? "http://localhost:8000"}/api/v1/auth/me`, {
      headers: { cookie: cookieHeader },
      timeout: 5000,
    });
    return true;
  } catch {
    return false;
  }
}

/** Only same-site paths are followed after signing in (no open redirects). */
function safeNext(value: string | string[] | undefined): string {
  const next = Array.isArray(value) ? value[0] : value;
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  const next = safeNext((await searchParams).next);
  if (await hasValidSession()) redirect(next);

  return (
    <main className="relative grid min-h-svh place-items-center px-4 py-12">
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm animate-fade-up">
        <div className="mb-8 text-center">
          <p className="font-display text-3xl font-bold tracking-tight">
            IS<span className="text-accent">.</span>
          </p>
          <h1 className="mt-4 font-display text-2xl font-semibold">Admin panel</h1>
          <p className="mt-1.5 text-sm text-subtle">Sign in to manage your portfolio.</p>
        </div>
        <div className="rounded-2xl border border-line bg-card p-6 shadow-[0_30px_80px_-40px_var(--pop-shadow)] backdrop-blur-sm sm:p-7">
          <LoginForm next={next} />
        </div>
      </div>
    </main>
  );
}
