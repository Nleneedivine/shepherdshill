import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const { submission, turnstileToken } = await req.json();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 1. Verify CAPTCHA
  const turnstileRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret: Deno.env.get("TURNSTILE_SECRET_KEY"),
      response: turnstileToken,
    }),
  });
  const turnstileData = await turnstileRes.json();
  if (!turnstileData.success) {
    return new Response(JSON.stringify({ error: "CAPTCHA verification failed" }), { status: 400 });
  }

  // 2. Rate limit by IP
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("registration_attempts")
    .select("*", { count: "exact", head: true })
    .eq("ip_address", ip)
    .gte("created_at", oneHourAgo);

  if ((count ?? 0) >= 5) {
    return new Response(JSON.stringify({ error: "Too many attempts. Please try again later." }), { status: 429 });
  }
  await supabase.from("registration_attempts").insert({ ip_address: ip });

  // 3. Insert the actual registration
  const { data, error } = await supabase
    .from("member_registrations")
    .insert(submission)
    .select("id")
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message, code: error.code }), { status: 400 });
  }

  return new Response(JSON.stringify({ id: data.id }), { status: 200 });
});
