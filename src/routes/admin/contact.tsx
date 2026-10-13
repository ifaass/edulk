import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { adminListContact, setContactStatus } from "@/server/admin";

export const Route = createFileRoute("/admin/contact")({
  component: ContactAdmin,
});

type Msg = { id: number; name: string; email: string; reason: string; message: string; status: string; created_at: string };

function ContactAdmin() {
  const [rows, setRows] = useState<Msg[]>([]);
  const [reason, setReason] = useState("all");

  async function load() {
    const result = await adminListContact();
    if (result.ok) setRows(result.messages as Msg[]);
  }
  useEffect(() => { void load(); }, []);

  const shown = rows.filter((row) => reason === "all" || row.reason === reason);

  function exportCsv() {
    const header = "name,email,reason,status,message";
    const body = shown.map((row) => [row.name, row.email, row.reason, row.status, row.message].map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([`${header}\n${body}`], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "edulk-contact.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-4xl">Inbox</h1>
        <Button type="button" variant="ghost" onClick={exportCsv}>Export CSV</Button>
      </div>
      <p className="mt-2 text-sm text-muted">Replies are not emailed. Marking resolved only updates this desk.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {["all", "general", "permission", "technical"].map((item) => (
          <Button key={item} type="button" variant={reason === item ? "primary" : "ghost"} onClick={() => setReason(item)}>{item}</Button>
        ))}
      </div>
      <ul className="mt-4 flex flex-col gap-3">
        {shown.map((row) => (
          <li key={row.id} className="rounded-2xl border border-border p-4">
            <p className="font-medium">{row.name} · {row.email}</p>
            <p className="text-xs text-muted">{row.reason} · {row.status}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm">{row.message}</p>
            <div className="mt-3 flex gap-2">
              <Button type="button" variant="ghost" onClick={() => void setContactStatus({ data: { id: row.id, status: "read" } }).then(load)}>Read</Button>
              <Button type="button" variant="ghost" onClick={() => void setContactStatus({ data: { id: row.id, status: "resolved" } }).then(load)}>Resolved</Button>
            </div>
          </li>
        ))}
      </ul>
      {shown.length === 0 ? <p className="mt-4 text-muted">Nothing here yet.</p> : null}
    </div>
  );
}
