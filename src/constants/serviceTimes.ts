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
  "RCCG Shepherd's Hill Parish. 54 NTA/Choba Road, Mgbuoba, Port Harcourt, Rivers State, Nigeria. [view on map] (https://www.waze.com/live-map/directions/ng/rv/port-harcourt/r.c.c.g.-shepherds-hill-parish?to=place.ChIJWZNVozzOaRARBIkkmbdQy98), [view on map] (https://www.facebook.com/RccgShepherdsHillParish/) — see the welcome desk or contact us for directions.";
