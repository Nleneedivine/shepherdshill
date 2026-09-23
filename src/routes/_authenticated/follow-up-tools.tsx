import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BookOpen, ExternalLink, MessageSquare, PhoneCall, RefreshCw, Settings2, WalletCards } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button, Input } from "@/components/ds";
import { useToastContext } from "@/components/ds/Toast";

export const Route = createFileRoute("/_authenticated/follow-up-tools")({
  ssr: false,
  component: FollowUpTools,
});

type Settings = {
  provider: string;
  messaging_enabled: boolean;
  calling_enabled: boolean;
  voice_number: string | null;
  sender_id: string | null;\n  messaging_agent_id: string | null;
  currency: string;
  voice_rate_per_minute: number | null;
  low_balance_threshold: number;
};

type ProviderStatus = {
  configured: boolean;
  balance: number | null;
  currency: string;
  last_synced_at: string;
  error?: string;
};

const defaultStatus: ProviderStatus = {
  configured: false,
  balance: null,
  currency: "NGN",
  last_synced_at: new Date().toISOString(),
};

function formatMoney(value: number | null, currency: string) {
  if (value === null) return "Not available";
  return new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
}

function formatDuration(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return "—";
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return [hours, mins, secs].map((v) => String(v).padStart(2, "0")).join(":");
}

