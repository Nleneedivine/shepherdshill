import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/types";

export interface UserRow {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  is_super_admin: boolean;
  branch_id: string | null;
  branch_name: string | null;
  is_anonymous: boolean;
  roles: AppRole[];
  primary_role: AppRole;
  created_at: string;
}

export type RoleFilter = "all" | "member" | "admin" | "super_admin" | "custom";
export type StatusFilter = "all" | "active" | "suspended";
export type AudienceFilter = "real" | "anonymous";

const ROLE_PRIORITY: AppRole[] = [
  "super_admin",
  "admin",
  "senior_pastor",
  "pastoral_team",
  "worker",
  "member",
  "first_timer",
];

/** user_roles is the single source of truth for access. */
function primaryRoleOf(roles: AppRole[]): AppRole {
  for (const r of ROLE_PRIORITY) if (roles.includes(r)) return r;
  return roles[0] ?? "member";
}

interface RpcRow {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  is_super_admin: boolean;
  branch_id: string | null;
  branch_name: string | null;
  is_anonymous: boolean;
  created_at: string;
  roles: string[] | null;
  total_count: number;
}

export function useUsers(params: {
  search: string;
  roleFilter: RoleFilter;
  statusFilter: StatusFilter;
  audience?: AudienceFilter;
  page: number;
  pageSize: number;
}) {
  const { search, roleFilter, statusFilter, audience = "real", page, pageSize } = params;
  const [rows, setRows] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcErr } = await supabase.rpc("admin_list_users", {
        p_search: search.trim(),
        p_anonymous: audience === "anonymous",
        p_limit: pageSize,
        p_offset: page * pageSize,
      } as never);
      if (rpcErr) throw rpcErr;

      const raw = (data ?? []) as unknown as RpcRow[];

      let assembled: UserRow[] = raw.map((r) => {
        const roles = ((r.roles ?? []) as AppRole[]).filter(Boolean);
        return {
          id: r.id,
          full_name: r.full_name,
          email: r.email,
          phone: r.phone,
          is_super_admin: r.is_super_admin,
          branch_id: r.branch_id,
          branch_name: r.branch_name,
          is_anonymous: r.is_anonymous,
          roles,
          primary_role: primaryRoleOf(roles),
          created_at: r.created_at,
        };
      });

      const count = raw[0]?.total_count ?? 0;

      if (roleFilter !== "all") {
        assembled = assembled.filter((r) => {
          if (roleFilter === "super_admin") return r.primary_role === "super_admin";
          if (roleFilter === "admin") return r.primary_role === "admin";
          if (roleFilter === "member") return r.primary_role === "member" || r.primary_role === "first_timer";
          return ["worker", "pastoral_team", "senior_pastor"].includes(r.primary_role);
        });
      }
      if (statusFilter === "suspended") assembled = [];

      setRows(assembled);
      setTotal(Number(count) || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, statusFilter, audience, page, pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  return { rows, total, loading, error, refresh: load };
}
