import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const service = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const MAX_CALLBACK_BYTES = 64 * 1024;
const MAX_RECORDING_BYTES = 20 * 1024 * 1024;
const ALLOWED_AUDIO_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/webm",
]);

const xml = (body: string, status = 200) =>
  new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, {
    status,
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "no-store" },
  });

const constantTimeEqual = (left: string, right: string) => {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return difference === 0;
};

const esc = (value: string) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&apos;");

async function readPayload(req: Request) {
  const contentType = (req.headers.get("content-type") ?? "").toLowerCase();
  if (!contentType.includes("application/json") &&
      !contentType.includes("application/x-www-form-urlencoded") &&
      !contentType.includes("multipart/form-data")) {
    throw new Error("unsupported_content_type");
  }

  // Bound the actual streamed body even when Content-Length is missing or false.
  const reader = req.body?.getReader();
  if (!reader) throw new Error("empty_callback_body");
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_CALLBACK_BYTES) {
      await reader.cancel();
      throw new Error("callback_too_large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const boundedRequest = new Request(req.url, {
    method: "POST",
    headers: { "content-type": req.headers.get("content-type") ?? "" },
    body: bytes,
  });
  if (contentType.includes("application/json")) return await boundedRequest.json();

  const form = await boundedRequest.formData();
  const result: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") result[key] = value;
  }
  return result;
}

function allowedRecordingUrl(raw: string): URL | null {
  try {
    const url = new URL(raw);
    const allowedHosts = (Deno.env.get("VOICE_RECORDING_ALLOWED_HOSTS") ?? "")
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean);

    // Fail closed until the operator configures the exact provider host(s).
    if (!allowedHosts.length || url.protocol !== "https:" || url.username || url.password ||
        url.port || !allowedHosts.includes(url.hostname.toLowerCase())) return null;
    return url;
  } catch {
    return null;
  }
}

