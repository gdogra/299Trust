// PLACEHOLDER Formstack field map for the AI-guided intake (V2).
// Replace the `id`s with the real Formstack field ids once the form is known
// (same field-name caveat as webhook-receiver). `sensitive` fields ALWAYS
// require explicit user confirmation — they drive the human-in-the-loop
// guardrail: the AI never finalizes who inherits an estate on its own.

export interface FormstackField {
  id: string;
  label: string;
  sensitive?: boolean;
}

export const FORMSTACK_FIELDS: FormstackField[] = [
  { id: "field_full_name", label: "Your full legal name" },
  { id: "field_marital_status", label: "Marital status" },
  { id: "field_spouse_name", label: "Spouse/partner full legal name" },
  { id: "field_children", label: "Children's full legal names and ages" },
  { id: "field_primary_beneficiaries", label: "Primary beneficiaries and their shares", sensitive: true },
  { id: "field_successor_trustee", label: "Successor trustee (who manages the trust if you can't)", sensitive: true },
  { id: "field_guardian_minor", label: "Guardian for any minor children", sensitive: true },
  { id: "field_real_estate", label: "Real estate to place in the trust" },
  { id: "field_financial_accounts", label: "Financial accounts to include" },
  { id: "field_specific_gifts", label: "Specific gifts or bequests", sensitive: true },
  { id: "field_healthcare_agent", label: "Healthcare decision-maker", sensitive: true },
];

export const SENSITIVE_FIELD_IDS = new Set(
  FORMSTACK_FIELDS.filter((f) => f.sensitive).map((f) => f.id),
);

export function buildSystemPrompt(plan?: string): string {
  const fieldList = FORMSTACK_FIELDS.map(
    (f) => `- ${f.id}: ${f.label}${f.sensitive ? "  [SENSITIVE — must confirm]" : ""}`,
  ).join("\n");

  return `You are the 299Trust guided intake assistant. You help a customer complete a DIY revocable living trust questionnaire through a calm, plain-language conversation.
${plan ? `\nThe customer chose the ${plan} plan.\n` : ""}
Your job: collect the information needed to fill the questionnaire, ONE question at a time, in warm everyday language, and map what the customer tells you to the Formstack fields below by calling the record_answers tool.

Formstack fields:
${fieldList}

Rules:
- You are NOT a lawyer and you do NOT give legal advice. If asked for legal advice, gently explain you can help complete the documents but can't advise, and suggest consulting an attorney.
- Ask ONE clear, short, friendly question at a time.
- When the customer answers, call record_answers with the mapped field(s). Set a confidence from 0 to 1. Set needs_confirmation=true for any SENSITIVE field, or whenever you are not highly confident you understood correctly.
- For SENSITIVE answers (beneficiaries, trustees, guardians, specific gifts, healthcare agent), read the answer back and ask the customer to confirm before moving on. NEVER finalize who inherits without explicit confirmation.
- Never invent or assume answers. If anything is unclear, ask.
- When every field is collected and the sensitive ones are confirmed, call intake_complete with a brief summary.
- Start by briefly explaining what you'll do (1-2 sentences), then ask the first question.`;
}
