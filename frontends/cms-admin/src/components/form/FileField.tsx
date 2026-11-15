"use client";

import { useRef, useState } from "react";
import { LuExternalLink, LuFileText, LuUpload } from "react-icons/lu";
import { checkFile, uploadMedia, uploadRules, type MediaPurpose } from "@/api/media.api";
import { errorMessage } from "@/api/errors";
import { Button } from "@/components/ui/Button";
import type { Media } from "@/types/api";

const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/** A single document (the résumé PDF): uploaded right away, linked when the form is saved. */
export function FileField({
  value,
  onChange,
  purpose,
  invalid,
}: {
  value: Media | null;
  onChange: (media: Media) => void;
  purpose: MediaPurpose;
  invalid?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    const problem = checkFile(file, purpose);
    if (problem) return setError(problem);
    setError(null);
    setProgress(0);
    try {
      onChange(await uploadMedia(file, purpose, { onProgress: setProgress }));
    } catch (err) {
      setError(errorMessage(err, "Couldn't upload the file."));
    } finally {
      setProgress(null);
    }
  }

  return (
    <div>
      <div
        data-invalid={invalid || undefined}
        className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-tint/[0.03] p-3 data-[invalid=true]:border-danger/70"
      >
        <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent">
          <LuFileText className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          {value ? (
            <>
              <a href={value.url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1.5 truncate text-sm font-medium hover:text-accent">
                <span className="truncate">{value.original_name}</span> <LuExternalLink className="size-3.5 shrink-0" />
              </a>
              <p className="text-xs text-subtle">{formatSize(value.size_bytes)}</p>
            </>
          ) : (
            <p className="text-sm text-faint">No file yet.</p>
          )}
        </div>
        <Button
          size="sm"
          variant="secondary"
          loading={progress !== null}
          icon={<LuUpload className="size-3.5" />}
          onClick={() => inputRef.current?.click()}
        >
          {progress !== null ? `${Math.round(progress * 100)}%` : value ? "Upload a new version" : "Upload"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={uploadRules[purpose].accept}
          hidden
          onChange={(e) => {
            void upload(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      <p className={`mt-1.5 text-xs ${error ? "text-danger" : "text-faint"}`}>{error ?? uploadRules[purpose].label}</p>
    </div>
  );
}
