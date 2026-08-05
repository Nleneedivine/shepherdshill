/** The 8-stage membership lifecycle pipeline. */
export const MEMBERSHIP_STAGES = [
  { key: "first_timer", label: "First Timer", description: "Attended a service for the first time" },
  { key: "second_timer", label: "Second Timer", description: "Returned for a second visit" },
  { key: "new_convert", label: "New Convert", description: "Made a decision for Christ" },
  { key: "believers_class", label: "Believers' Class", description: "Enrolled in foundational teaching" },
  { key: "baptised", label: "Baptised", description: "Water baptism completed" },
  { key: "member", label: "Member", description: "Full church member" },
  { key: "worker_in_training", label: "Worker in Training", description: "Undergoing workers' training" },
  { key: "worker", label: "Worker", description: "Commissioned worker" },
] as const;

export type MembershipStageKey = (typeof MEMBERSHIP_STAGES)[number]["key"];

export function stageLabel(key: string | null | undefined): string {
  if (!key) return "—";
  return MEMBERSHIP_STAGES.find((s) => s.key === key)?.label ?? key.replace(/_/g, " ");
}

export function stageIndex(key: string | null | undefined): number {
  return MEMBERSHIP_STAGES.findIndex((s) => s.key === key);
}
