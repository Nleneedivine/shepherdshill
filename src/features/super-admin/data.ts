export type ModuleStatus = "active" | "in_development" | "coming_soon";

export interface ModuleInfo {
  number: number;
  name: string;
  status: ModuleStatus;
}

export const MODULES: ModuleInfo[] = [
  { number: 0, name: "Foundation", status: "active" },
  { number: 1, name: "Member Onboarding", status: "active" },
  { number: 2, name: "Verification Queue", status: "active" },
  { number: 3, name: "Approval & Records", status: "active" },
  { number: 4, name: "Check-in Kiosk", status: "in_development" },
  { number: 5, name: "Attendance Analytics", status: "coming_soon" },
  { number: 6, name: "Cell Groups", status: "coming_soon" },
  { number: 7, name: "Departments & Teams", status: "coming_soon" },
  { number: 8, name: "Giving & Finance", status: "coming_soon" },
  { number: 9, name: "Events & Programmes", status: "coming_soon" },
  { number: 10, name: "Discipleship", status: "coming_soon" },
  { number: 11, name: "Prayer Requests", status: "coming_soon" },
  { number: 12, name: "Pastoral Care", status: "coming_soon" },
  { number: 13, name: "Communications", status: "coming_soon" },
  { number: 14, name: "Multi-branch", status: "coming_soon" },
  { number: 15, name: "Reports & Insights", status: "coming_soon" },
  { number: 16, name: "AI Assistant", status: "coming_soon" },
  { number: 17, name: "System Settings", status: "coming_soon" },
];
