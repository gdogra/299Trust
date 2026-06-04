// Small shared helpers for the Edge Functions.

export function nowIso(): string {
  return new Date().toISOString();
}

// Normalize an unknown to a trimmed non-empty string, else null.
export function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

// Drop null/undefined keys so an UPDATE never clobbers existing values.
export function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== null && v !== undefined),
  ) as Partial<T>;
}
