import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, LayoutDashboard, Save, ShieldCheck, Users, Users2 } from "lucide-react";
import { AppLayout, PageWrapper, Card, Button, Badge, Spinner, Modal, Input } from "@/components/ds";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToastContext } from "@/components/ds/Toast";
import { requireRoles, ADMIN_ROLES } from "@/lib/routeGuards";

export const Route = createFileRoute("/_authenticated/admin/family-groups")({
  ssr: false,
  beforeLoad: () => requireRoles(ADMIN_ROLES),
  component: FamilyGroupsAdmin,
});

interface Scheme {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  is_default: boolean;
}
interface Group {
  id: string;
  scheme_id: string;
  name: string;
  short_name: string | null;
  emoji: string | null;
  colour: string | null;
  min_age: number | null;
  max_age: number | null;
  gender_restriction: string | null;
  marital_status_rule: string | null;
  sequence_order: number | null;
  is_active: boolean;
}
interface Settings {
  branch_id: string;
  active_family_scheme_id: string | null;
  elders_age_threshold: number;
}

function ageLabel(g: Group) {
  if (g.min_age == null && g.max_age == null) return "Any age";
  if (g.min_age != null && g.max_age != null) return `Ages ${g.min_age}–${g.max_age}`;
  if (g.min_age != null) return `${g.min_age}+`;
  return `Up to ${g.max_age}`;
}

