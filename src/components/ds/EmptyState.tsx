import type { ReactNode } from "react";
import { Button } from "./Button";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: () => void;
  actionLabel?: string;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  actionLabel,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-16 px-6",
        className,
      )}
    >
      {icon && (
        <div className="text-slate-600 mb-4 [&>svg]:h-12 [&>svg]:w-12">{icon}</div>
      )}
      <h3 className="text-base font-semibold text-slate-300">{title}</h3>
      {description && (
        <p className="mt-1.5 text-sm text-slate-500 max-w-sm">{description}</p>
      )}
      {action && actionLabel && (
        <Button onClick={action} className="mt-6" variant="primary">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
