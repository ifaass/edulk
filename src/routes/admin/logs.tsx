import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { fieldClass } from "@/components/ui";
import { adminLogs } from "@/server/admin";

export const Route = createFileRoute("/admin/logs")({
  component: LogsAdmin,
});

type Log = { id: number; action: string; entity_type: string; entity_id: string; created_at: string; name: string | null; email: string | null };

function LogsAdmin() {
  const [rows, setRows] = useState<Log[]>([]);
  const [q, setQ] = useState("");
  useEffect(() => {
    void adminLogs().then((result) => { if (result.ok) setRows(result.logs as Log[]); });
  }, []);
  const shown = rows.filter((row) => `${row.action} ${row.entity_type} ${row.name ?? ""} ${row.email ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <h1 className="font-display text-4xl">Log</h1>
      <input className={`${fieldClass} mt-4 max-w-sm`} placeholder="Filter by action or person" value={q} onChange={(event) => setQ(event.target.value)} />
      <ul className="mt-4 flex flex-col">
        {shown.map((row) => (
          <li key={row.id} className="grid gap-1 border-t border-border py-3 text-sm sm:grid-cols-[8rem_1fr_auto]">
            <span className="text-muted">{row.created_at?.slice(0, 16)}</span>
            <span>{row.name ?? row.email ?? "Admin"} · {row.action} {row.entity_type}</span>
            <span className="text-muted">{row.entity_id}</span>
          </li>
        ))}
      </ul>
      {shown.length === 0 ? <p className="mt-4 text-muted">Nothing here yet.</p> : null}
    </div>
  );
}
