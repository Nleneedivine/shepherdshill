import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const service = createClient(supabaseUrl, serviceKey);

const xml = (body: string) =>
  new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });

const esc = (value: string) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&apos;");

async function readPayload(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return await req.json();
  const form = await req.formData();
  const result: Record<string, string> = {};
  for (const [key, value] of form.entries()) if (typeof value === "string") result[key] = value;
  return result;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("OK");
  const secret = Deno.env.get("VOICE_CALLBACK_SECRET");
  if (secret && new URL(req.url).searchParams.get("token") !== secret) return new Response("Unauthorized", { status: 401 });

  const payload = await readPayload(req);
  const sessionId = String(payload.sessionId ?? payload.callSessionId ?? payload.call_session_id ?? "");
  const clientRequestId = String(payload.clientRequestId ?? "");
  const status = String(payload.status ?? payload.callStatus ?? "");
  const recordingUrl = String(payload.recordingUrl ?? payload.recording_url ?? payload.recording?.url ?? "");
  const duration = Number(payload.durationInSeconds ?? payload.duration_seconds ?? payload.duration ?? 0);
  const cost = Number(payload.amount ?? payload.cost ?? payload.charge ?? 0);

  let session: any = null;
  if (clientRequestId) {
    const { data } = await service.from("follow_up_call_sessions").select("*").eq("client_request_id", clientRequestId).maybeSingle();
    session = data;
  }
  if (!session && sessionId) {
    const { data } = await service.from("follow_up_call_sessions").select("*").eq("provider_session_id", sessionId).maybeSingle();
    session = data;
  }
  // Some callbacks omit clientRequestId; fall back to the most recent active session.
  if (!session && (payload.destinationNumber || payload.to || payload.toNumber)) {
    const { data } = await service
      .from("follow_up_call_sessions")
      .select("*")
      .eq("operator_phone", String(payload.destinationNumber ?? payload.to ?? payload.toNumber))
      .in("status", ["queued", "dialing", "ringing"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    session = data;
  }

  if (session) {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (sessionId) updates.provider_session_id = sessionId;
    if (status) {
      const normalized = status.toLowerCase();
      updates.status =
        normalized.includes("notanswered") || normalized.includes("no_answer") ? "not_answered" :
        normalized.includes("expired") ? "expired" :
        normalized.includes("failed") || normalized.includes("aborted") ? "failed" :
        normalized.includes("bridged") ? "bridged" :
        normalized.includes("ringing") ? "ringing" :
        normalized.includes("dialing") ? "dialing" :
        normalized.includes("completed") ? "completed" : session.status;
    }
    if (duration > 0) updates.duration_seconds = Math.round(duration);
    if (cost > 0) updates.cost = cost;
    if (recordingUrl) {
      updates.recording_url = recordingUrl;
      updates.recording_status = "available";
    }
    if (updates.status === "completed") updates.ended_at = new Date().toISOString();
    await service.from("follow_up_call_sessions").update(updates).eq("id", session.id);

    if (recordingUrl) {
      try {
        const recordingResponse = await fetch(recordingUrl);
        if (recordingResponse.ok) {
          const contentType = recordingResponse.headers.get("content-type") ?? "audio/mpeg";
          const extension = contentType.includes("wav") ? "wav" : "mp3";
          const bytes = new Uint8Array(await recordingResponse.arrayBuffer());
          const path = `${session.member_id}/${session.id}.${extension}`;
          const upload = await service.storage.from("call-recordings").upload(path, bytes, {
            contentType,
            upsert: true,
          });
          if (!upload.error) {
            await service.from("follow_up_call_sessions").update({
              recording_path: path,
              recording_status: "available",
              updated_at: new Date().toISOString(),
            }).eq("id", session.id);
          }
        }
      } catch {
        await service.from("follow_up_call_sessions").update({ recording_status: "failed", updated_at: new Date().toISOString() }).eq("id", session.id);
      }
    }
  }



  return new Response("OK");
});
