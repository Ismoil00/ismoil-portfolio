"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { LuUserPen } from "react-icons/lu";
import { api } from "@/api/client";
import { Checkbox } from "@/components/form/Choice";
import { Field, TextInput } from "@/components/form/Field";
import { applyServerErrors } from "@/components/form/server-errors";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";

// Same rules as the backend (services/auth.py): letter case and surrounding spaces don't matter.
const normalize = (value: string) => value.trim().toLowerCase();
const ALLOWED = /^[a-z0-9._-]{3,32}$/;

function schemaFor(current: string) {
  return z
    .object({
      new_username: z
        .string()
        .refine((v) => ALLOWED.test(normalize(v)), "Use 3–32 Latin letters, digits, dots, hyphens or underscores")
        .refine((v) => /^[a-z0-9]/.test(normalize(v)), "It must start with a letter or digit"),
      current_password: z.string().min(1, "Enter your current password"),
    })
    .refine((v) => normalize(v.new_username) !== current, {
      path: ["new_username"],
      message: "Pick a username different from the current one",
    });
}
type Values = z.infer<ReturnType<typeof schemaFor>>;

const EMPTY: Values = { new_username: "", current_password: "" };

/** Change the admin username. Like the password: the current password confirms it, every other
 * browser is signed out, and this one stays signed in. */
export function UsernameCard({ username }: { username: string }) {
  const router = useRouter();
  const toast = useToast();
  const [show, setShow] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const schema = useMemo(() => schemaFor(username), [username]);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ defaultValues: EMPTY, resolver: zodResolver(schema) });

  async function save(values: Values) {
    setFormError(null);
    try {
      await api.put("/admin/settings/username", {
        current_password: values.current_password,
        new_username: normalize(values.new_username),
      });
      reset(EMPTY);
      setShow(false);
      toast("Username changed. Other browsers were signed out.");
      router.refresh(); // the sidebar and this card show the new name
    } catch (error) {
      const message = applyServerErrors(error, setError);
      // Field messages already sit under their inputs; keep only a message that belongs to no field.
      setFormError(message === "Some fields need attention." ? null : message);
    }
  }

  return (
    <Card
      title="Username"
      description="3–32 Latin letters, digits, dots, hyphens or underscores, starting with a letter or digit. Letter case doesn't matter. Changing it signs out every other browser; this one stays signed in."
    >
      <form onSubmit={handleSubmit(save)} noValidate className="max-w-md space-y-4">
        <p className="text-sm text-muted">
          Current username: <span className="font-medium text-fg">{username}</span>
        </p>
        <Field label="New username" htmlFor="new-username" required error={errors.new_username?.message}>
          <TextInput
            id="new-username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={32}
            invalid={Boolean(errors.new_username)}
            {...register("new_username")}
          />
        </Field>
        <Field label="Current password" htmlFor="username-password" required error={errors.current_password?.message}>
          <TextInput
            id="username-password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            maxLength={1024}
            invalid={Boolean(errors.current_password)}
            {...register("current_password")}
          />
        </Field>
        <Checkbox label="Show password" checked={show} onChange={(e) => setShow(e.target.checked)} />
        {formError && (
          <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
            {formError}
          </p>
        )}
        <Button type="submit" loading={isSubmitting} icon={<LuUserPen className="size-4" />}>
          Change username
        </Button>
      </form>
    </Card>
  );
}
