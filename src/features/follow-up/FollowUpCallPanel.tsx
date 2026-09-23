import { useEffect, useMemo, useState } from "react";
import { PhoneCall, Settings2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button, Input } from "@/components/ds";

type CallSession = {
  id: string;
  status: string;
  duration_seconds: number | null;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
};

function formatClock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

export function FollowUpCallPanel({ memberId, phone }: { memberId: string; phone: string | null }) {
  const [operatorPhone, setOperatorPhone] = useState("");
  const [calling, setCalling] = useState(false);
  const [message, setMessage] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [callId, setCallId] = useState<string | null>(null);
  const [session, setSession] = useState<CallSession | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    setOperatorPhone(localStorage.getItem("follow-up-operator-phone") ?? "");
    void supabase.from("follow_up_communication_settings" as any).select("calling_enabled").eq("id", true).maybeSingle()
      .then(({ data }) => setEnabled(Boolean(data?.calling_enabled)));
  }, []);

  useEffect(() => {
    if (!callId) return;
    let cancelled = false;
    const poll = async () => {
      const { data } = await supabase.from("follow_up_call_sessions" as any)
        .select("id,status,duration_seconds,created_at,started_at,ended_at")
        .eq("id", callId)
        .maybeSingle();
      if (!cancelled && data) setSession(data as CallSession);
    };
    void poll();
    const interval = window.setInterval(() => { void poll(); }, 3000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [callId]);

  useEffect(() => {
    if (!session || !["queued","dialing","ringing","bridged"].includes(session.status)) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [session]);

  const liveSeconds = useMemo(() => {
    if (!session) return 0;
    if (session.duration_seconds) return session.duration_seconds;
    if (!session.started_at) return 0;
    return Math.max(0, (now - new Date(session.started_at).getTime()) / 1000);
  }, [now, session]);

  const startCall = async () => {
    if (!phone) return setMessage("This member has no phone number.");
    if (!/^\+\d{8,15}$/.test(operatorPhone.trim())) return setMessage("Enter your phone in international format, e.g. +2348012345678.");
    setCalling(true);
    setMessage("");
    localStorage.setItem("follow-up-operator-phone", operatorPhone.trim());
    try {
      const { data, error } = await supabase.functions.invoke("initiate-follow-up-call", {
        body: { member_id: memberId, operator_phone: operatorPhone.trim() },
      });
      if (error) throw error;
      setCallId(data?.call_id ?? null);
      setMessage("Your phone will ring first. Answer it and the system will connect you to the member.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not start the call.");
    } finally {
      setCalling(false);
    }
  };

  const active = session && ["queued","dialing","ringing","bridged"].includes(session.status);

  return (
    <div className="mt-4 rounded-2xl border border-violet-400/15 bg-violet-500/[0.06] p-4">
      <div className="flex items-start gap-3">
        <PhoneCall size={18} className="text-violet-300 mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-white">Call through Shepherd's Hill</div>
          <p className="text-xs text-slate-400 mt-1">
            Your phone rings first, then the member is connected. The conversation is recorded by the calling system.
          </p>
          {session && (
            <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs uppercase tracking-wider text-slate-500">Call status</div>
                <div className="text-xs font-semibold text-emerald-300">{session.status.replaceAll("_", " ")}</div>
              </div>
              <div className="text-2xl font-mono text-white mt-1">{formatClock(liveSeconds)}</div>
              {session.status === "completed" && <div className="text-xs text-slate-500 mt-1">Recording is being secured for transcription.</div>}
            </div>
          )}
          <div className="mt-3">
            <Input label="Your calling number" value={operatorPhone} onChange={(e) => setOperatorPhone(e.target.value)} placeholder="+234..." />
            <div className="text-[11px] text-slate-500 mt-1">Saved only in this browser for the next call.</div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => void startCall()} loading={calling} disabled={!enabled || !phone || Boolean(active)}>
              <PhoneCall size={14} className="mr-2" /> {active ? "Call in progress" : enabled ? "Call member" : "System calling is off"}
            </Button>
            <div className="inline-flex items-center gap-1.5 text-xs text-slate-500 px-2">
              {enabled ? <ShieldCheck size={13} className="text-emerald-400" /> : <Settings2 size={13} />}
              {enabled ? "Calling enabled" : "Ask an admin to enable calling"}
            </div>
          </div>
          {message && <div className="mt-3 rounded-xl bg-black/20 p-3 text-xs text-slate-300">{message}</div>}
        </div>
      </div>
    </div>
  );
}
