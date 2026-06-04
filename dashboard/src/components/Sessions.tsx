import type { SessionRow } from "../api";

const fmt = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export function Sessions({ rows }: { rows: SessionRow[] }) {
  if (rows.length === 0) {
    return <div className="card muted">No sessions yet.</div>;
  }
  return (
    <div className="card">
      <table>
        <thead>
          <tr>
            <th>Session</th>
            <th>Platform</th>
            <th>Status</th>
            <th>Lead</th>
            <th>Started</th>
            <th>Last seen</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td title={r.id}>{r.id.slice(0, 8)}</td>
              <td>{r.platform ?? "—"}</td>
              <td>
                <span className={`pill ${r.status}`}>{r.status}</span>
              </td>
              <td>{r.lead_id ? "✓" : "—"}</td>
              <td>{fmt(r.started_at)}</td>
              <td>{fmt(r.last_seen_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
