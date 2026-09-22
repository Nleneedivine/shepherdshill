import { createFileRoute } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Clock,
  History,
  MapPin,
  Phone,
  RefreshCw,
  UserPlus,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button, Input } from "@/components/ds";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

interface HistoryEvent {
  event_type: string;
  event_at: string;
  outcome: string | null;
  status: string | null;
  notes: string | null;
  next_follow_up_date: string | null;
  old_stage: string | null;
  new_stage: string | null;
  called_by: string | null;
}

async function fetchQueue(): Promise<QueueRow[]> {
  const { data, error } = await supabase.rpc("get_follow_up_queue");
  if (error) throw error;
  return (data ?? []) as QueueRow[];
}

async function fetchMemberHistory(memberId: string): Promise<HistoryEvent[]> {
  const { data, error } = await supabase.rpc("get_follow_up_member_history", {
    p_member_id: memberId,
  });
  if (error) throw error;
  return (data ?? []) as HistoryEvent[];
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

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

const selectTriggerClassName =
  "w-full mt-1 h-11 rounded-xl border border-white/15 bg-[#0D1117] px-3 text-sm text-white shadow-sm hover:bg-[#121821] focus:ring-2 focus:ring-white/20";

function FollowUpHub() {
  const { showToast } = useToastContext();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [contactFilter, setContactFilter] = useState<string>("all");
  const [activeMember, setActiveMember] = useState<QueueRow | null>(null);
  const [historyMember, setHistoryMember] = useState<QueueRow | null>(null);
  const [showAddFirstTimer, setShowAddFirstTimer] = useState(false);

  const { data: queue, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ["follow-up-queue"],
    queryFn: fetchQueue,
  });

  const filtered = (queue ?? []).filter((row) => {
    const query = search.trim().toLowerCase();
    const matchesSearch =
      !query ||
      `${row.first_name} ${row.last_name}`.toLowerCase().includes(query) ||
      row.phone_primary?.toLowerCase().includes(query);
    const matchesStage = stageFilter === "all" || row.membership_stage === stageFilter;
    const matchesContact =
      contactFilter === "all" ||
      (contactFilter === "never_called" && !row.last_call_date) ||
      (contactFilter === "missed" && row.no_answer_count > 0);
    return matchesSearch && matchesStage && matchesContact;
  });

  const stages = Array.from(
    new Set((queue ?? []).map((r) => r.membership_stage).filter((s): s is string => !!s)),
  );

  const total = queue?.length ?? 0;
  const neverCalled = (queue ?? []).filter((row) => !row.last_call_date).length;
  const missed = (queue ?? []).filter((row) => row.no_answer_count > 0).length;
  const stageCounts = stages
    .map((stage) => ({
      stage,
      count: (queue ?? []).filter((row) => row.membership_stage === stage).length,
    }))
    .sort((a, b) => b.count - a.count);

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
            {error instanceof Error && error.message.toLowerCase().includes("not authorized")
              ? "This page is only available to the Evangelism and Follow-up team and church admins."
              : "Something went wrong loading the follow-up queue."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-6 pb-24" style={{ backgroundColor: "#080c16" }}>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Follow-Up Hub</h1>
            <p className="text-sm text-slate-400 mt-1">
              Keep every first timer and member connection visible and actionable.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => void refetch()}
              disabled={isFetching}
              aria-label="Refresh follow-up queue"
            >
              <RefreshCw size={16} className={isFetching ? "animate-spin" : ""} />
            </Button>
            <Button onClick={() => setShowAddFirstTimer(true)}>
              <UserPlus size={16} className="mr-2" />
              Add First Timer
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-5">
          <SummaryCard icon={<BarChart3 size={16} />} label="In queue" value={total} />
          <SummaryCard icon={<Clock size={16} />} label="Never called" value={neverCalled} />
          <SummaryCard icon={<AlertCircle size={16} />} label="Missed calls" value={missed} />
        </div>

        {stageCounts.length > 0 && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2">
              <BarChart3 size={15} className="text-slate-400" />
              <h2 className="text-sm font-semibold text-white">Queue by stage</h2>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {stageCounts.map(({ stage, count }) => (
                <button
                  key={stage}
                  onClick={() => setStageFilter(stage)}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10"
                >
                  {stageLabel(stage)} <span className="text-white font-semibold">{count}</span>
                </button>
              ))}
              {(stageFilter !== "all" || contactFilter !== "all" || search) && (
                <button
                  onClick={() => {
                    setStageFilter("all");
                    setContactFilter("all");
                    setSearch("");
                  }}
                  className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                >
                  Clear filter
                </button>
              )}
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-col sm:flex-row gap-2">
          <Input
            type="text"
            placeholder="Search name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
          />
          <Select value={contactFilter} onValueChange={setContactFilter}>
            <SelectTrigger className={selectTriggerClassName}>
              <SelectValue placeholder="All contact states" />
            </SelectTrigger>
            <SelectContent className="border-white/15 bg-[#0D1117] text-white shadow-xl">
              <SelectItem value="all" className="text-white focus:bg-white/10 focus:text-white">All contact states</SelectItem>
              <SelectItem value="never_called" className="text-white focus:bg-white/10 focus:text-white">Never called</SelectItem>
              <SelectItem value="missed" className="text-white focus:bg-white/10 focus:text-white">Has missed calls</SelectItem>
            </SelectContent>
          </Select>
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className={selectTriggerClassName}>
              <SelectValue placeholder="All stages" />
            </SelectTrigger>
            <SelectContent className="border-white/15 bg-[#0D1117] text-white shadow-xl">
              <SelectItem value="all" className="text-white focus:bg-white/10 focus:text-white">
                All stages
              </SelectItem>
              {stages.map((s) => (
                <SelectItem key={s} value={s} className="text-white focus:bg-white/10 focus:text-white">
                  {stageLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-5 space-y-3">
          {filtered.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] py-12 text-center">
              <CheckCircle2 className="mx-auto text-emerald-400" size={24} />
              <p className="text-white font-medium mt-3">No one matches this filter</p>
              <p className="text-xs text-slate-500 mt-1">Try another search or clear the filters.</p>
            </div>
          )}

          {filtered.map((row) => {
            const lastStageDays = daysAgo(row.last_stage_change);
            const lastCallDays = daysAgo(row.last_call_date);

            return (
              <div
                key={row.member_id}
                className="w-full text-left bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/[0.07] transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    onClick={() => setActiveMember(row)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="font-semibold text-white truncate">
                      {row.first_name} {row.last_name}
                    </div>
                    <div className="text-xs text-violet-400 mt-0.5">{stageLabel(row.membership_stage)}</div>
                  </button>
                  <div className="flex items-center gap-2">
                    {row.no_answer_count > 0 && (
                      <span className="text-xs bg-rose-500/20 text-rose-300 px-2 py-1 rounded-full whitespace-nowrap">
                        {row.no_answer_count} missed
                      </span>
                    )}
                    <button
                      onClick={() => setHistoryMember(row)}
                      aria-label={`View history for ${row.first_name} ${row.last_name}`}
                      className="h-9 w-9 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10"
                    >
                      <History size={16} />
                    </button>
                  </div>
                </div>

                {row.phone_primary && (
                  <a
                    href={`tel:${row.phone_primary}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1.5 text-sm text-slate-300 mt-2 hover:text-white"
                  >
                    <Phone size={13} /> {row.phone_primary}
                  </a>
                )}
                {row.address && (
                  <div className="flex items-start gap-1.5 text-xs text-slate-400 mt-1">
                    <MapPin size={13} className="mt-0.5 shrink-0" /> {row.address}
                  </div>
                )}
                <div className="flex items-center justify-between gap-3 mt-3">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Clock size={12} />
                    {lastCallDays !== null
                      ? `Last called ${lastCallDays}d ago`
                      : lastStageDays !== null
                      ? `Stage since ${lastStageDays}d ago — never called`
                      : "No activity yet"}
                  </div>
                  <button
                    onClick={() => setActiveMember(row)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-300 hover:text-white"
                  >
                    Log call <ChevronRight size={13} />
                  </button>
                </div>
              </div>
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
          onHistory={() => {
            setHistoryMember(activeMember);
            setActiveMember(null);
          }}
          onSaved={() => {
            setActiveMember(null);
            void queryClient.invalidateQueries({ queryKey: ["follow-up-queue"] });
            showToast("Call logged", "success");
          }}
        />
      )}

      {historyMember && (
        <MemberHistoryModal
          member={historyMember}
          onClose={() => setHistoryMember(null)}
        />
      )}
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:p-4">
      <div className="flex items-center gap-2 text-slate-400">{icon}<span className="text-xs">{label}</span></div>
      <div className="text-xl sm:text-2xl font-bold text-white mt-2">{value}</div>
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
  onHistory,
  onSaved,
}: {
  member: QueueRow;
  onClose: () => void;
  onHistory: () => void;
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
          <div>
            <h2 className="text-lg font-bold text-white">
              Log call — {member.first_name} {member.last_name}
            </h2>
            <p className="text-xs text-slate-500 mt-1">{stageLabel(member.membership_stage)}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-400">Outcome</label>
            <Select value={outcome} onValueChange={setOutcome}>
              <SelectTrigger className={selectTriggerClassName}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/15 bg-[#0D1117] text-white shadow-xl">
                <SelectItem value="reached" className="text-white focus:bg-white/10 focus:text-white">Reached</SelectItem>
                <SelectItem value="no_answer" className="text-white focus:bg-white/10 focus:text-white">No answer</SelectItem>
                <SelectItem value="voicemail" className="text-white focus:bg-white/10 focus:text-white">Left voicemail</SelectItem>
                <SelectItem value="wrong_number" className="text-white focus:bg-white/10 focus:text-white">Wrong number</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-400">Status</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className={selectTriggerClassName}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/15 bg-[#0D1117] text-white shadow-xl">
                <SelectItem value="staying" className="text-white focus:bg-white/10 focus:text-white">Staying</SelectItem>
                <SelectItem value="needs_another_call" className="text-white focus:bg-white/10 focus:text-white">Needs another call</SelectItem>
                <SelectItem value="not_interested" className="text-white focus:bg-white/10 focus:text-white">Not interested</SelectItem>
                <SelectItem value="moved_away" className="text-white focus:bg-white/10 focus:text-white">Moved away</SelectItem>
                <SelectItem value="prayer_request_raised" className="text-white focus:bg-white/10 focus:text-white">Prayer request raised</SelectItem>
              </SelectContent>
            </Select>
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

          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={onHistory}>
              <History size={15} className="mr-2" /> View history
            </Button>
            <Button className="flex-1" loading={saving} onClick={handleSave}>
              Save call
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MemberHistoryModal({
  member,
  onClose,
}: {
  member: QueueRow;
  onClose: () => void;
}) {
  const { data: events, isLoading, isError } = useQuery({
    queryKey: ["follow-up-member-history", member.member_id],
    queryFn: () => fetchMemberHistory(member.member_id),
  });

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-4 z-50">
      <div className="bg-[#0D1117] border border-white/10 rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider">Member history</p>
            <h2 className="text-lg font-bold text-white mt-1">
              {member.first_name} {member.last_name}
            </h2>
            <p className="text-xs text-violet-400 mt-1">{stageLabel(member.membership_stage)}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>

        {isLoading && <p className="text-sm text-slate-400 py-10 text-center">Loading history...</p>}
        {isError && (
          <div className="py-10 text-center">
            <AlertCircle className="mx-auto text-rose-400" size={22} />
            <p className="text-sm text-slate-300 mt-3">Could not load this member's history.</p>
          </div>
        )}

        {!isLoading && !isError && events?.length === 0 && (
          <div className="py-10 text-center">
            <History className="mx-auto text-slate-500" size={22} />
            <p className="text-sm text-slate-300 mt-3">No history yet.</p>
            <p className="text-xs text-slate-500 mt-1">The first call or stage change will appear here.</p>
          </div>
        )}

        {!isLoading && !isError && events && events.length > 0 && (
          <div className="mt-5 space-y-3">
            {events.map((event, index) => (
              <div key={`${event.event_type}-${event.event_at}-${index}`} className="relative pl-7">
                <div className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-slate-500 ring-4 ring-[#0D1117]" />
                {index < events.length - 1 && (
                  <div className="absolute left-[4px] top-4 bottom-[-14px] w-px bg-white/10" />
                )}

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-white">
                        {event.event_type === "call" ? "Follow-up call" : "Stage changed"}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">{formatDateTime(event.event_at)}</div>
                    </div>
                    {event.outcome && (
                      <span className="text-[11px] rounded-full border border-white/10 bg-white/5 px-2 py-1 text-slate-300">
                        {stageLabel(event.outcome)}
                      </span>
                    )}
                  </div>

                  {event.event_type === "call" ? (
                    <div className="mt-3 space-y-2">
                      {event.status && (
                        <div className="text-xs text-slate-400">
                          Status: <span className="text-slate-200">{stageLabel(event.status)}</span>
                        </div>
                      )}
                      {event.notes && (
                        <p className="text-sm leading-6 text-slate-300 whitespace-pre-wrap">{event.notes}</p>
                      )}
                      {event.next_follow_up_date && (
                        <div className="text-xs text-slate-400">
                          Next follow-up: <span className="text-slate-200">{formatDate(event.next_follow_up_date)}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-3 text-xs text-slate-300">
                      {stageLabel(event.old_stage)} <span className="text-slate-500">→</span>{" "}
                      <span className="text-white">{stageLabel(event.new_stage)}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5">
          <Button variant="secondary" className="w-full" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}
