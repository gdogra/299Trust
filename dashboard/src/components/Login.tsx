import { useState } from "react";
import { setSecret } from "../api";

export function Login({ onAuthed, error }: { onAuthed: () => void; error?: string }) {
  const [value, setValue] = useState("");
  return (
    <div className="wrap">
      <div className="login card">
        <div className="brand" style={{ marginBottom: 8 }}>
          <div className="mark">29</div>
          <div>
            <h1>299Trust Admin</h1>
            <p className="muted">Funnel analytics</p>
          </div>
        </div>
        <p className="muted">
          Enter the admin secret (the <code>ADMIN_API_SECRET</code> set on the
          Edge Function).
        </p>
        <input
          type="password"
          placeholder="Admin secret"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setSecret(value);
              onAuthed();
            }
          }}
        />
        <button
          className="btn btn-primary"
          style={{ width: "100%" }}
          onClick={() => {
            setSecret(value);
            onAuthed();
          }}
        >
          Sign in
        </button>
        {error ? <div className="error">{error}</div> : null}
      </div>
    </div>
  );
}
