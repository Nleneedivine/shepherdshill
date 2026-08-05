import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Boxes, Plus, Power, Users as UsersIcon } from "lucide-react";
import { AdminShell } from "@/features/admin/AdminShell";
import { Card, Button, Badge, Input, Textarea, Modal, Spinner, EmptyState, StatCard } from "@/components/ds";
import { supabase } from "@/integrations/supabase/client";
import { useToastContext } from "@/components/ds/Toast";
import { requireRoles, ADMIN_ROLES } from "@/lib/routeGuards";

export const Route = createFileRoute("/_authenticated/admin/departments")({
  ssr: false,
  beforeLoad: () => requireRoles(ADMIN_ROLES),
  component: DepartmentsAdminPage,
});

interface DeptRow {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  is_active: boolean;
  member_count: number;
}

function DepartmentsAdminPage() {
  const { showToast } = useToastContext();
  const [rows, setRows] = useState<DeptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: depts }, { data: links }] = await Promise.all([
      supabase.from("departments").select("id, name, description, icon, is_active").order("name"),
      supabase.from("department_members").select("department_id"),
    ]);
    const counts = new Map<string, number>();
    for (const l of (links ?? []) as { department_id: string }[]) {
      counts.set(l.department_id, (counts.get(l.department_id) ?? 0) + 1);
    }
    setRows(
      ((depts ?? []) as Omit<DeptRow, "member_count">[]).map((d) => ({
        ...d,
        member_count: counts.get(d.id) ?? 0,
      })),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      // TODO(Messaging): create a department channel here once the Messaging module exists.
      const { error } = await supabase
        .from("departments")
        .insert({ name: name.trim(), description: description.trim() || null } as never);
      if (error) throw error;
      showToast("Department created", "success");
      setOpen(false);
      setName("");
      setDescription("");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not create department", "error");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (row: DeptRow) => {
    const { error } = await supabase
      .from("departments")
      .update({ is_active: !row.is_active } as never)
      .eq("id", row.id);
    if (error) {
      showToast(error.message, "error");
      return;
    }
    showToast(row.is_active ? "Department deactivated" : "Department reactivated", "success");
    await load();
  };

  const active = rows.filter((r) => r.is_active);

  return (
    <AdminShell
      title="Departments"
      crumb="Departments"
      description="Create, edit and deactivate the units and teams members can serve in."
      actions={<Button onClick={() => setOpen(true)}><Plus size={14} /> New department</Button>}
    >
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard label="Departments" value={rows.length} />
        <StatCard label="Active" value={active.length} />
        <StatCard label="Assignments" value={rows.reduce((a, r) => a + r.member_count, 0)} />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Boxes size={40} className="text-slate-400" />}
          title="No departments yet"
          description="Create your first department to start assigning members."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {rows.map((r) => (
            <Card key={r.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-semibold truncate">{r.name}</h3>
                    <Badge variant={r.is_active ? "success" : "warning"}>
                      {r.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  {r.description && <p className="text-xs text-slate-400 mt-1">{r.description}</p>}
                  <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-slate-400">
                    <UsersIcon size={12} /> {r.member_count} member{r.member_count === 1 ? "" : "s"}
                  </p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => void toggle(r)}>
                  <Power size={14} /> {r.is_active ? "Deactivate" : "Activate"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="New department"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={create} loading={saving} disabled={!name.trim()}>Create</Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <Input label="Name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Choir" />
          <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </div>
      </Modal>
    </AdminShell>
  );
}
