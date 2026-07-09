export type AppRole =
  | "super_admin"
  | "admin"
  | "senior_pastor"
  | "pastoral_team"
  | "worker"
  | "member"
  | "first_timer";

export interface Branch {
  id: string;
  name: string;
  branch_code: string;
  status: string;
}

export interface Role {
  id: string;
  name: AppRole;
  description?: string;
}

export interface Profile {
  id: string;
  member_id: string | null;
  branch_id: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  is_super_admin: boolean;
}

export interface AuthUser {
  id: string;
  email: string | null;
  phone: string | null;
  profile: Profile | null;
  roles: AppRole[];
}

export interface Member {
  id: string;
  member_code: string | null;
  first_name: string;
  last_name: string;
  phone_primary: string | null;
  email: string | null;
  membership_status: string;
  profile_photo_url: string | null;
  branch_id: string | null;
  cell_group_id: string | null;
}

export interface CellGroup {
  id: string;
  name: string;
  leader_name: string | null;
  meeting_day: string | null;
  meeting_time: string | null;
}

export interface Department {
  id: string;
  name: string;
  icon: string | null;
  is_active: boolean;
}

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: string | number;
}

// Registration form state
export interface ChildEntry {
  name: string;
  age: number | "";
}

export interface RegistrationData {
  personal: {
    firstName: string;
    middleName: string;
    lastName: string;
    preferredName: string;
    dob: string;
    gender: string;
    photoFile: File | null;
    photoPreview: string;
  };
  contact: {
    phonePrimary: string;
    phoneSecondary: string;
    email: string;
    address: string;
    city: string;
    state: string;
    country: string;
  };
  family: {
    maritalStatus: "" | "single" | "married" | "widowed" | "divorced";
    spouseName: string;
    spousePhone: string;
    spouseIsMember: "" | "yes" | "no" | "not_sure";
    children: ChildEntry[];
    otherFamilyMembers: string;
  };
  churchLife: {
    attendanceDuration: string;
    howHeard: string;
    membershipStage: string;
    cellGroupId: string | null;
    cellGroupText: string;
    departmentIds: string[];
    roleTitle: string;
  };
  spiritual: {
    salvation: "" | "yes" | "no" | "not_sure";
    baptised: "" | "yes" | "no" | "in_progress";
    believersClass: "" | "completed" | "in_progress" | "not_started";
    baptismalClass: "" | "completed" | "in_progress" | "not_started";
    workerTraining: "" | "completed" | "in_progress" | "not_started";
    otherTraining: string;
  };
  consent: {
    infoAccurate: boolean;
    churchUse: boolean;
    photoConsent: boolean;
  };
}

export interface RegistrationFormState {
  currentStep: number;
  data: RegistrationData;
  errors: Record<string, string>;
  isSubmitting: boolean;
  isSubmitted: boolean;
  submissionId: string | null;
}
