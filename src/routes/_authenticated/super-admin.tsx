import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/super-admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: profile } = await supabase
      .from("profiles").select("is_super_admin").eq("id", data.user.id).maybeSingle();
    const { data: roleRow } = await supabase
      .from("user_roles").select("role").eq("user_id", data.user.id).eq("role", "super_admin").maybeSingle();
    const isSuper = (profile as { is_super_admin?: boolean } | null)?.is_super_admin || !!roleRow;
    if (!isSuper) throw redirect({ to: "/dashboard" });
  },
  component: () => <Outlet />,
});
