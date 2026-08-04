import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface RolePermissionRow {
  id: string;
  role: string;
  permission_key: string;
  allowed: boolean;
}

export function useRolePermissions() {
  const [rows, setRows] = useState<RolePermissionRow[]>([]);
  const [usedRoles, setUsedRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ data, error: pErr }, { data: urData }] = await Promise.all([
        supabase.from("role_permissions").select("id, role, permission_key, allowed"),
        supabase.from("user_roles").select("role"),
      ]);
      if (pErr) throw pErr;
      setRows(((data ?? []) as unknown as RolePermissionRow[]).slice());
      setUsedRoles(
        Array.from(new Set(((urData ?? []) as { role: string }[]).map((r) => r.role))),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load permissions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const roles = useMemo(() => {
    const set = new Set<string>([...rows.map((r) => r.role), ...usedRoles]);
    return Array.from(set).sort();
  }, [rows, usedRoles]);

  const permissionKeys = useMemo(
    () => Array.from(new Set(rows.map((r) => r.permission_key))).sort(),
    [rows],
  );

  const setLocal = useCallback((role: string, key: string, allowed: boolean) => {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.role === role && r.permission_key === key);
      if (idx === -1) {
        return [...prev, { id: `new:${role}:${key}`, role, permission_key: key, allowed }];
      }
      const next = prev.slice();
      next[idx] = { ...next[idx], allowed };
      return next;
    });
  }, []);

  const save = useCallback(async () => {
    const payload = rows.map((r) => ({
      role: r.role,
      permission_key: r.permission_key,
      allowed: r.allowed,
    }));
    const { error: sErr } = await supabase
      .from("role_permissions")
      .upsert(payload as never, { onConflict: "role,permission_key" });
    if (sErr) throw sErr;
    await load();
  }, [rows, load]);

  return { rows, roles, permissionKeys, loading, error, setLocal, save, refresh: load };
}
