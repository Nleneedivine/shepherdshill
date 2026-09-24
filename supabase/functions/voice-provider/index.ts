export type VoiceBridgeRequest = {
  operatorPhone: string;
  memberPhone: string;
  callerId: string;
  clientRequestId: string;
};

export type VoiceBridgeResult = {
  providerSessionId?: string | null;
  raw: unknown;
};

export type VoiceProvider = {
  name: string;
  startHumanBridgeCall(input: VoiceBridgeRequest): Promise<VoiceBridgeResult>;
};

function env(name: string) {
  return Deno.env.get(name)?.trim() ?? "";
}

/**
 * Provider-neutral adapter.
 *
 * We deliberately keep the telecom adapter separate from Shepherd's Hill's
 * call/session logic. That lets us replace the carrier without changing the
 * Follow-Up application.
 *
 * NOTIFY_AFRICA_* is reserved for the production Notify Africa adapter once
 * the exact human-to-human bridge contract is enabled on the account.
 */
export function getVoiceProvider(provider: string): VoiceProvider {
  if (provider === "infobip") {
    return {
      name: "infobip",
      async startHumanBridgeCall(input) {
    const apiKey = env("INFOBIP_API_KEY");
    const baseUrl = env("INFOBIP_API_BASE_URL") || "https://api.infobip.com";
    const path = env("INFOBIP_CLICK_TO_CALL_PATH") || "/voice/3/click-to-call";
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
