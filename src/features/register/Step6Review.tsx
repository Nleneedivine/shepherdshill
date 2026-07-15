import { motion } from "framer-motion";
import { Edit2 } from "lucide-react";
import type { RegistrationData } from "@/types";
import { completenessScore } from "@/lib/registration";

interface Props {
  data: RegistrationData;
  onEdit: (step: number) => void;
  onConsentChange: (patch: Partial<RegistrationData["consent"]>) => void;
}

function fmt(v: unknown) {
  if (v === "" || v === null || v === undefined) return <span className="text-slate-500">Not provided</span>;
  if (Array.isArray(v)) return v.length ? v.join(", ") : <span className="text-slate-500">Not provided</span>;
  return String(v);
}

function Section({ title, step, onEdit, children }: { title: string; step: number; onEdit: (s: number) => void; children: React.ReactNode }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-white">{title}</h3>
        <button type="button" onClick={() => onEdit(step)} className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1">
          <Edit2 size={12} /> Edit
        </button>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">{children}</dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-white">{value}</dd>
    </>
  );
}

export function Step6Review({ data, onEdit, onConsentChange }: Props) {
  const score = completenessScore(data);
  const color = score >= 80 ? "#10b981" : score >= 50 ? "#f59e0b" : "#f43f5e";
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-white">Review & Submit</h2>
        <p className="text-sm text-slate-400">Verify your information before submitting.</p>
      </div>

      <div className="flex items-center gap-6 bg-white/5 border border-white/10 rounded-2xl p-5">
        <div className="relative h-24 w-24 flex-shrink-0">
          <svg className="h-24 w-24 -rotate-90">
            <circle cx="48" cy="48" r="40" stroke="rgba(255,255,255,0.1)" strokeWidth="8" fill="none" />
            <motion.circle
              cx="48" cy="48" r="40" stroke={color} strokeWidth="8" fill="none" strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-xl font-bold text-white">{score}%</div>
        </div>
        <div>
          <div className="text-white font-semibold">Your profile is {score}% complete</div>
          <div className="text-sm text-slate-400 mt-1">
            {score >= 80 ? "Excellent!" : score >= 50 ? "Good — a few more fields would help." : "Please add more information for a better profile."}
          </div>
        </div>
      </div>

      <Section title="Personal" step={1} onEdit={onEdit}>
        <Row label="First name" value={fmt(data.personal.firstName)} />
        <Row label="Last name" value={fmt(data.personal.lastName)} />
        <Row label="Middle name" value={fmt(data.personal.middleName)} />
        <Row label="Preferred name" value={fmt(data.personal.preferredName)} />
        <Row label="Date of birth" value={fmt(data.personal.dob)} />
        <Row label="Gender" value={fmt(data.personal.gender)} />
      </Section>

      <Section title="Contact" step={2} onEdit={onEdit}>
        <Row label="Primary phone" value={fmt(data.contact.phonePrimary)} />
        <Row label="Secondary phone" value={fmt(data.contact.phoneSecondary)} />
        <Row label="Email" value={fmt(data.contact.email)} />
        <Row label="State" value={fmt(data.contact.state)} />
        <Row label="City" value={fmt(data.contact.city)} />
        <Row label="Country" value={fmt(data.contact.country)} />
      </Section>

      <Section title="Family" step={3} onEdit={onEdit}>
        <Row label="Marital status" value={fmt(data.family.maritalStatus)} />
        <Row label="Spouse" value={fmt(data.family.spouseName)} />
        <Row label="Children" value={data.family.children.length ? `${data.family.children.length} listed` : <span className="text-slate-500">None</span>} />
      </Section>

      <Section title="Church Life" step={4} onEdit={onEdit}>
        <Row label="Attendance" value={fmt(data.churchLife.attendanceDuration)} />
        <Row label="Stage" value={fmt(data.churchLife.membershipStage)} />
        <Row label="House Fellowship Centre" value={fmt(data.churchLife.cellGroupText)} />
        <Row label="Departments" value={data.churchLife.departmentIds.length ? `${data.churchLife.departmentIds.length} selected` : <span className="text-slate-500">None</span>} />
      </Section>

      <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-blue-200">
        Your family group will be automatically assigned based on your age and marital status after registration.
      </div>

      <Section title="Spiritual" step={5} onEdit={onEdit}>
        <Row label="Salvation" value={fmt(data.spiritual.salvation)} />
        <Row label="Baptised" value={fmt(data.spiritual.baptised)} />
        <Row label="Believers' class" value={fmt(data.spiritual.believersClass)} />
        <Row label="Baptismal class" value={fmt(data.spiritual.baptismalClass)} />
      </Section>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
        <h3 className="font-semibold text-white">Consent</h3>
        {[
          { key: "infoAccurate" as const, label: "I confirm this information is accurate", required: true },
          { key: "churchUse" as const, label: "I agree to church data usage", required: true },
          { key: "photoConsent" as const, label: "I consent to photo usage (optional)", required: false },
        ].map(({ key, label, required }) => (
          <label key={key} className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={data.consent[key]}
              onChange={(e) => onConsentChange({ [key]: e.target.checked } as Partial<RegistrationData["consent"]>)}
              className="mt-0.5 h-5 w-5 rounded border-white/20 bg-white/5 accent-violet-600"
            />
            <span className="text-sm text-slate-300">
              {label} {required && <span className="text-rose-400">*</span>}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
