import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import type { ComponentType, ReactNode } from "react";
import {
  Database, GitBranch, LayoutDashboard, LogOut, ScrollText, Settings, Shield,
  ShieldAlert, ToggleRight, Users,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ds";

interface NavItem { label: string; to: string; icon: ComponentType<{ size?: number }>; }

const NAV: NavItem[] = [
  { label: "System Overview", to: "/super-admin", icon: LayoutDashboard },
  { label: "Branch Management", to: "/super-admin/branches", icon: GitBranch },
  { label: "Role Management", to: "/super-admin/roles", icon: Shield },
  { label: "User Management", to: "/super-admin/users", icon: Users },
  { label: "Feature Toggles", to: "/super-admin/features", icon: ToggleRight },
  { label: "Audit Logs", to: "/super-admin/audit", icon: ScrollText },
  { label: "System Health", to: "/super-admin/health", icon: Database },
  { label: "System Settings", to: "/super-admin/settings", icon: Settings },
];

export function SuperAdminShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen text-white relative" style={{ backgroundColor: "#080c16" }}>
      <div className="fixed top-0 inset-x-0 h-0.5 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-blue-500 z-50" />

      <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 flex-col bg-black/50 backdrop-blur-xl border-r border-violet-500/20 z-40">
        <div className="p-4 border-b border-violet-500/20">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500 flex items-center justify-center">
              <ShieldAlert size={18} className="text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">Church Console</div>
              <div className="text-[10px] uppercase tracking-widest text-violet-400 font-semibold">Super Admin</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
          {NAV.map((n) => {
            const active = path === n.to;
            const Icon = n.icon;
            return (
              <Link
                key={n.to} to={n.to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "bg-violet-500/15 text-violet-300 border-l-2 border-violet-500 pl-[10px] font-medium"
                    : "text-violet-400/70 hover:text-violet-300 hover:bg-violet-500/5",
                )}
              >
                <Icon size={18} />
                <span className="truncate">{n.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-violet-500/20 p-3 flex items-center gap-3">
          <Avatar name={user?.profile?.full_name ?? user?.email ?? "SA"} size="sm" />
          <div className="flex-1 min-w-0">
            <div className="text-sm text-white truncate">{user?.profile?.full_name ?? "Super Admin"}</div>
            <div className="text-xs text-violet-400/70 truncate">{user?.email}</div>
          </div>
          <button
            className="text-violet-400 hover:text-white"
            onClick={async () => { await logout(); navigate({ to: "/auth" }); }}
            aria-label="Log out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <main className="md:ml-64 pt-4 md:pt-6 px-4 md:px-8 pb-12">{children}</main>
    </div>
  );
}
