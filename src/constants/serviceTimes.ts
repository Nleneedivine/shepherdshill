export interface ServiceTime {
  day: string;
  time: string;
  name?: string;
}

export const SERVICE_TIMES: ServiceTime[] = [
  { day: "Sunday", time: "8:00 AM" },
  { day: "Sunday", time: "10:00 AM" },
  { day: "Tuesday", time: "6:00 PM", name: "Digging Deep" },
  { day: "Thursday", time: "6:00 PM", name: "Faith Clinic" },
];

export const CHURCH_ADDRESS =
  "RCCG Shepherd's Hill Parish — see the welcome desk or contact us for directions.";
