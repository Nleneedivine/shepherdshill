import { redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/types";

export const STAFF_ROLES: AppRole[] = [
  "super_admin",
  "admin",
  "senior_pastor",
  "pastoral_team",
];

export const ADMIN_ROLES: AppRole[] = ["super_admin", "admin"];

/** Client-side role gate for `_authenticated` routes (ssr: false). */
export async function requireRoles(allowed: AppRole[]) {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw redirect({ to: "/auth" });

  const { data: rows } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id);

  const roles = ((rows ?? []) as { role: AppRole }[]).map((r) => r.role);
  const permitted = roles.some((r) => allowed.includes(r));

  if (!permitted) throw redirect({ to: "/unauthorized" });

  return { userId: data.user.id, roles };
}
