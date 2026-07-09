import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout, PageWrapper, DataTable, EmptyState } from "@/components/ds";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Member } from "@/types";

export const Route = createFileRoute("/_authenticated/members")({
  component: MembersPage,
});

function MembersPage() {
  const { user } = useAuth();
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
        { label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
        { label: "Members", href: "/members", icon: "Users" },
      ]}
      userProfile={{ name: user?.profile?.full_name ?? user?.email ?? "User", email: user?.email ?? "", role: user?.roles[0] ?? "member" }}
    >
      <PageWrapper>
        <h1 className="text-2xl font-bold text-white mb-4">Members</h1>
        {!loading && members.length === 0 ? (
          <EmptyState
            icon="Users"
            title="No members yet"
            description="Members added to your church will appear here."
          />
        ) : (
          <DataTable
            loading={loading}
            columns={[
              { key: "first_name", label: "First name" },
              { key: "last_name", label: "Last name" },
              { key: "phone_primary", label: "Phone" },
              { key: "email", label: "Email" },
              { key: "membership_status", label: "Status" },
            ]}
            data={members}
          />
        )}
      </PageWrapper>
    </AppLayout>
  );
}
