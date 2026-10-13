import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button, fieldClass } from "@/components/ui";
import { adminListGrades, adminListSubjects, deleteSubject, moveSubject, saveSubject } from "@/server/admin";

export const Route = createFileRoute("/admin/subjects")({
  component: SubjectsAdmin,
});

type Subject = {
  id: number;
  gradeId: number;
  gradeNumber: number;
  name: { en: string; si: string; ta: string };
  icon: string;
  color: string;
  isActive: boolean;
  lessonCount: number;
};

function SubjectsAdmin() {
  const [gradeId, setGradeId] = useState(0);
  const [grades, setGrades] = useState<{ id: number; number: number }[]>([]);
  const [rows, setRows] = useState<Subject[]>([]);
  const [editing, setEditing] = useState<Partial<Subject> | null>(null);
  const [error, setError] = useState("");

  async function load(next = gradeId) {
    const result = await adminListSubjects({ data: next });
    if (result.ok) setRows(result.subjects as Subject[]);
    else setError(result.error);
  }
  useEffect(() => {
    void adminListGrades().then((result) => {
      if (result.ok) setGrades(result.grades.map((grade) => ({ id: grade.id, number: grade.number })));
    });
    void load(0);
  }, []);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-4xl">Subjects</h1>
        <Button type="button" onClick={() => setEditing({ gradeId: gradeId || grades[0]?.id, icon: "book", color: "lagoon", isActive: true, name: { en: "", si: "", ta: "" } })}>Add</Button>
      </div>
      <label className="mt-4 block text-sm">Filter
        <select className={`${fieldClass} mt-1 max-w-xs`} value={gradeId} onChange={(event) => { const next = Number(event.target.value); setGradeId(next); void load(next); }}>
          <option value={0}>All grades</option>
          {grades.map((grade) => <option key={grade.id} value={grade.id}>Grade {grade.number}</option>)}
        </select>
      </label>
      {error ? <p className="mt-3 text-sm text-accent">{error}</p> : null}
      <ul className="mt-4 flex flex-col gap-2">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border px-4 py-3">
            <span>G{row.gradeNumber} · {row.name.en} <span className="text-muted">({row.lessonCount})</span></span>
            <span className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => void moveSubject({ data: { id: row.id, dir: "up" } }).then(() => load())}>Up</Button>
              <Button type="button" variant="ghost" onClick={() => void moveSubject({ data: { id: row.id, dir: "down" } }).then(() => load())}>Down</Button>
              <Button type="button" variant="ghost" onClick={() => setEditing(row)}>Edit</Button>
              <Button type="button" variant="danger" onClick={() => void deleteSubject({ data: row.id }).then(() => load())}>Delete</Button>
            </span>
          </li>
        ))}
      </ul>
      {editing ? (
        <form className="mt-6 grid max-w-lg gap-3" onSubmit={(event) => {
          event.preventDefault();
          void saveSubject({
            data: {
              id: editing.id,
              gradeId: editing.gradeId ?? 0,
              nameEn: editing.name?.en ?? "",
              nameSi: editing.name?.si ?? "",
              nameTa: editing.name?.ta ?? "",
              icon: editing.icon ?? "book",
              color: editing.color ?? "lagoon",
              isActive: editing.isActive !== false,
            },
          }).then((result) => {
            if (!result.ok) setError(result.error);
            else { setEditing(null); void load(); }
          }).catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not save"));
        }}>
          <select className={fieldClass} value={editing.gradeId ?? 0} onChange={(event) => setEditing({ ...editing, gradeId: Number(event.target.value) })}>
            {grades.map((grade) => <option key={grade.id} value={grade.id}>Grade {grade.number}</option>)}
          </select>
          <input className={fieldClass} placeholder="English" value={editing.name?.en ?? ""} onChange={(event) => setEditing({ ...editing, name: { en: event.target.value, si: editing.name?.si ?? "", ta: editing.name?.ta ?? "" } })} />
          <input className={fieldClass} placeholder="Sinhala" value={editing.name?.si ?? ""} onChange={(event) => setEditing({ ...editing, name: { en: editing.name?.en ?? "", si: event.target.value, ta: editing.name?.ta ?? "" } })} />
          <input className={fieldClass} placeholder="Tamil" value={editing.name?.ta ?? ""} onChange={(event) => setEditing({ ...editing, name: { en: editing.name?.en ?? "", si: editing.name?.si ?? "", ta: event.target.value } })} />
          <select className={fieldClass} value={editing.icon ?? "book"} onChange={(event) => setEditing({ ...editing, icon: event.target.value })}>
            {["calculator", "leaf", "languages", "flask", "landmark", "cpu", "radical", "atom", "microscope", "book"].map((icon) => <option key={icon}>{icon}</option>)}
          </select>
          <select className={fieldClass} value={editing.color ?? "lagoon"} onChange={(event) => setEditing({ ...editing, color: event.target.value })}>
            <option value="lagoon">Lagoon</option>
            <option value="cinnamon">Cinnamon</option>
            <option value="ink">Ink</option>
          </select>
          <div className="flex gap-2">
            <Button type="submit">Save</Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
