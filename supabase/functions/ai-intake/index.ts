// POST /ai-intake — V2 AI-guided conversational intake.
//
// Turns the intimidating multi-page form into a plain-language chat. Maps the
// customer's answers to Formstack fields via tool use, persists the
// conversation + structured mappings, and ENFORCES a human-in-the-loop
// guardrail: sensitive answers (beneficiaries, trustees, guardians) come back
// flagged needs_confirmation and are never treated as final. The function does
// NOT auto-submit to Formstack — Formstack stays the source of truth; mappings
// are staged for a final human-reviewed hand-off.
//
// Body:   { session_id?, conversation_id?, plan?, message }
// Returns:{ conversation_id, reply, recorded[], needs_confirmation[], complete }
//
// Best practices (per claude-api skill): official Anthropic SDK, claude-opus-4-8
// default (override via ANTHROPIC_MODEL), adaptive thinking, prompt caching on
// the stable system prompt, tool use for structured extraction.

import Anthropic from "npm:@anthropic-ai/sdk@0.100.1";
import { adminClient } from "../_shared/supabase.ts";
import { json, corsHeaders } from "../_shared/cors.ts";
import { nowIso, str } from "../_shared/util.ts";
import {
  buildSystemPrompt,
  SENSITIVE_FIELD_IDS,
} from "../_shared/formstack-map.ts";

const API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const MODEL = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-opus-4-8";

const TOOLS: Anthropic.Tool[] = [
  {
    name: "record_answers",
    description:
      "Record one or more questionnaire answers mapped to Formstack fields. Call whenever the customer provides information that maps to a field.",
    input_schema: {
      type: "object",
      properties: {
        answers: {
          type: "array",
          items: {
            type: "object",
            properties: {
              formstack_field_id: { type: "string" },
              question_label: { type: "string" },
              answer_value: { type: "string" },
              confidence: { type: "number", description: "0 to 1" },
              needs_confirmation: { type: "boolean" },
            },
            required: [
              "formstack_field_id",
              "question_label",
              "answer_value",
              "confidence",
              "needs_confirmation",
            ],
          },
        },
      },
      required: ["answers"],
    },
  },
  {
    name: "intake_complete",
    description:
      "Call when all required fields have been collected and sensitive ones confirmed.",
    input_schema: {
      type: "object",
      properties: { summary: { type: "string" } },
      required: ["summary"],
    },
  },
];

// Strip thinking blocks before persisting — keeps the stored transcript lean
// and avoids replaying prior-turn reasoning.
// deno-lint-ignore no-explicit-any
function stripThinking(content: any) {
  if (!Array.isArray(content)) return content;
  return content.filter(
    (b) => b.type !== "thinking" && b.type !== "redacted_thinking",
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!API_KEY) return json({ error: "ai_not_configured" }, 503);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }

  const sessionId = str(body.session_id);
  const conversationId = str(body.conversation_id);
  const plan = str(body.plan);
  const userMessage = str(body.message);
  if (!userMessage) return json({ error: "missing_message" }, 422);

  const admin = adminClient();

  // Load or create the conversation.
  // deno-lint-ignore no-explicit-any
  let convo: any = null;
  if (conversationId) {
    const { data } = await admin
      .from("ai_conversations")
      .select("*")
      .eq("id", conversationId)
      .maybeSingle();
    convo = data;
  }
  if (!convo) {
    const { data } = await admin
      .from("ai_conversations")
      .insert({ session_id: sessionId, model: MODEL, status: "in_progress", transcript: [] })
      .select("*")
      .single();
    convo = data;
  }
  if (!convo) return json({ error: "conversation_failed" }, 500);

  const history = Array.isArray(convo.transcript) ? convo.transcript : [];
  // deno-lint-ignore no-explicit-any
  const messages: any[] = [...history, { role: "user", content: userMessage }];

  const anthropic = new Anthropic({ apiKey: API_KEY });
  const system: Anthropic.TextBlockParam[] = [
    {
      type: "text",
      text: buildSystemPrompt(plan ?? undefined),
      cache_control: { type: "ephemeral" },
    },
  ];

  // deno-lint-ignore no-explicit-any
  const recorded: any[] = [];
  let complete = false;
  let reply = "";

  // Manual tool loop: the model may record answers (a tool call) before asking
  // its next question. Resolve tool calls and continue until it ends the turn.
  for (let i = 0; i < 5; i++) {
    // deno-lint-ignore no-explicit-any
    const res: any = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      system,
      tools: TOOLS,
      messages,
    });

    messages.push({ role: "assistant", content: res.content });

    for (const b of res.content) {
      if (b.type === "text") reply += b.text;
    }

    const toolUses = res.content.filter((b: { type: string }) => b.type === "tool_use");
    if (res.stop_reason !== "tool_use" || toolUses.length === 0) break;

    // deno-lint-ignore no-explicit-any
    const toolResults: any[] = [];
    for (const tu of toolUses) {
      if (tu.name === "record_answers") {
        const answers = (tu.input?.answers ?? []) as Record<string, unknown>[];
        for (const a of answers) {
          const fieldId = String(a.formstack_field_id ?? "");
          const needsConfirm =
            a.needs_confirmation === true || SENSITIVE_FIELD_IDS.has(fieldId);
          recorded.push({ ...a, formstack_field_id: fieldId, needs_confirmation: needsConfirm });
        }
        toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: "recorded" });
      } else if (tu.name === "intake_complete") {
        complete = true;
        toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: "acknowledged" });
      } else {
        toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: "unknown_tool", is_error: true });
      }
    }
    messages.push({ role: "user", content: toolResults });
  }

  // Persist structured mappings (always unconfirmed at this stage).
  if (recorded.length > 0) {
    await admin.from("ai_answer_mappings").insert(
      recorded.map((a) => ({
        conversation_id: convo.id,
        formstack_field_id: a.formstack_field_id,
        question_label: a.question_label ?? null,
        answer_value: a.answer_value ?? null,
        confidence: typeof a.confidence === "number" ? a.confidence : null,
        confirmed_by_user: false,
      })),
    );
  }

  // Persist transcript (thinking stripped) + status.
  const cleanTranscript = messages.map((m) => ({ role: m.role, content: stripThinking(m.content) }));
  await admin
    .from("ai_conversations")
    .update({
      transcript: cleanTranscript,
      status: complete ? "completed" : "in_progress",
      completed_at: complete ? nowIso() : null,
    })
    .eq("id", convo.id);

  return json({
    conversation_id: convo.id,
    reply: reply.trim(),
    recorded,
    needs_confirmation: recorded.filter((a) => a.needs_confirmation),
    complete,
  });
});
