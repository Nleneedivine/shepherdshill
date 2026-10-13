// Sends a welcome message to a newly-approved member.
// Channel chain: WhatsApp -> SMS (Africa's Talking). SMS reaches iPhones as iMessage
// automatically when the recipient's number is registered with Apple.
//
// Provider tokens are read from env; when missing, that channel is skipped cleanly
// so the function stays deployable before secrets are configured.
//
// SECURITY: this function requires a valid authenticated session belonging to an
// admin/super_admin/pastoral_team user. It is never callable anonymously, since it
// can trigger paid WhatsApp/SMS sends to arbitrary phone numbers.
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
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

// Roles allowed to trigger notifications from this function.
const ALLOWED_ROLES = ["admin", "super_admin", "pastoral_team"] as const;

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

/**
 * Verifies the caller's JWT and confirms they hold one of ALLOWED_ROLES.
 * Returns the authenticated user id on success, or null if unauthorized.
 */
async function authorizeCaller(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const admin = createClient(supabaseUrl, serviceRoleKey);

  // Validate the JWT and get the underlying user.
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData?.user) return null;
  const userId = userData.user.id;

  // Confirm the user holds an allowed role.
  // Adjust the RPC/table name below if your project's role-check differs from `has_role`.
  for (const role of ALLOWED_ROLES) {
    const { data: hasRole, error: roleError } = await admin.rpc("has_role", {
      _user_id: userId,
      _role: role,
    });
    if (!roleError && hasRole === true) return userId;
  }
  return null;
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

async function readJsonLimited(req: Request, maxBytes: number): Promise<Record<string, unknown>> {
  const reader = req.body?.getReader();
  if (!reader) return {};
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("request_too_large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
  return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : {};
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
      status: 405,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }
  const declaredLength = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > 16 * 1024) {
    return new Response(JSON.stringify({ ok: false, error: "Request too large" }), {
      status: 413,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }

  try {
    // --- AUTH GATE: block every request that isn't from a signed-in admin/pastoral user ---
    const callerId = await authorizeCaller(req);
    if (!callerId) {
      return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }
    // --- end auth gate ---

    const body = await readJsonLimited(req, 16 * 1024).catch(() => ({}));

    // Direct-message mode
    if (body?.payload) {
      const p = body.payload as Partial<DirectPayload>;
      const phone = typeof p.recipientPhone === "string" ? p.recipientPhone.trim() : "";
      const message = typeof p.message === "string" ? p.message.trim() : "";
      const channel = p.channel ?? "auto";
      const recipientName = typeof p.recipientName === "string" ? p.recipientName.trim() : "";

      // Bound inputs before making paid provider requests or writing audit data.
      if (!/^\+?[1-9]\d{7,14}$/.test(phone)) {
        return new Response(JSON.stringify({ ok: false, error: "A valid international recipient phone is required" }), {
          status: 400, headers: { "content-type": "application/json", "cache-control": "no-store" },
        });
      }
      if (!message || message.length > 1600 || recipientName.length > 120 ||
          !["whatsapp", "sms", "imessage", "auto"].includes(channel)) {
        return new Response(JSON.stringify({ ok: false, error: "Invalid notification payload" }), {
          status: 400, headers: { "content-type": "application/json", "cache-control": "no-store" },
        });
      }
      const result = await deliver(channel, phone, message);
      await logAudit("notification_sent", { mode: "direct", recipient: phone, channel, result, sentBy: callerId });
      return new Response(JSON.stringify(result), {
        headers: { "content-type": "application/json", "cache-control": "no-store" },
      });
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
    await logAudit("welcome_notification_sent", { memberId, phone, result, sentBy: callerId });

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
