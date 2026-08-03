import { supabase } from '@/integrations/supabase/client'

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
    attendanceTrackingAcknowledged: boolean
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

export function calculateCompletenessScore(
  data: RegistrationFormData
): number {
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

async function getBranchId(): Promise<string | null> {
  // Try environment variable first
  const envBranchId = import.meta.env.VITE_DEFAULT_BRANCH_ID
  if (envBranchId) return envBranchId

  // Fall back to querying the database
  try {
    const { data } = await supabase
      .from('branches')
      .select('id')
      .eq('name', 'Main Campus')
      .single()
    if (data?.id) return data.id
  } catch {
    // Try getting any branch
  }

  try {
    const { data } = await supabase
      .from('branches')
      .select('id')
      .limit(1)
      .single()
    return data?.id || null
  } catch {
    return null
  }
}

export async function submitRegistration(
  data: RegistrationFormData,
  turnstileToken: string
): Promise<SubmissionResult> {
  console.log('[REG] Step 1 - Starting registration submission...')

  // Step 1 — Upload photo (non-blocking)
  let photoUrl: string | null = null
  if (data.personal.photoFile) {
    try {
      const file = data.personal.photoFile
      const ext = file?.name?.split('.').pop() || 'jpg'
      const fileName = `onboarding/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${ext}`

      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('member-photos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (!uploadError && uploadData) {
        const { data: urlData } = supabase.storage
          .from('member-photos')
          .getPublicUrl(uploadData.path)
        photoUrl = urlData?.publicUrl || null
        console.log('[REG] Photo uploaded successfully:', photoUrl)
      }
    } catch (photoError) {
      console.warn('[REG] Photo upload failed (non-blocking):', photoError)
    }
  }

  // Step 2 — Get branch ID
  const branchId = await getBranchId()
  console.log('[REG] Step 2 - Branch ID:', branchId)

  // Step 3 — Calculate completeness score
  const completenessScore = calculateCompletenessScore(data)
  console.log('[REG] Step 3 - Completeness score:', completenessScore)

  // Step 4 — Build submission object
  // IMPORTANT: This table stores data as JSONB blobs
  // The structure matches exactly what the table columns expect
  const submission = {
    // Top level fields (actual columns in the table)
    first_name: data.personal.firstName,
    last_name: data.personal.lastName,
    phone_primary: data.contact.phonePrimary
      ? formatPhoneNumber(data.contact.phonePrimary)
      : null,
    profile_photo_url: photoUrl,
    branch_id: branchId,
    cell_group_id: data.churchLife.cellGroupId || null,
    membership_stage: data.churchLife.membershipStage || null,
    status: 'pending',
    verification_status: 'pending',
    submission_method: 'self',
    completeness_score: completenessScore,
    ai_completeness_score: completenessScore,
    submitted_at: new Date().toISOString(),

    // JSONB columns — store as structured objects
    personal: {
      firstName: data.personal.firstName,
      middleName: data.personal.middleName || null,
      lastName: data.personal.lastName,
      preferredName: data.personal.preferredName || null,
      dateOfBirth: data.personal.dob || null,
      gender: data.personal.gender || null,
      photoUrl: photoUrl,
    },

    contact: {
      phonePrimary: data.contact.phonePrimary
        ? formatPhoneNumber(data.contact.phonePrimary)
        : null,
      phoneSecondary: data.contact.phoneSecondary
        ? formatPhoneNumber(data.contact.phoneSecondary)
        : null,
      email: data.contact.email || null,
      address: data.contact.address || null,
      city: data.contact.city || null,
      state: data.contact.state || null,
      country: data.contact.country || 'Nigeria',
    },

    family: {
      maritalStatus: data.family.maritalStatus || null,
      spouseName: data.family.spouseName || null,
      spousePhone: data.family.spousePhone
        ? formatPhoneNumber(data.family.spousePhone)
        : null,
      spouseIsMember: data.family.spouseIsMember || null,
      children: data.family.children || [],
      otherFamilyMembers: data.family.otherFamilyMembers || null,
    },

    church_life: {
      attendanceDuration: data.churchLife.attendanceDuration || null,
      howHeard: data.churchLife.howHeard || null,
      membershipStage: data.churchLife.membershipStage || null,
      cellGroupId: data.churchLife.cellGroupId || null,
      cellGroupText: data.churchLife.cellGroupText || null,
      departmentIds: data.churchLife.departmentIds || [],
      roleTitle: data.churchLife.roleTitle || null,
    },

    spiritual: {
      salvation: data.spiritual.salvation || null,
      baptised: data.spiritual.baptised || null,
      believersClass: data.spiritual.believersClass || null,
      baptismalClass: data.spiritual.baptismalClass || null,
      workerTraining: data.spiritual.workerTraining || null,
      otherTraining: data.spiritual.otherTraining || null,
    },

    consent: {
      infoAccurate: data.consent.infoAccurate,
      churchUse: data.consent.churchUse,
      photoConsent: data.consent.photoConsent,
      attendanceTrackingAcknowledged: data.consent.attendanceTrackingAcknowledged,
    },
  }

  console.log('[REG] Step 4 - Submission object built:', submission)

 
  // Step 5 — Submit via Edge Function (handles CAPTCHA verification + rate limiting + insert)
  try {
    console.log('[REG] Step 5 - Submitting via Edge Function...')

    const { data: result, error } = await supabase.functions.invoke(
      'submit-registration',
      { body: { submission, turnstileToken } }
    )

    console.log('[REG] Step 5 - Edge Function response:', { result, error })

    if (error || result?.error) {
      // supabase-js doesn't auto-parse the JSON body on non-2xx responses —
      // the real error message/code lives in error.context (the raw Response)
      let parsedBody: { error?: string; code?: string } | null = null
      if (error && 'context' in error && error.context instanceof Response) {
        try {
          parsedBody = await error.context.json()
        } catch {
          // context body wasn't valid JSON — fall through to generic message
        }
      }

      const message = parsedBody?.error || result?.error || error?.message || 'Unknown error'
      const code = parsedBody?.code || result?.code

      console.error('[REG] Submission error:', message)

      if (code === '23505') {
        if (String(message).includes('phone')) {
          return {
            success: false,
            error:
              'This phone number is already registered. ' +
              'If you are already a member, please contact the church office.',
          }
        }
        return {
          success: false,
          error:
            'This information is already in our system. ' +
            'Please contact the church office.',
        }
      }

      if (
        code === '42501' ||
        String(message).includes('permission') ||
        String(message).includes('policy')
      ) {
        return {
          success: false,
          error:
            'Registration is temporarily unavailable. ' +
            'Please speak to an usher or try again in a few minutes.',
        }
      }

      if (String(message).includes('CAPTCHA')) {
        return {
          success: false,
          error: 'Verification failed. Please complete the human verification check and try again.',
        }
      }

      if (String(message).includes('Too many attempts')) {
        return {
          success: false,
          error: 'Too many registration attempts from this location. Please try again later or speak to an usher.',
        }
      }

      return {
        success: false,
        error: `Registration failed: ${message}. Please try again or speak to an usher.`,
      }
    }

    console.log('[REG] Step 5 - Success! Member ID:', result?.id)

    return {
      success: true,
      submissionId: result?.id,
    }
  } catch (networkError) {
    console.error('[REG] Network error:', networkError)
    return {
      success: false,
      error:
        'Could not connect to the server. ' +
        'Please check your internet connection and try again.',
    }
  }
}
