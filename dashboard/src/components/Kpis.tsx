import type { Totals } from "../api";

export function Kpis({ totals }: { totals: Totals }) {
  const convRate =
    totals.total_sessions > 0
      ? Math.round((totals.paid_submissions / totals.total_sessions) * 100)
      : 0;

  const cards = [
    { label: "Sessions", value: totals.total_sessions, sub: `${totals.abandoned_sessions} abandoned` },
    { label: "Leads captured", value: totals.total_leads },
    { label: "Paid", value: totals.paid_submissions, sub: `${totals.total_submissions} submissions` },
    { label: "Conversion", value: `${convRate}%`, sub: "sessions → paid" },
  ];

  return (
    <div className="kpis">
      {cards.map((c) => (
        <div className="card kpi" key={c.label}>
          <div className="value">{c.value}</div>
          <div className="label">{c.label}</div>
          {c.sub ? <div className="sub">{c.sub}</div> : null}
        </div>
      ))}
    </div>
  );
}
