import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return new Response(JSON.stringify({ configured: false, error: "Not signed in" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });

  const { data: allowed } = await supabase.rpc("is_in_followup_department", { p_user_id: user.user.id });
  const { data: admin } = await supabase.rpc("has_role", { p_user_id: user.user.id, p_role: "admin" });
  if (!allowed && !admin) return new Response(JSON.stringify({ configured: false, error: "Not authorized" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });

  const username = Deno.env.get("AT_USERNAME");
  const apiKey = Deno.env.get("AT_API_KEY");
  if (!username || !apiKey) return new Response(JSON.stringify({ configured: false, balance: null, currency: "NGN", last_synced_at: new Date().toISOString() }), { headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const response = await fetch("https://api.africastalking.com/version1/user?username=" + encodeURIComponent(username), { headers: { apiKey, Accept: "application/json" } });
    const json = await response.json();
    const raw = json?.UserData?.balance ?? json?.balance ?? "";
    const match = String(raw).match(/([0-9]+(?:\\.[0-9]+)?)/);
    const balance = match ? Number(match[1]) : null;
    return new Response(JSON.stringify({ configured: response.ok && balance !== null, balance, currency: "NGN", last_synced_at: new Date().toISOString(), error: response.ok ? undefined : "Provider balance request failed" }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ configured: false, balance: null, currency: "NGN", last_synced_at: new Date().toISOString(), error: error instanceof Error ? error.message : "Provider request failed" }), { headers: { ...cors, "Content-Type": "application/json" } });
  }
});