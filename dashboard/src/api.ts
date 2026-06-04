// Dashboard data layer. Calls the admin-metrics Edge Function with the admin
// secret the operator entered (held in localStorage, never baked into the build).

const FUNCTIONS_URL =
  import.meta.env.VITE_FUNCTIONS_URL ??
  "https://fdrdecpzihlztncvglwx.supabase.co/functions/v1";

const SECRET_KEY = "two99.admin_secret";

export const getSecret = () => localStorage.getItem(SECRET_KEY) ?? "";
export const setSecret = (s: string) => localStorage.setItem(SECRET_KEY, s);
export const clearSecret = () => localStorage.removeItem(SECRET_KEY);

export interface Totals {
  total_sessions: number;
  total_leads: number;
  total_submissions: number;
  paid_submissions: number;
  converted_sessions: number;
  abandoned_sessions: number;
  orphan_submissions: number;
}

export interface FunnelStep {
  step: string;
  label: string;
  sessions: number;
  pctOfStart: number;
  dropFromPrev: number;
}

export interface SessionRow {
  id: string;
  platform: string | null;
  status: string;
  entry_source: string | null;
  started_at: string;
  last_seen_at: string;
  lead_id: string | null;
}

export interface Metrics {
  totals: Totals;
  funnel: FunnelStep[];
  recentSessions: SessionRow[];
}

export async function fetchMetrics(): Promise<Metrics> {
  const res = await fetch(`${FUNCTIONS_URL}/admin-metrics`, {
    headers: { "x-admin-secret": getSecret() },
  });
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) throw new Error(`metrics failed: ${res.status}`);
  return (await res.json()) as Metrics;
}
