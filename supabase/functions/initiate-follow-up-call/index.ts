import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

// ---- Provider-neutral voice adapter (inlined; shared folders are not deployable here) ----

type VoiceBridgeRequest = {
  operatorPhone: string;
  memberPhone: string;
  callerId: string;
  clientRequestId: string;
};

type VoiceBridgeResult = {
  providerSessionId?: string | null;
  raw: unknown;
};

type VoiceProvider = {
  name: string;
  startHumanBridgeCall(input: VoiceBridgeRequest): Promise<VoiceBridgeResult>;
};

function env(name: string) {
  return Deno.env.get(name)?.trim() ?? "";
}

function getVoiceProvider(provider: string): VoiceProvider {
  if (provider === "infobip") {
    return {
      name: "infobip",
      async startHumanBridgeCall(input) {
        const apiKey = env("INFOBIP_API_KEY");
        const baseUrl = env("INFOBIP_API_BASE_URL") || "https://api.infobip.com";
        // Infobip's Click-to-Call endpoint. Ignore the old, non-existent path if still configured.
        const configuredPath = env("INFOBIP_CLICK_TO_CALL_PATH");
        const path = configuredPath && !configuredPath.includes("/voice/3/click-to-call")
          ? configuredPath
          : "/voice/ctc/1/send";
        const callbackUrl = env("INFOBIP_CLICK_TO_CALL_NOTIFY_URL");

        if (!apiKey) throw new Error("Infobip API key is not configured");
        if (!callbackUrl) throw new Error("Infobip click-to-call callback URL is not configured");

        const body = {
          bulkId: input.clientRequestId,
          messages: [{
            from: input.callerId.replace(/^\+/, ""),
            fromB: input.callerId.replace(/^\+/, ""),
            destinationA: input.operatorPhone.replace(/^\+/, ""),
            destinationB: input.memberPhone.replace(/^\+/, ""),
            messageId: input.clientRequestId,
            anonymization: false,
            notifyUrl: callbackUrl,
            notifyContentType: "application/json",
            maxDuration: 300,
          }],
        };

        const response = await fetch(new URL(path, baseUrl).toString(), {
          method: "POST",
          headers: {
            Authorization: "App " + apiKey,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(body),
        });

        const text = await response.text();
        let raw: unknown = text;
        try { raw = JSON.parse(text); } catch { /* keep raw text */ }

        if (!response.ok) {
          throw new Error("Infobip rejected the call (" + response.status + "): " + text.slice(0, 500));
        }

        const result = raw as Record<string, unknown>;
        const messages = Array.isArray(result?.messages) ? result.messages : [];
        const first = (messages[0] ?? {}) as Record<string, unknown>;
        const providerError = String(first?.status?.description ?? first?.status?.name ?? first?.status ?? result?.errorMessage ?? "");

        return {
          providerSessionId: String(first?.messageId ?? first?.callId ?? first?.call_id ?? result?.bulkId ?? input.clientRequestId) || null,
          raw: providerError ? { providerError, response: raw } : raw,
        };
      },
    };
  }
  if (provider === "notify_africa") {
    return {
      name: "notify_africa",
      async startHumanBridgeCall(input) {
        const apiKey = env("NOTIFY_AFRICA_VOICE_API_KEY");
        const baseUrl = env("NOTIFY_AFRICA_VOICE_API_BASE_URL") || "https://api.notify.africa/api/v1";
        const path = env("NOTIFY_AFRICA_VOICE_CALL_PATH") || "/voice-api/calls";
        const bodyTemplate = env("NOTIFY_AFRICA_VOICE_CALL_BODY_TEMPLATE");

        if (!apiKey) throw new Error("Notify Africa Voice API key is not configured");
        if (!bodyTemplate) {
          throw new Error("Notify Africa human-to-human bridge adapter is not configured yet");
        }

        const body = JSON.parse(bodyTemplate
          .replaceAll("{{operator_phone}}", input.operatorPhone)
          .replaceAll("{{member_phone}}", input.memberPhone)
          .replaceAll("{{caller_id}}", input.callerId)
          .replaceAll("{{client_request_id}}", input.clientRequestId));

        const response = await fetch(new URL(path, baseUrl).toString(), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(body),
        });

        const text = await response.text();
        let raw: unknown = text;
        try { raw = JSON.parse(text); } catch { /* keep raw text */ }

        if (!response.ok) {
          throw new Error(`Notify Africa rejected the call (${response.status}): ${text.slice(0, 500)}`);
        }

        const result = raw as Record<string, unknown>;
        return {
          providerSessionId: String(
            result?.callSessionId ??
            result?.call_session_id ??
            result?.sessionId ??
            result?.session_id ??
            ""
          ) || null,
          raw,
        };
      },
    };
  }

  throw new Error(`Unsupported voice provider: ${provider}`);
}

// ---- Follow-Up call initiation ----

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
    .select("calling_enabled,voice_number,provider,voice_provider")
    .eq("id", true)
    .maybeSingle();
  if (settingsError) return json({ error: settingsError.message }, 500);
  if (!settings?.calling_enabled) return json({ error: "System calling is currently turned off by an administrator" }, 400);
  const voiceProvider = settings.voice_provider ?? settings.provider;
  if (!voiceProvider) return json({ error: "No voice provider has been configured" }, 503);
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
      provider: voiceProvider,
      status: "queued",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (insertError) return json({ error: insertError.message }, 500);

  try {
    const provider = getVoiceProvider(voiceProvider);
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
