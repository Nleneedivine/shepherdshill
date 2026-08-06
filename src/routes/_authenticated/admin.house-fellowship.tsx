import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Home, Plus, Power, Users as UsersIcon, Network, UserPlus, Pencil } from "lucide-react";
import { AdminShell } from "@/features/admin/AdminShell";
import { Card, Button, Badge, Input, Select, Modal, Spinner, EmptyState, StatCard } from "@/components/ds";
import { supabase } from "@/integrations/supabase/client";
import { useToastContext } from "@/components/ds/Toast";
import { requireRoles, ADMIN_ROLES } from "@/lib/routeGuards";
import { TERMS } from "@/constants/terminology";

export const Route = createFileRoute("/_authenticated/admin/house-fellowship")({
  ssr: false,
  beforeLoad: () => requireRoles(ADMIN_ROLES),
  component: HouseFellowshipPage,
});

interface Hfc {
  id: string;
  name: string;
  leader_name: string | null;
  leader_phone: string | null;
  meeting_day: string | null;
  meeting_time: string | null;
  address: string | null;
  capacity: number | null;
  parish_id: string | null;
  branch_id: string | null;
  is_active: boolean;
}

interface MemberLite {
  id: string;
  first_name: string;
  last_name: string;
  member_code: string | null;
  phone_primary: string | null;
  cell_group_id: string | null;
}

interface Named { id: string; name: string }
interface Parish extends Named { area_id: string | null }
interface Area extends Named { zone_id: string | null }
interface Zone extends Named { province_id: string | null }

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const emptyForm = {
  name: "",
  leader_name: "",
  leader_phone: "",
  meeting_day: "",
  meeting_time: "",
  address: "",
  capacity: "",
  parish_id: "",
};

