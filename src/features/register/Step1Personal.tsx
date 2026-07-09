import { useRef } from "react";
import { Upload, X } from "lucide-react";
import { Input, Select } from "@/components/ds";
import type { RegistrationData } from "@/types";

interface Props {
  data: RegistrationData["personal"];
  errors: Record<string, string>;
  onChange: (patch: Partial<RegistrationData["personal"]>) => void;
}

export function Step1Personal({ data, errors, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => onChange({ photoFile: file, photoPreview: String(e.target?.result ?? "") });
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-white">Personal Details</h2>
      <p className="text-sm text-slate-400">Tell us about yourself.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="First name" required value={data.firstName} error={errors.firstName}
          onChange={(e) => onChange({ firstName: e.target.value })} />
        <Input label="Middle name" value={data.middleName}
          onChange={(e) => onChange({ middleName: e.target.value })} />
        <Input label="Last name" required value={data.lastName} error={errors.lastName}
          onChange={(e) => onChange({ lastName: e.target.value })} />
        <Input label="Preferred name" value={data.preferredName}
          onChange={(e) => onChange({ preferredName: e.target.value })} />
        <Input label="Date of birth" type="date" required value={data.dob} error={errors.dob}
          onChange={(e) => onChange({ dob: e.target.value })} />
        <Select label="Gender" required value={data.gender} error={errors.gender}
          onChange={(e) => onChange({ gender: e.target.value })}>
          <option value="">Select…</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </Select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">Profile photo</label>
        {data.photoPreview ? (
          <div className="relative inline-block">
            <img src={data.photoPreview} alt="Preview" className="h-32 w-32 rounded-xl object-cover border border-white/10" />
            <button
              type="button"
              onClick={() => onChange({ photoFile: null, photoPreview: "" })}
              className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-rose-500/90 hover:bg-rose-500 text-white flex items-center justify-center"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full border-2 border-dashed border-white/15 hover:border-violet-500/50 rounded-xl p-8 flex flex-col items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <Upload size={24} />
            <span className="text-sm">Click to upload a photo</span>
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
      </div>
    </div>
  );
}
