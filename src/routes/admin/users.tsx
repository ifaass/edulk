import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button, fieldClass } from "@/components/ui";
import type { Tier } from "@/lib/types";
import { adminListUsers, setUserAccess } from "@/server/admin";

export const Route = createFileRoute("/admin/users")({
  component: UsersAdmin,
});

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: "student" | "admin" | null;
  tier: Tier | null;
  expires_at: string | null;
  banned_at: string | null;
};

function UsersAdmin() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const result = await adminListUsers();
    if (result.ok) setRows(result.users as UserRow[]);
    else setError(result.error);
  }
  useEffect(() => { void load(); }, []);

  const shown = rows.filter((row) => `${row.name} ${row.email}`.toLowerCase().includes(q.toLowerCase()));

  async function update(userId: string, patch: { role?: "student" | "admin"; tier?: Tier; banned?: boolean }) {
    const result = await setUserAccess({ data: { userId, ...patch } });
    if (!result.ok) setError(result.error);
    else { setError(""); await load(); }
  }

  return (
    <div>
      <h1 className="font-display text-4xl">Students</h1>
      <p className="mt-2 max-w-xl text-sm text-muted">Plans here are previews for 30 days. They do not charge PayHere or Stripe.</p>
      <input className={`${fieldClass} mt-4 max-w-sm`} placeholder="Search name or email" value={q} onChange={(event) => setQ(event.target.value)} />
      {error ? <p className="mt-3 text-sm text-accent">{error}</p> : null}
      <ul className="mt-4 flex flex-col gap-3">
        {shown.map((row) => (
          <li key={row.id} className="rounded-2xl border border-border p-4">
            <p className="font-medium">{row.name}</p>
            <p className="text-sm text-muted">{row.email}</p>
            <p className="mt-1 text-sm">{row.role ?? "no profile"} · {row.tier ?? "free"} {row.banned_at ? "· suspended" : ""}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" variant="ghost" onClick={() => void update(row.id, { role: row.role === "admin" ? "student" : "admin" })}>
                {row.role === "admin" ? "Make student" : "Make admin"}
              </Button>
              {(["free", "premium", "premium_plus"] as Tier[]).map((tier) => (
                <Button key={tier} type="button" variant="ghost" onClick={() => void update(row.id, { tier })}>{tier}</Button>
              ))}
              <Button type="button" variant="danger" onClick={() => void update(row.id, { banned: !row.banned_at })}>
                {row.banned_at ? "Unsuspend" : "Suspend"}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
