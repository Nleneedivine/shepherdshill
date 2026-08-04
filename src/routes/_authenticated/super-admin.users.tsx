import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Eye, Shield, Users as UsersIcon } from "lucide-react";
import { SuperAdminShell } from "@/features/super-admin/SuperAdminShell";
import { Card, Input, Select, Button, Avatar, Badge, EmptyState, Spinner } from "@/components/ds";
import { RoleModal } from "@/features/super-admin/RoleModal";
import { useUsers, type AudienceFilter, type RoleFilter, type StatusFilter, type UserRow } from "@/features/super-admin/useUsers";
import { useAuth } from "@/hooks/useAuth";
import { useToastContext } from "@/components/ds/Toast";

export const Route = createFileRoute("/_authenticated/super-admin/users")({
  ssr: false,
  component: UsersPage,
});

const PAGE_SIZE = 20;

function UsersPage() {
  const { user } = useAuth();
  const { showToast } = useToastContext();
  const callerIsSuperAdmin = (user?.roles ?? []).includes("super_admin");

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(0);
  const [audience, setAudience] = useState<AudienceFilter>("real");
  const [managing, setManaging] = useState<UserRow | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search); setPage(0); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const { rows, total, loading, error, refresh } = useUsers({
    search: debounced,
    roleFilter,
    statusFilter,
    audience,
    page,
    pageSize: PAGE_SIZE,
  });

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  return (
    <SuperAdminShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">User Management</h1>
        <p className="text-sm text-slate-400 mt-1">Manage system access and roles for all registered users</p>
      </div>

      <div className="mb-4 inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
        {(["real", "anonymous"] as AudienceFilter[]).map((a) => (
          <button
            key={a}
            onClick={() => { setAudience(a); setPage(0); }}
            className={`rounded-lg px-4 py-2 text-sm transition-colors ${
              audience === a ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            {a === "real" ? "Registered users" : "Anonymous visitors"}
          </button>
        ))}
      </div>

      <Card className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input label="Search" placeholder="Name, email, or phone…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select label="Role" value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value as RoleFilter); setPage(0); }}>
            <option value="all">All roles</option>
            <option value="member">Member</option>
            <option value="admin">Admin</option>
            <option value="super_admin">Super Admin</option>
            <option value="custom">Custom</option>
          </Select>
          <Select label="Status" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as StatusFilter); setPage(0); }}>
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </Select>
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : error ? (
        <Card><p className="text-sm text-red-300">{error}</p></Card>
      ) : rows.length === 0 ? (
        <EmptyState icon={<UsersIcon size={40} className="text-slate-400" />} title="No users found" description="Try adjusting the filters." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase text-slate-400 border-b border-white/5">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={r.full_name ?? r.email ?? "Anonymous"} size="sm" />
                      <div className="text-white">{r.full_name ?? (r.is_anonymous ? "Anonymous visitor" : "—")}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{r.email ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-300">{r.phone ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge variant={r.primary_role === "super_admin" ? "purple" : r.primary_role === "admin" ? "info" : "success"}>
                      {r.primary_role.replace(/_/g, " ")}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{r.branch_name ?? "—"}</td>
                  <td className="px-4 py-3"><Badge variant="success">Active</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => showToast("Profile view coming soon", "info")} aria-label="View profile">
                        <Eye size={14} />
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setManaging(r)}>
                        <Shield size={14} /> Manage role
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex items-center justify-between p-4 text-sm text-slate-400 border-t border-white/5">
            <span>Page {page + 1} of {totalPages} — {total} users</span>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Prev</Button>
              <Button size="sm" variant="secondary" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </div>
      )}

      <RoleModal
        user={managing}
        currentUserId={user?.id}
        callerIsSuperAdmin={callerIsSuperAdmin}
        onClose={() => setManaging(null)}
        onSaved={() => void refresh()}
      />
    </SuperAdminShell>
  );
}
