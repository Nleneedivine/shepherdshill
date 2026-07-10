import { createFileRoute } from "@tanstack/react-router";
import { SuperAdminShell } from "@/features/super-admin/SuperAdminShell";
import { Card } from "@/components/ds";
export const Route = createFileRoute("/_authenticated/super-admin/roles")({
  ssr: false,
  component: () => (
    <SuperAdminShell>
      <h1 className="text-2xl font-bold text-white mb-4">Role Management</h1>
      <Card title="Coming soon" subtitle="Estimated: Sprint 5"><p className="text-sm text-slate-400">Define roles and permissions.</p></Card>
    </SuperAdminShell>
  ),
});
