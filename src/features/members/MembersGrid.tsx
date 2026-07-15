import { motion } from "framer-motion";
import { Eye, MessageSquare } from "lucide-react";
import { Avatar, Badge, Button } from "@/components/ds";
import type { MemberListItem } from "./useMembers";

interface Props {
  items: MemberListItem[];
  selected: Set<string>;
  onToggle: (id: string, v: boolean) => void;
}

export function MembersGrid({ items, selected, onToggle }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {items.map((m, idx) => (
        <motion.div
          key={m.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.02 }}
          transition={{ delay: idx * 0.03 }}
          className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 hover:border-violet-500/40 hover:shadow-[0_0_20px_rgba(139,92,246,0.15)]"
        >
          <input
            type="checkbox"
            checked={selected.has(m.id)}
            onChange={(e) => onToggle(m.id, e.target.checked)}
            className="absolute top-3 right-3 h-4 w-4 rounded border-white/20 bg-white/5 accent-violet-600"
          />
          <div className="flex flex-col items-center text-center">
            <Avatar name={`${m.first_name} ${m.last_name}`} src={m.profile_photo_url ?? undefined} size="lg" />
            <div className="mt-3 font-medium text-white truncate max-w-full">{m.first_name} {m.last_name}</div>
            <div className="text-xs text-slate-400 font-mono">{m.member_code ?? "—"}</div>
            <div className="mt-2 flex flex-wrap justify-center gap-1">
              {m.membership_stage && <Badge variant="purple">{m.membership_stage.replace(/_/g, " ")}</Badge>}
              <Badge variant={m.membership_status === "active" ? "success" : "warning"}>{m.membership_status}</Badge>
            </div>
            <div className="mt-2 text-xs text-slate-400 truncate max-w-full">{m.cell_group_name ?? "No House Fellowship Centre"}</div>
            <div className="mt-4 flex gap-2 w-full">
              <Button size="sm" variant="secondary" className="flex-1"><Eye size={14} /> View</Button>
              <Button size="sm" variant="ghost" className="flex-1"><MessageSquare size={14} /> Message</Button>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
