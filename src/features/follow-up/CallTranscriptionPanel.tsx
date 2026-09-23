import { useState } from "react";
import { Download, FileAudio, Loader2, Play, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ds";

type CallRow = {
  id: string;
  status: string;
  duration_seconds: number | null;
  recording_status: string;
  transcription_status: string;
  transcript: string | null;
  created_at: string;
};

export function CallTranscriptionPanel({ memberId }: { memberId: string }) {
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.rpc("get_follow_up_call_sessions", { p_member_id: memberId });
    setCalls((data ?? []) as CallRow[]);
    setLoading(false);
  };

  useState(() => { void load(); });

  const transcribe = async (call: CallRow) => {
    setBusy(call.id);
    try {
      const { data, error } = await supabase.functions.invoke("call-recording-url", { body: { call_id: call.id } });
      if (error) throw error;
      const url = data?.url;
      if (!url) throw new Error("Recording URL unavailable");
      const { pipeline } = await import("@huggingface/transformers");
      const transcriber = await pipeline("automatic-speech-recognition", "Xenova/whisper-tiny.en", { dtype: "q8" });
      const result = await transcriber(url, { chunk_length_s: 30, stride_length_s: 5 });
      const text = typeof result === "string" ? result : result?.text ?? "";
      if (!text.trim()) throw new Error("No speech was detected");
      const { error: saveError } = await supabase.from("follow_up_call_sessions" as any).update({
        transcript: text.trim(),
        transcription_status: "completed",
        transcript_language: "en",
        updated_at: new Date().toISOString(),
      }).eq("id", call.id);
      if (saveError) throw saveError;
      await load();
    } catch (error) {
      await supabase.from("follow_up_call_sessions" as any).update({
        transcription_status: "failed",
        updated_at: new Date().toISOString(),
      }).eq("id", call.id);
      setCalls((current) => current.map((item) => item.id === call.id ? { ...item, transcription_status: "failed" } : item));
      console.error(error);
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <div className="mt-4 text-xs text-slate-500">Loading recorded calls...</div>;
  if (!calls.length) return null;

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-white"><FileAudio size={15} /> Recorded calls & transcription</div>
      <p className="text-xs text-slate-500 mt-1">Transcription runs in this browser using an open-source Whisper model. No transcription API fee is required.</p>
      <div className="mt-3 space-y-3">
        {calls.map((call) => (
          <div key={call.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm text-white">{call.status.replaceAll("_"," ")} · {call.duration_seconds ? Math.round(call.duration_seconds / 60) + " min" : "duration pending"}</div>
                <div className="text-xs text-slate-500 mt-1">{new Date(call.created_at).toLocaleString("en-NG")}</div>
              </div>
              <div className="flex gap-2">
                {call.recording_status === "available" && (
                  <Button variant="secondary" onClick={async () => {
                    const { data } = await supabase.functions.invoke("call-recording-url", { body: { call_id: call.id } });
                    if (data?.url) window.open(data.url, "_blank", "noopener,noreferrer");
                  }}><Play size={13} className="mr-1" /> Play</Button>
                )}
                {call.recording_status === "available" && !call.transcript && (
                  <Button onClick={() => void transcribe(call)} disabled={busy === call.id}>{busy === call.id ? <Loader2 size={13} className="mr-1 animate-spin" /> : <Sparkles size={13} className="mr-1" />}{busy === call.id ? "Transcribing…" : "Transcribe free"}</Button>
                )}
              </div>
            </div>
            {call.transcript && <div className="mt-3 rounded-xl bg-black/20 p-3 text-sm text-slate-300 whitespace-pre-wrap">{call.transcript}</div>}
            {call.transcription_status === "failed" && <div className="mt-2 text-xs text-rose-300">Transcription failed on this device. Try again on a newer desktop browser.</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
