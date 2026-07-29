import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/super-admin")({
  ssr: false,
  beforeLoad: async () => {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw redirect({ to: "/auth" });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_super_admin")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError || !profile?.is_super_admin) {
    throw redirect({ to: "/dashboard" });
  }
},
  component: () => <Outlet />,
});