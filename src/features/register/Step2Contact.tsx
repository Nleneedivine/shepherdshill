import { Input, Select } from "@/components/ds";
import { NIGERIAN_STATES, formatNigerianPhone } from "@/lib/nigeria";
import type { RegistrationData } from "@/types";

interface Props {
  data: RegistrationData["contact"];
  errors: Record<string, string>;
  onChange: (patch: Partial<RegistrationData["contact"]>) => void;
}

export function Step2Contact({ data, errors, onChange }: Props) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-white">Contact Information</h2>
      <p className="text-sm text-slate-400">How can we reach you?</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Primary phone" required value={data.phonePrimary} error={errors.phonePrimary}
          placeholder="0803… or +234…"
          onChange={(e) => onChange({ phonePrimary: e.target.value })}
          onBlur={(e) => onChange({ phonePrimary: formatNigerianPhone(e.target.value) })}
          hint={data.phonePrimary ? `Formatted: ${formatNigerianPhone(data.phonePrimary)}` : undefined}
        />
        <Input
          label="Secondary phone" value={data.phoneSecondary} error={errors.phoneSecondary}
          placeholder="Optional"
          onChange={(e) => onChange({ phoneSecondary: e.target.value })}
          onBlur={(e) => e.target.value && onChange({ phoneSecondary: formatNigerianPhone(e.target.value) })}
        />
        <Input label="Email" type="email" value={data.email} error={errors.email}
          onChange={(e) => onChange({ email: e.target.value })} />
        <Input label="City" value={data.city}
          onChange={(e) => onChange({ city: e.target.value })} />
        <Select label="State" required value={data.state} error={errors.state}
          onChange={(e) => onChange({ state: e.target.value })}>
          <option value="">Select state…</option>
          {NIGERIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Input label="Country" value={data.country}
          onChange={(e) => onChange({ country: e.target.value })} />
      </div>

      <Input label="Address" value={data.address}
        onChange={(e) => onChange({ address: e.target.value })} />
    </div>
  );
}
