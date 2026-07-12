import { useEffect, useRef, useState, type ChangeEvent, type FocusEvent } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Clock } from "lucide-react";
import { Textarea, type TextareaProps } from "@/components/ds/Textarea";
import { useFieldMemory } from "@/hooks/useFieldMemory";
import { useClickOutside } from "@/hooks/useClickOutside";

export interface SmartTextareaProps extends TextareaProps {
  fieldKey: string;
  onValueChange?: (value: string) => void;
}

export function SmartTextarea({ fieldKey, onValueChange, onChange, onFocus, onBlur, value, ...rest }: SmartTextareaProps) {
  const { recentValues, saveValue, clearMemory } = useFieldMemory(fieldKey);
  const shown = recentValues.slice(0, 3);
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<string>((value as string | undefined) ?? "");
  const wrapRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (value !== undefined) setCurrent(value as string);
  }, [value]);

  useClickOutside(wrapRef, () => setOpen(false), open);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setCurrent(e.target.value);
    onChange?.(e);
    onValueChange?.(e.target.value);
  };
  const handleFocus = (e: FocusEvent<HTMLTextAreaElement>) => {
    if (shown.length > 0) setOpen(true);
    onFocus?.(e);
  };
  const handleBlur = (e: FocusEvent<HTMLTextAreaElement>) => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    blurTimer.current = setTimeout(() => {
      setOpen(false);
      if (current) void saveValue(current);
    }, 150);
    onBlur?.(e);
  };
  const pick = (v: string) => {
    setCurrent(v);
    onValueChange?.(v);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative w-full">
      <Textarea
        {...rest}
        value={current}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
      <AnimatePresence>
        {open && shown.length > 0 && (
          <motion.div
            initial={reduce ? { opacity: 1 } : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={{ duration: reduce ? 0 : 0.15 }}
            className="absolute top-full left-0 right-0 z-50 mt-1 overflow-hidden rounded-xl border border-white/10 bg-[#0d1117]/95 backdrop-blur-xl shadow-2xl"
          >
            <div className="flex items-center justify-between px-3 pt-2 pb-1">
              <span className="text-[10px] uppercase tracking-wider text-slate-500">Recent entries</span>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); void clearMemory(); setOpen(false); }}
                className="text-[10px] text-slate-600 hover:text-rose-400"
              >Clear</button>
            </div>
            <ul>
              {shown.map((v) => (
                <li key={v}>
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); pick(v); }}
                    className="w-full flex items-start gap-2 px-3 py-2 text-left text-xs text-slate-300 hover:bg-white/5"
                  >
                    <Clock className="w-3 h-3 mt-0.5 text-slate-600 flex-shrink-0" />
                    <span className="line-clamp-1">{v.length > 60 ? `${v.slice(0, 60)}...` : v}</span>
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
