import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Shield, Save } from "lucide-react";
import { SuperAdminShell } from "@/features/super-admin/SuperAdminShell";
import { Card, Button, Badge, Spinner, EmptyState } from "@/components/ds";
import { useRolePermissions } from "@/features/super-admin/useRolePermissions";
import { useToastContext } from "@/components/ds/Toast";

export const Route = createFileRoute("/_authenticated/super-admin/roles")({
  ssr: false,
  component: RolesPage,
});

function RolesPage() {
  const { rows, roles, permissionKeys, loading, error, setLocal, save } = useRolePermissions();
  const { showToast } = useToastContext();
  const [activeRole, setActiveRole] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selected = activeRole ?? roles[0] ?? null;

  const isAllowed = (role: string, key: string) =>
    rows.find((r) => r.role === role && r.permission_key === key)?.allowed ?? false;

  const handleSave = async () => {
    setSaving(true);
    try {
      await save();
      showToast("Permissions saved", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SuperAdminShell>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Role Management</h1>
          <p className="text-sm text-slate-400 mt-1">
            Define what each role is allowed to do. Roles come from the app role list and any role
            currently in use.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving || loading}>
          <Save size={14} /> {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : error ? (
        <Card><p className="text-sm text-red-300">{error}</p></Card>
      ) : roles.length === 0 ? (
        <EmptyState icon={<Shield size={40} className="text-slate-400" />} title="No roles found" description="No roles are defined yet." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
          <Card title="Roles" subtitle={`${roles.length} total`}>
            <div className="flex flex-col gap-1">
              {roles.map((role) => (
                <button
                  key={role}
                  onClick={() => setActiveRole(role)}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    selected === role ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5"
                  }`}
                >
                  <span className="capitalize">{role.replace(/_/g, " ")}</span>
                  <Badge variant={role === "super_admin" ? "purple" : "info"}>
                    {rows.filter((r) => r.role === role && r.allowed).length}
                  </Badge>
                </button>
              ))}
            </div>
          </Card>

          <Card
            title={selected ? selected.replace(/_/g, " ") : "Permissions"}
            subtitle="Toggle the permissions this role grants"
          >
            {!selected ? null : permissionKeys.length === 0 ? (
              <p className="text-sm text-slate-400">No permission keys defined yet.</p>
            ) : (
              <div className="divide-y divide-white/5">
                {permissionKeys.map((key) => {
                  const allowed = isAllowed(selected, key);
                  return (
                    <label
                      key={key}
                      className="flex cursor-pointer items-center justify-between gap-4 py-3"
                    >
                      <div>
                        <div className="text-sm text-white">{key}</div>
                        <div className="text-xs text-slate-500">
                          {allowed ? "Allowed" : "Not allowed"}
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={allowed}
                        onChange={(e) => setLocal(selected, key, e.target.checked)}
                        className="h-5 w-5 rounded border-white/20 bg-white/5 accent-violet-600"
                      />
                    </label>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}
    </SuperAdminShell>
  );
}
