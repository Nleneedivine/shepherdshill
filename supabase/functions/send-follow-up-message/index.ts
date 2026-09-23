import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
  );
  const { data: auth } = await userClient.auth.getUser();
  if (!auth.user) return reply({ error: "Not signed in" }, 401);

  const userId = auth.user.id;
  const { data: allowed } = await userClient.rpc("is_in_followup_department", { check_user_id: userId });
  const { data: admin } = await userClient.rpc("has_role", { _user_id: userId, _role: "admin" });
  const { data: superAdmin } = await userClient.rpc("has_role", { _user_id: userId, _role: "super_admin" });
  if (!allowed && !admin && !superAdmin) return reply({ error: "Not authorized" }, 403);

  const body = await req.json().catch(() => ({}));
  const memberId = String(body.member_id ?? "");
  const channel = String(body.channel ?? "");
  const messageBody = String(body.body ?? "").trim();
  const messageType = String(body.message_type ?? "manual");

  if (!memberId || !["sms", "whatsapp"].includes(channel) || !messageBody) {
    return reply({ error: "member_id, channel and message body are required" }, 400);
  }

  const { data: settings, error: settingsError } = await userClient
    .from("follow_up_communication_settings")
    .select("provider,messaging_enabled,voice_number,messaging_agent_id")
    .eq("id", true)
    .maybeSingle();
  if (settingsError) return reply({ error: settingsError.message }, 500);
  if (!settings?.messaging_enabled) return reply({ error: "Messaging is currently turned off by an administrator" }, 400);
  if (settings.provider !== "voicebip") return reply({ error: "The active messaging adapter is not configured" }, 503);
  if (!settings.messaging_agent_id) return reply({ error: "The messaging agent has not been configured" }, 503);

  const { data: member, error: memberError } = await userClient
    .from("members")
    .select("id,phone_primary,membership_status,notification_opt_out")
    .eq("id", memberId)
    .maybeSingle();
  if (memberError) return reply({ error: memberError.message }, 500);
  if (!member?.phone_primary || member.membership_status !== "active") return reply({ error: "Member is inactive or has no phone number" }, 400);
  if (member.notification_opt_out) return reply({ error: "This member has opted out of notifications" }, 400);

  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const { data: row, error: insertError } = await serviceClient
    .from("follow_up_messages")
    .insert({
      member_id: member.id,
      channel,
      message_type: messageType,
      body: messageBody,
      status: "queued",
      automated: false,
      scheduled_for: new Date().toISOString(),
      created_by: userId,
    })
    .select("id")
    .single();
  if (insertError) return reply({ error: insertError.message }, 500);

  const apiKey = Deno.env.get("VOICEBIP_API_KEY");
  if (!apiKey) return reply({ error: "Voicebip messaging credentials are not configured", message_id: row.id }, 503);

  try {
    const response = await fetch("https://api.voicebip.com/v1/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        agent_id: settings.messaging_agent_id,
        channel,
        from_number: settings.voice_number,
        to_number: member.phone_primary,
        body: messageBody,
      }),
    });

    const providerText = await response.text();
    let provider: any = null;
    try { provider = JSON.parse(providerText); } catch { provider = { raw: providerText }; }

    if (!response.ok) {
      await serviceClient.from("follow_up_messages").update({
        status: "failed",
        error_message: provider?.message ?? providerText.slice(0, 500),
      }).eq("id", row.id);
      return reply({ error: "Messaging provider rejected the message", details: provider, message_id: row.id }, 502);
    }

    await serviceClient.from("follow_up_messages").update({
      status: "sent",
      sent_at: new Date().toISOString(),
      provider_message_id: provider?.message_id ?? null,
    }).eq("id", row.id);

    return reply({ message_id: row.id, provider_message_id: provider?.message_id ?? null, status: "sent" });
  } catch (error) {
    await serviceClient.from("follow_up_messages").update({
      status: "failed",
      error_message: error instanceof Error ? error.message : "Provider request failed",
    }).eq("id", row.id);
    return reply({ error: error instanceof Error ? error.message : "Provider request failed", message_id: row.id }, 502);
  }
});
