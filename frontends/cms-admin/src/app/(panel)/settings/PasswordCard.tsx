"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { LuKeyRound } from "react-icons/lu";
import { api } from "@/api/client";
import { Checkbox } from "@/components/form/Choice";
import { Field, TextInput } from "@/components/form/Field";
import { applyServerErrors } from "@/components/form/server-errors";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";

const MIN_LENGTH = 12; // same rule as the backend (services/auth.py)

const schema = z
  .object({
    current_password: z.string().min(1, "Enter your current password"),
    new_password: z.string().refine((v) => v.trim().length >= MIN_LENGTH, `Use at least ${MIN_LENGTH} characters`),
    repeat_password: z.string(),
  })
  .refine((v) => v.new_password === v.repeat_password, {
    path: ["repeat_password"],
    message: "The two new passwords don't match",
  })
  .refine((v) => !v.current_password || v.new_password !== v.current_password, {
    path: ["new_password"],
    message: "Pick a password different from the current one",
  });
type Values = z.infer<typeof schema>;

const EMPTY: Values = { current_password: "", new_password: "", repeat_password: "" };

/** Change the admin password. Every other browser is signed out; this one stays signed in. */
export function PasswordCard({ username }: { username: string }) {
  const toast = useToast();
  const [show, setShow] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
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
      await api.put("/admin/settings/password", {
        current_password: values.current_password,
        new_password: values.new_password,
      });
      reset(EMPTY);
      setShow(false);
      toast("Password changed. Other browsers were signed out.");
    } catch (error) {
      const message = applyServerErrors(error, setError);
      // Field messages already sit under their inputs; keep only a message that belongs to no field.
      setFormError(message === "Some fields need attention." ? null : message);
    }
  }

  const type = show ? "text" : "password";
  return (
    <Card
      title="Password"
      description={`At least ${MIN_LENGTH} characters. Changing it signs out every other browser; this one stays signed in.`}
    >
      <form onSubmit={handleSubmit(save)} noValidate className="max-w-md space-y-4">
        {/* Lets password managers know which account this is. */}
        <input type="text" name="username" autoComplete="username" value={username} readOnly hidden />
        <Field label="Current password" htmlFor="current-password" required error={errors.current_password?.message}>
          <TextInput
            id="current-password"
            type={type}
            autoComplete="current-password"
            maxLength={1024}
            invalid={Boolean(errors.current_password)}
            {...register("current_password")}
          />
        </Field>
        <Field label="New password" htmlFor="new-password" required error={errors.new_password?.message}>
          <TextInput
            id="new-password"
            type={type}
            autoComplete="new-password"
            maxLength={1024}
            invalid={Boolean(errors.new_password)}
            {...register("new_password")}
          />
        </Field>
        <Field label="Repeat the new password" htmlFor="repeat-password" required error={errors.repeat_password?.message}>
          <TextInput
            id="repeat-password"
            type={type}
            autoComplete="new-password"
            maxLength={1024}
            invalid={Boolean(errors.repeat_password)}
            {...register("repeat_password")}
          />
        </Field>
        <Checkbox label="Show passwords" checked={show} onChange={(e) => setShow(e.target.checked)} />
        {formError && (
          <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
            {formError}
          </p>
        )}
        <Button type="submit" loading={isSubmitting} icon={<LuKeyRound className="size-4" />}>
          Change password
        </Button>
      </form>
    </Card>
  );
}
