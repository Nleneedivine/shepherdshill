import { useState } from "react";
import { Modal, Textarea, Button } from "@/components/ds";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
}

export function RejectModal({ open, onClose, onConfirm }: Props) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!reason.trim()) return;
    setLoading(true);
    try {
      await onConfirm(reason.trim());
      setReason("");
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Reject Submission">
      <div className="space-y-4">
        <Textarea
          label="Rejection reason"
          required
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Explain why this submission is being rejected…"
          rows={4}
        />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={handleConfirm} loading={loading} disabled={!reason.trim()}>
            Confirm Rejection
          </Button>
        </div>
      </div>
    </Modal>
  );
}
