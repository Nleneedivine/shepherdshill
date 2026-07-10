import { supabase } from "@/integrations/supabase/client";

export interface ApprovalInput {
  submissionId: string;
  editedData?: Record<string, unknown>;
  confirmedFamilyLinks?: string[];
  confirmedCellGroupId?: string;
}

export interface ApprovalResult {
  success: boolean;
  memberId?: string;
  memberCode?: string;
  error?: string;
}

export async function generateMemberCode(branchId: string, branchCode: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `${branchCode}-${year}-`;
  try {
    const { data } = await supabase
      .from("members")
      .select("member_code")
      .eq("branch_id", branchId)
      .like("member_code", `${prefix}%`)
      .order("member_code", { ascending: false })
      .limit(1)
      .maybeSingle();
    let next = 1;
    if (data?.member_code) {
      const m = /(\d+)$/.exec(data.member_code);
      if (m) next = parseInt(m[1], 10) + 1;
    }
    return `${prefix}${String(next).padStart(4, "0")}`;
  } catch {
    return `${prefix}0001`;
  }
}

export async function approveSubmission(input: ApprovalInput): Promise<ApprovalResult> {
  try {
    // Idempotency guard
    const { data: existing } = await supabase
      .from("member_registrations")
      .select("created_member_id")
      .eq("id", input.submissionId)
      .maybeSingle();
    const existingId = (existing as { created_member_id?: string | null } | null)?.created_member_id;
    if (existingId) {
      const { data: mem } = await supabase.from("members").select("id, member_code").eq("id", existingId).maybeSingle();
      return {
        success: true,
        memberId: existingId,
        memberCode: (mem as { member_code?: string | null } | null)?.member_code ?? undefined,
      };
    }

    // Apply edits before running the RPC
    if (input.editedData && Object.keys(input.editedData).length) {
      await supabase.from("member_registrations").update(input.editedData as never).eq("id", input.submissionId);
    }

    const { data, error } = await supabase.rpc("approve_member_submission", {
      p_submission_id: input.submissionId,
      p_edited: (input.editedData as never) ?? {},
      p_confirmed_cell_group_id: input.confirmedCellGroupId ?? null,
    });

    if (error) return { success: false, error: error.message };
    const row = Array.isArray(data) ? data[0] : data;
    const memberId = (row as { member_id?: string } | null)?.member_id;
    const memberCode = (row as { member_code?: string } | null)?.member_code;
    if (!memberId) return { success: false, error: "Approval did not return a member id." };

    // Fire and forget welcome notification (edge fn may not exist yet)
    try {
      await supabase.functions.invoke("send-welcome-notification", { body: { memberId } });
    } catch {
      /* non-fatal */
    }

    return { success: true, memberId, memberCode };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Approval failed" };
  }
}
