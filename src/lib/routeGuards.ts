import { redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/types";
import { satisfiesAny } from "@/lib/roles";

export const STAFF_ROLES: AppRole[] = ["pastoral_team"];

export const ADMIN_ROLES: AppRole[] = ["admin"];

export const SUPER_ADMIN_ROLES: AppRole[] = ["super_admin"];

/**
 * Reads the caller's roles through the `my_roles()` security-definer RPC so the
 * result never depends on row-level read policies. Falls back to a direct
 * `user_roles` read if the RPC is unavailable.
 */
export async function fetchMyRoles(userId: string): Promise<AppRole[]> {
  const { data, error } = await supabase.rpc("my_roles" as never);
  if (!error && Array.isArray(data)) return data as AppRole[];

  const { data: rows } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  return ((rows ?? []) as { role: AppRole }[]).map((r) => r.role);
}

/**
 * Client-side role gate for `_authenticated` routes (ssr: false).
 * Hierarchy-aware: a higher-ranked role always satisfies a lower requirement,
 * so `super_admin` passes every `admin`/staff gate.
 */
export async function requireRoles(allowed: AppRole[], redirectTo = "/unauthorized") {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw redirect({ to: "/auth" });

  const roles = await fetchMyRoles(data.user.id);

  if (!satisfiesAny(roles, allowed)) throw redirect({ to: redirectTo });

  return { userId: data.user.id, roles };
}

/** Sermon portal: IT team, media team, admins and super admins only. */
export async function requireSermonManager(redirectTo = "/unauthorized") {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw redirect({ to: "/auth" });

  const roles = await fetchMyRoles(data.user.id);
  const allowed =
    roles.includes("it_team" as AppRole) ||
    roles.includes("media_team" as AppRole) ||
    satisfiesAny(roles, ADMIN_ROLES);

  if (!allowed) throw redirect({ to: redirectTo });
  return { userId: data.user.id, roles };
}
