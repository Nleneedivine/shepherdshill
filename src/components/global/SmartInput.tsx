import { useEffect, useRef, useState, type ChangeEvent, type FocusEvent } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ChevronDown, Clock, CornerDownLeft } from "lucide-react";
import { Input, type InputProps } from "@/components/ds/Input";
import { useFieldMemory } from "@/hooks/useFieldMemory";
import { useClickOutside } from "@/hooks/useClickOutside";

export interface SmartInputProps extends InputProps {
  fieldKey: string;
  onValueChange?: (value: string) => void;
}

export function SmartInput({ fieldKey, onValueChange, onChange, onFocus, onBlur, value, ...rest }: SmartInputProps) {
  const { recentValues, saveValue, clearMemory } = useFieldMemory(fieldKey);
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<string>((value as string | undefined) ?? "");
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const reduce = useReducedMotion();
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (value !== undefined) setCurrent(value as string);
  }, [value]);

  useClickOutside(wrapRef, () => setOpen(false), open);

  const handleFocus = (e: FocusEvent<HTMLInputElement>) => {
    if (recentValues.length > 0) setOpen(true);
    onFocus?.(e);
  };
  const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    blurTimer.current = setTimeout(() => {
      setOpen(false);
      if (current) void saveValue(current);
    }, 150);
    onBlur?.(e);
  };
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setCurrent(e.target.value);
    onChange?.(e);
    onValueChange?.(e.target.value);
  };
  const pick = (v: string) => {
    setCurrent(v);
    const el = inputRef.current;
    if (el) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      setter?.call(el, v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
    onValueChange?.(v);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative w-full">
      <div className="relative">
        <Input
          {...rest}
          ref={inputRef}
          value={current}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
        {recentValues.length > 0 && !open && (
          <ChevronDown
            className="pointer-events-none absolute right-3 bottom-3.5 w-3 h-3 text-slate-600"
          />
        )}
      </div>
      <AnimatePresence>
        {open && recentValues.length > 0 && (
          <motion.div
            initial={reduce ? { opacity: 1 } : { opacity: 0, y: -4, scaleY: 0.95 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, scaleY: 0.95 }}
            transition={{ duration: reduce ? 0 : 0.15 }}
            style={{ transformOrigin: "top" }}
            className="absolute top-full left-0 right-0 z-50 mt-1 overflow-hidden rounded-xl border border-white/10 bg-[#0d1117]/95 backdrop-blur-xl shadow-2xl"
          >
            <div className="flex items-center justify-between px-3 pt-2 pb-1">
              <span className="text-[10px] uppercase tracking-wider text-slate-500">Recent</span>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); void clearMemory(); setOpen(false); }}
                className="text-[10px] text-slate-600 hover:text-rose-400 transition-colors"
              >
                Clear
              </button>
            </div>
            <ul>
              {recentValues.map((v) => (
                <li key={v}>
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); pick(v); }}
                    className="group w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm text-slate-300 hover:bg-white/5 active:bg-white/10 transition-colors"
                  >
                    <Clock className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
                    <span className="flex-1 truncate">{v}</span>
                    <CornerDownLeft className="w-3 h-3 text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity" />
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