function HouseFellowshipPage() {
  const { showToast } = useToastContext();
  const [tab, setTab] = useState<"centres" | "hierarchy" | "unassigned">("centres");
  const [loading, setLoading] = useState(true);
  const [hfcs, setHfcs] = useState<Hfc[]>([]);
  const [members, setMembers] = useState<MemberLite[]>([]);
  const [parishes, setParishes] = useState<Parish[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [provinces, setProvinces] = useState<Named[]>([]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Hfc | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  const [assignFor, setAssignFor] = useState<MemberLite | null>(null);
  const [assignTo, setAssignTo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [cg, mem, pa, ar, zo, pr] = await Promise.all([
      supabase.from("cell_groups").select("*").order("name"),
      supabase.from("members").select("id, first_name, last_name, member_code, phone_primary, cell_group_id").order("first_name"),
      supabase.from("parishes").select("id, name, area_id").order("name"),
      supabase.from("areas").select("id, name, zone_id").order("name"),
      supabase.from("zones").select("id, name, province_id").order("name"),
      supabase.from("provinces").select("id, name").order("name"),
    ]);
    setHfcs((cg.data ?? []) as Hfc[]);
    setMembers((mem.data ?? []) as MemberLite[]);
    setParishes((pa.data ?? []) as Parish[]);
    setAreas((ar.data ?? []) as Area[]);
    setZones((zo.data ?? []) as Zone[]);
    setProvinces((pr.data ?? []) as Named[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of members) if (m.cell_group_id) map.set(m.cell_group_id, (map.get(m.cell_group_id) ?? 0) + 1);
    return map;
  }, [members]);

  const unassigned = useMemo(() => members.filter((m) => !m.cell_group_id), [members]);

  const startCreate = () => { setEditing(null); setForm({ ...emptyForm }); setOpen(true); };
  const startEdit = (h: Hfc) => {
    setEditing(h);
    setForm({
      name: h.name,
      leader_name: h.leader_name ?? "",
      leader_phone: h.leader_phone ?? "",
      meeting_day: h.meeting_day ?? "",
      meeting_time: h.meeting_time ?? "",
      address: h.address ?? "",
      capacity: h.capacity != null ? String(h.capacity) : "",
      parish_id: h.parish_id ?? "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        leader_name: form.leader_name.trim() || null,
        leader_phone: form.leader_phone.trim() || null,
        meeting_day: form.meeting_day || null,
        meeting_time: form.meeting_time || null,
        address: form.address.trim() || null,
        capacity: form.capacity ? Number(form.capacity) : null,
        parish_id: form.parish_id || null,
      };
      const { error } = editing
        ? await supabase.from("cell_groups").update(payload as never).eq("id", editing.id)
        : await supabase.from("cell_groups").insert(payload as never);
      if (error) throw error;
      showToast(editing ? `${TERMS.CELL_GROUP} updated` : `${TERMS.CELL_GROUP} created`, "success");
      setOpen(false);
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not save", "error");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (h: Hfc) => {
    const { error } = await supabase.from("cell_groups").update({ is_active: !h.is_active } as never).eq("id", h.id);
    if (error) { showToast(error.message, "error"); return; }
    showToast(h.is_active ? "Deactivated" : "Reactivated", "success");
    await load();
  };

  const assign = async () => {
    if (!assignFor || !assignTo) return;
    const { error } = await supabase.from("members").update({ cell_group_id: assignTo } as never).eq("id", assignFor.id);
    if (error) { showToast(error.message, "error"); return; }
    showToast("Member assigned", "success");
    setAssignFor(null);
    setAssignTo("");
    await load();
  };

  const activeCount = hfcs.filter((h) => h.is_active).length;

  return (
    <AdminShell
      title={TERMS.CELL_GROUPS}
      crumb={TERMS.CELL_GROUPS}
      description={`Create, edit and deactivate ${TERMS.CELL_GROUPS}, view the church hierarchy and assign members.`}
      actions={<Button onClick={startCreate}><Plus size={14} /> New centre</Button>}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Centres" value={hfcs.length} icon={<Home size={18} />} />
        <StatCard label="Active" value={activeCount} glowColor="green" />
        <StatCard label="Assigned members" value={members.length - unassigned.length} />
        <StatCard label="Unassigned" value={unassigned.length} glowColor="amber" />
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {([
          ["centres", "Centres", Home],
          ["hierarchy", "Hierarchy", Network],
          ["unassigned", `Unassigned (${unassigned.length})`, UserPlus],
        ] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm transition-colors ${
              tab === id
                ? "border-violet-500/40 bg-violet-500/15 text-violet-200"
                : "border-white/10 bg-white/5 text-slate-400 hover:text-white"
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : tab === "centres" ? (
        hfcs.length === 0 ? (
          <EmptyState icon={<Home size={40} />} title={`No ${TERMS.CELL_GROUPS} yet`} description="Create your first centre to start assigning members." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {hfcs.map((h) => (
              <Card key={h.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-white font-semibold truncate">{h.name}</h3>
                      <Badge variant={h.is_active ? "success" : "warning"}>{h.is_active ? "Active" : "Inactive"}</Badge>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {h.leader_name ? `${TERMS.CELL_LEADER}: ${h.leader_name}` : "No coordinator yet"}
                    </p>
                    {(h.meeting_day || h.meeting_time) && (
                      <p className="text-xs text-slate-500 mt-0.5">{[h.meeting_day, h.meeting_time].filter(Boolean).join(" • ")}</p>
                    )}
                    {h.address && <p className="text-xs text-slate-500 mt-0.5">{h.address}</p>}
                    <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-slate-400">
                      <UsersIcon size={12} /> {counts.get(h.id) ?? 0} member{(counts.get(h.id) ?? 0) === 1 ? "" : "s"}
                      {h.capacity ? ` / ${h.capacity}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button size="sm" variant="secondary" onClick={() => startEdit(h)}><Pencil size={14} /> Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => void toggle(h)}><Power size={14} /> {h.is_active ? "Deactivate" : "Activate"}</Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )
      ) : tab === "hierarchy" ? (
        <Card title="Church structure" subtitle="Province → Zone → Area → Parish → Centre">
          {provinces.length === 0 && hfcs.length === 0 ? (
            <p className="text-sm text-slate-500">No structure recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {provinces.map((p) => (
                <div key={p.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-sm font-semibold text-white">🏛️ {p.name}</p>
                  <div className="mt-2 space-y-2 pl-4 border-l border-white/10">
                    {zones.filter((z) => z.province_id === p.id).map((z) => (
                      <div key={z.id}>
                        <p className="text-sm text-slate-200">🗺️ {z.name}</p>
                        <div className="mt-1 space-y-1 pl-4 border-l border-white/10">
                          {areas.filter((a) => a.zone_id === z.id).map((a) => (
                            <div key={a.id}>
                              <p className="text-sm text-slate-300">📍 {a.name}</p>
                              <div className="mt-1 space-y-1 pl-4 border-l border-white/10">
                                {parishes.filter((pa) => pa.area_id === a.id).map((pa) => (
                                  <div key={pa.id}>
                                    <p className="text-sm text-slate-400">⛪ {pa.name}</p>
                                    <ul className="pl-4 mt-0.5 space-y-0.5">
                                      {hfcs.filter((h) => h.parish_id === pa.id).map((h) => (
                                        <li key={h.id} className="text-xs text-slate-500">🏠 {h.name} · {counts.get(h.id) ?? 0} members</li>
                                      ))}
                                    </ul>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {hfcs.some((h) => !h.parish_id) && (
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-sm font-semibold text-slate-300">Centres not linked to a parish</p>
                  <ul className="mt-1 space-y-0.5">
                    {hfcs.filter((h) => !h.parish_id).map((h) => (
                      <li key={h.id} className="text-xs text-slate-500">🏠 {h.name}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </Card>
      ) : unassigned.length === 0 ? (
        <EmptyState icon={<UserPlus size={40} />} title="Everyone is assigned" description={`Every member belongs to a ${TERMS.CELL_GROUP}.`} />
      ) : (
        <Card title="Members without a centre" subtitle={`${unassigned.length} to assign`}>
          <div className="divide-y divide-white/5">
            {unassigned.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">{m.first_name} {m.last_name}</p>
                  <p className="text-xs text-slate-500 font-mono">{m.member_code ?? "—"}</p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => { setAssignFor(m); setAssignTo(""); }}>
                  <UserPlus size={14} /> Assign
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={editing ? `Edit ${TERMS.CELL_GROUP}` : `New ${TERMS.CELL_GROUP}`}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} loading={saving} disabled={!form.name.trim()}>{editing ? "Save" : "Create"}</Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Grace Centre" />
          <Input label={TERMS.CELL_LEADER} value={form.leader_name} onChange={(e) => setForm({ ...form, leader_name: e.target.value })} />
          <Input label="Coordinator phone" value={form.leader_phone} onChange={(e) => setForm({ ...form, leader_phone: e.target.value })} />
          <Select label="Meeting day" value={form.meeting_day} onChange={(e) => setForm({ ...form, meeting_day: e.target.value })}>
            <option value="">—</option>
            {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
          </Select>
          <Input label="Meeting time" type="time" value={form.meeting_time} onChange={(e) => setForm({ ...form, meeting_time: e.target.value })} />
          <Input label="Capacity" type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
          <Select label="Parish" value={form.parish_id} onChange={(e) => setForm({ ...form, parish_id: e.target.value })}>
            <option value="">—</option>
            {parishes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <Input label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
      </Modal>

      <Modal
        isOpen={!!assignFor}
        onClose={() => setAssignFor(null)}
        title={`Assign ${assignFor?.first_name ?? ""} ${assignFor?.last_name ?? ""}`}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAssignFor(null)}>Cancel</Button>
            <Button onClick={assign} disabled={!assignTo}>Assign</Button>
          </div>
        }
      >
        <Select label={TERMS.CELL_GROUP} value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
          <option value="">Select a centre</option>
          {hfcs.filter((h) => h.is_active).map((h) => (
            <option key={h.id} value={h.id}>{h.name}</option>
          ))}
        </Select>
      </Modal>
    </AdminShell>
  );
}
