-- ============ Departments / cell groups: admin management ============
CREATE POLICY "Admins manage departments" ON public.departments
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins manage cell groups" ON public.cell_groups
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cell_groups TO authenticated;
GRANT ALL ON public.departments TO service_role;
GRANT ALL ON public.cell_groups TO service_role;

-- ============ Church hierarchy ============
CREATE TABLE public.provinces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.provinces TO authenticated;
GRANT ALL ON public.provinces TO service_role;
ALTER TABLE public.provinces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read provinces" ON public.provinces FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage provinces" ON public.provinces FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  province_id uuid REFERENCES public.provinces(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.zones TO authenticated;
GRANT ALL ON public.zones TO service_role;
ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read zones" ON public.zones FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage zones" ON public.zones FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id uuid REFERENCES public.zones(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.areas TO authenticated;
GRANT ALL ON public.areas TO service_role;
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read areas" ON public.areas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage areas" ON public.areas FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.parishes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id uuid REFERENCES public.areas(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  name text NOT NULL,
  code text,
  pastor_name text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parishes TO authenticated;
GRANT ALL ON public.parishes TO service_role;
ALTER TABLE public.parishes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read parishes" ON public.parishes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage parishes" ON public.parishes FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

ALTER TABLE public.cell_groups
  ADD COLUMN IF NOT EXISTS parish_id uuid REFERENCES public.parishes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS leader_phone text,
  ADD COLUMN IF NOT EXISTS capacity integer;

-- ============ Member transfers ============
CREATE TABLE public.member_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  from_branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  to_branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  from_cell_group_id uuid REFERENCES public.cell_groups(id) ON DELETE SET NULL,
  to_cell_group_id uuid REFERENCES public.cell_groups(id) ON DELETE SET NULL,
  transfer_type text NOT NULL DEFAULT 'internal',
  reason text,
  status text NOT NULL DEFAULT 'pending',
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at timestamptz,
  decision_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_transfers TO authenticated;
GRANT ALL ON public.member_transfers TO service_role;
ALTER TABLE public.member_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read transfers" ON public.member_transfers
  FOR SELECT TO authenticated USING (public.is_pastoral(auth.uid()));
CREATE POLICY "Staff request transfers" ON public.member_transfers
  FOR INSERT TO authenticated WITH CHECK (public.is_pastoral(auth.uid()) AND requested_by = auth.uid());
CREATE POLICY "Approvers update transfers" ON public.member_transfers
  FOR UPDATE TO authenticated
  USING (public.has_role_or_higher(auth.uid(), 'senior_pastor'))
  WITH CHECK (public.has_role_or_higher(auth.uid(), 'senior_pastor'));
CREATE POLICY "Admins delete transfers" ON public.member_transfers
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE TRIGGER trg_member_transfers_updated BEFORE UPDATE ON public.member_transfers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.decide_member_transfer(
  p_transfer_id uuid,
  p_approve boolean,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  t public.member_transfers%ROWTYPE;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role_or_higher(v_uid, 'senior_pastor') THEN
    RAISE EXCEPTION 'forbidden: only a senior pastor or above can decide transfers';
  END IF;

  SELECT * INTO t FROM public.member_transfers WHERE id = p_transfer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'transfer not found'; END IF;
  IF t.status <> 'pending' THEN RAISE EXCEPTION 'transfer already decided'; END IF;

  UPDATE public.member_transfers
     SET status = CASE WHEN p_approve THEN 'approved' ELSE 'declined' END,
         decided_by = v_uid,
         decided_at = now(),
         decision_notes = p_notes
   WHERE id = p_transfer_id;

  IF p_approve THEN
    UPDATE public.members
       SET branch_id = COALESCE(t.to_branch_id, branch_id),
           cell_group_id = COALESCE(t.to_cell_group_id, cell_group_id),
           membership_status = CASE WHEN t.transfer_type = 'external' THEN 'transferred' ELSE 'active' END,
           updated_at = now()
     WHERE id = t.member_id;
  END IF;

  INSERT INTO public.system_logs (action, performed_by, performed_by_name, details)
  VALUES (
    CASE WHEN p_approve THEN 'approve_member_transfer' ELSE 'decline_member_transfer' END,
    v_uid,
    (SELECT COALESCE(full_name, email) FROM public.profiles WHERE id = v_uid),
    jsonb_build_object('transfer_id', p_transfer_id, 'member_id', t.member_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.decide_member_transfer(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decide_member_transfer(uuid, boolean, text) TO authenticated, service_role;

-- ============ Spiritual journey stages ============
CREATE TABLE public.spiritual_journey_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  sequence_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spiritual_journey_stages TO authenticated;
GRANT ALL ON public.spiritual_journey_stages TO service_role;
ALTER TABLE public.spiritual_journey_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read journey stages" ON public.spiritual_journey_stages
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage journey stages" ON public.spiritual_journey_stages
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER trg_journey_stages_updated BEFORE UPDATE ON public.spiritual_journey_stages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.spiritual_journey_stages (key, name, description, sequence_order) VALUES
  ('salvation', 'Salvation', 'Made a personal decision for Christ', 1),
  ('believers_class', 'Believers'' Class', 'Completed foundational discipleship class', 2),
  ('baptised', 'Water Baptism', 'Baptised by immersion', 3),
  ('baptismal_class', 'Baptismal Class', 'Completed pre-baptism teaching', 4),
  ('worker_training', 'Workers'' Training', 'Completed workers-in-training school', 5)
ON CONFLICT (key) DO NOTHING;