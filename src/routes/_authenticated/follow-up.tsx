import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Phone, MapPin, Clock, X, UserPlus, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button, Input } from "@/components/ds";
import { useToastContext } from "@/components/ds/Toast";

export const Route = createFileRoute("/_authenticated/follow-up")({
  ssr: false,
  component: FollowUpHub,
});

interface QueueRow {
  member_id: string;
  first_name: string;
  last_name: string;
  phone_primary: string | null;
  address: string | null;
  membership_stage: string | null;
  cell_group_id: string | null;
  member_created_at: string;
  last_call_date: string | null;
  no_answer_count: number;
  last_stage_change: string | null;
}

async function fetchQueue(): Promise<QueueRow[]> {
  const { data, error } = await supabase.rpc("get_follow_up_queue");
  if (error) throw error;
  return (data ?? []) as QueueRow[];
}

function daysAgo(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function stageLabel(stage: string | null): string {
  if (!stage) return "Unknown";
  return stage
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function FollowUpHub() {
  const { showToast } = useToastContext();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [activeMember, setActiveMember] = useState<QueueRow | null>(null);
  const [showAddFirstTimer, setShowAddFirstTimer] = useState(false);

  const { data: queue, isLoading, isError, error } = useQuery({
    queryKey: ["follow-up-queue"],
    queryFn: fetchQueue,
  });

  const filtered = (queue ?? []).filter((row) => {
    const matchesSearch =
      !search ||
      `${row.first_name} ${row.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
      row.phone_primary?.includes(search);
    const matchesStage = stageFilter === "all" || row.membership_stage === stageFilter;
    return matchesSearch && matchesStage;
  });

  const stages = Array.from(
    new Set((queue ?? []).map((r) => r.membership_stage).filter((s): s is string => !!s))
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#080c16" }}>
        <p className="text-slate-400">Loading follow-up queue...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "#080c16" }}>
        <div className="text-center max-w-sm">
          <h1 className="text-xl font-bold text-white">Access restricted</h1>
          <p className="text-sm text-slate-400 mt-2">
            {error instanceof Error && error.message.includes("Not authorized")
              ? "This page is only available to the Evangelism and Follow-up team and church admins."
              : "Something went wrong loading the follow-up queue."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-6 pb-24" style={{ backgroundColor: "#080c16" }}>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-white">Follow-Up Queue</h1>
        <p className="text-sm text-slate-400 mt-1">{filtered.length} people to follow up with</p>

        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <Input
            type="text"
            placeholder="Search name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
          />
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
          >
            <option value="all">All stages</option>
            {stages.map((s) => (
              <option key={s} value={s}>
                {stageLabel(s)}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-5 space-y-3">
          {filtered.length === 0 && (
            <p className="text-center text-slate-500 py-10">No one matches this filter.</p>
          )}

          {filtered.map((row) => {
            const lastStageDays = daysAgo(row.last_stage_change);
            const lastCallDays = daysAgo(row.last_call_date);

            return (
              <button
                key={row.member_id}
                onClick={() => setActiveMember(row)}
                className="w-full text-left bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/10 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-white">
                      {row.first_name} {row.last_name}
                    </div>
                    <div className="text-xs text-violet-400 mt-0.5">{stageLabel(row.membership_stage)}</div>
                  </div>
                  {row.no_answer_count > 0 && (
                    <span className="text-xs bg-rose-500/20 text-rose-300 px-2 py-1 rounded-full whitespace-nowrap">
                      {row.no_answer_count} missed
                    </span>
                  )}
                </div>

                {row.phone_primary && (
                  <div className="flex items-center gap-1.5 text-sm text-slate-300 mt-2">
                    <Phone size={13} /> {row.phone_primary}
                  </div>
                )}
                {row.address && (
                  <div className="flex items-start gap-1.5 text-xs text-slate-400 mt-1">
                    <MapPin size={13} className="mt-0.5 shrink-0" /> {row.address}
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-2">
                  <Clock size={12} />
                  {lastCallDays !== null
                    ? `Last called ${lastCallDays}d ago`
                    : lastStageDays !== null
                    ? `Stage since ${lastStageDays}d ago — never called`
                    : "No activity yet"}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {showAddFirstTimer && (
        <AddFirstTimerModal
          onClose={() => setShowAddFirstTimer(false)}
          onSaved={() => {
            setShowAddFirstTimer(false);
            void queryClient.invalidateQueries({ queryKey: ["follow-up-queue"] });
            showToast("First timer added successfully", "success");
          }}
        />
      )}

      {activeMember && (
        <CallLogModal
          member={activeMember}
          onClose={() => setActiveMember(null)}
          onSaved={() => {
            setActiveMember(null);
            void queryClient.invalidateQueries({ queryKey: ["follow-up-queue"] });
            showToast("Call logged", "success");
          }}
        />
      )}
    </div>
  );
}

function AddFirstTimerModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const { showToast } = useToastContext();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      showToast("First name and last name are required", "error");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.rpc("add_first_timer", {
        p_first_name: firstName.trim(),
        p_last_name: lastName.trim(),
        p_phone: phone.trim() || null,
        p_address: address.trim() || null,
      });
      if (error) throw error;
      onSaved();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not add first timer", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-[#0D1117] border border-white/10 rounded-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Add First Timer</h2>
            <p className="text-xs text-slate-500 mt-1">The person will be active immediately.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>

        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoFocus />
            <Input label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
          <Input label="Phone (optional)" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input label="Address (optional)" value={address} onChange={(e) => setAddress(e.target.value)} />
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1" loading={saving} onClick={handleSave}>Add First Timer</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CallLogModal({
  member,
  onClose,
  onSaved,
}: {
  member: QueueRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { showToast } = useToastContext();
  const [outcome, setOutcome] = useState("reached");
  const [status, setStatus] = useState("staying");
  const [notes, setNotes] = useState("");
  const [nextFollowUp, setNextFollowUp] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const calledBy = userData.user?.id;
      if (!calledBy) throw new Error("You must be signed in to log a call");
      const { error } = await supabase.from("follow_up_calls").insert({
        member_id: member.member_id,
        called_by: calledBy,
        outcome,
        status,
        notes: notes || null,
        next_follow_up_date: nextFollowUp || null,
      });
      if (error) throw error;
      onSaved();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not save call log", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-[#0D1117] border border-white/10 rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">
            Log call — {member.first_name} {member.last_name}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-400">Outcome</label>
            <select
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              className="w-full mt-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
            >
              <option value="reached">Reached</option>
              <option value="no_answer">No answer</option>
              <option value="voicemail">Left voicemail</option>
              <option value="wrong_number">Wrong number</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-400">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full mt-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
            >
              <option value="staying">Staying</option>
              <option value="needs_another_call">Needs another call</option>
              <option value="not_interested">Not interested</option>
              <option value="moved_away">Moved away</option>
              <option value="prayer_request_raised">Prayer request raised</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-400">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full mt-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white resize-none"
              placeholder="Anything worth remembering for next time..."
            />
          </div>

          <Input
            label="Next follow-up date (optional)"
            type="date"
            value={nextFollowUp}
            onChange={(e) => setNextFollowUp(e.target.value)}
          />

          <Button className="w-full" loading={saving} onClick={handleSave}>
            Save call log
          </Button>
        </div>
      </div>
    </div>
  );
}