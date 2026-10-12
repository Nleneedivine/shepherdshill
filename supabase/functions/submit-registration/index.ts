import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const textField = (value: unknown, max: number, required = false): string | null => {
  if (value === null || value === undefined || value === "") return required ? null : "";
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (normalized.length > max || (required && normalized.length === 0)) return null;
  return normalized;
};

const optionalUuid = (value: unknown): string | null | undefined => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) return undefined;
  return value;
};

async function readBodyLimited(req: Request, maxBytes: number): Promise<string> {
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("payload_too_large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function cleanObject(source: Record<string, unknown>, schema: Record<string, number>) {
  const result: Record<string, string | null> = {};
  for (const [key, max] of Object.entries(schema)) {
    const value = source[key];
    if (value === null || value === undefined || value === "") {
      result[key] = null;
      continue;
    }
    const cleaned = textField(value, max);
    if (cleaned === null) return null;
    result[key] = cleaned || null;
  }
  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const contentLength = Number(req.headers.get("content-length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > 64 * 1024) {
      return json({ error: "Submission is too large" }, 413);
    }

    const authorization = req.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return json({ error: "Sign in before submitting a registration" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const turnstileSecret = Deno.env.get("TURNSTILE_SECRET_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey || !turnstileSecret) {
      console.error("Registration endpoint configuration is incomplete");
      return json({ error: "Registration is temporarily unavailable" }, 503);
    }

    // Validate the caller's JWT explicitly because this public Edge Function has
    // verify_jwt=false for compatibility with the current Supabase deployment.
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) return json({ error: "Your session is invalid or expired" }, 401);

    let body: unknown;
    try {
      body = JSON.parse(await readBodyLimited(req, 64 * 1024));
    } catch (error) {
      if (error instanceof Error && error.message === "payload_too_large") {
        return json({ error: "Submission is too large" }, 413);
      }
      return json({ error: "Invalid JSON body" }, 400);
    }
    if (!isRecord(body) || !isRecord(body.submission) || typeof body.turnstileToken !== "string" || body.turnstileToken.length > 4096) {
      return json({ error: "Invalid registration payload" }, 400);
    }

    const submission = body.submission;
    const personalIn = submission.personal;
    const contactIn = submission.contact;
    const familyIn = submission.family;
    const churchIn = submission.church_life;
    const spiritualIn = submission.spiritual;
    const consentIn = submission.consent;

    if (![personalIn, contactIn, familyIn, churchIn, spiritualIn, consentIn].every(isRecord)) {
      return json({ error: "Required registration sections are missing" }, 400);
    }

    const personal = personalIn as Record<string, unknown>;
    const contact = contactIn as Record<string, unknown>;
    const family = familyIn as Record<string, unknown>;
    const church = churchIn as Record<string, unknown>;
    const spiritual = spiritualIn as Record<string, unknown>;
    const consent = consentIn as Record<string, unknown>;

    const firstName = textField(personal.firstName, 100, true);
    const lastName = textField(personal.lastName, 100, true);
    if (firstName === null || lastName === null) {
      return json({ error: "First name and last name are required" }, 400);
    }
    if (consent.infoAccurate !== true || consent.churchUse !== true) {
      return json({ error: "Please confirm the required registration consent" }, 400);
    }

    const personalClean = cleanObject(personal, {
      firstName: 100, middleName: 100, lastName: 100, preferredName: 100,
      dateOfBirth: 10, gender: 40, photoUrl: 2048,
    });
    const contactClean = cleanObject(contact, {
      phonePrimary: 40, phoneSecondary: 40, email: 254, address: 500,
      city: 100, state: 100, country: 100,
    });
    const familyClean = cleanObject(family, {
      maritalStatus: 50, spouseName: 200, spousePhone: 40,
      spouseIsMember: 30, otherFamilyMembers: 2000,
    });
    const churchClean = cleanObject(church, {
      attendanceDuration: 100, howHeard: 200, membershipStage: 80,
      cellGroupText: 200, roleTitle: 100,
    });
    const spiritualClean = cleanObject(spiritual, {
      salvation: 500, baptised: 100, believersClass: 100,
      baptismalClass: 100, workerTraining: 100, otherTraining: 500,
    });

    if (!personalClean || !contactClean || !familyClean || !churchClean || !spiritualClean) {
      return json({ error: "One or more fields are invalid or too long" }, 400);
    }

    const branchId = optionalUuid(submission.branch_id);
    const cellGroupId = optionalUuid(church.cellGroupId ?? submission.cell_group_id);
    if (branchId === undefined || cellGroupId === undefined) {
      return json({ error: "Invalid branch or cell group" }, 400);
    }

    const childrenIn = family.children;
    if (childrenIn !== undefined && childrenIn !== null && !Array.isArray(childrenIn)) {
      return json({ error: "Invalid family details" }, 400);
    }
    const children = (Array.isArray(childrenIn) ? childrenIn : []).slice(0, 30);
    if (Array.isArray(childrenIn) && childrenIn.length > 30) {
      return json({ error: "Too many family entries" }, 400);
    }
    const safeChildren: Array<{ name: string | null; age: string | null }> = [];
    for (const child of children) {
      if (!isRecord(child)) return json({ error: "Invalid family details" }, 400);
      const name = textField(child.name, 120);
      const age = textField(child.age, 20);
      if (name === null || age === null) return json({ error: "Invalid family details" }, 400);
      safeChildren.push({ name: name || null, age: age || null });
    }

    const departmentIds = church.departmentIds;
    if (departmentIds !== undefined && departmentIds !== null &&
        (!Array.isArray(departmentIds) || departmentIds.length > 30 ||
         departmentIds.some((id) => typeof id !== "string" || id.length > 100))) {
      return json({ error: "Invalid department selection" }, 400);
    }

    const completeness = Number(submission.completeness_score);
    const completenessScore = Number.isFinite(completeness)
      ? Math.max(0, Math.min(100, Math.round(completeness)))
      : 0;

    // Use a trusted proxy-derived IP where available, and always rate-limit by
    // authenticated user as well. The database RPC serializes concurrent attempts.
    const ip = (req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip")?.trim() || "unknown").slice(0, 128);
    const service = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: allowed, error: rateError } = await service.rpc("consume_registration_rate_limit", {
      p_ip_address: ip,
      p_user_id: user.id,
      p_max_attempts: 5,
    });
    if (rateError) {
      console.error("Registration rate-limit check failed", rateError.code);
      return json({ error: "Registration is temporarily unavailable" }, 503);
    }
    if (allowed !== true) return json({ error: "Too many attempts. Please try again later." }, 429);

    const turnstileResponse = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: turnstileSecret,
        response: body.turnstileToken,
        remoteip: ip === "unknown" ? undefined : ip,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!turnstileResponse.ok) {
      return json({ error: "CAPTCHA verification is temporarily unavailable" }, 503);
    }
    const turnstileData = await turnstileResponse.json();
    if (turnstileData?.success !== true) {
      return json({ error: "CAPTCHA verification failed" }, 400);
    }

    const photoUrl = textField(personalClean.photoUrl, 2048);
    if (photoUrl) {
      try {
        const parsedPhotoUrl = new URL(photoUrl);
        if (parsedPhotoUrl.protocol !== "https:") return json({ error: "Invalid profile photo URL" }, 400);
      } catch {
        return json({ error: "Invalid profile photo URL" }, 400);
      }
    }

    const safeSubmission = {
      user_id: user.id,
      first_name: firstName,
      last_name: lastName,
      phone_primary: contactClean.phonePrimary,
      profile_photo_url: photoUrl || null,
      branch_id: branchId,
      cell_group_id: cellGroupId,
      membership_stage: churchClean.membershipStage,
      status: "pending",
      verification_status: "pending",
      submission_method: "self",
      completeness_score: completenessScore,
      ai_completeness_score: completenessScore,
      submitted_at: new Date().toISOString(),
      personal: personalClean,
      contact: contactClean,
      family: { ...familyClean, children: safeChildren },
      church_life: { ...churchClean, cellGroupId, departmentIds: Array.isArray(departmentIds) ? departmentIds : [] },
      spiritual: spiritualClean,
      consent: {
        infoAccurate: true,
        churchUse: true,
        photoConsent: consent.photoConsent === true,
        attendanceTrackingAcknowledged: consent.attendanceTrackingAcknowledged === true,
      },
    };

    const { data, error } = await service
      .from("member_registrations")
      .insert(safeSubmission)
      .select("id")
      .single();

    if (error) {
      console.error("Registration insert failed", error.code);
      return json({ error: "Unable to submit registration. Please try again." }, 400);
    }

    return json({ id: data.id });
  } catch (error) {
    console.error("Registration request failed", error instanceof Error ? error.name : "unknown");
    return json({ error: "Registration is temporarily unavailable" }, 500);
  }
});
