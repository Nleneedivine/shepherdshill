import { AnimatePresence, motion } from "framer-motion";
import { User, Heart, Shield, UserX, Plus, Trash2 } from "lucide-react";
import { Input, Textarea, Button } from "@/components/ds";
import { formatNigerianPhone } from "@/lib/nigeria";
import type { RegistrationData, ChildEntry } from "@/types";

interface Props {
  data: RegistrationData["family"];
  errors: Record<string, string>;
  onChange: (patch: Partial<RegistrationData["family"]>) => void;
}

const STATUSES = [
  { value: "single", label: "Single", Icon: User },
  { value: "married", label: "Married", Icon: Heart },
  { value: "widowed", label: "Widowed", Icon: Shield },
  { value: "divorced", label: "Divorced", Icon: UserX },
] as const;

export function Step3Family({ data, errors, onChange }: Props) {
  const addChild = () => {
    if (data.children.length >= 10) return;
    onChange({ children: [...data.children, { name: "", age: "" }] });
  };
  const updateChild = (i: number, patch: Partial<ChildEntry>) => {
    const next = data.children.map((c, idx) => (idx === i ? { ...c, ...patch } : c));
    onChange({ children: next });
  };
  const removeChild = (i: number) => onChange({ children: data.children.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white">Family Information</h2>
        <p className="text-sm text-slate-400">Your household details.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Marital status *</label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {STATUSES.map(({ value, label, Icon }) => {
            const active = data.maritalStatus === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => onChange({ maritalStatus: value })}
                className={`p-4 rounded-xl border transition-all flex flex-col items-center gap-2 ${
                  active
                    ? "border-transparent bg-gradient-to-br from-violet-600/20 to-blue-500/20"
                    : "border-white/10 bg-white/5 hover:border-white/20"
                }`}
                style={active ? {
                  backgroundImage: "linear-gradient(rgba(124,58,237,0.15),rgba(59,130,246,0.15)),linear-gradient(135deg,#7c3aed,#3b82f6)",
                  backgroundOrigin: "border-box",
                  backgroundClip: "padding-box,border-box",
                } : undefined}
              >
                <Icon size={20} className={active ? "text-violet-300" : "text-slate-400"} />
                <span className={`text-sm ${active ? "text-white font-medium" : "text-slate-300"}`}>{label}</span>
              </button>
            );
          })}
        </div>
        {errors.maritalStatus && <p className="mt-1.5 text-xs text-rose-400">{errors.maritalStatus}</p>}
      </div>

      <AnimatePresence>
        {data.maritalStatus === "married" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4 overflow-hidden"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Spouse name" required value={data.spouseName} error={errors.spouseName}
                onChange={(e) => onChange({ spouseName: e.target.value })} />
              <Input label="Spouse phone" value={data.spousePhone} error={errors.spousePhone}
                onChange={(e) => onChange({ spousePhone: e.target.value })}
                onBlur={(e) => e.target.value && onChange({ spousePhone: formatNigerianPhone(e.target.value) })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Is spouse a member?</label>
              <div className="flex gap-2">
                {(["yes", "no", "not_sure"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => onChange({ spouseIsMember: v })}
                    className={`px-4 py-2 rounded-xl text-sm border transition-all ${
                      data.spouseIsMember === v
                        ? "bg-gradient-to-r from-violet-600 to-blue-500 text-white border-transparent"
                        : "bg-white/5 border-white/10 text-slate-300 hover:border-white/20"
                    }`}
                  >
                    {v === "not_sure" ? "Not sure" : v.charAt(0).toUpperCase() + v.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-slate-300">Children ({data.children.length}/10)</label>
          <Button type="button" variant="secondary" size="sm" onClick={addChild} disabled={data.children.length >= 10}>
            <Plus size={14} /> Add child
          </Button>
        </div>
        <AnimatePresence>
          {data.children.map((child, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex gap-2 mb-2"
            >
              <div className="flex-1">
                <Input placeholder="Name" value={child.name}
                  onChange={(e) => updateChild(i, { name: e.target.value })}
                  error={errors[`child_${i}`]} />
              </div>
              <div className="w-24">
                <Input type="number" min={0} max={17} placeholder="Age"
                  value={child.age === "" ? "" : child.age}
                  onChange={(e) => updateChild(i, { age: e.target.value === "" ? "" : Number(e.target.value) })} />
              </div>
              <button type="button" onClick={() => removeChild(i)}
                className="h-[46px] w-[46px] flex items-center justify-center rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-400 hover:bg-rose-500/30">
                <Trash2 size={16} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <Textarea label="Other family members in this church (optional)" value={data.otherFamilyMembers}
        onChange={(e) => onChange({ otherFamilyMembers: e.target.value })} />
    </div>
  );
}
