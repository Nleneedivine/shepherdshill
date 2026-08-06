import { useEffect, useState } from "react";
import { Modal, Button, Select, Textarea } from "@/components/ds";
import { supabase } from "@/integrations/supabase/client";
import { useToastContext } from "@/components/ds/Toast";
import { TERMS } from "@/constants/terminology";

interface Props {
  open: boolean;
  onClose: () => void;
  memberId: string;
  memberName: string;
  currentBranchId: string | null;
  currentCellGroupId: string | null;
  onSubmitted?: () => void;
}

interface Named { id: string; name: string }

/** Starts a transfer request for a member; a senior pastor approves it later. */
export function TransferModal({
  open,
  onClose,
  memberId,
  memberName,
  currentBranchId,
  currentCellGroupId,
  onSubmitted,
}: Props) {
  const { showToast } = useToastContext();
  const [branches, setBranches] = useState<Named[]>([]);
  const [groups, setGroups] = useState<Named[]>([]);
  const [type, setType] = useState<"internal" | "external">("internal");
  const [toBranch, setToBranch] = useState("");
  const [toGroup, setToGroup] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const [b, g] = await Promise.all([
        supabase.from("branches").select("id, name").order("name"),
        supabase.from("cell_groups").select("id, name").eq("is_active", true).order("name"),
      ]);
      setBranches((b.data ?? []) as Named[]);
      setGroups((g.data ?? []) as Named[]);
    })();
  }, [open]);

  const submit = async () => {
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("member_transfers").insert({
        member_id: memberId,
        from_branch_id: currentBranchId,
        from_cell_group_id: currentCellGroupId,
        to_branch_id: type === "internal" ? toBranch || null : null,
        to_cell_group_id: type === "internal" ? toGroup || null : null,
        transfer_type: type,
        reason: reason.trim() || null,
        status: "pending",
        requested_by: auth.user?.id ?? null,
      } as never);
      if (error) throw error;
      showToast("Transfer request submitted for approval", "success");
      setReason("");
      setToBranch("");
      setToGroup("");
      onSubmitted?.();
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not submit the request", "error");
    } finally {
      setSaving(false);
    }
  };

  const valid = type === "external" || !!toBranch || !!toGroup;

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={`Transfer ${memberName}`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={saving} disabled={!valid}>Submit request</Button>
        </div>
      }
    >
      <div className="space-y-3">
        <Select label="Transfer type" value={type} onChange={(e) => setType(e.target.value as "internal" | "external")}>
          <option value="internal">Internal (another branch or centre)</option>
          <option value="external">External (leaving this church)</option>
        </Select>
        {type === "internal" && (
          <>
            <Select label="Destination branch" value={toBranch} onChange={(e) => setToBranch(e.target.value)}>
              <option value="">Keep current branch</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
            <Select label={`Destination ${TERMS.CELL_GROUP}`} value={toGroup} onChange={(e) => setToGroup(e.target.value)}>
              <option value="">Keep current centre</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </Select>
          </>
        )}
        <Textarea label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Why is this transfer needed?" />
        <p className="text-xs text-slate-500">A senior pastor must approve before the move takes effect.</p>
      </div>
    </Modal>
  );
}
