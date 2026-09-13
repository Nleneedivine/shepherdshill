CREATE OR REPLACE FUNCTION public.is_in_followup_department(check_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_member_id uuid;
BEGIN
  SELECT member_id INTO v_member_id FROM profiles WHERE id = check_user_id;
  IF v_member_id IS NULL THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM department_members dm
    JOIN departments d ON d.id = dm.department_id
    WHERE dm.member_id = v_member_id
    AND d.is_active
    AND (
      d.name ILIKE '%follow%up%'
      OR d.name ILIKE '%evangelism%'
    )
  );
END;
$function$;