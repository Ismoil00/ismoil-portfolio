import { initBotId } from "botid/client/core";

// Vercel BotID (free, invisible): the AI assistant's questions carry a proof that a real browser sent them,
// checked by app/api/chat/route.ts. Scripts that only send HTTP requests can't produce it. On Vercel only
// (see next.config.ts).
if (process.env.NEXT_PUBLIC_BOTID === "1") {
  try {
    initBotId({ protect: [{ path: "/api/chat", method: "POST" }] });
  } catch {
    // Without the check the server refuses the question; the rest of the site keeps working.
  }
}
