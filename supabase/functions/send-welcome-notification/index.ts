// Edge function stub: send-welcome-notification
// Wires up a member welcome message (SMS/WhatsApp) after approval.
// The concrete provider integration will be added later.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req) => {
  try {
    const { memberId } = await req.json();
    // TODO: fetch member + send welcome via provider
    return new Response(JSON.stringify({ ok: true, memberId }), {
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
});
