import { useState } from "react";
import { MessageSquare, Phone, Send, Smartphone } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button, Input } from "@/components/ds";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToastContext } from "@/components/ds/Toast";

type Communication = {
  id: string;
  channel: "whatsapp" | "sms";
  message_type: string;
  body: string;
  status: string;
  automated: boolean;
  scheduled_for: string;
  sent_at: string | null;
  provider_message_id: string | null;
  error_message: string | null;
  created_by: string | null;
  created_at: string;
};

const triggerClass =
  "w-full h-10 rounded-xl border border-white/15 bg-[#0D1117] px-3 text-sm text-white";

function formatMessageDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function FollowUpCommunicationPanel({
  memberId,
  phone,
}: {
  memberId: string;
  phone: string | null;
}) {
  const { showToast } = useToastContext();
  const queryClient = useQueryClient();
  const [channel, setChannel] = useState<"whatsapp" | "sms">("whatsapp");
  const [messageType, setMessageType] = useState("follow_up");
  const [body, setBody] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  const { data: communications, isLoading } = useQuery({
    queryKey: ["follow-up-communications", memberId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_follow_up_communications", {
        p_member_id: memberId,
      });
      if (error) throw error;
      return (data ?? []) as Communication[];
    },
  });

  const queueMessage = async () => {
    if (!body.trim()) {
      showToast("Write a message first", "error");
      return;
    }

    if (!phone) {
      showToast("This member does not have a phone number", "error");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.rpc("queue_follow_up_message", {
        p_member_id: memberId,
        p_channel: channel,
        p_body: body.trim(),
        p_message_type: messageType,
        p_scheduled_for: scheduledFor ? new Date(scheduledFor).toISOString() : new Date().toISOString(),
        p_automated: false,
      });
      if (error) throw error;

      setBody("");
      setScheduledFor("");
      await queryClient.invalidateQueries({
        queryKey: ["follow-up-communications", memberId],
      });
      showToast("Message queued for delivery", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Could not queue message",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <MessageSquare size={15} className="text-slate-300" />
            <div className="text-xs uppercase tracking-wider text-slate-500">
              WhatsApp / SMS
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Queue a message now or for later. Send now uses the configured provider. Queue keeps the message in Follow-Up history for later delivery.
          </p>
        </div>
        {phone && (
          <a
            href={channel === "whatsapp" ? `https://wa.me/${phone.replace(/\D/g, "")}` : `tel:${phone}`}
            target={channel === "whatsapp" ? "_blank" : undefined}
            rel={channel === "whatsapp" ? "noreferrer" : undefined}
            className="text-slate-400 hover:text-white"
            aria-label={channel === "whatsapp" ? "Open WhatsApp" : "Call member"}
          >
            {channel === "whatsapp" ? <MessageSquare size={16} /> : <Phone size={16} />}
          </a>
        )}
      </div>

      <div className="mt-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Select value={channel} onValueChange={(value) => setChannel(value as "whatsapp" | "sms")}>
            <SelectTrigger className={triggerClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-white/15 bg-[#0D1117] text-white shadow-xl">
              <SelectItem value="whatsapp" className="text-white focus:bg-white/10 focus:text-white">
                WhatsApp
              </SelectItem>
              <SelectItem value="sms" className="text-white focus:bg-white/10 focus:text-white">
                SMS
              </SelectItem>
            </SelectContent>
          </Select>

          <Select value={messageType} onValueChange={setMessageType}>
            <SelectTrigger className={triggerClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-white/15 bg-[#0D1117] text-white shadow-xl">
              <SelectItem value="follow_up" className="text-white focus:bg-white/10 focus:text-white">
                Follow-up
              </SelectItem>
              <SelectItem value="welcome" className="text-white focus:bg-white/10 focus:text-white">
                Welcome
              </SelectItem>
              <SelectItem value="reminder" className="text-white focus:bg-white/10 focus:text-white">
                Reminder
              </SelectItem>
              <SelectItem value="stage_update" className="text-white focus:bg-white/10 focus:text-white">
                Stage update
              </SelectItem>
              <SelectItem value="manual" className="text-white focus:bg-white/10 focus:text-white">
                Manual
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={4}
          placeholder="Write a short, personal message..."
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-600 resize-none focus:outline-none focus:ring-2 focus:ring-white/20"
        />

        <Input
          label="Schedule (optional)"
          type="datetime-local"
          value={scheduledFor}
          onChange={(event) => setScheduledFor(event.target.value)}
        />

        <Button className="w-full" loading={saving} disabled={!phone} onClick={queueMessage}>
          <Send size={15} className="mr-2" />
          Queue message
        </Button>
      </div>

      <div className="mt-5 border-t border-white/10 pt-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500">
          <Smartphone size={14} />
          Communication history
        </div>

        {isLoading ? (
          <p className="text-xs text-slate-500 py-5 text-center">Loading messages...</p>
        ) : communications?.length ? (
          <div className="mt-3 space-y-2">
            {communications.map((item) => (
              <div key={item.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <span className="capitalize">{item.channel}</span>
                    <span className="text-slate-600">·</span>
                    <span className="capitalize">{item.status}</span>
                    {item.automated && (
                      <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-violet-300">
                        Automated
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-600">
                    {formatMessageDate(item.created_at)}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-5 text-slate-300 whitespace-pre-wrap">
                  {item.body}
                </p>
                {item.error_message && (
                  <p className="mt-2 text-xs text-rose-300">{item.error_message}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500 py-5 text-center">
            No WhatsApp or SMS activity yet.
          </p>
        )}
      </div>
    </div>
  );
}
