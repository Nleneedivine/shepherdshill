import { supabase } from '@/lib/supabase'

export interface RegistrationFormData {
  personal: {
    firstName: string
    middleName: string
    lastName: string
    preferredName: string
    dob: string
    gender: string
    photoFile?: File | null
    photoPreview?: string
  }
  contact: {
    phonePrimary: string
    phoneSecondary: string
    email: string
    address: string
    city: string
    state: string
    country: string
  }
  family: {
    maritalStatus: string
    spouseName: string
    spousePhone: string
    spouseIsMember: string
    children: Array<{ name: string; age: string }>
    otherFamilyMembers: string
  }
  churchLife: {
    attendanceDuration: string
    howHeard: string
    membershipStage: string
    cellGroupId: string | null
    cellGroupText: string
    departmentIds: string[]
    roleTitle: string
  }
  spiritual: {
    salvation: string
    baptised: string
    believersClass: string
    baptismalClass: string
    workerTraining: string
    otherTraining: string
  }
  consent: {
    infoAccurate: boolean
    churchUse: boolean
    photoConsent: boolean
  }
}

export interface SubmissionResult {
  success: boolean
  submissionId?: string
  error?: string
}

export function formatPhoneNumber(phone: string): string {
  if (!phone) return ''
  const cleaned = phone.replace(/[\s\-\(\)]/g, '')
  if (cleaned.startsWith('+234')) return cleaned
  if (cleaned.startsWith('234')) return '+' + cleaned
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    return '+234' + cleaned.slice(1)
  }
  if (cleaned.length === 10) return '+234' + cleaned
  return cleaned
}

export function calculateCompletenessScore(data: RegistrationFormData): number {
  let score = 0
  if (data.personal.firstName) score += 10
  if (data.personal.lastName) score += 10
  if (data.personal.dob) score += 5
  if (data.personal.gender) score += 5
  if (data.contact.phonePrimary) score += 15
  if (data.contact.address) score += 5
  if (data.contact.state) score += 5
  if (data.personal.photoPreview) score += 10
  if (data.churchLife.cellGroupId) score += 15
  if (data.churchLife.departmentIds.length > 0) score += 10
  if (data.contact.email) score += 5
  if (data.spiritual.salvation) score += 5
  return Math.min(score, 100)
}

export async function submitRegistration(
  data: RegistrationFormData
): Promise<SubmissionResult> {
  let photoUrl: string | null = null

  // Step 1: Upload photo if provided
  if (data.personal.photoFile) {
    try {
      const file = data.personal.photoFile
      const ext = file.name.split('.').pop() || 'jpg'
      const fileName = `onboarding/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('member-photos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (!uploadError && uploadData) {
        const { data: urlData } = supabase.storage
          .from('member-photos')
          .getPublicUrl(uploadData.path)
        photoUrl = urlData?.publicUrl || null
      }
      // If photo upload fails, we continue without it
    } catch {
      // Photo upload failure is non-blocking
      console.warn('Photo upload failed, continuing without photo')
    }
  }

  // Step 2: Calculate completeness score
  const completenessScore = calculateCompletenessScore(data)

  // Step 3: Get branch ID
  // Try environment variable first, then query the first branch
  let branchId = import.meta.env.VITE_DEFAULT_BRANCH_ID

  if (!branchId) {
    try {
      const { data: branchData } = await supabase
        .from('branches')
        .select('id')
        .limit(1)
        .single()
      branchId = branchData?.id || null
    } catch {
      branchId = null
    }
  }

  // Step 4: Build the submission object
  // Map to whatever columns actually exist in your table
  const submission: Record<string, unknown> = {
    // Branch
    branch_id: branchId,

    // Personal
    first_name: data.personal.firstName,
    middle_name: data.personal.middleName || null,
    last_name: data.personal.lastName,
    preferred_name: data.personal.preferredName || null,
    date_of_birth: data.personal.dob || null,
    gender: data.personal.gender || null,
    profile_photo_url: photoUrl,

    // Contact
    phone_primary: data.contact.phonePrimary
      ? formatPhoneNumber(data.contact.phonePrimary)
      : null,
    phone_secondary: data.contact.phoneSecondary
      ? formatPhoneNumber(data.contact.phoneSecondary)
      : null,
    email: data.contact.email || null,
    address: data.contact.address || null,
    city: data.contact.city || null,
    state: data.contact.state || null,
    country: data.contact.country || 'Nigeria',

    // Family (stored as JSON)
    family_info: {
      maritalStatus: data.family.maritalStatus,
      spouseName: data.family.spouseName,
      spousePhone: data.family.spousePhone,
      spouseIsMember: data.family.spouseIsMember,
      children: data.family.children,
      otherFamilyMembers: data.family.otherFamilyMembers,
    },

    // Church life
    membership_stage_self_reported: data.churchLife.membershipStage || null,
    cell_group_id: data.churchLife.cellGroupId || null,
    cell_group_text: data.churchLife.cellGroupText || null,
    department_ids: data.churchLife.departmentIds,
    how_they_heard: data.churchLife.howHeard || null,

    // Spiritual (stored as JSON)
    spiritual_journey: {
      salvation: data.spiritual.salvation,
      baptised: data.spiritual.baptised,
      believersClass: data.spiritual.believersClass,
      baptismalClass: data.spiritual.baptismalClass,
      workerTraining: data.spiritual.workerTraining,
      otherTraining: data.spiritual.otherTraining,
    },

    // Consent
    consent_given: data.consent.churchUse,
    photo_consent: data.consent.photoConsent,

    // System fields
    submission_method: 'self',
    verification_status: 'pending',
    ai_completeness_score: completenessScore,
  }

  // Step 5: Submit to Supabase
  try {
    const { data: result, error } = await supabase
      .from('member_registrations')
      .insert(submission)
      .select('id')
      .single()

    if (error) {
      console.error('Supabase insert error:', error)

      // Handle specific errors with friendly messages
      if (error.code === '23505') {
        // Unique constraint violation — duplicate phone/email
        if (error.message.includes('phone')) {
          return {
            success: false,
            error:
              'This phone number is already registered. If you are already a member, please contact the church office.',
          }
        }
        if (error.message.includes('email')) {
          return {
            success: false,
            error:
              'This email address is already registered. Please use a different email or contact the church office.',
          }
        }
        return {
          success: false,
          error: 'This information is already in our system. Please contact the church office.',
        }
      }

      if (error.code === '42501' || error.message.includes('permission')) {
        return {
          success: false,
          error:
            'Registration is temporarily unavailable. Please try again in a few minutes or speak to an usher.',
        }
      }

      if (error.code === 'PGRST116') {
        // Column not found — schema mismatch
        return {
          success: false,
          error:
            'A technical error occurred. Our team has been notified. Please try again or speak to an usher.',
        }
      }

      return {
        success: false,
        error: 'Something went wrong. Please check your connection and try again.',
      }
    }

    return {
      success: true,
      submissionId: result?.id,
    }
  } catch (networkError) {
    console.error('Network error during registration:', networkError)
    return {
      success: false,
      error:
        'Could not connect to the server. Please check your internet connection and try again.',
    }
  }
}
