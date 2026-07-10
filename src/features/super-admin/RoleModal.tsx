import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Modal, Button, Badge } from "@/components/ds";
import { supabase } from "@/integrations/supabase/client";
import { useToastContext } from "@/components/ds/Toast";
import type { AppRole } from "@/types";
import type { UserRow } from "./useUsers";

interface Props {
  user: UserRow | null;
  currentUserId: string | undefined;
  callerIsSuperAdmin: boolean;
  onClose: () => void;
  onSaved: () => void;
}

type Choice = "member" | "admin" | "super_admin" | "custom";
const CUSTOM_ROLES: AppRole[] = ["worker", "pastoral_team", "senior_pastor"];

export function RoleModal({ user, currentUserId, callerIsSuperAdmin, onClose, onSaved }: Props) {
  const { showToast } = useToastContext();
  const [choice, setChoice] = useState<Choice>("member");
  const [customRole, setCustomRole] = useState<AppRole>("worker");
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setConfirmed(false);
    if (user.primary_role === "super_admin") setChoice("super_admin");
    else if (user.primary_role === "admin") setChoice("admin");
    else if (CUSTOM_ROLES.includes(user.primary_role)) {
      setChoice("custom");
      setCustomRole(user.primary_role);
    } else setChoice("member");
  }, [user]);

  if (!user) return null;

  const isSelf = currentUserId === user.id;
  const needsConfirm = choice === "super_admin";
  const saveDisabled = saving || isSelf || (needsConfirm && !confirmed);

  const targetRole: AppRole = choice === "custom" ? customRole : (choice as AppRole);

  const handleSave = async () => {
    if (isSelf) {
      showToast("You cannot change your own role.", "error");
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc("assign_user_role", {
      p_target_user_id: user.id,
      p_new_role: targetRole,
      p_branch_id: user.branch_id,
    } as never);
    setSaving(false);
    if (error) {
      showToast(error.message, "error");
      return;
    }
    showToast(`Role updated to ${targetRole.replace(/_/g, " ")}`, "success");
    onSaved();
    onClose();
  };

  const label = user.full_name || user.email || "user";

  return (
    <Modal isOpen={!!user} onClose={onClose} title={`Manage Access — ${label}`}>
      <div className="space-y-5">
        {isSelf && (
          <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            <AlertTriangle size={16} className="mt-0.5" />
            <div>You cannot change your own role. Ask another super admin to make this change.</div>
          </div>
        )}

        <div className="flex items-center gap-2 text-sm text-slate-300">
          <span className="text-slate-400">Current role:</span>
          <Badge variant={user.primary_role === "super_admin" ? "purple" : "info"}>
            {user.primary_role.replace(/_/g, " ")}
          </Badge>
          {user.branch_name && <span className="text-xs text-slate-500">· {user.branch_name}</span>}
        </div>

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-white mb-2">New role</legend>

          <label className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/5 p-3 cursor-pointer hover:border-white/20">
            <input type="radio" name="role" checked={choice === "member"} onChange={() => setChoice("member")} className="mt-1 accent-violet-600" />
            <div>
              <div className="text-sm font-medium text-white">Member</div>
              <div className="text-xs text-slate-400">Basic access to their own profile and portal.</div>
            </div>
          </label>

          <label className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/5 p-3 cursor-pointer hover:border-white/20">
            <input type="radio" name="role" checked={choice === "admin"} onChange={() => setChoice("admin")} className="mt-1 accent-violet-600" />
            <div>
              <div className="text-sm font-medium text-white">Admin</div>
              <div className="text-xs text-slate-400">Full branch management — members, verifications, cell groups.</div>
            </div>
          </label>

          {callerIsSuperAdmin && (
            <label className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/5 p-3 cursor-pointer hover:border-white/20">
              <input type="radio" name="role" checked={choice === "super_admin"} onChange={() => setChoice("super_admin")} className="mt-1 accent-violet-600" />
              <div>
                <div className="text-sm font-medium text-white">Super Admin</div>
                <div className="text-xs text-slate-400">God-level access. Only super admins can grant this.</div>
              </div>
            </label>
          )}

          <label className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/5 p-3 cursor-pointer hover:border-white/20">
            <input type="radio" name="role" checked={choice === "custom"} onChange={() => setChoice("custom")} className="mt-1 accent-violet-600" />
            <div className="flex-1">
              <div className="text-sm font-medium text-white">Custom role</div>
              <div className="text-xs text-slate-400 mb-2">Worker, pastoral team, or senior pastor.</div>
              {choice === "custom" && (
                <select
                  value={customRole}
                  onChange={(e) => setCustomRole(e.target.value as AppRole)}
                  className="w-full rounded-lg bg-black/30 border border-white/10 text-white text-sm px-3 py-2"
                >
                  {CUSTOM_ROLES.map((r) => (
                    <option key={r} value={r}>{r.replace(/_/g, " ")}</option>
                  ))}
                </select>
              )}
            </div>
          </label>
        </fieldset>

        {needsConfirm && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="mt-0.5" />
              <div>
                This grants full unrestricted access to the entire system. Only grant this to trusted developers or senior leadership.
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-amber-100">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="accent-amber-500" />
              I understand the implications of this access level
            </label>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} loading={saving} disabled={saveDisabled}>
            Save changes
          </Button>
        </div>
      </div>
    </Modal>
  );
}
