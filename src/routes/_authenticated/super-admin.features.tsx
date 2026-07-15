import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SuperAdminShell } from "@/features/super-admin/SuperAdminShell";
import { Card, Button, Badge, Spinner, Modal, Input } from "@/components/ds";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToastContext } from "@/components/ds/Toast";

export const Route = createFileRoute("/_authenticated/super-admin/features")({
  ssr: false,
  component: FeatureTogglesPage,
});

interface Scheme { id: string; name: string; is_default: boolean; is_active: boolean; }

function FeatureTogglesPage() {
  const { user } = useAuth();
  const { showToast } = useToastContext();
  const [loading, setLoading] = useState(true);
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [activeSchemeId, setActiveSchemeId] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(60);
  const [activeMembers, setActiveMembers] = useState(0);
  const [confirmTarget, setConfirmTarget] = useState<Scheme | null>(null);
  const [switching, setSwitching] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: prof } = await supabase.from("profiles").select("branch_id").eq("id", user?.id ?? "").maybeSingle();
    let bId = (prof as { branch_id: string | null } | null)?.branch_id ?? null;
    if (!bId) {
      const { data: b } = await supabase.from("branches").select("id").order("created_at").limit(1).maybeSingle();
      bId = (b as { id: string } | null)?.id ?? null;
    }
    setBranchId(bId);
    const [schRes, setRes, memRes] = await Promise.all([
      supabase.from("family_grouping_schemes").select("id, name, is_default, is_active").order("name"),
      bId ? supabase.from("branch_settings").select("active_family_scheme_id, elders_age_threshold").eq("branch_id", bId).maybeSingle() : Promise.resolve({ data: null }),
      bId ? supabase.from("members").select("id", { count: "exact", head: true }).eq("branch_id", bId).eq("membership_status", "active") : Promise.resolve({ count: 0 }),
    ]);
    setSchemes((schRes.data as Scheme[]) ?? []);
    const s = setRes.data as { active_family_scheme_id: string | null; elders_age_threshold: number } | null;
    setActiveSchemeId(s?.active_family_scheme_id ?? null);
    setThreshold(s?.elders_age_threshold ?? 60);
    setActiveMembers((memRes as { count: number | null }).count ?? 0);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [user?.id]);

  const defaultScheme = schemes.find((s) => s.is_default);
  const rccgScheme = schemes.find((s) => !s.is_default);
  const isRccgActive = activeSchemeId === rccgScheme?.id;

  const requestSwitch = () => {
    const target = isRccgActive ? defaultScheme : rccgScheme;
    if (target) setConfirmTarget(target);
  };

  const doSwitch = async () => {
    if (!confirmTarget || !branchId) return;
    setSwitching(true);
    try {
      const { error } = await supabase.rpc("switch_family_grouping_scheme", {
        p_scheme_id: confirmTarget.id,
        p_branch_id: branchId,
      });
      if (error) throw error;
      showToast(`Switched to ${confirmTarget.name}`, "success");
      setConfirmTarget(null);
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Switch failed", "error");
    } finally {
      setSwitching(false);
    }
  };

  const activeSchemeName = schemes.find((s) => s.id === activeSchemeId)?.name ?? "—";

  return (
    <SuperAdminShell>
      <h1 className="text-2xl font-bold text-white mb-6">Feature Toggles</h1>

      {loading ? <Spinner /> : (
        <div className="space-y-6">
          <Card title="Family Grouping" subtitle={`Currently active: ${activeSchemeName}`}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="max-w-xl">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-white">Use RCCG Standard Age Groups</h3>
                  {isRccgActive ? <Badge variant="success">On</Badge> : <Badge>Off</Badge>}
                </div>
                <p className="text-sm text-slate-400">
                  Switch from Shepherd's Hill default groups to the detailed RCCG age band system.
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Elders threshold: {threshold} · Active members that will be re-evaluated: {activeMembers}
                </p>
              </div>
              <button
                type="button"
                onClick={requestSwitch}
                role="switch"
                aria-checked={isRccgActive}
                className={`relative h-8 w-14 rounded-full border transition-colors ${isRccgActive ? "bg-emerald-500/80 border-emerald-400" : "bg-white/10 border-white/20"}`}
              >
                <span className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-all ${isRccgActive ? "left-7" : "left-1"}`} />
              </button>
            </div>
          </Card>

          <Card title="More toggles" subtitle="Estimated: Sprint 6">
            <p className="text-sm text-slate-400">Additional feature toggles will land in a later sprint.</p>
          </Card>
        </div>
      )}

      <Modal
        isOpen={!!confirmTarget}
        onClose={() => { if (!switching) setConfirmTarget(null); }}
        title={confirmTarget ? `Switch to ${confirmTarget.name}?` : ""}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            This will reassign all <span className="font-semibold text-white">{activeMembers}</span> active members
            to their correct group in this scheme.
          </p>
          <Input
            label="Elders age threshold"
            type="number"
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value) || 60)}
            min={40}
            max={100}
            hint={`Members aged ${threshold} and above will be placed in the Elders group.`}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setConfirmTarget(null)} disabled={switching}>Cancel</Button>
            <Button variant="primary" onClick={doSwitch} loading={switching}>Confirm Switch</Button>
          </div>
        </div>
      </Modal>
    </SuperAdminShell>
  );
}
