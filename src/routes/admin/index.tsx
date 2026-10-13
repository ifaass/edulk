import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { adminStats } from "@/server/admin";

export const Route = createFileRoute("/admin/")({
  component: Dashboard,
});

function Dashboard() {
  const [data, setData] = useState<Awaited<ReturnType<typeof adminStats>> | null>(null);
  useEffect(() => {
    void adminStats().then(setData);
  }, []);
  if (!data) return <p className="text-muted">Loading the desk…</p>;
  if (!data.ok) return <p>{data.error}</p>;
  const cards = [
    ["Students", data.counts?.students ?? 0],
    ["Paid plans", data.counts?.premium ?? 0],
    ["Lessons", data.counts?.lessons ?? 0],
    ["Videos", data.counts?.videos ?? 0],
    ["New messages", data.counts?.inbox ?? 0],
  ] as const;
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-4xl">Overview</h1>
      <p className="max-w-xl text-sm text-muted">Counts from the catalog. Paid plans are previews, not PayHere or Stripe charges.</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {cards.map(([label, value]) => (
          <article key={label} className="rounded-2xl border border-border bg-surface p-4">
            <p className="text-sm text-muted">{label}</p>
            <p className="font-display text-3xl tabular-nums">{value}</p>
          </article>
        ))}
      </div>
      <div className="h-64 rounded-2xl border border-border bg-surface p-4">
        <h2 className="mb-2 font-display text-xl">Lessons by grade</h2>
        <ResponsiveContainer width="100%" height="85%">
          <BarChart data={data.byGrade}>
            <XAxis dataKey="grade" stroke="var(--color-muted)" fontSize={12} />
            <YAxis allowDecimals={false} stroke="var(--color-muted)" fontSize={12} />
            <Tooltip contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-fg)" }} />
            <Bar dataKey="lessons" fill="var(--color-primary)" radius={4} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <section>
        <h2 className="font-display text-xl">Recent actions</h2>
        {data.recent.length === 0 ? <p className="mt-2 text-sm text-muted">No admin actions yet.</p> : null}
        <ul className="mt-2 flex flex-col">
          {data.recent.map((row) => (
            <li key={row.id} className="flex justify-between gap-3 border-t border-border py-2 text-sm">
              <span>{row.name ?? "Admin"} · {row.action} {row.entity_type}</span>
              <span className="text-muted">{row.entity_id}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