function FollowUpTools() {
  const { showToast } = useToastContext();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [status, setStatus] = useState<ProviderStatus>(defaultStatus);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  const [rate, setRate] = useState("");
  const [threshold, setThreshold] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("follow_up_communication_settings" as any).select("provider,voice_provider,messaging_provider,messaging_enabled,calling_enabled,voice_number,sender_id,messaging_agent_id,currency,voice_rate_per_minute,low_balance_threshold").eq("id", true).maybeSingle();
    if (error) showToast(error.message, "error");
    else if (data) {
      const next = data as Settings;
      setSettings(next);
      setRate(next.voice_rate_per_minute?.toString() ?? "");
      setThreshold(next.low_balance_threshold.toString());
    }
    setLoading(false);
  };

  const syncBalance = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("communication-status");
      if (error) throw error;
      setStatus((data ?? defaultStatus) as ProviderStatus);
    } catch (error) {
      setStatus({ ...defaultStatus, error: error instanceof Error ? error.message : "Could not check provider status" });
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => { void load(); void syncBalance(); }, []);

  const estimatedSeconds = useMemo(() => {
    if (status.balance === null || !settings?.voice_rate_per_minute || settings.voice_rate_per_minute <= 0) return null;
    return (status.balance / settings.voice_rate_per_minute) * 60;
  }, [settings?.voice_rate_per_minute, status.balance]);

  const saveSettings = async (patch: Partial<Settings>) => {
    if (!settings) return;
    setSaving(true);
    const next = { ...settings, ...patch };
    const { error } = await supabase.from("follow_up_communication_settings" as any).update({
      messaging_enabled: next.messaging_enabled,
      calling_enabled: next.calling_enabled,
      voice_number: next.voice_number,
      sender_id: next.sender_id,\n      messaging_agent_id: next.messaging_agent_id,
      voice_rate_per_minute: next.voice_rate_per_minute,
      low_balance_threshold: next.low_balance_threshold,
      updated_by: (await supabase.auth.getUser()).data.user?.id ?? null,
      updated_at: new Date().toISOString(),
    }).eq("id", true);
    if (error) showToast(error.message, "error");
    else { setSettings(next); showToast("Communication settings saved", "success"); }
    setSaving(false);
  };

  if (loading) return <div className="min-h-screen bg-[#080c16] flex items-center justify-center text-slate-400">Loading communication tools...</div>;
  if (!settings) return <div className="min-h-screen bg-[#080c16] flex items-center justify-center text-slate-400">Communication settings are not available.</div>;

  const lowBalance = status.balance !== null && status.balance <= settings.low_balance_threshold;

  return (
    <div className="min-h-screen bg-[#080c16] px-4 py-6 pb-24">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div><div className="text-xs uppercase tracking-[0.18em] text-violet-300/80">Follow-Up Tools</div><h1 className="text-2xl font-bold text-white mt-1">Calls & Messaging</h1><p className="text-sm text-slate-400 mt-1">Everything the Follow-Up team needs to contact people without dealing with technical settings.</p></div>
          <Button variant="secondary" onClick={() => { void load(); void syncBalance(); }} disabled={syncing}><RefreshCw size={15} className={syncing ? "animate-spin mr-2" : "mr-2"} /> Refresh</Button>
        </div>

        {showGuide && <div className="mt-5 rounded-2xl border border-violet-400/20 bg-violet-500/10 p-5"><div className="flex items-start justify-between gap-4"><div className="flex gap-3"><BookOpen className="text-violet-300 mt-0.5" size={20} /><div><h2 className="font-semibold text-white">Simple guide for Follow-Up workers</h2><ol className="mt-3 space-y-2 text-sm text-slate-300 list-decimal pl-5"><li>Open <b>Follow-Up</b> and select the person you need to contact.</li><li>Tap the member phone / Call button to place the call, then return here and record the outcome after the conversation.</li><li>Use <b>WhatsApp / SMS</b> when a message is more appropriate. Keep messages short and personal.</li><li>After a call, always save the result and set the next follow-up date if another contact is needed.</li><li>If the balance warning is red, tell an admin before making more calls.</li></ol></div></div><button onClick={() => setShowGuide(false)} className="text-xs text-slate-400 hover:text-white">Hide</button></div></div>}

        <div className="grid md:grid-cols-2 gap-4 mt-5">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center gap-2 text-slate-300"><PhoneCall size={17} /><span className="font-semibold">Calling</span></div>
            <div className="mt-4 rounded-2xl bg-white/[0.03] border border-white/10 p-4"><div className="text-xs text-slate-500 uppercase tracking-wider">Estimated call time left</div><div className="text-3xl font-bold text-white mt-2 font-mono">{formatDuration(estimatedSeconds)}</div><div className="text-xs text-slate-500 mt-2">Based on current wallet balance and the configured Nigeria voice rate.</div></div>
            <div className="mt-3 grid grid-cols-2 gap-3"><Stat label="Wallet" value={formatMoney(status.balance, status.currency)} /><Stat label="Rate / min" value={settings.voice_rate_per_minute ? formatMoney(settings.voice_rate_per_minute, settings.currency) : "Set rate"} /></div>
            <div className="mt-4 flex gap-2"><Button onClick={() => void syncBalance()} disabled={syncing} className="flex-1"><RefreshCw size={14} className="mr-2" /> Check balance</Button><a href={settings.provider === "voicebip" ? "https://voicebip.ng/" : "https://notify.africa/"} target="_blank" rel="noreferrer" className="flex-1"><Button variant="secondary" className="w-full"><WalletCards size={14} className="mr-2" /> Recharge</Button></a></div>
            {lowBalance && <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 text-xs text-amber-200 flex gap-2"><AlertTriangle size={15} className="shrink-0" /> Low balance. Recharge before making more calls.</div>}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center gap-2 text-slate-300"><MessageSquare size={17} /><span className="font-semibold">Messaging</span></div>
            <p className="text-xs text-slate-500 mt-2">Admin controls whether WhatsApp/SMS sending is available to the team.</p>
            <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-3"><div><div className="text-sm text-white">Messaging is {settings.messaging_enabled ? "ON" : "OFF"}</div><div className="text-xs text-slate-500 mt-1">{settings.sender_id ? "Sender ID: " + settings.sender_id : "Sender ID not configured"}</div><div className="text-xs text-slate-500 mt-1">Provider: <span className="text-slate-300">{settings.provider}</span></div></div><button disabled={saving} onClick={() => void saveSettings({ messaging_enabled: !settings.messaging_enabled })} className={settings.messaging_enabled ? "rounded-full bg-emerald-500/20 px-3 py-1.5 text-xs text-emerald-300" : "rounded-full bg-white/10 px-3 py-1.5 text-xs text-slate-300"}>{settings.messaging_enabled ? "Turn off" : "Turn on"}</button></div>
            <div className="mt-3 text-xs text-slate-500">Turning this on only makes the tools available. Provider credentials are kept on the server and are never shown to Follow-Up workers.</div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5"><div className="flex items-center gap-2 text-slate-300"><Settings2 size={17} /><span className="font-semibold">Admin settings</span></div>
          <div className="mt-4 grid md:grid-cols-2 gap-3"><div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-300">Voice provider: <span className="text-white">{settings.voice_provider || settings.provider}</span><div className="text-xs text-slate-500 mt-1">Messaging provider: {settings.messaging_provider || settings.provider}</div></div><div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-500">Providers are intentionally separated so we can change voice and messaging pipes independently.</div></div><div className="mt-4 grid md:grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 flex items-center justify-between">
              <div><div className="text-sm text-white">System calling</div><div className="text-xs text-slate-500 mt-1">Workers can place recorded human-to-human calls through the selected voice provider.</div></div>
              <button disabled={saving} onClick={() => void saveSettings({ calling_enabled: !settings.calling_enabled })} className={settings.calling_enabled ? "rounded-full bg-emerald-500/20 px-3 py-1.5 text-xs text-emerald-300" : "rounded-full bg-white/10 px-3 py-1.5 text-xs text-slate-300"}>{settings.calling_enabled ? "ON" : "OFF"}</button>
            </div>
            <div className="rounded-xl border border-amber-400/10 bg-amber-500/[0.04] p-3 text-xs text-slate-400">Keep calling OFF until the selected provider, real number, credentials and callback/webhook setup are configured.</div>
          </div><p className="text-xs text-slate-500 mt-1">Only admins or the Follow-Up department head should change these values.</p><div className="grid md:grid-cols-3 gap-3 mt-4"><Input label="Voice number" value={settings.voice_number ?? ""} onChange={(e) => setSettings({ ...settings, voice_number: e.target.value })} placeholder="+234..." /><Input label="Sender ID" value={settings.sender_id ?? ""} onChange={(e) => setSettings({ ...settings, sender_id: e.target.value })} placeholder="ShepherdsHill" /><Input label="Messaging agent ID" value={settings.messaging_agent_id ?? ""} onChange={(e) => setSettings({ ...settings, messaging_agent_id: e.target.value })} placeholder="Provider agent ID" /><Input label="Voice rate / minute (NGN)" type="number" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="Enter current provider rate" /></div><div className="grid md:grid-cols-3 gap-3 mt-3"><Input label="Low balance alert (NGN)" type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} /><div className="md:col-span-2 flex items-end"><Button loading={saving} onClick={() => void saveSettings({ voice_number: settings.voice_number || null, sender_id: settings.sender_id || null, voice_rate_per_minute: rate ? Number(rate) : null, low_balance_threshold: threshold ? Number(threshold) : 5000 })}>Save settings</Button></div></div></div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5"><h2 className="font-semibold text-white">How to recharge</h2><div className="mt-3 space-y-2 text-sm text-slate-300"><p><b>1.</b> Tap <b>Recharge</b> above.</p><p><b>2.</b> In the provider dashboard, open <b>Billing / Top Up</b>.</p><p><b>3.</b> Choose the country and payment method, then complete the payment.</p><p><b>4.</b> Return here and tap <b>Check balance</b>.</p></div><p className="text-xs text-slate-500 mt-3">We deliberately do not store card details in Shepherd's Hill.</p><a className="inline-flex items-center gap-2 text-xs text-violet-300 mt-3 hover:text-white" href="https://voicebip.ng/" target="_blank" rel="noreferrer">Open provider billing <ExternalLink size={13} /></a></div>

        <div className="mt-4 text-xs text-slate-600">Provider status: {status.configured ? "Connected" : "Not connected yet"} · Last checked {new Date(status.last_synced_at).toLocaleTimeString("en-NG")}{status.error ? " · " + status.error : ""}</div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3"><div className="text-[11px] uppercase tracking-wider text-slate-500">{label}</div><div className="text-sm text-white mt-1">{value}</div></div>;
}
