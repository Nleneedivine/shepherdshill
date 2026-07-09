
-- Roles enum
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'senior_pastor', 'pastoral_team', 'worker', 'member', 'first_timer');

-- Branches
CREATE TABLE public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  branch_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.branches TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches TO authenticated;
GRANT ALL ON public.branches TO service_role;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Branches readable by all" ON public.branches FOR SELECT USING (true);

-- Cell Groups
CREATE TABLE public.cell_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  leader_name TEXT,
  meeting_day TEXT,
  meeting_time TEXT,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cell_groups TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cell_groups TO authenticated;
GRANT ALL ON public.cell_groups TO service_role;
ALTER TABLE public.cell_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cell groups readable by all" ON public.cell_groups FOR SELECT USING (true);

-- Departments
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  icon TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.departments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Departments readable by all" ON public.departments FOR SELECT USING (true);

-- Members
CREATE TABLE public.members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_code TEXT UNIQUE,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  last_name TEXT NOT NULL,
  preferred_name TEXT,
  dob DATE,
  gender TEXT,
  phone_primary TEXT,
  phone_secondary TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'Nigeria',
  marital_status TEXT,
  membership_status TEXT DEFAULT 'active',
  profile_photo_url TEXT,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  cell_group_id UUID REFERENCES public.cell_groups(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.members TO authenticated;
GRANT ALL ON public.members TO service_role;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  is_super_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- User Roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- has_role security definer
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'phone');
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'member');
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Public registrations table
CREATE TABLE public.member_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  personal JSONB NOT NULL,
  contact JSONB NOT NULL,
  family JSONB NOT NULL,
  church_life JSONB NOT NULL,
  spiritual JSONB NOT NULL,
  consent JSONB NOT NULL,
  cell_group_id UUID REFERENCES public.cell_groups(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  completeness_score INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT INSERT ON public.member_registrations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_registrations TO authenticated;
GRANT ALL ON public.member_registrations TO service_role;
ALTER TABLE public.member_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can submit registration" ON public.member_registrations FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Admins read registrations" ON public.member_registrations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'pastoral_team'));
CREATE POLICY "Admins update registrations" ON public.member_registrations FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- Members RLS
CREATE POLICY "Auth users read members" ON public.members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage members" ON public.members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'pastoral_team'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'pastoral_team'));
