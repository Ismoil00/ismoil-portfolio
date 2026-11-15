"use client";

import { useState, type FormEvent } from "react";
import { LuEye, LuEyeOff, LuLogIn } from "react-icons/lu";
import { api } from "@/api/client";
import { errorMessage } from "@/api/errors";
import { Field, TextInput } from "@/components/form/Field";
import { Button } from "@/components/ui/Button";

export function LoginForm({ next }: { next: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (!email || !password) {
      setError("Enter your email and password.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await api.post("/auth/login", { email, password });
      // A full navigation, so every server component reads the new session cookie.
      window.location.href = next;
    } catch (err) {
      setError(errorMessage(err, "Couldn't sign in. Try again."));
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field label="Email" htmlFor="email" required>
        <TextInput id="email" name="email" type="email" autoComplete="username" autoFocus required maxLength={254} />
      </Field>
      <Field label="Password" htmlFor="password" required>
        <div className="relative">
          <TextInput
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            maxLength={1024}
            className="pr-11"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-faint transition-colors hover:text-fg"
          >
            {showPassword ? <LuEyeOff className="size-4" /> : <LuEye className="size-4" />}
          </button>
        </div>
      </Field>
      {error && (
        <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
          {error}
        </p>
      )}
      <Button type="submit" loading={pending} icon={<LuLogIn className="size-4" />} className="w-full">
        Sign in
      </Button>
    </form>
  );
}
