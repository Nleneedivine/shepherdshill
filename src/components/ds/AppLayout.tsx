import { useState, type ReactNode } from "react";
import { Sidebar, type NavItem, type UserProfile } from "./Sidebar";
import { TopNav, type Breadcrumb } from "./TopNav";
import { cn } from "@/lib/utils";

export interface AppLayoutProps {
  children: ReactNode;
  navItems: NavItem[];
  userProfile?: UserProfile;
  title?: string;
  breadcrumb?: Breadcrumb[];
  notificationCount?: number;
}

export function AppLayout({
  children,
  navItems,
  userProfile,
  title,
  breadcrumb,
  notificationCount,
}: AppLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="relative min-h-screen w-full overflow-hidden" style={{ backgroundColor: "#080c16" }}>
      {/* Ambient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="orb-1 absolute top-0 left-64 h-96 w-96 rounded-full bg-violet-600 opacity-20 blur-3xl" />
        <div className="orb-2 absolute bottom-20 right-20 h-80 w-80 rounded-full bg-blue-600 opacity-20 blur-3xl" />
        <div className="orb-3 absolute top-1/2 left-1/3 h-64 w-64 rounded-full bg-indigo-600 opacity-15 blur-3xl" />
      </div>

      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        navItems={navItems}
        userProfile={userProfile}
      />

      <div
        className={cn(
          "relative min-h-screen transition-[padding] duration-300",
          "md:pl-64",
          collapsed && "md:pl-16",
        )}
      >
        <TopNav
          title={title}
          breadcrumb={breadcrumb}
          notificationCount={notificationCount}
          userName={userProfile?.name}
          userAvatar={userProfile?.avatar}
        />
        <main className="relative p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
