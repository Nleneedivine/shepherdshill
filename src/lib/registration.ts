import type { RegistrationData } from "@/types";

export function completenessScore(data: RegistrationData): number {
  let score = 0;
  let total = 0;

  const check = (val: unknown, weight = 1) => {
    total += weight;
    if (val && String(val).trim().length > 0) score += weight;
  };

  // Personal (weight heavy)
  check(data.personal.firstName, 2);
  check(data.personal.lastName, 2);
  check(data.personal.dob, 2);
  check(data.personal.gender, 2);
  check(data.personal.middleName);
  check(data.personal.preferredName);
  check(data.personal.photoPreview, 2);

  // Contact
  check(data.contact.phonePrimary, 2);
  check(data.contact.state, 2);
  check(data.contact.email);
  check(data.contact.address);
  check(data.contact.city);

  // Family
  check(data.family.maritalStatus, 2);
  if (data.family.maritalStatus === "married") {
    check(data.family.spouseName);
    check(data.family.spousePhone);
  }

  // Church life
  check(data.churchLife.attendanceDuration, 2);
  check(data.churchLife.howHeard);
  check(data.churchLife.membershipStage, 2);
  total += 2;
  if (data.churchLife.cellGroupId || data.churchLife.cellGroupText === "unknown") score += 2;
  total += 1;
  if (data.churchLife.departmentIds.length > 0) score += 1;

  // Spiritual
  check(data.spiritual.salvation, 2);
  check(data.spiritual.baptised, 2);
  check(data.spiritual.believersClass);
  check(data.spiritual.baptismalClass);
  check(data.spiritual.workerTraining);

  return Math.round((score / total) * 100);
}

export function initialRegistrationData(): RegistrationData {
  return {
    personal: {
      firstName: "", middleName: "", lastName: "", preferredName: "",
      dob: "", gender: "", photoFile: null, photoPreview: "",
    },
    contact: {
      phonePrimary: "", phoneSecondary: "", email: "",
      address: "", city: "", state: "", country: "Nigeria",
    },
    family: {
      maritalStatus: "", spouseName: "", spousePhone: "",
      spouseIsMember: "", children: [], otherFamilyMembers: "",
    },
    churchLife: {
      attendanceDuration: "", howHeard: "", membershipStage: "",
      cellGroupId: null, cellGroupText: "", departmentIds: [], roleTitle: "",
    },
    spiritual: {
      salvation: "", baptised: "",
      believersClass: "", baptismalClass: "", workerTraining: "",
      otherTraining: "",
    },
    consent: { infoAccurate: false, churchUse: false, photoConsent: false, attendanceTrackingAcknowledged: false },
  };
}
