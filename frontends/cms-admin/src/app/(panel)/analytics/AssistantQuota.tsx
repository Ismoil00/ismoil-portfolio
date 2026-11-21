import { Card } from "@/components/ui/Card";
import type { Analytics } from "@/types/api";

type Usage = NonNullable<Analytics["assistant"]>;
type ModelUsage = Usage["models"][number];

const fmt = (n: number) => n.toLocaleString("en");

/**
 * The AI assistant's use of Groq's free quota: for each model, the windows Groq counts in (rolling: the
 * last 24 hours, hour and minute), used against the share the site allows itself (backend settings
 * CHAT_MODEL_*, a little below Groq's own limits). Counted from this site's own questions.
 */
export function AssistantQuota({ usage }: { usage: Usage }) {
  const status = !usage.ready
    ? { text: "Not set up: GROQ_API_KEY is missing", tone: "text-danger" }
    : usage.enabled
      ? { text: "On", tone: "text-success" }
      : { text: "Switched off in Settings", tone: "text-subtle" };

  return (
    <Card
      title="AI assistant: Groq free quota"
      description="Used and left for each model over the windows Groq counts in (the last 24 hours, hour and minute; they free up on their own). The limits are the site's own share, a little below Groq's free limits (1,000 requests and 200,000 tokens a day, 8,000 tokens a minute). When a model runs out the next one answers; when all have, the assistant asks visitors to come back later."
      actions={<span className={`text-sm font-medium ${status.tone}`}>{status.text}</span>}
      className="lg:col-span-2"
    >
      <div className="space-y-6">
        {usage.models.map((m, i) => (
          <section key={m.model} aria-label={m.model}>
            <h3 className="mb-3 flex flex-wrap items-baseline gap-x-2 text-sm">
              <code className="font-medium text-fg">{m.model}</code>
              <span className="text-xs text-subtle">{i === 0 ? "answers first" : `takes over when model ${i} is out`}</span>
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Meter model={m} label="Requests, last 24 hours" used={m.requests_day} limit={m.requests_day_limit} />
              <Meter model={m} label="Tokens, last 24 hours" used={m.tokens_day} limit={m.tokens_day_limit} />
              <Meter model={m} label="Tokens, last hour" used={m.tokens_hour} limit={m.tokens_hour_limit} />
              <Meter model={m} label="Tokens, last minute" used={m.tokens_minute} limit={m.tokens_minute_limit} />
            </div>
          </section>
        ))}
      </div>
    </Card>
  );
}

function Meter({ model, label, used, limit }: { model: ModelUsage; label: string; used: number; limit: number }) {
  const share = limit > 0 ? Math.min(1, used / limit) : 1;
  const bar = share >= 1 ? "bg-danger" : share >= 0.8 ? "bg-warning" : "bg-accent";
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-subtle">{label}</span>
        <span className="tabular-nums text-subtle">{fmt(Math.max(0, limit - used))} left</span>
      </div>
      <div
        role="meter"
        aria-label={`${model.model}: ${label}`}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={Math.min(used, limit)}
        aria-valuetext={`${fmt(used)} of ${fmt(limit)} used`}
        className="mt-1.5 h-2 overflow-hidden rounded-full bg-tint/10"
      >
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${share * 100}%` }} />
      </div>
      <p className="mt-1 text-sm tabular-nums">
        <span className="font-medium text-fg">{fmt(used)}</span>
        <span className="text-subtle"> / {fmt(limit)}</span>
      </p>
    </div>
  );
}
