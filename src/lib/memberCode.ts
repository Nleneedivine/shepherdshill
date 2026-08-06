import { supabase } from "@/integrations/supabase/client";

/** Church-wide member code prefix: RCCG-SH-YYYY-NNNN */
export const MEMBER_CODE_PREFIX = "RCCG-SH";

export function memberCodePrefixForYear(year: number = new Date().getFullYear()): string {
  return `${MEMBER_CODE_PREFIX}-${year}-`;
}

/** Example code used for placeholders / helper text. */
export const MEMBER_CODE_EXAMPLE = `${memberCodePrefixForYear()}0001`;

/** Matches RCCG-SH-YYYY-NNNN */
export const MEMBER_CODE_PATTERN = /^RCCG-SH-\d{4}-\d{4}$/;

/**
 * Computes the next available member code. Codes are church-wide (not
 * per-branch) so the sequence is unique across every branch.
 */
export async function nextMemberCode(): Promise<string> {
  const prefix = memberCodePrefixForYear();
  try {
    const { data } = await supabase
      .from("members")
      .select("member_code")
      .like("member_code", `${prefix}%`)
      .order("member_code", { ascending: false })
      .limit(1)
      .maybeSingle();
    const last = (data as { member_code?: string | null } | null)?.member_code;
    let n = 1;
    if (last) {
      const m = /(\d+)$/.exec(last);
      if (m) n = parseInt(m[1], 10) + 1;
    }
    return `${prefix}${String(n).padStart(4, "0")}`;
  } catch {
    return `${prefix}0001`;
  }
}
