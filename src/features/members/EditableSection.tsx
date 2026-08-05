import { useEffect, useMemo, useState } from "react";
import { Edit, Save, X } from "lucide-react";
import { Card, Button, Input, Select } from "@/components/ds";
import { supabase } from "@/integrations/supabase/client";
import { useToastContext } from "@/components/ds/Toast";

export interface EditableField {
  key: string;
  label: string;
  type?: "text" | "date" | "email" | "tel" | "select";
  options?: { value: string; label: string }[];
  readOnly?: boolean;
  format?: (value: unknown) => string;
}

interface Props {
  title: string;
  memberId: string;
  fields: EditableField[];
  values: Record<string, unknown>;
  canEdit: boolean;
  onSaved: (patch: Record<string, unknown>) => void;
  onDirtyChange?: (dirty: boolean) => void;
  children?: React.ReactNode;
}

function toInput(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

/** Normalises Nigerian phone numbers for duplicate comparison. */
function normalisePhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-()]/g, "");
  if (cleaned.startsWith("+234")) return cleaned;
  if (cleaned.startsWith("234")) return `+${cleaned}`;
  if (cleaned.startsWith("0") && cleaned.length === 11) return `+234${cleaned.slice(1)}`;
  if (cleaned.length === 10) return `+234${cleaned}`;
  return cleaned;
}

const PHONE_KEYS = ["phone_primary", "phone_secondary"];

export function EditableSection({
  title,
  memberId,
  fields,
  values,
  canEdit,
  onSaved,
  onDirtyChange,
  children,
}: Props) {
  const { showToast } = useToastContext();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const baseline = useMemo(() => {
    const b: Record<string, string> = {};
    for (const f of fields) b[f.key] = toInput(values[f.key]);
    return b;
  }, [fields, values]);

  const dirty = editing && fields.some((f) => (draft[f.key] ?? "") !== (baseline[f.key] ?? ""));

  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);

  const startEdit = () => {
    setDraft({ ...baseline });
    setErrors({});
    setEditing(true);
  };

  const cancel = () => {
    if (dirty && !window.confirm("Discard your unsaved changes to this section?")) return;
    setEditing(false);
    setErrors({});
  };

  const save = async () => {
    setSaving(true);
    setErrors({});
    try {
      const patch: Record<string, unknown> = {};
      for (const f of fields) {
        if (f.readOnly) continue;
        const next = (draft[f.key] ?? "").trim();
        if (next === (baseline[f.key] ?? "")) continue;
        patch[f.key] = PHONE_KEYS.includes(f.key) && next ? normalisePhone(next) : next === "" ? null : next;
      }

      if (Object.keys(patch).length === 0) {
        setEditing(false);
        return;
      }

      // Duplicate phone-number validation
      for (const key of PHONE_KEYS) {
        const value = patch[key];
        if (typeof value !== "string" || !value) continue;
        const { data: clash } = await supabase
          .from("members")
          .select("id, first_name, last_name")
          .eq("phone_primary", value)
          .neq("id", memberId)
          .maybeSingle();
        if (clash) {
          const c = clash as { first_name: string; last_name: string };
          setErrors({ [key]: `Already used by ${c.first_name} ${c.last_name}` });
          showToast("That phone number belongs to another member", "error");
          return;
        }
      }

      const { error } = await supabase
        .from("members")
        .update(patch as never)
        .eq("id", memberId);
      if (error) throw error;

      onSaved(patch);
      showToast(`${title} updated`, "success");
      setEditing(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not save changes", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card
      title={title}
      action={
        !canEdit ? undefined : editing ? (
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={cancel} disabled={saving}>
              <X size={14} /> Cancel
            </Button>
            <Button size="sm" onClick={save} loading={saving}>
              <Save size={14} /> Save
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="secondary" onClick={startEdit}>
            <Edit size={14} /> Edit
          </Button>
        )
      }
    >
      {editing ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {fields
            .filter((f) => !f.readOnly)
            .map((f) =>
              f.type === "select" ? (
                <Select
                  key={f.key}
                  label={f.label}
                  value={draft[f.key] ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                >
                  <option value="">—</option>
                  {(f.options ?? []).map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              ) : (
                <Input
                  key={f.key}
                  label={f.label}
                  type={f.type ?? "text"}
                  value={draft[f.key] ?? ""}
                  error={errors[f.key]}
                  onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                />
              ),
            )}
        </div>
      ) : (
        <div className="space-y-0.5">
          {fields.map((f) => {
            const raw = values[f.key];
            const display = f.format ? f.format(raw) : toInput(raw);
            return (
              <div
                key={f.key}
                className="flex items-start justify-between py-2 border-b border-white/5 last:border-0"
              >
                <span className="text-xs uppercase tracking-wider text-slate-500">{f.label}</span>
                <span className="text-sm text-slate-200 text-right ml-4">{display || "—"}</span>
              </div>
            );
          })}
          {children}
        </div>
      )}
    </Card>
  );
}
