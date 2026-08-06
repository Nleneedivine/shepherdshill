import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GitBranch, ChevronRight, ExternalLink } from "lucide-react";
import { AdminShell } from "@/features/admin/AdminShell";
import { Card, Button, Badge, Modal, Select, Spinner, EmptyState } from "@/components/ds";
import { supabase } from "@/integrations/supabase/client";
import { useToastContext } from "@/components/ds/Toast";
import { requireRoles, ADMIN_ROLES } from "@/lib/routeGuards";
import { MEMBERSHIP_STAGES, stageLabel } from "@/constants/membershipStages";

export const Route = createFileRoute("/_authenticated/admin/membership-stages")({
  ssr: false,
  beforeLoad: () => requireRoles(ADMIN_ROLES),
  component: MembershipStagesPage,
});

interface MemberRow {
  id: string;
  first_name: string;
  last_name: string;
  member_code: string | null;
  membership_stage: string | null;
}

function MembershipStagesPage() {
  const { showToast } = useToastContext();
  const [rows, setRows] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [promote, setPromote] = useState<MemberRow | null>(null);
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("members")
      .select("id, first_name, last_name, member_code, membership_stage")
      .order("first_name");
    setRows((data ?? []) as MemberRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const byStage = useMemo(() => {
    const map = new Map<string, MemberRow[]>();
    for (const s of MEMBERSHIP_STAGES) map.set(s.key, []);
    map.set("__unset", []);
    for (const m of rows) {
      const key = m.membership_stage && map.has(m.membership_stage) ? m.membership_stage : "__unset";
      map.get(key)!.push(m);
    }
    return map;
  }, [rows]);

  const openPromote = (m: MemberRow) => {
    const idx = MEMBERSHIP_STAGES.findIndex((s) => s.key === m.membership_stage);
    setTarget(MEMBERSHIP_STAGES[Math.min(idx + 1, MEMBERSHIP_STAGES.length - 1)]?.key ?? MEMBERSHIP_STAGES[0].key);
    setPromote(m);
  };

  const savePromotion = async () => {
    if (!promote || !target) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("members").update({ membership_stage: target } as never).eq("id", promote.id);
      if (error) throw error;
      showToast(`Moved to ${stageLabel(target)}`, "success");
      setPromote(null);
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not update the stage", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminShell
      title="Membership Stages"
      crumb="Membership Stages"
      description="The 8-stage membership lifecycle. Move members along the pipeline as they grow."
    >
      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : rows.length === 0 ? (
        <EmptyState icon={<GitBranch size={40} />} title="No members yet" description="Approved members will appear in the pipeline." />
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {[...MEMBERSHIP_STAGES.map((s) => ({ key: s.key, label: s.label, description: s.description })),
            { key: "__unset", label: "No stage set", description: "Members without a lifecycle stage" }].map((stage) => {
            const list = byStage.get(stage.key) ?? [];
            return (
              <div key={stage.key} className="w-64 shrink-0">
                <Card>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white">{stage.label}</h3>
                    <Badge variant={stage.key === "__unset" ? "warning" : "purple"}>{list.length}</Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{stage.description}</p>
                  <div className="mt-3 space-y-2 max-h-[24rem] overflow-y-auto">
                    {list.length === 0 ? (
                      <p className="text-xs text-slate-600">Empty</p>
                    ) : (
                      list.map((m) => (
                        <div key={m.id} className="rounded-xl border border-white/10 bg-white/5 p-2.5">
                          <p className="text-sm text-white truncate">{m.first_name} {m.last_name}</p>
                          <p className="text-xs text-slate-500 font-mono">{m.member_code ?? "—"}</p>
                          <div className="mt-2 flex items-center gap-2">
                            <Button size="sm" variant="secondary" onClick={() => openPromote(m)}>
                              <ChevronRight size={12} /> Move
                            </Button>
                            <Link to="/members/$id" params={{ id: m.id }} className="text-slate-500 hover:text-white">
                              <ExternalLink size={14} />
                            </Link>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={!!promote}
        onClose={() => setPromote(null)}
        title={`Move ${promote?.first_name ?? ""} ${promote?.last_name ?? ""}`}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setPromote(null)}>Cancel</Button>
            <Button onClick={savePromotion} loading={busy}>Save</Button>
          </div>
        }
      >
        <p className="text-sm text-slate-400 mb-3">Current stage: {stageLabel(promote?.membership_stage)}</p>
        <Select label="New stage" value={target} onChange={(e) => setTarget(e.target.value)}>
          {MEMBERSHIP_STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </Select>
      </Modal>
    </AdminShell>
  );
}
