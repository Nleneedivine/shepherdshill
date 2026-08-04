import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/super-admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      throw redirect({ to: "/auth" });
    }

    // user_roles is the single source of truth for access
    const { data: roles, error: rolesError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);

    const isSuperAdmin = ((roles ?? []) as { role: string }[]).some(
      (r) => r.role === "super_admin",
    );

    if (rolesError || !isSuperAdmin) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: () => <Outlet />,
});