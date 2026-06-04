import type { FunnelStep } from "../api";

// Horizontal funnel: bar width = % of sessions that reached this step relative
// to app-open, with the step-over-step drop called out where it's meaningful.
export function Funnel({ steps }: { steps: FunnelStep[] }) {
  return (
    <div className="card">
      {steps.map((s, i) => (
        <div className="funnel-row" key={s.step}>
          <div className="meta">
            <span className="name">{s.label}</span>
            <span>
              {s.sessions.toLocaleString()} ({s.pctOfStart}%)
              {i > 0 && s.dropFromPrev > 0 ? (
                <span className="drop"> · −{s.dropFromPrev}%</span>
              ) : null}
            </span>
          </div>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${Math.max(s.pctOfStart, 3)}%` }}>
              {s.pctOfStart >= 12 ? `${s.pctOfStart}%` : ""}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
