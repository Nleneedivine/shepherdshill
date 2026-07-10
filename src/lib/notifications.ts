// Client-safe notification helpers.
// Actual provider calls (WhatsApp / Africa's Talking) happen ONLY inside
// the send-welcome-notification edge function to keep tokens off the client.

import { supabase } from "@/integrations/supabase/client";

export type NotificationChannel = "whatsapp" | "sms" | "imessage" | "auto";

export interface NotificationPayload {
  recipientPhone: string;
  recipientName: string;
  message: string;
  channel: NotificationChannel;
}

export interface NotificationResult {
  ok: boolean;
  delivered_via?: NotificationChannel;
  skipped?: boolean;
  error?: string;
}

/** Fire-and-await notification via the edge function. */
export async function sendNotification(payload: NotificationPayload): Promise<NotificationResult> {
  try {
    const { data, error } = await supabase.functions.invoke("send-welcome-notification", {
      body: { payload },
    });
    if (error) return { ok: false, error: error.message };
    return (data as NotificationResult) ?? { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Notification failed" };
  }
}

// TODO(Sprint 2): expose per-member notification preferences UI
// (preferred_notification_channel + notification_opt_out live on profiles).
