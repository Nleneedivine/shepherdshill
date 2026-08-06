import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, Check, X, FileDown } from "lucide-react";
import { AdminShell } from "@/features/admin/AdminShell";
import { Card, Button, Badge, Textarea, Modal, Spinner, EmptyState, StatCard } from "@/components/ds";
import { supabase } from "@/integrations/supabase/client";
import { useToastContext } from "@/components/ds/Toast";
import { requireRoles, ADMIN_ROLES } from "@/lib/routeGuards";
import { useAuth } from "@/hooks/useAuth";
import { satisfiesAny } from "@/lib/roles";
import { TERMS } from "@/constants/terminology";

export const Route = createFileRoute("/_authenticated/admin/transfers")({
  ssr: false,
  beforeLoad: () => requireRoles(ADMIN_ROLES),
  component: TransfersPage,
});

interface TransferRow {
  id: string;
  member_id: string;
  transfer_type: string;
  reason: string | null;
  status: string;
  requested_at: string;
  decided_at: string | null;
  decision_notes: string | null;
  from_branch_id: string | null;
  to_branch_id: string | null;
  from_cell_group_id: string | null;
  to_cell_group_id: string | null;
}

interface Lookup { [id: string]: string }

function TransfersPage() {
  const { showToast } = useToastContext();
  const { user } = useAuth();
  const canDecide = satisfiesAny(user?.roles ?? [], ["senior_pastor"]);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<TransferRow[]>([]);
  const [memberNames, setMemberNames] = useState<Lookup>({});
  const [branches, setBranches] = useState<Lookup>({});
  const [groups, setGroups] = useState<Lookup>({});
  const [filter, setFilter] = useState<"pending" | "all">("pending");

  const [decide, setDecide] = useState<{ row: TransferRow; approve: boolean } | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [t, m, b, g] = await Promise.all([
      supabase.from("member_transfers").select("*").order("requested_at", { ascending: false }),
      supabase.from("members").select("id, first_name, last_name, member_code"),
      supabase.from("branches").select("id, name"),
      supabase.from("cell_groups").select("id, name"),
    ]);
    setRows((t.data ?? []) as TransferRow[]);
    const mn: Lookup = {};
    ((m.data ?? []) as { id: string; first_name: string; last_name: string; member_code: string | null }[]).forEach((x) => {
      mn[x.id] = `${x.first_name} ${x.last_name}${x.member_code ? ` (${x.member_code})` : ""}`;
    });
    setMemberNames(mn);
    const bn: Lookup = {};
    ((b.data ?? []) as { id: string; name: string }[]).forEach((x) => { bn[x.id] = x.name; });
    setBranches(bn);
    const gn: Lookup = {};
    ((g.data ?? []) as { id: string; name: string }[]).forEach((x) => { gn[x.id] = x.name; });
    setGroups(gn);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(
    () => (filter === "pending" ? rows.filter((r) => r.status === "pending") : rows),
    [rows, filter],
  );

  const submitDecision = async () => {
    if (!decide) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("decide_member_transfer" as never, {
        p_transfer_id: decide.row.id,
        p_approve: decide.approve,
        p_notes: notes.trim() || null,
      } as never);
      if (error) throw error;
      showToast(decide.approve ? "Transfer approved" : "Transfer declined", "success");
      setDecide(null);
      setNotes("");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not record the decision", "error");
    } finally {
      setBusy(false);
    }
  };

  const pending = rows.filter((r) => r.status === "pending").length;
  const approved = rows.filter((r) => r.status === "approved").length;
  const declined = rows.filter((r) => r.status === "declined").length;

  return (
    <AdminShell
      title="Member Transfers"
      crumb="Transfers"
      description={`Review requests to move members between branches and ${TERMS.CELL_GROUPS}.`}
    >
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Pending" value={pending} glowColor="amber" icon={<ArrowLeftRight size={18} />} />
        <StatCard label="Approved" value={approved} glowColor="green" />
        <StatCard label="Declined" value={declined} />
      </div>

      <div className="mb-4 flex gap-2">
        {(["pending", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-xl border px-3 py-1.5 text-sm capitalize transition-colors ${
              filter === f
                ? "border-violet-500/40 bg-violet-500/15 text-violet-200"
                : "border-white/10 bg-white/5 text-slate-400 hover:text-white"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {!canDecide && (
        <p className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          Only a senior pastor or above can approve or decline transfers. You have read-only access.
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : visible.length === 0 ? (
        <EmptyState icon={<ArrowLeftRight size={40} />} title="No transfers" description="Transfer requests started from a member profile appear here." />
      ) : (
        <div className="space-y-3">
          {visible.map((r) => (
            <Card key={r.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-semibold">{memberNames[r.member_id] ?? "Unknown member"}</h3>
                    <Badge variant={r.status === "pending" ? "warning" : r.status === "approved" ? "success" : "danger"}>
                      {r.status}
                    </Badge>
                    <Badge variant="neutral">{r.transfer_type}</Badge>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {(r.from_branch_id ? branches[r.from_branch_id] : null) ?? "—"}
                    {" → "}
                    {(r.to_branch_id ? branches[r.to_branch_id] : null) ?? "External / unspecified"}
                  </p>
                  {(r.from_cell_group_id || r.to_cell_group_id) && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      {TERMS.CELL_GROUP}: {(r.from_cell_group_id ? groups[r.from_cell_group_id] : null) ?? "—"} → {(r.to_cell_group_id ? groups[r.to_cell_group_id] : null) ?? "—"}
                    </p>
                  )}
                  {r.reason && <p className="text-sm text-slate-300 mt-2">{r.reason}</p>}
                  {r.decision_notes && <p className="text-xs text-slate-500 mt-1">Decision note: {r.decision_notes}</p>}
                  <p className="text-xs text-slate-600 mt-2">
                    Requested {new Date(r.requested_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  {r.status === "pending" && canDecide && (
                    <>
                      <Button size="sm" onClick={() => { setDecide({ row: r, approve: true }); setNotes(""); }}>
                        <Check size={14} /> Approve
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setDecide({ row: r, approve: false }); setNotes(""); }}>
                        <X size={14} /> Decline
                      </Button>
                    </>
                  )}
                  <Button size="sm" variant="ghost" disabled title="Transfer letter PDF coming soon">
                    <FileDown size={14} /> Letter (soon)
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={!!decide}
        onClose={() => setDecide(null)}
        title={decide?.approve ? "Approve transfer" : "Decline transfer"}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDecide(null)}>Cancel</Button>
            <Button onClick={submitDecision} loading={busy}>{decide?.approve ? "Approve" : "Decline"}</Button>
          </div>
        }
      >
        <p className="text-sm text-slate-400 mb-3">
          {decide?.approve
            ? "Approving moves the member to the destination branch and centre."
            : "Declining keeps the member where they are."}
        </p>
        <Textarea label="Decision notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </Modal>
    </AdminShell>
  );
}
