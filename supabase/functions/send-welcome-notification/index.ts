// Sends a welcome message to a newly-approved member.
// Channel chain: WhatsApp -> SMS (Africa's Talking). SMS reaches iPhones as iMessage
// automatically when the recipient's number is registered with Apple.
//
// Provider tokens are read from env; when missing, that channel is skipped cleanly
// so the function stays deployable before secrets are configured.
//
// Env expected (all optional until you enable a channel):
//   WHATSAPP_API_TOKEN            (Meta Cloud API token)
//   WHATSAPP_PHONE_NUMBER_ID      (Meta Cloud API phone number id)
//   AT_API_KEY                    (Africa's Talking API key)
//   AT_USERNAME                   (Africa's Talking username; use "sandbox" for testing)
//   AT_SENDER_ID                  (optional sender id / short code)
//   APP_URL                       (public app URL used in message body)
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

type Channel = "whatsapp" | "sms" | "imessage" | "auto";

interface DirectPayload {
  recipientPhone: string;
  recipientName: string;
  message: string;
  channel: Channel;
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const appUrl = Deno.env.get("APP_URL") ?? "";

async function logAudit(action: string, details: Record<string, unknown>) {
  try {
    const admin = createClient(supabaseUrl, serviceRoleKey);
    await admin.from("system_logs").insert({
      action,
      performed_by_name: "system:notifications",
      details,
    });
  } catch (_) { /* non-fatal */ }
}

async function sendWhatsApp(phone: string, message: string) {
  const token = Deno.env.get("WHATSAPP_API_TOKEN");
  const phoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  if (!token || !phoneId) return { ok: false, skipped: true, reason: "whatsapp_not_configured" };
  try {
    const res = await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone.replace(/^\+/, ""),
        type: "text",
        text: { body: message },
      }),
    });
    if (!res.ok) return { ok: false, error: `whatsapp_${res.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

async function sendSMS(phone: string, message: string) {
  const apiKey = Deno.env.get("AT_API_KEY");
  const username = Deno.env.get("AT_USERNAME");
  if (!apiKey || !username) return { ok: false, skipped: true, reason: "sms_not_configured" };
  try {
    const form = new URLSearchParams();
    form.set("username", username);
    form.set("to", phone);
    form.set("message", message);
    const from = Deno.env.get("AT_SENDER_ID");
    if (from) form.set("from", from);

    const res = await fetch("https://api.africastalking.com/version1/messaging", {
      method: "POST",
      headers: {
        apiKey,
        Accept: "application/json",
        "content-type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });
    if (!res.ok) return { ok: false, error: `sms_${res.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

async function deliver(channel: Channel, phone: string, message: string) {
  if (channel === "whatsapp") {
    const w = await sendWhatsApp(phone, message);
    if (w.ok) return { delivered_via: "whatsapp", ...w };
    return w;
  }
  if (channel === "sms" || channel === "imessage") {
    const s = await sendSMS(phone, message);
    if (s.ok) return { delivered_via: channel, ...s };
    return s;
  }
  // auto: WhatsApp -> SMS fallback
  const w = await sendWhatsApp(phone, message);
  if (w.ok) return { delivered_via: "whatsapp", ...w };
  const s = await sendSMS(phone, message);
  if (s.ok) return { delivered_via: "sms", ...s };
  const skipped = ("skipped" in w && w.skipped) && ("skipped" in s && s.skipped);
  return { ok: false, skipped, whatsapp: w, sms: s };
}

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));

    // Direct-message mode
    if (body?.payload) {
      const p = body.payload as DirectPayload;
      const result = await deliver(p.channel ?? "auto", p.recipientPhone, p.message);
      await logAudit("notification_sent", { mode: "direct", recipient: p.recipientPhone, result });
      return new Response(JSON.stringify(result), { headers: { "content-type": "application/json" } });
    }

    // Member welcome mode
    const memberId = body?.memberId as string | undefined;
    if (!memberId) {
      return new Response(JSON.stringify({ ok: false, error: "memberId required" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: member, error } = await admin
      .from("members")
      .select("id, first_name, member_code, phone_primary")
      .eq("id", memberId)
      .maybeSingle();
    if (error || !member) {
      return new Response(JSON.stringify({ ok: false, error: "member not found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }

    const phone = (member as { phone_primary?: string }).phone_primary;
    if (!phone) {
      return new Response(JSON.stringify({ ok: false, skipped: true, reason: "no_phone" }), {
        headers: { "content-type": "application/json" },
      });
    }

    const first = (member as { first_name?: string }).first_name ?? "there";
    const code = (member as { member_code?: string }).member_code ?? "";
    const loginLink = appUrl ? `${appUrl.replace(/\/$/, "")}/auth` : "the church portal";
    const message =
      `Welcome, ${first}! 🙏\n` +
      `Your member ID is ${code}.\n` +
      `We're glad you're part of our family.\n` +
      `Log in: ${loginLink}`;

    const result = await deliver("auto", phone, message);
    await logAudit("welcome_notification_sent", { memberId, phone, result });

    return new Response(JSON.stringify({ ok: true, memberId, result }), {
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
});
