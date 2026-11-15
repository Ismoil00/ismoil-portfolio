"use client";

import { useRef, useState } from "react";
import { LuImageUp, LuTrash2 } from "react-icons/lu";
import { checkFile, uploadMedia, uploadRules } from "@/api/media.api";
import { errorMessage } from "@/api/errors";
import { Button } from "@/components/ui/Button";
import type { Media } from "@/types/api";

/** A company or institute logo: uploaded right away, linked when the form is saved. */
export function LogoField({ value, onChange }: { value: Media | null; onChange: (media: Media | null) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    const problem = checkFile(file, "logo");
    if (problem) return setError(problem);
    setError(null);
    setProgress(0);
    try {
      onChange(await uploadMedia(file, "logo", { onProgress: setProgress }));
    } catch (err) {
      setError(errorMessage(err, "Couldn't upload the logo."));
    } finally {
      setProgress(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-dashed border-line-strong bg-[conic-gradient(var(--color-card)_25%,transparent_0_50%,var(--color-card)_0_75%,transparent_0)] bg-[length:12px_12px]">
          {/* eslint-disable-next-line @next/next/no-img-element -- uploaded file, any size */}
          {value ? <img src={value.url} alt="Logo" className="max-h-12 max-w-12 object-contain" /> : <span className="text-xs text-faint">None</span>}
        </div>
        <Button
          size="sm"
          variant="secondary"
          loading={progress !== null}
          icon={<LuImageUp className="size-3.5" />}
          onClick={() => inputRef.current?.click()}
        >
          {progress !== null ? `${Math.round(progress * 100)}%` : value ? "Replace logo" : "Upload logo"}
        </Button>
        {value && (
          <Button size="sm" variant="ghost" icon={<LuTrash2 className="size-3.5" />} onClick={() => onChange(null)}>
            Remove
          </Button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={uploadRules.logo.accept}
          hidden
          onChange={(e) => {
            void upload(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      <p className={`mt-1.5 text-xs ${error ? "text-danger" : "text-faint"}`}>{error ?? uploadRules.logo.label}</p>
    </div>
  );
}
