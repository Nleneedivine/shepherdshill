import { createFileRoute } from "@tanstack/react-router";
import { SuperAdminShell } from "@/features/super-admin/SuperAdminShell";
import { Card } from "@/components/ds";
export const Route = createFileRoute("/_authenticated/super-admin/settings")({
  ssr: false,
  component: () => (
    <SuperAdminShell>
      <h1 className="text-2xl font-bold text-white mb-4">System Settings</h1>
      <Card title="Coming soon" subtitle="Estimated: Sprint 9"><p className="text-sm text-slate-400">Global configuration and defaults.</p></Card>
    </SuperAdminShell>
  ),
});
