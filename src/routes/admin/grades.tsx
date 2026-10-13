import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button, fieldClass } from "@/components/ui";
import { adminListGrades, deleteGrade, moveGrade, saveGrade } from "@/server/admin";

export const Route = createFileRoute("/admin/grades")({
  component: GradesAdmin,
});

type Grade = {
  id: number;
  number: number;
  name: { en: string; si: string; ta: string };
  band: string;
  isActive: boolean;
  subjectCount: number;
};

function GradesAdmin() {
  const [rows, setRows] = useState<Grade[]>([]);
  const [editing, setEditing] = useState<Partial<Grade> | null>(null);
  const [confirm, setConfirm] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function load() {
    const result = await adminListGrades();
    if (result.ok) setRows(result.grades as Grade[]);
    else setError(result.error);
  }
  useEffect(() => { void load(); }, []);

  async function onSave() {
    if (!editing) return;
    setError("");
    try {
      const result = await saveGrade({
        data: {
          id: editing.id,
          number: editing.number ?? 1,
          nameEn: editing.name?.en ?? "",
          nameSi: editing.name?.si ?? "",
          nameTa: editing.name?.ta ?? "",
          band: editing.band ?? "primary",
          isActive: editing.isActive !== false,
        },
      });
      if (!result.ok) setError(result.error);
      else { setEditing(null); await load(); }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-4xl">Grades</h1>
        <Button type="button" onClick={() => setEditing({ number: 1, band: "primary", isActive: true, name: { en: "", si: "", ta: "" } })}>Add</Button>
      </div>
      {error ? <p className="mt-3 text-sm text-accent">{error}</p> : null}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-muted">
            <tr><th className="py-2">#</th><th>Name</th><th>Subjects</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-border">
                <td className="py-3 tabular-nums">{row.number}</td>
                <td>{row.name.en}<span className="block text-xs text-muted">{row.name.si} · {row.name.ta}</span></td>
                <td className="tabular-nums">{row.subjectCount}</td>
                <td>{row.isActive ? "Active" : "Hidden"}</td>
                <td className="flex flex-wrap gap-2 py-2">
                  <Button type="button" variant="ghost" onClick={() => void moveGrade({ data: { id: row.id, dir: "up" } }).then(load)}>Up</Button>
                  <Button type="button" variant="ghost" onClick={() => void moveGrade({ data: { id: row.id, dir: "down" } }).then(load)}>Down</Button>
                  <Button type="button" variant="ghost" onClick={() => setEditing(row)}>Edit</Button>
                  {confirm === row.id ? (
                    <Button type="button" variant="danger" onClick={() => void deleteGrade({ data: row.id }).then(() => { setConfirm(null); return load(); })}>Confirm delete</Button>
                  ) : (
                    <Button type="button" variant="ghost" onClick={() => setConfirm(row.id)}>Delete</Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing ? (
        <form className="mt-6 grid max-w-lg gap-3 rounded-2xl border border-border bg-surface p-4" onSubmit={(event) => { event.preventDefault(); void onSave(); }}>
          <label>Number
            <input className={fieldClass} type="number" min={1} max={13} value={editing.number ?? 1} onChange={(event) => setEditing({ ...editing, number: Number(event.target.value) })} />
          </label>
          <label>English<input className={fieldClass} value={editing.name?.en ?? ""} onChange={(event) => setEditing({ ...editing, name: { en: event.target.value, si: editing.name?.si ?? "", ta: editing.name?.ta ?? "" } })} /></label>
          <label>Sinhala<input className={fieldClass} value={editing.name?.si ?? ""} onChange={(event) => setEditing({ ...editing, name: { en: editing.name?.en ?? "", si: event.target.value, ta: editing.name?.ta ?? "" } })} /></label>
          <label>Tamil<input className={fieldClass} value={editing.name?.ta ?? ""} onChange={(event) => setEditing({ ...editing, name: { en: editing.name?.en ?? "", si: editing.name?.si ?? "", ta: event.target.value } })} /></label>
          <label>Band
            <select className={fieldClass} value={editing.band ?? "primary"} onChange={(event) => setEditing({ ...editing, band: event.target.value })}>
              <option value="primary">Primary</option>
              <option value="junior">Junior</option>
              <option value="ol">O/L</option>
              <option value="al">A/L</option>
            </select>
          </label>
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" checked={editing.isActive !== false} onChange={(event) => setEditing({ ...editing, isActive: event.target.checked })} />
            Active
          </label>
          <div className="flex gap-2">
            <Button type="submit">Save</Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
