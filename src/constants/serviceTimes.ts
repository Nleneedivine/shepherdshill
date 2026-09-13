export interface ServiceTime {
  day: string;
  time: string;
  name?: string;
}

export const SERVICE_TIMES: ServiceTime[] = [
  { day: "Sunday", time: "8:00 AM" },
  { day: "Tuesday", time: "6:00 PM", name: "Digging Deep" },
  { day: "Thursday", time: "6:00 PM", name: "Faith Clinic" },
];

export const CHURCH_ADDRESS =
  "RCCG Shepherd's Hill Parish. 54 NTA/Choba Road, Mgbuoba, Port Harcourt, Rivers State, Nigeria. 
