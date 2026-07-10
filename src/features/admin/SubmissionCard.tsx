import { motion } from "framer-motion";
import { Check, Eye, X } from "lucide-react";
import { Avatar, Badge, Button } from "@/components/ds";
import type { Submission } from "./types";

interface Props {
  submission: Submission;
  selected: boolean;
  onSelect: (v: boolean) => void;
  onReview: () => void;
  onApprove: () => void;
  onReject: () => void;
  approving?: boolean;
}

function relativeTime(iso: string) {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

const statusColor: Record<string, "amber" | "green" | "rose" | "violet" | "blue"> = {
  pending: "amber",
  ai_cleared: "blue",
  flagged: "amber",
  held: "amber",
  approved: "green",
  rejected: "rose",
};

export function SubmissionCard({ submission, selected, onSelect, onReview, onApprove, onReject, approving }: Props) {
  const name = `${submission.first_name ?? ""} ${submission.last_name ?? ""}`.trim() || "Unnamed";
  const status = submission.verification_status;
  const canQuickApprove = status === "ai_cleared" || status === "pending";
  const score = submission.ai_completeness_score ?? 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -30 }}
      className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex flex-col md:flex-row md:items-center gap-4"
    >
      <div className="flex items-center gap-3 md:w-1/3">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect(e.target.checked)}
          className="h-4 w-4 rounded border-white/20 bg-white/5 accent-violet-600"
        />
        <Avatar name={name} src={submission.profile_photo_url ?? undefined} size="md" />
        <div className="min-w-0">
          <div className="font-medium text-white truncate">{name}</div>
          <div className="text-xs text-slate-400 truncate">{submission.phone_primary}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 md:flex-1">
        <span className="text-xs text-slate-400">{relativeTime(submission.submitted_at)}</span>
        {submission.membership_stage && (
          <Badge tone="violet">{submission.membership_stage.replace(/_/g, " ")}</Badge>
        )}
        <Badge tone={score >= 80 ? "green" : score >= 50 ? "amber" : "rose"}>{score}% complete</Badge>
        {submission.ai_duplicate_flag && <Badge tone="amber">Possible duplicate</Badge>}
      </div>

      <div className="flex items-center gap-2 md:justify-end">
        <Badge tone={statusColor[status] ?? "violet"}>{status.replace(/_/g, " ")}</Badge>
        <Button size="sm" variant="secondary" onClick={onReview}>
          <Eye size={14} /> Review
        </Button>
        {canQuickApprove && (
          <Button size="sm" variant="success" onClick={onApprove} loading={approving}>
            <Check size={14} /> Approve
          </Button>
        )}
        <Button size="sm" variant="danger" onClick={onReject}>
          <X size={14} /> Reject
        </Button>
      </div>
    </motion.div>
  );
}
