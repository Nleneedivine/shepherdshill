import { Check } from "lucide-react";
import { Textarea } from "@/components/ds";
import type { RegistrationData } from "@/types";

interface Props {
  data: RegistrationData["spiritual"];
  onChange: (patch: Partial<RegistrationData["spiritual"]>) => void;
}

function Pills<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-2">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = value === o.value;
          const isCompleted = o.value === "completed";
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              className={`px-4 py-2 rounded-full text-sm border transition-all flex items-center gap-1.5 ${
                active
                  ? isCompleted
                    ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                    : "bg-gradient-to-r from-violet-600 to-blue-500 text-white border-transparent"
                  : "bg-white/5 border-white/10 text-slate-300 hover:border-white/20"
              }`}
            >
              {active && isCompleted && <Check size={14} />}
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Step5Spiritual({ data, onChange }: Props) {
  const yesNo = [
    { value: "yes" as const, label: "Yes" },
    { value: "no" as const, label: "No" },
    { value: "not_sure" as const, label: "Not sure" },
  ];
  const baptised = [
    { value: "yes" as const, label: "Yes" },
    { value: "no" as const, label: "No" },
    { value: "in_progress" as const, label: "In progress" },
  ];
  const classes = [
    { value: "completed" as const, label: "Completed" },
    { value: "in_progress" as const, label: "In progress" },
    { value: "not_started" as const, label: "Not started" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-white">Spiritual Journey</h2>
        <p className="text-sm text-slate-400">Where you are in your walk of faith.</p>
      </div>

      <Pills label="Have you accepted salvation?" value={data.salvation} options={yesNo}
        onChange={(v) => onChange({ salvation: v })} />
      <Pills label="Are you baptised in water?" value={data.baptised} options={baptised}
        onChange={(v) => onChange({ baptised: v })} />
      <Pills label="Believers' class" value={data.believersClass} options={classes}
        onChange={(v) => onChange({ believersClass: v })} />
      <Pills label="Baptismal class" value={data.baptismalClass} options={classes}
        onChange={(v) => onChange({ baptismalClass: v })} />
      <Pills label="Worker training" value={data.workerTraining} options={classes}
        onChange={(v) => onChange({ workerTraining: v })} />

      <Textarea label="Other training or spiritual milestones (optional)" value={data.otherTraining}
        onChange={(e) => onChange({ otherTraining: e.target.value })} />
    </div>
  );
}
