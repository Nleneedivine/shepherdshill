import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Users, UserPlus, Building2, HeartHandshake, LogOut, LayoutDashboard } from "lucide-react";
import { AppLayout, Card, StatCard, PageWrapper, Button } from "@/components/ds";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [stats, setStats] = useState({ members: 0, pending: 0, cellGroups: 0, branches: 0 });

  useEffect(() => {
    void (async () => {
      const [m, p, c, b] = await Promise.all([
        supabase.from("members").select("id", { count: "exact", head: true }),
        supabase.from("member_registrations").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("cell_groups").select("id", { count: "exact", head: true }),
        supabase.from("branches").select("id", { count: "exact", head: true }),
      ]);
      setStats({
        members: m.count ?? 0,
        pending: p.count ?? 0,
        cellGroups: c.count ?? 0,
        branches: b.count ?? 0,
      });
    })();
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate({ to: "/auth" });
  };

  return (
    <AppLayout
      title="Dashboard"
      breadcrumb={[{ label: "Home", href: "/dashboard" }, { label: "Dashboard" }]}
      navItems={[
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { label: "Members", href: "/members", icon: Users },
      ]}
      userProfile={{
        name: user?.profile?.full_name ?? user?.email ?? "User",
        email: user?.email ?? "",
        onLogout: handleLogout,
      }}
    >
      <PageWrapper>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">
              Welcome{user?.profile?.full_name ? `, ${user.profile.full_name}` : ""}
            </h1>
            <p className="text-sm text-slate-400 mt-1">Here's a snapshot of your church community.</p>
          </div>
          <Button variant="secondary" onClick={handleLogout}><LogOut size={16} /> Sign out</Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Members" value={stats.members} icon={<Users size={20} />} />
          <StatCard label="Pending Registrations" value={stats.pending} icon={<UserPlus size={20} />} glowColor="amber" />
          <StatCard label="Cell Groups" value={stats.cellGroups} icon={<HeartHandshake size={20} />} glowColor="green" />
          <StatCard label="Branches" value={stats.branches} icon={<Building2 size={20} />} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
          <Card title="Your Role" subtitle="Permissions granted to your account">
            <div className="flex flex-wrap gap-2">
              {user?.roles.map((r) => (
                <span key={r} className="px-3 py-1 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-200 text-xs font-medium">
                  {r.replace("_", " ")}
                </span>
              ))}
            </div>
          </Card>
          <Card title="Quick Actions" subtitle="Common tasks">
            <div className="flex flex-col gap-2">
              <Button variant="secondary" onClick={() => navigate({ to: "/members" })}>
                <Users size={16} /> View members
              </Button>
            </div>
          </Card>
        </div>
      </PageWrapper>
    </AppLayout>
  );
}
