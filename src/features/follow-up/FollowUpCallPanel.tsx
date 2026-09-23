import { useEffect, useState } from "react";
import { PhoneCall, Settings2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button, Input } from "@/components/ds";

export function FollowUpCallPanel({ memberId, phone }: { memberId: string; phone: string | null }) {
  const [operatorPhone, setOperatorPhone] = useState("");
  const [calling, setCalling] = useState(false);
  const [message, setMessage] = useState("");
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setOperatorPhone(localStorage.getItem("follow-up-operator-phone") ?? "");
    void supabase.from("follow_up_communication_settings" as any).select("calling_enabled").eq("id", true).maybeSingle()
      .then(({ data }) => setEnabled(Boolean(data?.calling_enabled)));
  }, []);

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
      setMessage("Your phone will ring first. Answer it and the system will connect you to the member.");
      if (data?.call_id) window.dispatchEvent(new CustomEvent("follow-up-call-started", { detail: data.call_id }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not start the call.");
    } finally {
      setCalling(false);
    }
  };

  return (
    <div className="mt-4 rounded-2xl border border-violet-400/15 bg-violet-500/[0.06] p-4">
      <div className="flex items-start gap-3">
        <PhoneCall size={18} className="text-violet-300 mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-white">Call through Shepherd's Hill</div>
          <p className="text-xs text-slate-400 mt-1">
            Your phone rings first, then the member is connected. The conversation is recorded by the calling system.
          </p>
          <div className="mt-3">
            <Input label="Your calling number" value={operatorPhone} onChange={(e) => setOperatorPhone(e.target.value)} placeholder="+234..." />
            <div className="text-[11px] text-slate-500 mt-1">Saved only in this browser for the next call.</div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => void startCall()} loading={calling} disabled={!enabled || !phone}>
              <PhoneCall size={14} className="mr-2" /> {enabled ? "Call member" : "System calling is off"}
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
