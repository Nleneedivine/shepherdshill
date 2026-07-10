import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Activity, Building2, Database, Users } from "lucide-react";
import { StatCard, Card, EmptyState, DataTable } from "@/components/ds";
import { supabase } from "@/integrations/supabase/client";
import { SuperAdminShell } from "@/features/super-admin/SuperAdminShell";
import { MODULES, type ModuleStatus } from "@/features/super-admin/data";

export const Route = createFileRoute("/_authenticated/super-admin/")({
  ssr: false,
  component: SystemOverview,
});

const statusTone: Record<ModuleStatus, string> = {
  active: "bg-green-500/15 text-green-400 border-green-500/30",
  in_development: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  coming_soon: "bg-slate-500/15 text-slate-400 border-slate-500/30",
};

interface LogRow { id: string; action: string; performed_by_name: string | null; created_at: string }

function SystemOverview() {
  const [members, setMembers] = useState(0);
  const [branches, setBranches] = useState(0);
  const [logs, setLogs] = useState<LogRow[]>([]);

  useEffect(() => {
    void (async () => {
      const [m, b, l] = await Promise.all([
        supabase.from("members").select("id", { count: "exact", head: true }),
        supabase.from("branches").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("system_logs").select("id, action, performed_by_name, created_at")
          .order("created_at", { ascending: false }).limit(20),
      ]);
      setMembers(m.count ?? 0);
      setBranches(b.count ?? 0);
      setLogs((l.data ?? []) as LogRow[]);
    })();
  }, []);

  return (
    <SuperAdminShell>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">System Overview</h1>
        <p className="text-sm text-violet-300/70 mt-1">Everything under the hood</p>
      </div>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Members" value={members} icon={<Users size={20} />} />
        <StatCard label="Active Branches" value={branches} icon={<Building2 size={20} />} />
        <StatCard label="System Health" value={99.9} unit="%" icon={<Activity size={20} />} glowColor="green" />
        <StatCard label="Database Size" value={0} unit="MB" icon={<Database size={20} />} />
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">Module Status</h2>
        <motion.div
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3"
          initial="hidden" animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.03 } } }}
        >
          {MODULES.map((m) => (
            <motion.div
              key={m.number}
              variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}
              className="bg-white/5 border border-violet-500/10 rounded-2xl p-4 flex flex-col gap-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-violet-400/70 font-mono">M{String(m.number).padStart(2, "0")}</span>
                <span className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border ${statusTone[m.status]}`}>
                  {m.status.replace("_", " ")}
                </span>
              </div>
              <div className="text-sm text-white font-medium">{m.name}</div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">Recent System Activity</h2>
        {logs.length === 0 ? (
          <EmptyState title="No activity yet" description="System actions will appear here." />
        ) : (
          <Card>
            <DataTable
              columns={[
                { key: "action", header: "Action" },
                { key: "performed_by_name", header: "By" },
                { key: "created_at", header: "When", render: (v) => new Date(String(v)).toLocaleString() },
              ]}
              data={logs}
            />
          </Card>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { label: "Activate Multi-Branch Mode", hint: "Available after all modules built" },
            { label: "Export All Data", hint: "Coming soon" },
            { label: "System Backup", hint: "Coming soon" },
          ].map((q) => (
            <div key={q.label} className="bg-white/5 border border-white/10 rounded-2xl p-4 opacity-60" title={q.hint}>
              <div className="text-sm text-white font-medium">{q.label}</div>
              <div className="text-xs text-slate-400 mt-1">{q.hint}</div>
            </div>
          ))}
        </div>
      </section>
    </SuperAdminShell>
  );
}
