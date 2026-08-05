import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type CardGlow = "purple" | "green" | "amber" | "red" | "none";

export interface CardProps {
  children?: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  /** Optional controls rendered on the right of the header row. */
  action?: ReactNode;
  glow?: CardGlow;
  onClick?: () => void;
}

const glowMap: Record<CardGlow, string> = {
  purple: "shadow-[0_0_40px_-10px_rgba(124,58,237,0.5)]",
  green: "shadow-[0_0_40px_-10px_rgba(34,197,94,0.5)]",
  amber: "shadow-[0_0_40px_-10px_rgba(245,158,11,0.5)]",
  red: "shadow-[0_0_40px_-10px_rgba(244,63,94,0.5)]",
  none: "",
};

export function Card({
  children,
  className,
  title,
  subtitle,
  glow = "none",
  onClick,
}: CardProps) {
  const interactive = !!onClick;
  return (
    <motion.div
      whileHover={interactive ? { scale: 1.01 } : undefined}
      onClick={onClick}
      className={cn(
        "bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 transition-colors duration-200",
        interactive && "cursor-pointer hover:border-white/20",
        glowMap[glow],
        className,
      )}
    >
      {(title || subtitle) && (
        <div className="mb-4">
          {title && <h3 className="text-base font-semibold text-white">{title}</h3>}
          {subtitle && <p className="text-sm text-slate-400 mt-1">{subtitle}</p>}
        </div>
      )}
      {children}
    </motion.div>
  );
}
