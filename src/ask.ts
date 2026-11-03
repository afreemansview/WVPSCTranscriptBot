// POST /api/ask: one step of the question-answering loop (called from src/worker.ts).
//
// The browser holds the transcripts and runs the searches itself (public/js/search.js).
// This function only forwards the conversation to Claude with a fixed model, system
// prompt and tool list, so the API key never reaches the browser. The browser runs any
// `search_transcripts` call Claude makes, sends the results back, and repeats until
// Claude calls `give_answer`.

import Anthropic from "@anthropic-ai/sdk";

export interface Env {
  ANTHROPIC_API_KEY: string;
  ASSETS: Fetcher;
}

const MODEL = "claude-opus-5-5";
const MAX_MESSAGES = 16; // question + up to 7 search rounds
const MAX_QUESTION_CHARS = 1000;
const MAX_BODY_BYTES = 600_000;

const SYSTEM = `You answer questions about the West Virginia Public Service Commission evidentiary hearing on NextEra Energy Transmission MidAtlantic's application for the Mid-Atlantic Resiliency Link (MARL), a 500 kV transmission line (case number read on the record as 26-000075). The hearing ran five days, Monday October 26 to Friday October 30, 2026.

Your only source is the hearing transcript, which you read through the search_transcripts tool. The transcript comes from YouTube auto-captions with speakers added afterwards, so words can be misheard and a few speakers are labelled "Unidentified speaker".

How to work:
- Search before answering. Run several searches with different wording: synonyms, the names of people involved, and the terms a witness would actually say (for example "property value", "appraisal", "sell my house"). Captions sometimes mishear words, so try alternatives.
- Use the day and speaker filters when the question names them.
- Stop searching once you have the passages you need, or after about six searches.
- Then call give_answer exactly once. Its summary is two to five plain sentences that say what was said and by whom. Every quote must be copied word for word from one turn's text, as a contiguous excerpt of one to three sentences, with the turn_id it came from. Give up to eight quotes, most relevant first.
- Report what was said; do not add facts from outside the transcript or judge who is right. If the transcript does not cover the question, say so in the summary and give no quotes.`;

const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "search_transcripts",
    description:
      "Keyword search over every speaker turn of the five hearing days. Returns up to 12 turns, best match first, each with turn_id, day, date, stream time, speaker, role and text.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Keywords to look for." },
        day: { type: "integer", description: "Optional hearing day, 1 to 5." },
        speaker: { type: "string", description: "Optional part of a speaker's name." },
      },
      required: ["query"],
    },
  },
  {
    name: "give_answer",
    description: "Give the final answer: a short summary and the supporting verbatim quotes.",
    input_schema: {
      type: "object",
      properties: {
        summary: { type: "string" },
        quotes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              turn_id: { type: "string" },
              quote: { type: "string" },
            },
            required: ["turn_id", "quote"],
          },
        },
      },
      required: ["summary", "quotes"],
    },
  },
];

function bad(message: string, status = 400): Response {
  return Response.json({ error: message }, { status });
}

// Accept only the shape this site sends: a question, then alternating assistant turns
// and user turns made of tool results. Stops the endpoint being used as a general proxy.
function validate(messages: unknown): string | null {
  if (!Array.isArray(messages) || messages.length === 0) return "messages missing";
  if (messages.length > MAX_MESSAGES) return "too many search rounds";
  const first = messages[0] as { role?: string; content?: unknown };
  if (first.role !== "user" || typeof first.content !== "string") return "first message must be the question";
  if (first.content.length > MAX_QUESTION_CHARS) return "question too long";
  for (let i = 1; i < messages.length; i++) {
    const m = messages[i] as { role?: string; content?: unknown };
    const want = i % 2 === 1 ? "assistant" : "user";
    if (m.role !== want || !Array.isArray(m.content)) return "unexpected message";
    if (want === "user" && !m.content.every((b: { type?: string }) => b.type === "tool_result")) {
      return "follow-up messages may only carry search results";
    }
  }
  return null;
}

export async function handleAsk(request: Request, env: Env): Promise<Response> {
  if (!env.ANTHROPIC_API_KEY) return bad("The site's ANTHROPIC_API_KEY secret is not set.", 500);
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return bad("request too large", 413);
  let body: { messages?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return bad("invalid JSON");
  }
  const problem = validate(body.messages);
  if (problem) return bad(problem);

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium" },
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      tools: TOOLS,
      messages: body.messages as Anthropic.Beta.BetaMessageParam[],
    });
    if (response.stop_reason === "refusal") {
      return Response.json({ stop_reason: "refusal", content: [] });
    }
    return Response.json({ stop_reason: response.stop_reason, content: response.content });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return bad("The AI service is busy. Try again in a minute.", 429);
    if (err instanceof Anthropic.AuthenticationError) return bad("The site's API key was rejected.", 500);
    if (err instanceof Anthropic.APIError) return bad(`AI service error: ${err.message}`, 502);
    return bad("Could not reach the AI service.", 502);
  }
}
