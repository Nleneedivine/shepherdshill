import type { ComponentType, ReactNode } from "react";
import { ChevronsLeft, ChevronsRight, LogOut, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "./Avatar";
import { ITProjectButton } from "@/components/global/ITProjectButton";

export interface NavItem {
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  href?: string;
  active?: boolean;
  onClick?: () => void;
}

export interface UserProfile {
  name: string;
  email?: string;
  avatar?: string;
  onLogout?: () => void;
}

export interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
  navItems: NavItem[];
  userProfile?: UserProfile;
  logo?: ReactNode;
}

export function Sidebar({ collapsed, onToggle, navItems, userProfile, logo }: SidebarProps) {
  return (
    <aside
      className={cn(
        "hidden md:flex fixed inset-y-0 left-0 z-40 flex-col bg-white/[0.03] backdrop-blur-xl border-r border-white/10 transition-[width] duration-300",
        collapsed ? "w-16" : "w-64",
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-white/10">
        <div className={cn("flex items-center gap-2 overflow-hidden", collapsed && "justify-center w-full")}>
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-600 to-blue-500 flex items-center justify-center flex-shrink-0">
            {logo ?? <Sparkles size={16} className="text-white" />}
          </div>
          {!collapsed && <span className="font-semibold text-white truncate">Console</span>}
        </div>
        {!collapsed && onToggle && (
          <button
            onClick={onToggle}
            className="text-slate-400 hover:text-white transition-colors"
            aria-label="Collapse sidebar"
          >
            <ChevronsLeft size={16} />
          </button>
        )}
      </div>

      {collapsed && onToggle && (
        <button
          onClick={onToggle}
          className="mx-auto mt-2 text-slate-400 hover:text-white transition-colors"
          aria-label="Expand sidebar"
        >
          <ChevronsRight size={16} />
        </button>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <a
              key={item.label}
              href={item.href || "#"}
              onClick={(e) => {
                if (item.onClick) {
                  e.preventDefault();
                  item.onClick();
                }
              }}
              title={collapsed ? item.label : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                item.active
                  ? "text-violet-400 bg-violet-500/10 border-l-2 border-violet-500 pl-[10px]"
                  : "text-slate-400 hover:text-white hover:bg-white/5",
                collapsed && "justify-center px-0",
              )}
            >
              <Icon size={18} className="flex-shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
              {collapsed && (
                <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-md bg-[#0d1117] px-2 py-1 text-xs text-white opacity-0 shadow-lg border border-white/10 group-hover:opacity-100 transition-opacity">
                  {item.label}
                </span>
              )}
            </a>
          );
        })}
      </nav>

        {/* IT Project Button */}
      <div className={cn("border-t border-white/10", collapsed ? "px-2 py-2" : "px-3 py-2")}>
        <ITProjectButton
          source="sidebar"
          variant={collapsed ? "icon" : "default"}
          collapsed={collapsed}
          className="w-full"
        />
      </div>
      
      {/* User */}
      {userProfile && (
        <div className="border-t border-white/10 p-3">
          <div
            className={cn(
              "flex items-center gap-3",
              collapsed && "flex-col gap-2",
            )}
          >
            <Avatar name={userProfile.name} src={userProfile.avatar} size="sm" />
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{userProfile.name}</p>
                {userProfile.email && (
                  <p className="text-xs text-slate-500 truncate">{userProfile.email}</p>
                )}
              </div>
            )}
            <button
              onClick={userProfile.onLogout}
              className="text-slate-400 hover:text-white transition-colors"
              aria-label="Log out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}