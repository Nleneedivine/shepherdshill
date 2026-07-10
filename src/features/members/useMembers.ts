import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Member } from "@/types";

export interface MemberListItem extends Member {
  cell_group_name: string | null;
  department_names: string[];
  has_biometrics: boolean;
  membership_stage: string | null;
  created_at: string;
}

export interface MemberFilterState {
  q: string;
  stage: string;   // "all" or membership_stage value
  dept: string;    // "all" or department_id
  cell: string;    // "all" or cell_group_id
  status: string;  // "all" | "active" | "inactive" | "transferred"
  bio: string;     // "all" | "enrolled" | "not_enrolled"
  view: "table" | "grid";
  page: number;
  sort: "name" | "created_at" | "membership_stage";
  dir: "asc" | "desc";
}

export interface MemberStats {
  total: number;
  newThisMonth: number;
  withBiometrics: number;
  incompleteProfiles: number;
}

export const MEMBERS_PAGE_SIZE = 20;

const sortColumn = (s: MemberFilterState["sort"]) =>
  s === "name" ? "first_name" : s === "membership_stage" ? "membership_stage" : "created_at";

export function useMembers(filters: MemberFilterState) {
  const [items, setItems] = useState<MemberListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let q = supabase
        .from("members")
        .select("*, cell_groups(name)", { count: "exact" })
        .order(sortColumn(filters.sort), { ascending: filters.dir === "asc" })
        .range(filters.page * MEMBERS_PAGE_SIZE, filters.page * MEMBERS_PAGE_SIZE + MEMBERS_PAGE_SIZE - 1);

      if (filters.q.trim()) {
        const s = filters.q.replace(/[,%]/g, "").trim();
        q = q.or(`first_name.ilike.%${s}%,last_name.ilike.%${s}%,phone_primary.ilike.%${s}%,member_code.ilike.%${s}%`);
      }
      if (filters.stage !== "all") q = q.eq("membership_stage", filters.stage);
      if (filters.cell !== "all") q = q.eq("cell_group_id", filters.cell);
      if (filters.status !== "all") q = q.eq("membership_status", filters.status);

      const { data, count, error: dbErr } = await q;
      if (dbErr) throw dbErr;

      const rawMembers = (data ?? []) as unknown as (Member & { cell_groups: { name: string } | null; membership_stage: string | null; created_at: string })[];
      const memberIds = rawMembers.map((m) => m.id);

      // Department joins + biometrics enrollment
      const [{ data: depRows }, { data: bioRows }] = await Promise.all([
        memberIds.length
          ? supabase.from("department_members").select("member_id, departments(name, id)").in("member_id", memberIds)
          : Promise.resolve({ data: [] as unknown[] }),
        memberIds.length
          ? supabase.from("member_biometrics").select("member_id, has_face, has_fingerprint, has_qr").in("member_id", memberIds)
          : Promise.resolve({ data: [] as unknown[] }),
      ]);

      const depsByMember = new Map<string, { id: string; name: string }[]>();
      for (const row of (depRows ?? []) as { member_id: string; departments: { id: string; name: string } | null }[]) {
        if (!row.departments) continue;
        const list = depsByMember.get(row.member_id) ?? [];
        list.push(row.departments);
        depsByMember.set(row.member_id, list);
      }
      const bioByMember = new Map<string, boolean>();
      for (const row of (bioRows ?? []) as { member_id: string; has_face: boolean; has_fingerprint: boolean; has_qr: boolean }[]) {
        bioByMember.set(row.member_id, !!(row.has_face || row.has_fingerprint || row.has_qr));
      }

      let assembled: MemberListItem[] = rawMembers.map((m) => {
        const deps = depsByMember.get(m.id) ?? [];
        return {
          ...m,
          cell_group_name: m.cell_groups?.name ?? null,
          department_names: deps.map((d) => d.name),
          has_biometrics: bioByMember.get(m.id) ?? false,
        };
      });

      // Client-side department + biometrics filters (page-local; ok at 20/page)
      if (filters.dept !== "all") {
        assembled = assembled.filter((m) => {
          const deps = depsByMember.get(m.id) ?? [];
          return deps.some((d) => d.id === filters.dept);
        });
      }
      if (filters.bio === "enrolled") assembled = assembled.filter((m) => m.has_biometrics);
      if (filters.bio === "not_enrolled") assembled = assembled.filter((m) => !m.has_biometrics);

      setItems(assembled);
      setTotal(count ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load members");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { void load(); }, [load]);

  return { items, total, loading, error, refresh: load };
}

export async function fetchMemberStats(): Promise<MemberStats> {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [totalRes, monthRes, bioRes, incompleteRes] = await Promise.all([
    supabase.from("members").select("id", { count: "exact", head: true }).eq("membership_status", "active"),
    supabase.from("members").select("id", { count: "exact", head: true }).gte("created_at", monthStart.toISOString()),
    supabase.from("member_biometrics").select("id", { count: "exact", head: true }).or("has_face.eq.true,has_fingerprint.eq.true"),
    supabase.from("incomplete_profiles").select("id", { count: "exact", head: true }),
  ]);

  return {
    total: totalRes.count ?? 0,
    newThisMonth: monthRes.count ?? 0,
    withBiometrics: bioRes.count ?? 0,
    incompleteProfiles: incompleteRes.count ?? 0,
  };
}

export async function fetchFilterOptions() {
  const [stagesRes, deptsRes, cellsRes] = await Promise.all([
    supabase.from("members").select("membership_stage").not("membership_stage", "is", null),
    supabase.from("departments").select("id, name").eq("is_active", true).order("name"),
    supabase.from("cell_groups").select("id, name").eq("is_active", true).order("name"),
  ]);
  const stages = Array.from(new Set(((stagesRes.data ?? []) as { membership_stage: string | null }[])
    .map((r) => r.membership_stage).filter(Boolean) as string[]));
  return {
    stages,
    departments: (deptsRes.data ?? []) as { id: string; name: string }[],
    cellGroups: (cellsRes.data ?? []) as { id: string; name: string }[],
  };
}
