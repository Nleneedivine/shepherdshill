import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const user = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: auth } = await user.auth.getUser();
  if (!auth.user) return new Response(JSON.stringify({ error: "Not signed in" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
  const { data: allowed } = await user.rpc("is_in_followup_department", { check_user_id: auth.user.id });
  const { data: admin } = await user.rpc("has_role", { _user_id: auth.user.id, _role: "admin" });
  const { data: superAdmin } = await user.rpc("has_role", { _user_id: auth.user.id, _role: "super_admin" });
  if (!allowed && !admin && !superAdmin) return new Response(JSON.stringify({ error: "Not authorized" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });

  const body = await req.json().catch(() => ({}));
  const callId = String(body.call_id ?? "");
  if (!callId) return new Response(JSON.stringify({ error: "call_id is required" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });

  const service = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const { data: call, error } = await service.from("follow_up_call_sessions").select("id,recording_path").eq("id", callId).maybeSingle();
  if (error || !call?.recording_path) return new Response(JSON.stringify({ error: "Recording is not available yet" }), { status: 404, headers: { ...cors, "Content-Type": "application/json" } });
  const { data: signed, error: signedError } = await service.storage.from("call-recordings").createSignedUrl(call.recording_path, 3600);
  if (signedError) return new Response(JSON.stringify({ error: signedError.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  return new Response(JSON.stringify({ url: signed.signedUrl }), { headers: { ...cors, "Content-Type": "application/json" } });
});