function FamilyGroupsAdmin() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { showToast } = useToastContext();

  const [loading, setLoading] = useState(true);
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [activeMembers, setActiveMembers] = useState(0);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<Scheme | null>(null);
  const [threshold, setThreshold] = useState(60);
  const [savingThreshold, setSavingThreshold] = useState(false);
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

    const [schRes, grpRes, setRes, mfgRes, memRes] = await Promise.all([
      supabase.from("family_grouping_schemes").select("*").order("name"),
      supabase.from("family_groups").select("*").order("sequence_order", { ascending: true, nullsFirst: false }),
      bId ? supabase.from("branch_settings").select("*").eq("branch_id", bId).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from("member_family_groups").select("group_id").eq("is_active", true),
      bId ? supabase.from("members").select("id", { count: "exact", head: true }).eq("branch_id", bId).eq("membership_status", "active") : Promise.resolve({ count: 0 }),
    ]);
    setSchemes((schRes.data as Scheme[]) ?? []);
    setGroups((grpRes.data as Group[]) ?? []);
    const s = setRes.data as Settings | null;
    setSettings(s);
    setThreshold(s?.elders_age_threshold ?? 60);
    const counts: Record<string, number> = {};
    ((mfgRes.data as { group_id: string }[]) ?? []).forEach((r) => {
      counts[r.group_id] = (counts[r.group_id] ?? 0) + 1;
    });
    setMemberCounts(counts);
    setActiveMembers((memRes as { count: number | null }).count ?? 0);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [user?.id]);

  const activeScheme = schemes.find((s) => s.id === settings?.active_family_scheme_id) ?? schemes.find((s) => s.is_active);
  const groupsFor = (schemeId: string) => groups.filter((g) => g.scheme_id === schemeId && g.is_active);
  const activeSchemeCount = activeScheme ? groupsFor(activeScheme.id).reduce((sum, g) => sum + (memberCounts[g.id] ?? 0), 0) : 0;

  const doSwitch = async () => {
    if (!confirming || !branchId) return;
    setSwitching(true);
    try {
      if (threshold !== (settings?.elders_age_threshold ?? 60)) {
        await supabase.from("branch_settings").update({ elders_age_threshold: threshold }).eq("branch_id", branchId);
      }
      const { data, error } = await supabase.rpc("switch_family_grouping_scheme", {
        p_scheme_id: confirming.id,
        p_branch_id: branchId,
      });
      if (error) throw error;
      const result = data as { scheme_name?: string; members_reassigned?: number } | null;
      showToast(`${result?.members_reassigned ?? 0} members reassigned to ${result?.scheme_name ?? confirming.name}`, "success");
      setConfirming(null);
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Switch failed", "error");
    } finally {
      setSwitching(false);
    }
  };

  const saveThreshold = async () => {
    if (!branchId || !activeScheme) return;
    setSavingThreshold(true);
    try {
      await supabase.from("branch_settings").update({ elders_age_threshold: threshold }).eq("branch_id", branchId);
      const { error } = await supabase.rpc("reassign_all_members_to_scheme", {
        p_scheme_id: activeScheme.id,
        p_branch_id: branchId,
      });
      if (error) throw error;
      showToast("Elders threshold saved and members re-evaluated", "success");
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Save failed", "error");
    } finally {
      setSavingThreshold(false);
    }
  };

  return (
    <AppLayout
      title="Family Groups"
      breadcrumb={[{ label: "Home", href: "/dashboard" }, { label: "Admin" }, { label: "Family Groups" }]}
      navItems={[
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { label: "Members", href: "/members", icon: Users },
        { label: "Verifications", href: "/admin/verifications", icon: ShieldCheck },
        { label: "Family Groups", href: "/admin/family-groups", icon: Users2, active: true },
      ]}
      userProfile={{
        name: user?.profile?.full_name ?? user?.email ?? "User",
        email: user?.email ?? "",
        onLogout: async () => { await logout(); navigate({ to: "/auth" }); },
      }}
    >
      <PageWrapper>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Family Groups</h1>
          <p className="text-sm text-slate-400 mt-1">Manage how members are grouped by life stage</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : (
          <div className="space-y-6">
            {/* Active scheme */}
            {activeScheme && (
              <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl p-[1px] bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-500"
              >
                <div className="rounded-2xl bg-[#0d1117] p-6">
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h2 className="text-lg font-semibold text-white">{activeScheme.name}</h2>
                        <Badge variant="success">Active</Badge>
                        {activeScheme.is_default && <Badge variant="warning">Default</Badge>}
                      </div>
                      <p className="text-sm text-slate-400">{activeScheme.description ?? ""}</p>
                      {activeScheme.is_default && (
                        <p className="text-xs text-slate-500 mt-1">This is the default grouping for Shepherd's Hill.</p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-white">{activeSchemeCount}</div>
                      <div className="text-xs uppercase tracking-wider text-slate-500">Assigned members</div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Scheme switcher */}
            <div>
              <h3 className="text-base font-semibold text-white">Switch Grouping Scheme</h3>
              <p className="text-sm text-slate-400 mb-3">
                Switching will automatically reassign all members to their correct group in the new scheme.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {schemes.map((s) => {
                  const isActive = activeScheme?.id === s.id;
                  const preview = groupsFor(s.id).slice(0, 8);
                  return (
                    <Card key={s.id}>
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <h4 className="font-semibold text-white">{s.name}</h4>
                        {isActive && <Badge variant="success">Active</Badge>}
                        {s.is_default && <Badge variant="warning">Default</Badge>}
                        {!s.is_default && <Badge variant="info">RCCG Standard</Badge>}
                      </div>
                      <p className="text-sm text-slate-400 mb-4">{s.description ?? ""}</p>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {preview.map((g) => (
                          <span key={g.id}
                            className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]"
                            style={{
                              backgroundColor: `${g.colour ?? "#6366f1"}26`,
                              borderColor: `${g.colour ?? "#6366f1"}66`,
                              color: g.colour ?? "#6366f1",
                            }}>
                            {g.emoji && <span>{g.emoji}</span>}<span>{g.name}</span>
                            {g.min_age != null && (
                              <span className="opacity-70">
                                · {g.min_age}{g.max_age != null ? `–${g.max_age}` : "+"}
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                      <Button
                        variant={isActive ? "secondary" : "primary"}
                        disabled={isActive || switching}
                        onClick={() => setConfirming(s)}
                      >
                        {isActive ? <><CheckCircle2 size={16} /> Currently Active</> : <>Activate This Scheme</>}
                      </Button>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Elders threshold */}
            <Card title="Elders Age Threshold" subtitle="Members at or above this age are placed in the Elders group regardless of other rules">
              <div className="flex items-end gap-3 flex-wrap">
                <div className="max-w-[180px]">
                  <Input
                    label="Elders age threshold"
                    type="number"
                    value={threshold}
                    onChange={(e) => setThreshold(Number(e.target.value) || 60)}
                    min={40} max={100}
                  />
                </div>
                <Button variant="secondary" onClick={saveThreshold} loading={savingThreshold}>
                  <Save size={16} /> Save & re-evaluate
                </Button>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Members aged {threshold} and above will be placed in the Elders group.
              </p>
            </Card>

            {/* Groups in active scheme */}
            {activeScheme && (
              <Card title={`Groups in ${activeScheme.name}`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-slate-500">
                        <th className="py-2 pr-3">Emoji</th>
                        <th className="py-2 pr-3">Group</th>
                        <th className="py-2 pr-3">Age</th>
                        <th className="py-2 pr-3">Gender</th>
                        <th className="py-2 pr-3">Marital</th>
                        <th className="py-2 pr-3 text-right">Members</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupsFor(activeScheme.id).map((g, i) => (
                        <motion.tr
                          key={g.id}
                          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.03 }}
                          className="border-b border-white/5 last:border-0"
                        >
                          <td className="py-2 pr-3 text-lg">{g.emoji ?? ""}</td>
                          <td className="py-2 pr-3 text-white font-medium">{g.name}</td>
                          <td className="py-2 pr-3 text-slate-300">{ageLabel(g)}</td>
                          <td className="py-2 pr-3 text-slate-400 capitalize">{g.gender_restriction ?? "all"}</td>
                          <td className="py-2 pr-3 text-slate-400 capitalize">{(g.marital_status_rule ?? "any").replace("_", " ")}</td>
                          <td className="py-2 pr-3 text-right text-white font-mono">{memberCounts[g.id] ?? 0}</td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        )}

        <Modal isOpen={!!confirming} onClose={() => { if (!switching) setConfirming(null); }} title={confirming ? `Switch to ${confirming.name}?` : ""}>
          <div className="space-y-4">
            <p className="text-sm text-slate-300">
              This will reassign all <span className="font-semibold text-white">{activeMembers}</span> active members
              to their correct group in this scheme. This may take a moment.
            </p>
            <Input
              label="Elders age threshold"
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value) || 60)}
              min={40} max={100}
              hint={`Members aged ${threshold} and above will be placed in the Elders group.`}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setConfirming(null)} disabled={switching}>Cancel</Button>
              <Button variant="primary" onClick={doSwitch} loading={switching}>Confirm Switch</Button>
            </div>
          </div>
        </Modal>
      </PageWrapper>
    </AppLayout>
  );
}
