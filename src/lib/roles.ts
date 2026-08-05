import type { AppRole } from "@/types";

/**
 * Role hierarchy — mirrors public.role_rank() in the database.
 * A higher rank always satisfies a check for a lower-ranked role, so
 * `super_admin` is sufficient anywhere `admin` is required.
 */
export const ROLE_RANK: Record<string, number> = {
  super_admin: 100,
  admin: 90,
  senior_pastor: 80,
  provincial_pastor: 75,
  zonal_pastor: 72,
  area_supervisor: 70,
  parish_pastor: 68,
  pastoral_team: 65,
  counselling_pastor: 62,
  finance_director: 60,
  department_head: 55,
  cell_leader: 50,
  prayer_coordinator: 45,
  finance_team: 40,
  media_team: 40,
  communications_team: 40,
  facilities_team: 40,
  it_team: 40,
  protocol_team: 40,
  usher: 35,
  worker: 30,
  volunteer: 25,
  member: 10,
  first_timer: 5,
  visitor: 1,
};

export function rankOf(role: string | null | undefined): number {
  if (!role) return 0;
  return ROLE_RANK[role] ?? 0;
}

export function highestRank(roles: readonly string[] | null | undefined): number {
  return (roles ?? []).reduce((max, r) => Math.max(max, rankOf(r)), 0);
}

/** True when any held role ranks at or above `required`. */
export function hasRoleOrHigher(
  roles: readonly string[] | null | undefined,
  required: AppRole,
): boolean {
  return highestRank(roles) >= rankOf(required);
}

/** True when the caller satisfies ANY of the allowed roles (hierarchy-aware). */
export function satisfiesAny(
  roles: readonly string[] | null | undefined,
  allowed: readonly AppRole[],
): boolean {
  return allowed.some((r) => hasRoleOrHigher(roles, r));
}

export const isSuperAdmin = (roles?: readonly string[] | null) =>
  hasRoleOrHigher(roles, "super_admin");
export const isAdmin = (roles?: readonly string[] | null) => hasRoleOrHigher(roles, "admin");
export const isPastoral = (roles?: readonly string[] | null) =>
  hasRoleOrHigher(roles, "pastoral_team");
export const isStaff = (roles?: readonly string[] | null) => hasRoleOrHigher(roles, "worker");
