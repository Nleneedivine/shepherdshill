import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Sparkles, Plus, Pencil, Trash2, GripVertical, Power } from "lucide-react";
import { AdminShell } from "@/features/admin/AdminShell";
import { Card, Button, Badge, Input, Textarea, Modal, Spinner, EmptyState } from "@/components/ds";
import { supabase } from "@/integrations/supabase/client";
import { useToastContext } from "@/components/ds/Toast";
import { requireRoles, ADMIN_ROLES } from "@/lib/routeGuards";

export const Route = createFileRoute("/_authenticated/admin/spiritual-journey")({
  ssr: false,
  beforeLoad: () => requireRoles(ADMIN_ROLES),
  component: SpiritualJourneyPage;
});

interface Stage {
  id: string;
  key: string;
  name: string;
  description: string | null;
  sequence_order: number;
  is_active: boolean;
}

const slug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

function SpiritualJourneyPage() {
  const { showToast } = useToastContext();
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Stage | null>(null);
  const [form, setForm] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("spiritual_journey_stages")
      .select("*")
      .order("sequence_order", { ascending: true });
    setStages((data ?? []) as Stage[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const startCreate = () => { setEditing(null); setForm({ name: "", description: "" }); setOpen(true); };
  const startEdit = (s: Stage) => { setEditing(s); setForm({ name: s.name, description: s.description ?? "" }); setOpen(true); };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase
          .from("spiritual_journey_stages")
          .update({ name: form.name.trim(), description: form.description.trim() || null } as never)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const nextOrder = stages.reduce((max, s) => Math.max(max, s.sequence_order), 0) + 1;
        const { error } = await supabase.from("spiritual_journey_stages").insert({
          key: slug(form.name) || `stage_${nextOrder}`,
          name: form.name.trim(),
          description: form.description.trim() || null,
          sequence_order: nextOrder,
          is_active: true,
        } as never);
        if (error) throw error;
      }
      showToast(editing ? "Stage updated" : "Stage created", "success");
      setOpen(false);
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not save the stage", "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (s: Stage) => {
    if (!window.confirm(`Delete “${s.name}”? This cannot be undone.`)) return;
    const { error } = await supabase.from("spiritual_journey_stages").delete().eq("id", s.id);
    if (error) { showToast(error.message, "error"); return; }
    showToast("Stage deleted", "success");
    await load();
  };

  const toggle = async (s: Stage) => {
    const { error } = await supabase.from("spiritual_journey_stages").update({ is_active: !s.is_active } as never).eq("id", s.id);
    if (error) { showToast(error.message, "error"); return; }
    await load();
  };

  const persistOrder = async (list: Stage[]) => {
    await Promise.all(
      list.map((s, i) =>
        supabase.from("spiritual_journey_stages").update({ sequence_order: i + 1 } as never).eq("id", s.id),
      ),
    );
    showToast("Order saved", "success");
  };

  const onDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const from = stages.findIndex((s) => s.id === dragId);
    const to = stages.findIndex((s) => s.id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...stages];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setStages(next.map((s, i) => ({ ...s, sequence_order: i + 1 })));
    setDragId(null);
    void persistOrder(next);
  };

  return (
    <AdminShell
      title="Spiritual Journey"
      crumb="Spiritual Journey"
      description="Define the milestones members progress through. Drag to reorder."
      actions={<Button onClick={startCreate}><Plus size={14} /> New stage</Button>}
    >
      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : stages.length === 0 ? (
        <EmptyState icon={<Sparkles size={40} />} title="No stages yet" description="Create your first spiritual journey milestone." actionLabel="New stage" action={startCreate} />
      ) : (
        <div className="space-y-2">
          {stages.map((s) => (
            <div
              key={s.id}
              draggable
              onDragStart={() => setDragId(s.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(s.id)}
              className={`rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 transition-opacity ${dragId === s.id ? "opacity-50" : ""}`}
            >
              <div className="flex items-center gap-3">
                <GripVertical size={16} className="text-slate-600 cursor-grab shrink-0" />
                <span className="text-xs text-slate-500 w-6">{s.sequence_order}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-white truncate">{s.name}</p>
                    <Badge variant={s.is_active ? "success" : "neutral"}>{s.is_active ? "Active" : "Hidden"}</Badge>
                  </div>
                  {s.description && <p className="text-xs text-slate-500 mt-0.5">{s.description}</p>}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="secondary" onClick={() => startEdit(s)}><Pencil size={14} /></Button>
                  <Button size="sm" variant="ghost" onClick={() => void toggle(s)}><Power size={14} /></Button>
                  <Button size="sm" variant="ghost" onClick={() => void remove(s)}><Trash2 size={14} /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit stage" : "New stage"}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} loading={saving} disabled={!form.name.trim()}>{editing ? "Save" : "Create"}</Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Input label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Water Baptism" />
          <Textarea label="Description" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
      </Modal>
    </AdminShell>
  );
}
