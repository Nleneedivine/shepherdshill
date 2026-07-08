import { forwardRef, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, required, className, id, children, ...props }, ref) => {
    const selectId = id || props.name;
    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={selectId}
            className="mb-1.5 block text-sm font-medium text-slate-300"
          >
            {label}
            {required && <span className="text-rose-400 ml-0.5">*</span>}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            required={required}
            className={cn(
              "w-full appearance-none bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-10 text-white outline-none transition-all duration-200",
              "focus:border-violet-500 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.15)]",
              "[&>option]:bg-[#0d1117] [&>option]:text-white",
              error && "border-rose-500",
              className,
            )}
            {...props}
          >
            {children}
          </select>
          <ChevronDown
            size={16}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
        </div>
        {error ? (
          <p className="mt-1.5 text-xs text-rose-400">{error}</p>
        ) : hint ? (
          <p className="mt-1.5 text-xs text-slate-500">{hint}</p>
        ) : null}
      </div>
    );
  },
);
Select.displayName = "Select";
