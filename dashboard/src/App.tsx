import { useCallback, useEffect, useState } from "react";
import { clearSecret, fetchMetrics, getSecret, type Metrics } from "./api";
import { Kpis } from "./components/Kpis";
import { Funnel } from "./components/Funnel";
import { Sessions } from "./components/Sessions";
import { Login } from "./components/Login";

export default function App() {
  const [authed, setAuthed] = useState(!!getSecret());
  const [data, setData] = useState<Metrics | null>(null);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      setData(await fetchMetrics());
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === "unauthorized") {
        clearSecret();
        setAuthed(false);
        setError("Invalid admin secret.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authed) load();
  }, [authed, load]);

  if (!authed) {
    return <Login onAuthed={() => setAuthed(true)} error={error} />;
  }

  return (
    <div className="wrap">
      <div className="topbar">
        <div className="brand">
          <div className="mark">29</div>
          <div>
            <h1>299Trust Admin</h1>
            <p>Funnel · drop-off · conversion</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" onClick={load} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => {
              clearSecret();
              setAuthed(false);
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}

      {data ? (
        <>
          <Kpis totals={data.totals} />
          <div className="section-title">Conversion funnel</div>
          <Funnel steps={data.funnel} />
          {data.totals.orphan_submissions > 0 ? (
            <p className="muted" style={{ marginTop: 10 }}>
              ⚠ {data.totals.orphan_submissions} submission(s) arrived without a
              matched app session — reconcile by email.
            </p>
          ) : null}
          <div className="section-title">Recent sessions</div>
          <Sessions rows={data.recentSessions} />
        </>
      ) : (
        <div className="card muted">Loading…</div>
      )}
    </div>
  );
}
