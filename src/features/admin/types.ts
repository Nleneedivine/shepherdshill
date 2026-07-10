export interface Submission {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone_primary: string | null;
  profile_photo_url: string | null;
  verification_status: string;
  submission_method: string;
  membership_stage: string | null;
  ai_completeness_score: number | null;
  ai_duplicate_flag: boolean;
  ai_family_match_suggestions: unknown;
  ai_cell_group_suggestion_id: string | null;
  ai_processing_notes: string | null;
  submitted_at: string;
  created_member_id: string | null;
  personal: Record<string, unknown> | null;
  contact: Record<string, unknown> | null;
  family: Record<string, unknown> | null;
  church_life: Record<string, unknown> | null;
  spiritual: Record<string, unknown> | null;
  cell_group_id: string | null;
}
