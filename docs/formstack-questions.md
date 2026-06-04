# Formstack integration — open questions for the 299 Trust team

Status: form URL wired (`299trust.formstack.com/forms/us_estate_planning`).
Outstanding items to finish the data/correlation side.

## Message to send the team

> **Subject: Two quick things to finish the app ↔ Formstack connection**
>
> Thanks for the form link — it's wired in. Two items to close the loop:
>
> **1. Add two hidden fields to the `us_estate_planning` form** (Form Builder →
> add field → set to Hidden), named exactly:
> - `session_id`
> - `plan`
>
> The app passes these in the URL automatically; Formstack just needs the
> fields present to capture them.
>
> **2. One sample webhook payload.** The cleanest way for us to read the Stripe
> **payment status** correctly the first time is to see one real example.
> Either:
> - **(Best)** Do one test submission with a test payment and send us the **raw
>   JSON** Formstack posts to the webhook, **or**
> - Tell us, in the webhook payload:
>   - **Payment status** — which field, and what values (`paid` / `completed` /
>     `success` / `failed`)?
>   - Is payment status in the **same** webhook as the submission, or a
>     **separate** event?
>   - **Amount** — which field, dollars or cents?
>   - **Stripe transaction/charge ID** — which field?
>   - **Submission ID** — the unique submission identifier field.

## We don't strictly need to wait — the webhook self-documents

`webhook-receiver` now writes a **payload shape** (key names only, no PII) into
`audit_logs` on every hit. After the first test submission, read it:

```sql
select metadata->'payload_shape'
from audit_logs
where action like 'submission_received%' or action = 'webhook_missing_submission_id'
order by occurred_at desc
limit 1;
```

`resolvedFrom` tells us which key each field matched. If
`resolvedFrom.payment_status` is `null`, the real Stripe status key isn't in our
candidate list yet — add it to `KEY_CANDIDATES` in
`supabase/functions/webhook-receiver/index.ts` and redeploy. The full raw
payload (with values) is also in `formstack_submissions.raw_payload`.

**No data is lost while we tune this:** every submission is stored; a mis-mapped
`payment_status` just reads `unpaid` until the key is added.

## Current candidate keys (what the webhook already tries)

| Field | Keys tried (top level + `data`/`fields`/`FormData`) |
|---|---|
| submission id | `UniqueID`, `unique_id`, `submission_id`, `id` |
| session id | `session_id`, `sessionId` |
| plan | `plan` |
| email | `email`, `Email` |
| payment status | `payment_status`, `PaymentStatus`, `payment`, `transaction_status` |
| amount | `amount_cents`, `amount`, `total`, `payment_amount` |
| stripe charge id | `stripe_charge_id`, `charge_id`, `transaction_id` |
