// Owns the app session and the funnel-event pipeline. On launch it mints a
// stable device_id, creates a server session, and exposes track() to every
// screen. Events are buffered and flushed in batches so we never lose funnel
// data to flaky mobile networks (the whole point of the analytics layer).

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { api, type FunnelEvent, type FunnelEventType } from "@/api/client";

const DEVICE_KEY = "two99.device_id";
const QUEUE_KEY = "two99.event_queue";
const FLUSH_INTERVAL_MS = 4000;

type Ctx = {
  sessionId: string | null;
  leadId: string | null;
  ready: boolean;
  track: (event: FunnelEventType, step?: string, metadata?: Record<string, unknown>) => void;
  identifyLead: (id: string) => void;
};

const SessionContext = createContext<Ctx | null>(null);

// RFC4122-ish id without a crypto dep; fine for an anonymous device handle.
function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function getDeviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = uuid();
    await AsyncStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const queue = useRef<FunnelEvent[]>([]);

  // Create the session once on launch.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const device_id = await getDeviceId();
        const { session_id } = await api.createSession({
          device_id,
          platform: Platform.OS === "ios" ? "ios" : "android",
          app_version: Constants.expoConfig?.version ?? undefined,
        });
        if (!cancelled) setSessionId(session_id);
      } catch (e) {
        // Non-fatal: the app still works, we just lose analytics for this run.
        console.warn("session create failed", e);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const flush = useCallback(async () => {
    if (!sessionId || queue.current.length === 0) return;
    const batch = queue.current;
    queue.current = [];
    try {
      await api.trackEvents(sessionId, batch, leadId ?? undefined);
      await AsyncStorage.removeItem(QUEUE_KEY);
    } catch {
      // Re-queue and persist so a crash/close doesn't lose events.
      queue.current = [...batch, ...queue.current];
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue.current));
    }
  }, [sessionId, leadId]);

  // Periodic flush + flush when the app backgrounds.
  useEffect(() => {
    const timer = setInterval(flush, FLUSH_INTERVAL_MS);
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active") flush();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [flush]);

  const track = useCallback<Ctx["track"]>((event, step, metadata) => {
    queue.current.push({
      event_type: event,
      step,
      metadata,
      occurred_at: new Date().toISOString(),
    });
  }, []);

  const identifyLead = useCallback((id: string) => setLeadId(id), []);

  return (
    <SessionContext.Provider value={{ sessionId, leadId, ready, track, identifyLead }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): Ctx {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
