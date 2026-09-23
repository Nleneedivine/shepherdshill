import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
  );
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return reply({ configured: false, error: "Not signed in" }, 401);

  const { data: allowed } = await supabase.rpc("is_in_followup_department", { check_user_id: user.user.id });
  const { data: admin } = await supabase.rpc("has_role", { _user_id: user.user.id, _role: "admin" });
  const { data: superAdmin } = await supabase.rpc("has_role", { _user_id: user.user.id, _role: "super_admin" });
  if (!allowed && !admin && !superAdmin) return reply({ configured: false, error: "Not authorized" }, 403);

  const { data: settings, error } = await supabase
    .from("follow_up_communication_settings")
    .select("provider,currency")
    .eq("id", true)
    .maybeSingle();
  if (error) return reply({ configured: false, balance: null, currency: "NGN", last_synced_at: new Date().toISOString(), error: error.message }, 500);

  const provider = settings?.provider ?? "none";
  const currency = settings?.currency ?? "NGN";
  const now = new Date().toISOString();

  // Voicebip exposes a simple live workspace balance endpoint.
  if (provider === "voicebip") {
    const apiKey = Deno.env.get("VOICEBIP_API_KEY");
    if (!apiKey) return reply({ configured: false, balance: null, currency, provider, last_synced_at: now });

    try {
      const response = await fetch("https://api.voicebip.com/v1/billing/balance", {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      });
      const json = await response.json();
      const balanceKobo = Number(json?.balance_kobo);
      const balance = Number.isFinite(balanceKobo) ? balanceKobo / 100 : null;
      return reply({
        configured: response.ok && balance !== null,
        balance,
        currency: json?.currency ?? currency,
        provider,
        last_synced_at: now,
        error: response.ok ? undefined : "Voice provider balance request failed",
      });
    } catch (err) {
      return reply({ configured: false, balance: null, currency, provider, last_synced_at: now, error: err instanceof Error ? err.message : "Provider request failed" });
    }
  }

  // Notify Africa's Voice API currently exposes call sessions, but its public
  // developer docs do not document a balance endpoint. We therefore never
  // invent a balance figure.
  if (provider === "notify_africa") {
    const configured = Boolean(Deno.env.get("NOTIFY_AFRICA_VOICE_API_KEY"));
    return reply({
      configured,
      balance: null,
      currency,
      provider,
      last_synced_at: now,
      error: configured ? "Live balance is not exposed by the provider API used here" : undefined,
    });
  }

  return reply({
    configured: false,
    balance: null,
    currency,
    provider,
    last_synced_at: now,
    error: provider === "africastalking" ? "Africa's Talking has been removed from the voice integration. Select a new provider." : undefined,
  });
});
