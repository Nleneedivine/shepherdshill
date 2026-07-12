import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Clock } from "lucide-react";
import { Select, type SelectProps } from "@/components/ds/Select";
import { useFieldMemory } from "@/hooks/useFieldMemory";
import { useClickOutside } from "@/hooks/useClickOutside";

export interface SmartSelectProps extends SelectProps {
  fieldKey: string;
  onValueChange?: (value: string) => void;
}

export function SmartSelect({ fieldKey, onValueChange, onChange, value, children, ...rest }: SmartSelectProps) {
  const { recentValues, saveValue, clearMemory } = useFieldMemory(fieldKey);
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<string>((value as string | undefined) ?? "");
  const wrapRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (value !== undefined) setCurrent(value as string);
  }, [value]);

  useClickOutside(wrapRef, () => setOpen(false), open);

  const handleChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setCurrent(e.target.value);
    onChange?.(e);
    onValueChange?.(e.target.value);
    if (e.target.value) void saveValue(e.target.value);
  };

  return (
    <div ref={wrapRef} className="relative w-full">
      {recentValues.length > 0 && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="mb-1 text-[10px] uppercase tracking-wider text-slate-500 hover:text-slate-300 transition-colors"
        >
          Recent · {recentValues.length}
        </button>
      )}
      <AnimatePresence>
        {open && recentValues.length > 0 && (
          <motion.div
            initial={reduce ? { opacity: 1 } : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={{ duration: reduce ? 0 : 0.15 }}
            className="mb-2 rounded-xl border border-white/10 bg-[#0d1117]/95 backdrop-blur-xl shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-3 pt-2 pb-1">
              <span className="text-[10px] uppercase tracking-wider text-slate-500">Recent picks</span>
              <button
                type="button"
                onClick={() => { void clearMemory(); setOpen(false); }}
                className="text-[10px] text-slate-600 hover:text-rose-400 transition-colors"
              >
                Clear
              </button>
            </div>
            <div className="flex flex-wrap gap-1 p-2">
              {recentValues.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => {
                    setCurrent(v);
                    onValueChange?.(v);
                    onChange?.({ target: { value: v } } as unknown as ChangeEvent<HTMLSelectElement>);
                    setOpen(false);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs bg-white/5 hover:bg-white/10 text-slate-300"
                >
                  <Clock className="w-3 h-3 text-slate-500" /> {v}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <Select {...rest} value={current} onChange={handleChange}>
        {children}
      </Select>
    </div>
  );
}
