import { supabase } from "@/integrations/supabase/client";
import { completenessScore, initialRegistrationData } from "@/lib/registration";
import { formatNigerianPhone } from "@/lib/nigeria";
import type { RegistrationData } from "@/types";

export type RegistrationFormData = RegistrationData;

export interface SubmissionResult {
  success: boolean;
  submissionId?: string;
  error?: string;
}

export function calculateCompletenessScore(data: RegistrationFormData): number {
  return completenessScore(data);
}

export function formatPhoneNumber(phone: string): string {
  return formatNigerianPhone(phone);
}

async function uploadPhoto(file: File): Promise<string | null> {
  try {
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `onboarding/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("member-photos")
      .upload(path, file, { contentType: file.type || "image/jpeg", upsert: false });
    if (error) return null;
    // Bucket is private; store path — read side will produce a signed URL.
    return path;
  } catch {
    return null;
  }
}

export async function submitRegistration(data: RegistrationFormData): Promise<SubmissionResult> {
  try {
    let photoUrl: string | null = null;
    let photoNote: string | null = null;
    if (data.personal.photoFile) {
      photoUrl = await uploadPhoto(data.personal.photoFile);
      if (!photoUrl) photoNote = "Photo upload failed";
    }

    const score = calculateCompletenessScore(data);
    const phonePrimary = formatPhoneNumber(data.contact.phonePrimary);

    const { photoFile: _pf, photoPreview: _pp, ...personalClean } = data.personal;
    void _pf; void _pp;

    const branchId = (import.meta.env.VITE_DEFAULT_BRANCH_ID as string | undefined) || null;

    const payload = {
      personal: personalClean,
      contact: { ...data.contact, phonePrimary },
      family: data.family,
      church_life: data.churchLife,
      spiritual: data.spiritual,
      consent: data.consent,
      cell_group_id: data.churchLife.cellGroupId,
      status: "pending",
      completeness_score: score,
      // Flat fields for querying / de-duplication
      first_name: data.personal.firstName,
      last_name: data.personal.lastName,
      phone_primary: phonePrimary,
      profile_photo_url: photoUrl,
      branch_id: branchId,
      membership_stage: data.churchLife.membershipStage || null,
      verification_status: "pending",
      submission_method: "self",
      ai_completeness_score: score,
      ai_processing_notes: photoNote,
      submitted_at: new Date().toISOString(),
    } as never;

    const { data: inserted, error } = await supabase
      .from("member_registrations")
      .insert(payload)
      .select("id")
      .single();

    if (error) {
      const code = (error as { code?: string }).code;
      if (code === "23505") {
        return {
          success: false,
          error: "This phone number is already registered. Please contact the church office if you need help.",
        };
      }
      return { success: false, error: "Something went wrong. Please check your connection and try again." };
    }

    return { success: true, submissionId: (inserted as { id: string }).id };
  } catch {
    return { success: false, error: "Something went wrong. Please check your connection and try again." };
  }
}

// re-export for callers who want a fresh empty form
export { initialRegistrationData };
