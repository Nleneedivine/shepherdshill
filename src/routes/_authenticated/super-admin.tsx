import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/super-admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });

    // Check profiles table for is_super_admin flag
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_super_admin")
      .eq("id", data.user.id)
      .maybeSingle();

    const isSuperAdmin =
      (profile as { is_super_admin?: boolean } | null)
        ?.is_super_admin === true;

    if (!isSuperAdmin) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: () => <Outlet />,
});