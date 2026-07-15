import { useEffect, useState } from "react";
import { Search, Info, X, Music2, Shield, Star, Megaphone, Heart, Baby, Camera, Monitor, Sun, Flame, Brush, Users, type LucideIcon } from "lucide-react";import { Search, Info, X, Music2, Shield, Star, Megaphone, Heart, Baby, Camera, Monitor, Sun, Flame, Brush, Users, CheckCircle, type LucideIcon } from "lucide-react";
import { Input, Select } from "@/components/ds";
import { supabase } from "@/integrations/supabase/client";
import type { CellGroup, Department, RegistrationData } from "@/types";

interface Props {
  data: RegistrationData["churchLife"];
  errors: Record<string, string>;
  onChange: (patch: Partial<RegistrationData["churchLife"]>) => void;
}

const iconMap: Record<string, LucideIcon> = {
  Music2, Shield, Star, Megaphone, Heart, Baby, Camera, Monitor, Sun, Flame, Brush, Users,
};

const STAGES = [
  { value: "first_timer", label: "First Timer", desc: "Just visiting" },
  { value: "consistent_visitor", label: "Consistent Visitor", desc: "Attending regularly" },
  { value: "in_foundational", label: "In Foundational Classes", desc: "Learning the basics" },
  { value: "worker", label: "Worker", desc: "Serving in a department" },
  { value: "sod", label: "School of Disciples", desc: "Discipleship training" },
  { value: "minister", label: "Minister", desc: "Ordained minister" },
  { value: "assistant_pastor", label: "Assistant Pastor", desc: "Pastoral leadership" },
  { value: "pastor_in_charge", label: "Pastor-in-Charge", desc: "Leads a branch" },
];

