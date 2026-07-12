import { Check, Cloud, Loader2 } from "lucide-react";

function relTime(d: Date): string {
  const diff = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return `${Math.floor(diff / 86400)} day(s) ago`;
}

export interface FormSaveIndicatorProps {
  isSaving: boolean;
  lastSaved: Date | null;
  draftExists?: boolean;
  fixed?: boolean;
}

export function FormSaveIndicator({ isSaving, lastSaved, draftExists, fixed }: FormSaveIndicatorProps) {
  return (
    <div
      className={
        (fixed ? "fixed bottom-0 left-0 right-0 z-30 " : "") +
        "h-8 flex items-center justify-between px-3 border-t border-white/[0.06] bg-black/40 backdrop-blur-sm text-xs"
      }
    >
      <div className="flex items-center gap-2 text-slate-500">
        {isSaving ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Saving…</span>
          </>
        ) : lastSaved ? (
          <>
            <Check className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-slate-600">All changes saved · {relTime(lastSaved)}</span>
          </>
        ) : (
          <>
            <Cloud className="w-3.5 h-3.5 text-slate-700" />
            <span className="text-slate-700">Changes will be saved automatically</span>
          </>
        )}
      </div>
      {draftExists && (
        <div className="flex items-center gap-1.5 text-amber-600">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />
          <span>Draft active</span>
        </div>
      )}
    </div>
  );
}