async function readLimitedBody(response: Response, maxBytes: number): Promise<Uint8Array> {
  if (!response.body) throw new Error("empty_recording_body");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("recording_too_large");
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const secret = Deno.env.get("VOICE_CALLBACK_SECRET");
  if (!secret) {
    console.error("VOICE_CALLBACK_SECRET is not configured");
    return new Response("Callback authentication is not configured", { status: 503 });
  }
  const suppliedSecret = req.headers.get("x-voice-callback-secret") ??
    new URL(req.url).searchParams.get("token") ?? "";
  if (!constantTimeEqual(suppliedSecret, secret)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_CALLBACK_BYTES) {
    return new Response("Payload too large", { status: 413 });
  }

  let payload: Record<string, unknown>;
  try {
    const parsed = await readPayload(req);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return new Response("Invalid callback payload", { status: 400 });
    }
    payload = parsed as Record<string, unknown>;
  } catch {
    return new Response("Invalid callback payload", { status: 400 });
  }

  const statusValue = payload.status;
  const statusName = typeof statusValue === "object" && statusValue !== null
    ? (statusValue as Record<string, unknown>).name
    : statusValue;
  const sessionId = String(payload.sessionId ?? payload.callSessionId ?? payload.call_session_id ?? "").slice(0, 200);
  const clientRequestId = String(payload.clientRequestId ?? payload.messageId ?? payload.message_id ?? "").slice(0, 200);
  const status = String(statusName ?? payload.callStatus ?? payload.call_status ?? "").slice(0, 100);
  const recordingUrl = String(payload.recordingUrl ?? payload.recording_url ??
    (typeof payload.recording === "object" && payload.recording !== null
      ? (payload.recording as Record<string, unknown>).url ?? ""
      : "") ?? payload.fileUrl ?? payload.file_url ?? "").slice(0, 4096);
  const duration = Number(payload.durationInSeconds ?? payload.duration_seconds ?? payload.duration ?? payload.inboundDuration ?? 0);
  const cost = Number(payload.amount ?? payload.cost ?? payload.charge ?? 0);

  if (!sessionId && !clientRequestId) {
    // Do not correlate callbacks by destination phone number: it can attach a
    // forged callback to the wrong active session.
    return new Response("Missing call identifier", { status: 400 });
  }

  let session: Record<string, any> | null = null;
  if (clientRequestId) {
    const { data } = await service.from("follow_up_call_sessions")
      .select("*").eq("client_request_id", clientRequestId).maybeSingle();
    session = data;
  }
  if (!session && sessionId) {
    const { data } = await service.from("follow_up_call_sessions")
      .select("*").eq("provider_session_id", sessionId).maybeSingle();
    session = data;
  }

  if (session) {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (sessionId) updates.provider_session_id = sessionId;

    if (status) {
      const normalized = status.toLowerCase().replace(/[\s-]/g, "_");
      updates.status =
        normalized.includes("notanswered") || normalized.includes("no_answer") ? "not_answered" :
        normalized.includes("expired") ? "expired" :
        normalized.includes("failed") || normalized.includes("aborted") ? "failed" :
        normalized.includes("bridged") ? "bridged" :
        normalized.includes("ringing") ? "ringing" :
        normalized.includes("dialing") ? "dialing" :
        normalized.includes("completed") ? "completed" : session.status;
    }
    if (Number.isFinite(duration) && duration > 0 && duration <= 24 * 60 * 60) {
      updates.duration_seconds = Math.round(duration);
    }
    if (Number.isFinite(cost) && cost > 0 && cost <= 1000000) updates.cost = cost;

    const recordingLocation = recordingUrl ? allowedRecordingUrl(recordingUrl) : null;
    if (recordingUrl && !recordingLocation) {
      // Never fetch or persist an arbitrary callback-supplied URL.
      updates.recording_status = "failed";
    }

    if (recordingLocation) {
      updates.recording_url = recordingLocation.toString();
      updates.recording_status = "processing";
    }
    if (updates.status === "completed") updates.ended_at = new Date().toISOString();

    const { error: updateError } = await service.from("follow_up_call_sessions")
      .update(updates).eq("id", session.id);
    if (updateError) console.error("Voice callback session update failed", updateError.code);

    if (recordingLocation) {
      try {
        const recordingResponse = await fetch(recordingLocation, {
          redirect: "error",
          signal: AbortSignal.timeout(15000),
        });
        if (!recordingResponse.ok) throw new Error("recording_download_failed");

        const contentType = (recordingResponse.headers.get("content-type") ?? "")
          .split(";")[0].trim().toLowerCase();
        if (!ALLOWED_AUDIO_TYPES.has(contentType)) throw new Error("unsupported_recording_type");

        const declaredLength = Number(recordingResponse.headers.get("content-length") ?? 0);
        if (Number.isFinite(declaredLength) && declaredLength > MAX_RECORDING_BYTES) {
          throw new Error("recording_too_large");
        }

        const bytes = await readLimitedBody(recordingResponse, MAX_RECORDING_BYTES);
        const extension = contentType.includes("wav") ? "wav" :
          contentType.includes("ogg") ? "ogg" :
          contentType.includes("webm") ? "webm" :
          contentType.includes("mp4") ? "m4a" : "mp3";
        const path = `${session.member_id}/${session.id}.${extension}`;
        const upload = await service.storage.from("call-recordings").upload(path, bytes, {
          contentType,
          upsert: true,
        });
        if (upload.error) throw new Error("recording_storage_upload_failed");

        const { error: savedPathError } = await service.from("follow_up_call_sessions")
          .update({
            recording_path: path,
            recording_status: "available",
            updated_at: new Date().toISOString(),
          }).eq("id", session.id);
        if (savedPathError) throw new Error("recording_path_update_failed");
      } catch (error) {
        console.error("Voice recording processing failed", error instanceof Error ? error.message : "unknown");
        await service.from("follow_up_call_sessions")
          .update({ recording_status: "failed", updated_at: new Date().toISOString() })
          .eq("id", session.id);
      }
    }
  }

  return xml(esc(""), 200);
});
