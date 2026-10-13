import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button, fieldClass } from "@/components/ui";
import { adminListGrades, adminListLessons, adminListSubjects, deleteLesson, previewYoutube, saveLesson } from "@/server/admin";

export const Route = createFileRoute("/admin/lessons")({
  component: LessonsAdmin,
});

type LessonRow = {
  id: number;
  title_en: string;
  title_si: string;
  title_ta: string;
  summary_en: string;
  notes_en: string;
  notes_si: string;
  notes_ta: string;
  tier_required: "free" | "premium";
  status: "draft" | "published";
  is_featured: boolean;
  grade_id: number;
  subject_id: number;
  grade_number: number;
  source_url: string | null;
};

const empty = {
  gradeId: 0,
  subjectId: 0,
  titleEn: "",
  titleSi: "",
  titleTa: "",
  summaryEn: "",
  notesEn: "",
  notesSi: "",
  notesTa: "",
  youtubeUrl: "",
  tier: "free" as const,
  status: "published" as const,
  featured: false,
};

function LessonsAdmin() {
  const [gradeId, setGradeId] = useState(0);
  const [subjectId, setSubjectId] = useState(0);
  const [grades, setGrades] = useState<{ id: number; number: number }[]>([]);
  const [subjects, setSubjects] = useState<{ id: number; gradeId: number; name: { en: string } }[]>([]);
  const [rows, setRows] = useState<LessonRow[]>([]);
  const [form, setForm] = useState<typeof empty & { id?: number } | null>(null);
  const [preview, setPreview] = useState<{ title: string; author: string; thumbnail: string } | null>(null);
  const [error, setError] = useState("");

  async function load(g = gradeId, s = subjectId) {
    const result = await adminListLessons({ data: { gradeId: g, subjectId: s } });
    if (result.ok) setRows(result.lessons as LessonRow[]);
  }

  useEffect(() => {
    void adminListGrades().then((result) => { if (result.ok) setGrades(result.grades.map((g) => ({ id: g.id, number: g.number }))); });
    void adminListSubjects({ data: 0 }).then((result) => {
      if (result.ok) setSubjects(result.subjects.map((s) => ({ id: s.id, gradeId: s.gradeId, name: s.name })));
    });
    void load(0, 0);
  }, []);

  const visibleSubjects = subjects.filter((s) => !form?.gradeId || s.gradeId === form.gradeId);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-4xl">Lessons</h1>
        <Button type="button" onClick={() => { setPreview(null); setForm({ ...empty, gradeId: gradeId || grades[0]?.id || 0 }); }}>Add</Button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <select className={fieldClass} value={gradeId} onChange={(event) => { const next = Number(event.target.value); setGradeId(next); setSubjectId(0); void load(next, 0); }}>
          <option value={0}>All grades</option>
          {grades.map((g) => <option key={g.id} value={g.id}>Grade {g.number}</option>)}
        </select>
        <select className={fieldClass} value={subjectId} onChange={(event) => { const next = Number(event.target.value); setSubjectId(next); void load(gradeId, next); }}>
          <option value={0}>All subjects</option>
          {subjects.filter((s) => gradeId === 0 || s.gradeId === gradeId).map((s) => <option key={s.id} value={s.id}>{s.name.en}</option>)}
        </select>
      </div>
      {error ? <p className="mt-3 text-sm text-accent">{error}</p> : null}
      <ul className="mt-4 flex flex-col gap-2">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-3 text-sm">
            <span>G{row.grade_number} · {row.title_en} · {row.tier_required} · {row.status}</span>
            <span className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setForm({
                id: row.id,
                gradeId: row.grade_id,
                subjectId: row.subject_id,
                titleEn: row.title_en,
                titleSi: row.title_si,
                titleTa: row.title_ta,
                summaryEn: row.summary_en,
                notesEn: row.notes_en,
                notesSi: row.notes_si,
                notesTa: row.notes_ta,
                youtubeUrl: row.source_url ?? "",
                tier: row.tier_required,
                status: row.status,
                featured: row.is_featured,
              })}>Edit</Button>
              <Button type="button" variant="danger" onClick={() => void deleteLesson({ data: row.id }).then(() => load())}>Delete</Button>
            </span>
          </li>
        ))}
      </ul>
      {form ? (
        <form className="mt-6 grid max-w-2xl gap-3" onSubmit={(event) => {
          event.preventDefault();
          void saveLesson({ data: form }).then((result) => {
            if (!result.ok) setError(result.error);
            else { setForm(null); void load(); }
          }).catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not save"));
        }}>
          <div className="grid gap-2 sm:grid-cols-2">
            <select className={fieldClass} value={form.gradeId} onChange={(event) => setForm({ ...form, gradeId: Number(event.target.value), subjectId: 0 })}>
              {grades.map((g) => <option key={g.id} value={g.id}>Grade {g.number}</option>)}
            </select>
            <select className={fieldClass} value={form.subjectId} onChange={(event) => setForm({ ...form, subjectId: Number(event.target.value) })}>
              <option value={0}>Subject</option>
              {visibleSubjects.map((s) => <option key={s.id} value={s.id}>{s.name.en}</option>)}
            </select>
          </div>
          <input className={fieldClass} placeholder="Title English" value={form.titleEn} onChange={(event) => setForm({ ...form, titleEn: event.target.value })} />
          <input className={fieldClass} placeholder="Title Sinhala" value={form.titleSi} onChange={(event) => setForm({ ...form, titleSi: event.target.value })} />
          <input className={fieldClass} placeholder="Title Tamil" value={form.titleTa} onChange={(event) => setForm({ ...form, titleTa: event.target.value })} />
          <textarea className={fieldClass} rows={3} placeholder="Notes English" value={form.notesEn} onChange={(event) => setForm({ ...form, notesEn: event.target.value, summaryEn: event.target.value })} />
          <textarea className={fieldClass} rows={2} placeholder="Notes Sinhala" value={form.notesSi} onChange={(event) => setForm({ ...form, notesSi: event.target.value })} />
          <textarea className={fieldClass} rows={2} placeholder="Notes Tamil" value={form.notesTa} onChange={(event) => setForm({ ...form, notesTa: event.target.value })} />
          <label className="text-sm">YouTube URL
            <input className={fieldClass} value={form.youtubeUrl} onChange={(event) => setForm({ ...form, youtubeUrl: event.target.value })} placeholder="https://www.youtube.com/watch?v=…" />
          </label>
          <Button type="button" variant="ghost" onClick={() => void previewYoutube({ data: form.youtubeUrl }).then((result) => {
            if (!result.ok) setError(result.error);
            else { setError(""); setPreview(result); }
          })}>Preview video</Button>
          {preview ? (
            <figure className="overflow-hidden rounded-2xl border border-border">
              <img src={preview.thumbnail} alt="" className="aspect-video w-full object-cover" />
              <figcaption className="p-3 text-sm">{preview.title}<span className="block text-muted">{preview.author}</span></figcaption>
            </figure>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <select className={fieldClass} value={form.tier} onChange={(event) => setForm({ ...form, tier: event.target.value === "premium" ? "premium" : "free" })}>
              <option value="free">Free</option>
              <option value="premium">Premium</option>
            </select>
            <select className={fieldClass} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value === "draft" ? "draft" : "published" })}>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" checked={form.featured} onChange={(event) => setForm({ ...form, featured: event.target.checked })} />
              Featured
            </label>
          </div>
          <div className="flex gap-2">
            <Button type="submit">Save lesson</Button>
            <Button type="button" variant="ghost" onClick={() => setForm(null)}>Cancel</Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
