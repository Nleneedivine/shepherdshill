import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Check, MessageCircle, X } from "lucide-react";
import { useState } from "react";
import { Button, Badge } from "@/components/ds";
import type { Submission } from "./types";

interface Props {
  submission: Submission | null;
  onClose: () => void;
  onApprove: (edited: Record<string, unknown>) => Promise<void>;
  onReject: () => void;
  onRequestInfo: () => void;
  approving?: boolean;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-2 border-b border-white/5">
      <dt className="text-xs text-slate-400 uppercase tracking-wide">{label}</dt>
      <dd className="col-span-2 text-sm text-white">{value ?? <span className="text-slate-500">—</span>}</dd>
    </div>
  );
}

function j(obj: Record<string, unknown> | null | undefined, key: string): string {
  const v = obj?.[key];
  return v == null || v === "" ? "" : String(v);
}

export function ReviewPanel({ submission, onClose, onApprove, onReject, onRequestInfo, approving }: Props) {
  const [edits, setEdits] = useState<Record<string, unknown>>({});

  if (!submission) return null;

  const setEdit = (k: string, v: unknown) => setEdits((prev) => ({ ...prev, [k]: v }));

  const familySuggestions = Array.isArray(submission.ai_family_match_suggestions)
    ? (submission.ai_family_match_suggestions as Array<{ id?: string; name?: string }>)
    : [];

  return (
    <AnimatePresence>
      {submission && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/60 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="fixed z-50 bg-[#0d1117] border-l border-white/10 flex flex-col
                       right-0 top-0 bottom-0 w-full md:w-[480px]
                       max-md:top-auto max-md:h-[90vh] max-md:rounded-t-3xl max-md:border-l-0 max-md:border-t"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  {(submission.first_name ?? "") + " " + (submission.last_name ?? "")}
                </h2>
                <p className="text-xs text-slate-400">Submission review</p>
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-white" aria-label="Close">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {submission.ai_duplicate_flag && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex gap-3">
                  <AlertTriangle className="text-amber-400 flex-shrink-0" size={20} />
                  <div className="flex-1">
                    <div className="text-sm text-amber-100 font-medium">Possible duplicate</div>
                    <div className="text-xs text-amber-200/80 mt-1">
                      {submission.ai_processing_notes ?? "AI flagged this submission as a likely duplicate."}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant="secondary">Merge</Button>
                      <Button size="sm" variant="ghost">Keep separate</Button>
                    </div>
                  </div>
                </div>
              )}

              {familySuggestions.length > 0 && (
                <div>
                  <h3 className="text-xs uppercase text-slate-400 mb-2">Family match suggestions</h3>
                  <div className="space-y-2">
                    {familySuggestions.map((s, i) => (
                      <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center justify-between">
                        <div className="text-sm text-white">{s.name ?? "Unknown"}</div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="secondary">Confirm</Button>
                          <Button size="sm" variant="ghost">Dismiss</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <section>
                <h3 className="text-xs uppercase text-slate-400 mb-1">Personal</h3>
                <dl>
                  <Row label="First name" value={j(submission.personal, "firstName")} />
                  <Row label="Last name" value={j(submission.personal, "lastName")} />
                  <Row label="DOB" value={j(submission.personal, "dob")} />
                  <Row label="Gender" value={j(submission.personal, "gender")} />
                </dl>
              </section>

              <section>
                <h3 className="text-xs uppercase text-slate-400 mb-1">Contact</h3>
                <dl>
                  <Row
                    label="Phone"
                    value={
                      <input
                        defaultValue={submission.phone_primary ?? ""}
                        onChange={(e) => setEdit("phone_primary", e.target.value)}
                        className="w-full bg-transparent border-b border-white/10 focus:border-violet-500 outline-none text-sm"
                      />
                    }
                  />
                  <Row label="Email" value={j(submission.contact, "email")} />
                  <Row label="State" value={j(submission.contact, "state")} />
                  <Row label="City" value={j(submission.contact, "city")} />
                </dl>
              </section>

              <section>
                <h3 className="text-xs uppercase text-slate-400 mb-1">Church life</h3>
                <dl>
                  <Row label="Stage" value={j(submission.church_life, "membershipStage")} />
                  <Row label="Cell group" value={j(submission.church_life, "cellGroupText")} />
                  <Row label="Attendance" value={j(submission.church_life, "attendanceDuration")} />
                </dl>
              </section>

              <section>
                <h3 className="text-xs uppercase text-slate-400 mb-1">Spiritual</h3>
                <dl>
                  <Row label="Salvation" value={j(submission.spiritual, "salvation")} />
                  <Row label="Baptised" value={j(submission.spiritual, "baptised")} />
                </dl>
              </section>

              <section>
                <h3 className="text-xs uppercase text-slate-400 mb-1">AI Flags</h3>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={submission.ai_duplicate_flag ? "warning" : "success"}>
                    Duplicate: {submission.ai_duplicate_flag ? "yes" : "no"}
                  </Badge>
                  <Badge variant="info">Score: {submission.ai_completeness_score ?? 0}%</Badge>
                  {submission.ai_cell_group_suggestion_id && (
                    <Badge variant="purple">Cell group suggestion</Badge>
                  )}
                </div>
                {submission.ai_processing_notes && (
                  <p className="text-xs text-slate-400 mt-2">{submission.ai_processing_notes}</p>
                )}
              </section>
            </div>

            <div className="border-t border-white/10 p-3 flex gap-2">
              <Button variant="danger" onClick={onReject}>
                <X size={14} /> Reject
              </Button>
              <Button variant="secondary" onClick={onRequestInfo}>
                <MessageCircle size={14} /> Request info
              </Button>
              <Button className="flex-1" onClick={() => onApprove(edits)} loading={approving}>
                <Check size={14} /> Approve
              </Button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
