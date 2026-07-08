import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, required, className, id, ...props }, ref) => {
    const inputId = id || props.name;
    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="mb-1.5 block text-sm font-medium text-slate-300"
          >
            {label}
            {required && <span className="text-rose-400 ml-0.5">*</span>}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          required={required}
          className={cn(
            "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 outline-none transition-all duration-200",
            "focus:border-violet-500 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.15)]",
            error && "border-rose-500 focus:border-rose-500 focus:shadow-[0_0_0_3px_rgba(244,63,94,0.15)]",
            className,
          )}
          {...props}
        />
        {error ? (
          <p className="mt-1.5 text-xs text-rose-400">{error}</p>
        ) : hint ? (
          <p className="mt-1.5 text-xs text-slate-500">{hint}</p>
        ) : null}
      </div>
    );
  },
);
Input.displayName = "Input";
