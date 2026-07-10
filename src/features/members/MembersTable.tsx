import { motion } from "framer-motion";
import { ArrowDown, ArrowUp, MoreVertical } from "lucide-react";
import { Avatar, Badge } from "@/components/ds";
import type { MemberListItem, MemberFilterState } from "./useMembers";

interface Props {
  items: MemberListItem[];
  selected: Set<string>;
  onToggle: (id: string, v: boolean) => void;
  onToggleAll: (v: boolean) => void;
  sort: MemberFilterState["sort"];
  dir: MemberFilterState["dir"];
  onSort: (col: MemberFilterState["sort"]) => void;
}

function SortHeader({ label, active, dir, onClick }: { label: string; active: boolean; dir: "asc" | "desc"; onClick: () => void }) {
  return (
    <button className="flex items-center gap-1 uppercase text-xs text-slate-400 hover:text-white" onClick={onClick}>
      {label}
      {active ? (dir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : null}
    </button>
  );
}

export function MembersTable({ items, selected, onToggle, onToggleAll, sort, dir, onSort }: Props) {
  const allSelected = items.length > 0 && items.every((m) => selected.has(m.id));

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
      <table className="w-full text-sm text-left">
        <thead className="border-b border-white/5">
          <tr>
            <th className="px-4 py-3 w-10">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => onToggleAll(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-white/5 accent-violet-600"
              />
            </th>
            <th className="px-4 py-3"><SortHeader label="Name" active={sort === "name"} dir={dir} onClick={() => onSort("name")} /></th>
            <th className="px-4 py-3 text-xs uppercase text-slate-400">Member ID</th>
            <th className="px-4 py-3 text-xs uppercase text-slate-400">Phone</th>
            <th className="px-4 py-3"><SortHeader label="Stage" active={sort === "membership_stage"} dir={dir} onClick={() => onSort("membership_stage")} /></th>
            <th className="px-4 py-3 text-xs uppercase text-slate-400">Cell group</th>
            <th className="px-4 py-3 text-xs uppercase text-slate-400">Departments</th>
            <th className="px-4 py-3 text-xs uppercase text-slate-400">Status</th>
            <th className="px-4 py-3 text-right"><SortHeader label="Joined" active={sort === "created_at"} dir={dir} onClick={() => onSort("created_at")} /></th>
            <th className="px-4 py-3 w-10" />
          </tr>
        </thead>
        <tbody>
          {items.map((m, idx) => (
            <motion.tr
              key={m.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.02 }}
              className="border-b border-white/5 hover:bg-white/5"
            >
              <td className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={selected.has(m.id)}
                  onChange={(e) => onToggle(m.id, e.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-white/5 accent-violet-600"
                />
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <Avatar name={`${m.first_name} ${m.last_name}`} src={m.profile_photo_url ?? undefined} size="sm" />
                  <div className="text-white truncate">{m.first_name} {m.last_name}</div>
                </div>
              </td>
              <td className="px-4 py-3 text-slate-300 font-mono text-xs">{m.member_code ?? "—"}</td>
              <td className="px-4 py-3 text-slate-300">{m.phone_primary ?? "—"}</td>
              <td className="px-4 py-3">
                {m.membership_stage ? <Badge variant="purple">{m.membership_stage.replace(/_/g, " ")}</Badge> : <span className="text-slate-500 text-xs">—</span>}
              </td>
              <td className="px-4 py-3 text-slate-300">{m.cell_group_name ?? "—"}</td>
              <td className="px-4 py-3 text-slate-300 truncate max-w-[180px]">{m.department_names.join(", ") || "—"}</td>
              <td className="px-4 py-3">
                <Badge variant={m.membership_status === "active" ? "success" : "warning"}>{m.membership_status}</Badge>
              </td>
              <td className="px-4 py-3 text-right text-slate-400 text-xs">{new Date(m.created_at).toLocaleDateString()}</td>
              <td className="px-4 py-3">
                <button className="text-slate-400 hover:text-white" aria-label="Actions">
                  <MoreVertical size={16} />
                </button>
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
