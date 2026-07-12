import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw } from "lucide-react";
import type { FormDraft } from "@/hooks/useFormDraft";

function relTime(d: Date): string {
  const diff = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return `${Math.floor(diff / 86400)} day(s) ago`;
}

export interface DraftResumeBannerProps {
  draft: FormDraft | null;
  totalSteps?: number;
  onResume: () => void;
  onDiscard: () => void;
}

export function DraftResumeBanner({ draft, totalSteps = 6, onResume, onDiscard }: DraftResumeBannerProps) {
  return (
    <AnimatePresence>
      {draft && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
          className="mb-5 rounded-xl border border-amber-500/20 border-l-4 border-l-amber-500 bg-amber-500/[0.08] px-4 py-3.5 flex items-start gap-3"
        >
          <RotateCcw className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-amber-200 font-medium text-sm">You have an unfinished registration</div>
            <div className="text-xs text-amber-400/80 mt-0.5">
              Last saved {relTime(draft.lastSavedAt)} · {draft.completenessScore}% complete · Step {draft.currentStep} of {totalSteps}
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={onResume}
              className="text-white text-xs px-3 py-1.5 rounded-lg font-medium bg-gradient-to-br from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400"
            >
              Continue
            </button>
            <button
              onClick={() => {
                if (typeof window !== "undefined" && window.confirm("Start over and discard your saved progress?")) onDiscard();
              }}
              className="text-slate-500 text-xs px-2 hover:text-slate-300"
            >
              Start fresh
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
