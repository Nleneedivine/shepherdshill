import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getVoiceProvider } from "../voice-provider/index.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
  );
  const { data: auth } = await userClient.auth.getUser();
  if (!auth.user) return json({ error: "Not signed in" }, 401);

  const userId = auth.user.id;
  const { data: allowed } = await userClient.rpc("is_in_followup_department", { check_user_id: userId });
  const { data: admin } = await userClient.rpc("has_role", { _user_id: userId, _role: "admin" });
  const { data: superAdmin } = await userClient.rpc("has_role", { _user_id: userId, _role: "super_admin" });
  if (!allowed && !admin && !superAdmin) return json({ error: "Not authorized" }, 403);

  const body = await req.json().catch(() => ({}));
  const memberId = String(body.member_id ?? "");
  const operatorPhone = String(body.operator_phone ?? "").trim();
  if (!memberId || !/^\+\d{8,15}$/.test(operatorPhone)) {
    return json({ error: "A valid operator phone in international format is required" }, 400);
  }

  const { data: settings, error: settingsError } = await userClient
    .from("follow_up_communication_settings")
    .select("calling_enabled,voice_number,provider")
    .eq("id", true)
    .maybeSingle();
  if (settingsError) return json({ error: settingsError.message }, 500);
  if (!settings?.calling_enabled) return json({ error: "System calling is currently turned off by an administrator" }, 400);
  if (!settings.provider) return json({ error: "No voice provider has been configured" }, 503);
  if (!settings.voice_number) return json({ error: "The system voice number has not been configured" }, 400);

  const { data: member, error: memberError } = await userClient
    .from("members")
    .select("id,phone_primary,membership_status")
    .eq("id", memberId)
    .maybeSingle();
  if (memberError) return json({ error: memberError.message }, 500);
  if (!member?.phone_primary) return json({ error: "This member has no phone number" }, 400);
  if (member.membership_status !== "active") return json({ error: "This member is not active" }, 400);

  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const clientRequestId = crypto.randomUUID();
  const { data: session, error: insertError } = await serviceClient
    .from("follow_up_call_sessions")
    .insert({
      member_id: member.id,
      initiated_by: userId,
      operator_phone: operatorPhone,
      member_phone: member.phone_primary,
      client_request_id: clientRequestId,
      provider: settings.provider,
      status: "queued",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (insertError) return json({ error: insertError.message }, 500);

  try {
    const provider = getVoiceProvider(settings.provider);
    const result = await provider.startHumanBridgeCall({
      operatorPhone,
      memberPhone: member.phone_primary,
      callerId: settings.voice_number,
      clientRequestId,
    });

    await serviceClient.from("follow_up_call_sessions").update({
      status: "dialing",
      provider_session_id: result.providerSessionId ?? null,
      updated_at: new Date().toISOString(),
    }).eq("id", session.id);

    return json({ call_id: session.id, provider: result.raw });
  } catch (error) {
    await serviceClient.from("follow_up_call_sessions").update({
      status: "failed",
      updated_at: new Date().toISOString(),
    }).eq("id", session.id);

    return json({
      error: error instanceof Error ? error.message : "Call request failed",
      call_id: session.id,
    }, 502);
  }
});
