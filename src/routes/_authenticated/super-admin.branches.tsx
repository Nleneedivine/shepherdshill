import { createFileRoute } from "@tanstack/react-router";
import { SuperAdminShell } from "@/features/super-admin/SuperAdminShell";
import { Card } from "@/components/ds";
export const Route = createFileRoute("/_authenticated/super-admin/branches")({
  ssr: false,
  component: () => (
    <SuperAdminShell>
      <h1 className="text-2xl font-bold text-white mb-4">Branch Management</h1>
      <Card title="Coming soon" subtitle="Estimated: Sprint 4">
        <p className="text-sm text-slate-400">Manage church branches, codes, and status here.</p>
      </Card>
    </SuperAdminShell>
  ),
});
