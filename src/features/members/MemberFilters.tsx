import { X } from "lucide-react";
import { Card, Input, Select, Button } from "@/components/ds";
import type { MemberFilterState } from "./useMembers";

interface Props {
  filters: MemberFilterState;
  onChange: (patch: Partial<MemberFilterState>) => void;
  searchInput: string;
  onSearchInput: (v: string) => void;
  options: {
    stages: string[];
    departments: { id: string; name: string }[];
    cellGroups: { id: string; name: string }[];
  };
  onClear: () => void;
}

export function MemberFilters({ filters, onChange, searchInput, onSearchInput, options, onClear }: Props) {
  const active =
    filters.q ||
    filters.stage !== "all" ||
    filters.dept !== "all" ||
    filters.cell !== "all" ||
    (filters.status !== "all" && filters.status !== "active") ||
    filters.bio !== "all";

  return (
    <Card className="mb-6">
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Input label="Search" placeholder="Name, phone, code…" value={searchInput} onChange={(e) => onSearchInput(e.target.value)} />
        <Select label="Stage" value={filters.stage} onChange={(e) => onChange({ stage: e.target.value })}>
          <option value="all">All stages</option>
          {options.stages.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
          ))}
        </Select>
        <Select label="Department" value={filters.dept} onChange={(e) => onChange({ dept: e.target.value })}>
          <option value="all">All departments</option>
          {options.departments.map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))}
        </Select>
        <Select label="House Fellowship Centre" value={filters.cell} onChange={(e) => onChange({ cell: e.target.value })}>
          <option value="all">All House Fellowship Centres</option>
          {options.cellGroups.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
        </Select>
        <Select label="Status" value={filters.status} onChange={(e) => onChange({ status: e.target.value })}>
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="transferred">Transferred</option>
        </Select>
        <Select label="Biometrics" value={filters.bio} onChange={(e) => onChange({ bio: e.target.value })}>
          <option value="all">All</option>
          <option value="enrolled">Enrolled</option>
          <option value="not_enrolled">Not enrolled</option>
        </Select>
      </div>
      {active && (
        <div className="mt-3">
          <Button size="sm" variant="ghost" onClick={onClear}>
            <X size={14} /> Clear filters
          </Button>
        </div>
      )}
    </Card>
  );
}
