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
  roles: AppRole[];
  primary_role: AppRole;
  created_at: string;
}

export type RoleFilter = "all" | "member" | "admin" | "super_admin" | "custom";
export type StatusFilter = "all" | "active" | "suspended";

const ROLE_PRIORITY: AppRole[] = [
  "super_admin",
  "admin",
  "senior_pastor",
  "pastoral_team",
  "worker",
  "member",
  "first_timer",
];

function primaryRoleOf(roles: AppRole[], isSuperAdmin: boolean): AppRole {
  if (isSuperAdmin) return "super_admin";
  for (const r of ROLE_PRIORITY) if (roles.includes(r)) return r;
  return "member";
}

export function useUsers(params: {
  search: string;
  roleFilter: RoleFilter;
  statusFilter: StatusFilter;
  page: number;
  pageSize: number;
}) {
  const { search, roleFilter, statusFilter, page, pageSize } = params;
  const [rows, setRows] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch profiles + branch join, then user_roles separately.
      let q = supabase
        .from("profiles")
        .select("id, full_name, email, phone, is_super_admin, branch_id, created_at, branches(name)", {
          count: "exact",
        })
        .order("created_at", { ascending: false })
        .range(page * pageSize, page * pageSize + pageSize - 1);
      if (search.trim()) {
        const s = search.replace(/[,%]/g, "").trim();
        q = q.or(`full_name.ilike.%${s}%,email.ilike.%${s}%,phone.ilike.%${s}%`);
      }
      const { data: profiles, count, error: pErr } = await q;
      if (pErr) throw pErr;

      const ids = (profiles ?? []).map((p) => (p as { id: string }).id);
      const rolesById = new Map<string, AppRole[]>();
      if (ids.length) {
        const { data: rRows } = await supabase
          .from("user_roles")
          .select("user_id, role")
          .in("user_id", ids);
        for (const r of (rRows ?? []) as { user_id: string; role: AppRole }[]) {
          const list = rolesById.get(r.user_id) ?? [];
          list.push(r.role);
          rolesById.set(r.user_id, list);
        }
      }

      let assembled: UserRow[] = (profiles ?? []).map((p) => {
        const prof = p as unknown as {
          id: string;
          full_name: string | null;
          email: string | null;
          phone: string | null;
          is_super_admin: boolean;
          branch_id: string | null;
          created_at: string;
          branches: { name: string } | null;
        };
        const roles = rolesById.get(prof.id) ?? [];
        return {
          id: prof.id,
          full_name: prof.full_name,
          email: prof.email,
          phone: prof.phone,
          is_super_admin: prof.is_super_admin,
          branch_id: prof.branch_id,
          branch_name: prof.branches?.name ?? null,
          roles,
          primary_role: primaryRoleOf(roles, prof.is_super_admin),
          created_at: prof.created_at,
        };
      });

      // Client-side role filter (small dataset per page)
      if (roleFilter !== "all") {
        assembled = assembled.filter((r) => {
          if (roleFilter === "super_admin") return r.primary_role === "super_admin";
          if (roleFilter === "admin") return r.primary_role === "admin";
          if (roleFilter === "member") return r.primary_role === "member" || r.primary_role === "first_timer";
          // custom = anything else (worker / pastoral_team / senior_pastor)
          return ["worker", "pastoral_team", "senior_pastor"].includes(r.primary_role);
        });
      }
      // Status filter — for now we treat every profile as active; suspended is placeholder.
      if (statusFilter === "suspended") assembled = [];

      setRows(assembled);
      setTotal(count ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, statusFilter, page, pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  return { rows, total, loading, error, refresh: load };
}
