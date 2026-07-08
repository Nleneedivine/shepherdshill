import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  isIcon?: boolean;
  children?: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-r from-violet-600 to-blue-500 text-white hover:shadow-[0_0_20px_rgba(124,58,237,0.4)] hover:scale-[1.02] active:scale-[0.98]",
  secondary:
    "bg-white/10 border border-white/20 text-white hover:bg-white/15",
  danger:
    "bg-rose-500/20 border border-rose-500/30 text-rose-400 hover:bg-rose-500/30",
  ghost: "text-slate-400 hover:text-white hover:bg-white/5",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "text-sm px-3 py-1.5",
  md: "text-sm px-4 py-2",
  lg: "text-base px-6 py-3",
};

const iconSizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 w-8 p-0",
  md: "h-10 w-10 p-0",
  lg: "h-12 w-12 p-0",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = "primary", size = "md", loading, isIcon, className, children, disabled, ...props },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "relative inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:opacity-60 disabled:pointer-events-none",
          isIcon ? iconSizeClasses[size] : sizeClasses[size],
          variantClasses[variant],
          loading && "pointer-events-none",
          className,
        )}
        {...props}
      >
        {loading ? <Spinner size="sm" color="white" /> : children}
      </button>
    );
  },
);
Button.displayName = "Button";
