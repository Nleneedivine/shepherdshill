import { useCallback, useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { Card, Badge, Button, Select, Spinner } from "@/components/ds";
import { supabase } from "@/integrations/supabase/client";
import { useToastContext } from "@/components/ds/Toast";

interface Assignment {
  id: string;
  department_id: string;
  role_title: string | null;
  name: string;
}

interface Dept {
  id: string;
  name: string;
}

// TODO(Messaging): when the Messaging module lands, joining a department should
// also subscribe the member to that department's channel.
export function MemberDepartments({ memberId, canEdit }: { memberId: string; canEdit: boolean }) {
  const { showToast } = useToastContext();
  const [rows, setRows] = useState<Assignment[]>([]);
  const [all, setAll] = useState<Dept[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: dm }, { data: ds }] = await Promise.all([
      supabase
        .from("department_members")
        .select("id, department_id, role_title, departments(name)")
        .eq("member_id", memberId),
      supabase.from("departments").select("id, name").eq("is_active", true).order("name"),
    ]);
    const assigned = ((dm ?? []) as unknown as {
      id: string;
      department_id: string;
      role_title: string | null;
      departments: { name: string } | null;
    }[]).map((r) => ({
      id: r.id,
      department_id: r.department_id,
      role_title: r.role_title,
      name: r.departments?.name ?? "Unknown",
    }));
    setRows(assigned);
    setAll(((ds ?? []) as Dept[]) ?? []);
    setLoading(false);
  }, [memberId]);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async () => {
    if (!adding) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("department_members")
        .insert({ member_id: memberId, department_id: adding } as never);
      if (error) throw error;
      setAdding("");
      showToast("Department assigned", "success");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not assign department", "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    try {
      const { error } = await supabase.from("department_members").delete().eq("id", id);
      if (error) throw error;
      showToast("Removed from department", "success");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not remove", "error");
    } finally {
      setBusy(false);
    }
  };

  const available = all.filter((d) => !rows.some((r) => r.department_id === d.id));

  return (
    <Card title="Departments" subtitle="Units and teams this member serves in">
      {loading ? (
        <div className="flex justify-center py-6"><Spinner /></div>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.length === 0 ? (
            <p className="text-sm text-slate-400">Not assigned to any department yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {rows.map((r) => (
                <span key={r.id} className="inline-flex items-center gap-1">
                  <Badge variant="success">{r.name}{r.role_title ? ` · ${r.role_title}` : ""}</Badge>
                  {canEdit && (
                    <button
                      onClick={() => void remove(r.id)}
                      disabled={busy}
                      aria-label={`Remove from ${r.name}`}
                      className="text-slate-500 hover:text-rose-400 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}

          {canEdit && available.length > 0 && (
            <div className="flex items-end gap-2">
              <Select
                label="Add to department"
                value={adding}
                onChange={(e) => setAdding(e.target.value)}
                className="flex-1"
              >
                <option value="">Select a department…</option>
                {available.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </Select>
              <Button size="sm" onClick={add} disabled={!adding} loading={busy}>
                <Plus size={14} /> Add
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