export function Step4Church({ data, errors, onChange }: Props) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<CellGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<CellGroup | null>(null);

  useEffect(() => {
    void supabase.from("departments").select("*").eq("is_active", true).order("name")
      .then(({ data }) => setDepartments((data as Department[]) ?? []));
  }, []);

  useEffect(() => {
    if (!search || data.cellGroupText === "unknown") { setResults([]); return; }
    const t = setTimeout(async () => {
      const { data: rows } = await supabase
        .from("cell_groups")
        .select("*")
        .or(`name.ilike.%${search}%,leader_name.ilike.%${search}%`)
        .limit(8);
      setResults((rows as CellGroup[]) ?? []);
    }, 300);
    return () => clearTimeout(t);
  }, [search, data.cellGroupText]);

  const pickGroup = (g: CellGroup) => {
    setSelectedGroup(g);
    onChange({ cellGroupId: g.id, cellGroupText: g.name });
    setSearch("");
    setResults([]);
  };

  const clearGroup = () => {
    setSelectedGroup(null);
    onChange({ cellGroupId: null, cellGroupText: "" });
  };

  const markUnknown = () => {
    setSelectedGroup(null);
    onChange({ cellGroupId: null, cellGroupText: "unknown" });
    setResults([]);
  };

  const toggleDepartment = (id: string) => {
    const has = data.departmentIds.includes(id);
    onChange({ departmentIds: has ? data.departmentIds.filter((x) => x !== id) : [...data.departmentIds, id] });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white">Church Life</h2>
        <p className="text-sm text-slate-400">Your journey with our church.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select label="How long have you been attending?" value={data.attendanceDuration}
          onChange={(e) => onChange({ attendanceDuration: e.target.value })}>
          <option value="">Select…</option>
          <option value="lt3m">Less than 3 months</option>
          <option value="3_6m">3-6 months</option>
          <option value="6_12m">6-12 months</option>
          <option value="1_3y">1-3 years</option>
          <option value="3_5y">3-5 years</option>
          <option value="5plus">5+ years</option>
        </Select>
        <Select label="How did you hear about us?" value={data.howHeard}
          onChange={(e) => onChange({ howHeard: e.target.value })}>
          <option value="">Select…</option>
          <option value="friend">Friend/Family</option>
          <option value="social">Social Media</option>
          <option value="outreach">Outreach</option>
          <option value="walk_in">Walked In</option>
          <option value="transfer">Transfer</option>
          <option value="online">Online Service</option>
          <option value="other">Other</option>
        </Select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Where are you in your journey?</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {STAGES.map((s) => {
            const active = data.membershipStage === s.value;
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => onChange({ membershipStage: s.value })}
                className={`p-4 rounded-xl border text-left transition-all ${
                  active
                    ? "bg-gradient-to-br from-violet-600/20 to-blue-500/20 border-violet-500/50"
                    : "bg-white/5 border-white/10 hover:border-white/20"
                }`}
              >
                <div className="font-semibold text-white">{s.label}</div>
                <div className="text-xs text-slate-400 mt-0.5">{s.desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">House Fellowship Centre</label>
        {selectedGroup ? (
          <div className="p-4 rounded-xl bg-gradient-to-br from-violet-600/10 to-blue-500/10 border border-violet-500/30 flex items-start justify-between">
            <div>
              <div className="font-semibold text-white">{selectedGroup.name}</div>
              <div className="text-sm text-slate-400">Coordinator: {selectedGroup.leader_name}</div>
              <div className="text-xs text-slate-500 mt-1">{selectedGroup.meeting_day} • {selectedGroup.meeting_time}</div>
            </div>
            <button type="button" onClick={clearGroup} className="text-slate-400 hover:text-white"><X size={16} /></button>
          </div>
        ) : data.cellGroupText === "unknown" ? (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2">
            <Info size={18} className="text-amber-400 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm text-white">I will be assigned to a House Fellowship Centre</div>
              <div className="text-xs text-slate-400 mt-1">An admin will place you in the right centre.</div>
            </div>
            <button type="button" onClick={clearGroup} className="text-slate-400 hover:text-white"><X size={16} /></button>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by centre name or coordinator…"
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-500 outline-none focus:border-violet-500"
              />
            </div>
            {results.length > 0 && (
              <div className="mt-2 rounded-xl bg-[#0d1117] border border-white/10 overflow-hidden">
                {results.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => pickGroup(g)}
                    className="w-full p-3 text-left hover:bg-white/5 border-b border-white/5 last:border-0"
                  >
                    <div className="font-medium text-white">{g.name}</div>
                    <div className="text-xs text-slate-400">{g.leader_name} • {g.meeting_day} {g.meeting_time}</div>
                  </button>
                ))}
              </div>
            )}
            <button type="button" onClick={markUnknown} className="mt-2 text-xs text-slate-500 hover:text-slate-300">
              I will be assigned to a House Fellowship Centre
            </button>
          </>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Departments (optional)</label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {departments.map((d) => {
            const Icon = iconMap[d.icon ?? ""] ?? Users;
            const active = data.departmentIds.includes(d.id);
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => toggleDepartment(d.id)}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                  active
                    ? "bg-gradient-to-br from-violet-600/20 to-blue-500/20 border-violet-500/50"
                    : "bg-white/5 border-white/10 hover:border-white/20"
                }`}
              >
                <Icon size={18} className={active ? "text-violet-300" : "text-slate-400"} />
                <span className={`text-xs ${active ? "text-white font-medium" : "text-slate-300"}`}>{d.name}</span>
              </button>
            );
          })}
        </div>
      </div>

     <Input label="Role/title (optional)" value={data.roleTitle}
        onChange={(e) => onChange({ roleTitle: e.target.value })} />

      {/* ── FAMILY GROUP PREVIEW ── */}
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Family Group
          </label>
          <p className="text-xs text-slate-500">
            Automatically assigned based on your age and marital
            status. No selection needed.
          </p>
        </div>

        {/* Info card showing all groups */}
        <div
          className="rounded-xl p-4 border"
          style={{
            background: "rgba(124,58,237,0.08)",
            borderColor: "rgba(124,58,237,0.25)",
            borderLeft: "3px solid #7C3AED",
          }}
        >
          <div className="flex items-start gap-3">
            <Users
              size={18}
              className="mt-0.5 flex-shrink-0"
              style={{ color: "#7C3AED" }}
            />
            <div className="flex-1">
              <p
                className="text-sm font-medium mb-2"
                style={{ color: "#C4B5FD" }}
              >
                Shepherd's Hill Family Groups
              </p>
              <div className="space-y-1.5">
                {[
                  { emoji: "👶", range: "Ages 0–12", group: "Junior Church" },
                  { emoji: "🧑", range: "Ages 13–19", group: "Teens Church" },
                  { emoji: "👤", range: "Ages 20–35 (unmarried)", group: "YAYA" },
                  { emoji: "👨", range: "Men 35+ or married", group: "RMF" },
                  { emoji: "👩", range: "Women 35+ or married", group: "Good Women Fellowship" },
                  { emoji: "🧓", range: "Ages 60+", group: "Elders Fellowship" },
                ].map((item) => (
                  <div key={item.group} className="flex items-center gap-2 text-xs">
                    <span>{item.emoji}</span>
                    <span className="text-slate-400">{item.range}</span>
                    <span className="text-slate-600">→</span>
                    <span className="font-medium" style={{ color: "#C4B5FD" }}>
                      {item.group}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Note - prediction requires data from earlier steps */}
        <div
          className="rounded-xl p-3 border text-xs"
          style={{
            background: "rgba(16,185,129,0.08)",
            borderColor: "rgba(16,185,129,0.2)",
            color: "#6EE7B7",
          }}
        >
          <div className="flex items-center gap-2">
            <CheckCircle size={14} style={{ color: "#10B981" }} />
            <span>
              Your family group will be automatically assigned when
              your registration is approved, based on the age and
              marital status you provided in the earlier steps.
            </span>
          </div>
        </div>
      </div>

    </div>
  );
}
