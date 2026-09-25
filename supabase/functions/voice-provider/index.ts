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

export function getVoiceProvider(provider: string): VoiceProvider {
  if (provider === "infobip") {
    return {
      name: "infobip",
      async startHumanBridgeCall(input) {
        const apiKey = env("INFOBIP_API_KEY");
        const baseUrl = env("INFOBIP_API_BASE_URL") || "https://4knxlp.api.infobip.com";
        const path = env("INFOBIP_CLICK_TO_CALL_PATH") || "/voice/3/click-to-call";
        const callbackUrl = env("INFOBIP_CLICK_TO_CALL_NOTIFY_URL");

        if (!apiKey) throw new Error("Infobip API key is not configured");
        if (!callbackUrl) throw new Error("Infobip click-to-call callback URL is not configured");

        const operator = input.operatorPhone.replace(/^\+/, "");
        const member = input.memberPhone.replace(/^\+/, "");
        const callerId = input.callerId.replace(/^\+/, "");

        if (!/^\d{8,15}$/.test(operator) || !/^\d{8,15}$/.test(member) || !/^\d{8,15}$/.test(callerId)) {
          throw new Error("Infobip requires phone numbers in international numeric format");
        }

        const body = {
          bulkId: input.clientRequestId,
          messages: [{
            from: callerId,
            fromB: callerId,
            destinationA: operator,
            destinationB: member,
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

        const responseText = await response.text();
        let raw: unknown = responseText;
        try { raw = JSON.parse(responseText); } catch {}

        if (!response.ok) {
          throw new Error("Infobip rejected the call (" + response.status + "): " + responseText.slice(0, 800));
        }

        const result = raw as Record<string, any>;
        const messages = Array.isArray(result?.messages) ? result.messages : [];
        const first = (messages[0] ?? {}) as Record<string, any>;
        const status = first?.status;
        const statusName = String(status?.name ?? status ?? "");
        const statusDescription = String(status?.description ?? result?.errorMessage ?? "");

        if (statusName && !/^(accepted|pending|queued|sent|delivered|200)$/i.test(statusName)) {
          throw new Error("Infobip did not accept the call: " + (statusDescription || statusName));
        }

        return {
          providerSessionId: String(
            first?.messageId ??
            first?.callId ??
            first?.call_id ??
            result?.bulkId ??
            input.clientRequestId
          ) || null,
          raw,
        };
      },
    };
  }

  throw new Error(`Unsupported voice provider: ${provider}`);
}
