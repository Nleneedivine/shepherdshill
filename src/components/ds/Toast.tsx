import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DURATION = 4000;

const typeMap: Record<ToastType, { border: string; icon: ReactNode; bar: string }> = {
  success: {
    border: "border-l-emerald-500",
    icon: <CheckCircle2 size={18} className="text-emerald-400" />,
    bar: "bg-emerald-500",
  },
  error: {
    border: "border-l-rose-500",
    icon: <AlertCircle size={18} className="text-rose-400" />,
    bar: "bg-rose-500",
  },
  warning: {
    border: "border-l-amber-500",
    icon: <AlertTriangle size={18} className="text-amber-400" />,
    bar: "bg-amber-500",
  },
  info: {
    border: "border-l-blue-500",
    icon: <Info size={18} className="text-blue-400" />,
    bar: "bg-blue-500",
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, type }]);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="pointer-events-none fixed top-4 right-4 z-[100] flex flex-col gap-2 w-[calc(100vw-2rem)] max-w-sm">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <ToastRow key={t.id} toast={t} onDismiss={() => remove(t.id)} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

function ToastRow({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const cfg = typeMap[toast.type];
  useEffect(() => {
    const timer = setTimeout(onDismiss, DURATION);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <motion.div
      layout
      initial={{ x: 400, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 400, opacity: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
      className={cn(
        "pointer-events-auto relative overflow-hidden rounded-xl border border-white/10 border-l-4 bg-white/5 backdrop-blur-xl shadow-xl",
        cfg.border,
      )}
    >
      <div className="flex items-start gap-3 p-4 pr-10">
        <div className="mt-0.5">{cfg.icon}</div>
        <p className="flex-1 text-sm text-white">{toast.message}</p>
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 text-slate-400 hover:text-white transition-colors"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
      <motion.div
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{ duration: DURATION / 1000, ease: "linear" }}
        style={{ transformOrigin: "left" }}
        className={cn("h-0.5 w-full", cfg.bar)}
      />
    </motion.div>
  );
}

export function useToastContext() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
