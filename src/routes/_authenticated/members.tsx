import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Users, LayoutDashboard } from "lucide-react";
import { AppLayout, PageWrapper, DataTable, EmptyState } from "@/components/ds";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Member } from "@/types";

export const Route = createFileRoute("/_authenticated/members")({
  component: MembersPage,
});

function MembersPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from("members").select("*").order("created_at", { ascending: false });
      setMembers((data as Member[]) ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <AppLayout
      title="Members"
      breadcrumb={[{ label: "Home", href: "/dashboard" }, { label: "Members" }]}
      navItems={[
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { label: "Members", href: "/members", icon: Users },
      ]}
      userProfile={{
        name: user?.profile?.full_name ?? user?.email ?? "User",
        email: user?.email ?? "",
        onLogout: async () => { await logout(); navigate({ to: "/auth" }); },
      }}
    >
      <PageWrapper>
        <h1 className="text-2xl font-bold text-white mb-4">Members</h1>
        {!loading && members.length === 0 ? (
          <EmptyState
            icon={<Users size={40} className="text-slate-400" />}
            title="No members yet"
            description="Approved registrations will appear here."
          />
        ) : (
          <DataTable
            loading={loading}
            columns={[
              { key: "first_name", header: "First name" },
              { key: "last_name", header: "Last name" },
              { key: "phone_primary", header: "Phone" },
              { key: "email", header: "Email" },
              { key: "membership_status", header: "Status" },
            ]}
            data={members}
            rowKey={(row) => row.id}
          />
        )}
      </PageWrapper>
    </AppLayout>
  );
}
