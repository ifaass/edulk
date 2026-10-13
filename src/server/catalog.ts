import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import type { AdPublic, Band, GradeCard, LessonCard, LessonDetail, QuizQuestion, Tri } from "@/lib/types";

type GradeRow = {
  id: number;
  number: number;
  slug: string;
  name_en: string;
  name_si: string;
  name_ta: string;
  band: Band;
  sort_order: number;
  is_active: boolean;
  subject_count: number;
};

type LessonRow = {
  id: number;
  slug: string;
  title_en: string;
  title_si: string;
  title_ta: string;
  summary_en: string;
  summary_si: string;
  summary_ta: string;
  notes_en: string;
  notes_si: string;
  notes_ta: string;
  tier_required: "free" | "premium";
  status: string;
  sort_order: number;
  is_featured: boolean;
  youtube_id: string | null;
  channel_name: string | null;
  thumbnail_url: string | null;
  grade_number: number;
  grade_slug: string;
  grade_en: string;
  grade_si: string;
  grade_ta: string;
  subject_slug: string;
  subject_en: string;
  subject_si: string;
  subject_ta: string;
  subject_icon: string;
  subject_color: string;
};

const lessonSelect = `
  select l.id, l.slug, l.title_en, l.title_si, l.title_ta,
         l.summary_en, l.summary_si, l.summary_ta,
         l.notes_en, l.notes_si, l.notes_ta,
         l.tier_required, l.status, l.sort_order, l.is_featured,
         v.youtube_id, v.channel_name, v.thumbnail_url,
         g.number as grade_number, g.slug as grade_slug,
         g.name_en as grade_en, g.name_si as grade_si, g.name_ta as grade_ta,
         s.slug as subject_slug, s.name_en as subject_en, s.name_si as subject_si,
         s.name_ta as subject_ta, s.icon as subject_icon, s.color as subject_color
  from lessons l
  join grades g on g.id = l.grade_id
  join subjects s on s.id = l.subject_id
  left join videos v on v.id = l.video_id
`;

function tri(en: string, si: string, ta: string): Tri {
  return { en, si, ta };
}

function mapGrade(row: GradeRow): GradeCard {
  return {
    id: row.id,
    number: row.number,
    slug: row.slug,
    name: tri(row.name_en, row.name_si, row.name_ta),
    band: row.band,
    subjectCount: row.subject_count,
    isActive: row.is_active,
    sortOrder: row.sort_order,
  };
}

function presentLesson(row: LessonRow, entitled: boolean): LessonDetail {
  const locked = row.tier_required === "premium" && !entitled;
  return {
    id: row.id,
    slug: row.slug,
    title: tri(row.title_en, row.title_si, row.title_ta),
    summary: tri(row.summary_en, row.summary_si, row.summary_ta),
    notes: locked
      ? { en: "", si: "", ta: "" }
      : tri(row.notes_en, row.notes_si, row.notes_ta),
    tier: row.tier_required,
    locked,
    status: row.status,
    featured: row.is_featured,
    sortOrder: row.sort_order,
    youtubeId: locked ? null : row.youtube_id,
    channel: locked ? "" : (row.channel_name ?? ""),
    thumbnail: locked ? "" : (row.thumbnail_url ?? ""),
    grade: {
      number: row.grade_number,
      slug: row.grade_slug,
      name: tri(row.grade_en, row.grade_si, row.grade_ta),
    },
    subject: {
      slug: row.subject_slug,
      name: tri(row.subject_en, row.subject_si, row.subject_ta),
      icon: row.subject_icon,
      color: row.subject_color,
    },
    quiz: null,
    positionSeconds: 0,
    bookmarked: false,
    note: "",
  };
}

function toCard(lesson: LessonDetail): LessonCard {
  return {
    id: lesson.id,
    slug: lesson.slug,
    title: lesson.title,
    tier: lesson.tier,
    locked: lesson.locked,
    hasVideo: Boolean(lesson.youtubeId) || lesson.locked,
    sortOrder: lesson.sortOrder,
    status: lesson.status,
    featured: lesson.featured,
  };
}

async function questionsFor(lessonId: number, locked: boolean): Promise<LessonDetail["quiz"]> {
  if (locked) return null;
  const sql = await getSql();
  const quizzes = await sql<{ id: number; pass_percent: number }>`
    select id, pass_percent from quizzes where lesson_id = ${lessonId} limit 1
  `;
  const quiz = quizzes[0];
  if (!quiz) return null;
  const rows = await sql<{
    id: number;
    prompt_en: string;
    prompt_si: string;
    prompt_ta: string;
    choices_en: string;
    choices_si: string;
    choices_ta: string;
  }>`
    select id, prompt_en, prompt_si, prompt_ta, choices_en, choices_si, choices_ta
    from quiz_questions where quiz_id = ${quiz.id} order by sort_order, id
  `;
  const questions: QuizQuestion[] = rows.map((row) => {
    const en = JSON.parse(row.choices_en) as string[];
    const si = JSON.parse(row.choices_si) as string[];
    const ta = JSON.parse(row.choices_ta) as string[];
    return {
      id: row.id,
      prompt: tri(row.prompt_en, row.prompt_si, row.prompt_ta),
      choices: en.map((choice, index) => tri(choice, si[index] ?? choice, ta[index] ?? choice)),
    };
  });
  return { id: quiz.id, passPercent: quiz.pass_percent, questions };
}

export const getHome = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  const grades = await sql<GradeRow>`
    select g.id, g.number, g.slug, g.name_en, g.name_si, g.name_ta, g.band, g.sort_order, g.is_active,
           (select count(*)::int from subjects s where s.grade_id = g.id and s.is_active) as subject_count
    from grades g
    where g.is_active
    order by g.sort_order, g.number
  `;
  const featured = await sql.query<LessonRow>(
    `${lessonSelect} where l.is_featured and l.status = 'published' and g.is_active order by g.number, l.sort_order limit 5`,
  );
  const announcements = await sql<{
    title_en: string;
    title_si: string;
    title_ta: string;
    body_en: string;
    body_si: string;
    body_ta: string;
  }>`
    select title_en, title_si, title_ta, body_en, body_si, body_ta
    from announcements where is_active order by id desc limit 1
  `;
  const ann = announcements[0];
  return {
    grades: grades.map(mapGrade),
    featured: featured.map((row) => presentLesson(row, false)),
    announcement: ann
      ? { title: tri(ann.title_en, ann.title_si, ann.title_ta), body: tri(ann.body_en, ann.body_si, ann.body_ta) }
      : null,
  };
});

export const getGrade = createServerFn({ method: "POST" })
  .validator((slug: string) => slug.trim())
  .handler(async ({ data: slug }) => {
    const sql = await getSql();
    const grades = await sql<GradeRow>`
      select g.id, g.number, g.slug, g.name_en, g.name_si, g.name_ta, g.band, g.sort_order, g.is_active,
             (select count(*)::int from subjects s where s.grade_id = g.id and s.is_active) as subject_count
      from grades g where g.slug = ${slug} and g.is_active
    `;
    const grade = grades[0];
    if (!grade) return null;
    const subjects = await sql<{
      id: number;
      slug: string;
      name_en: string;
      name_si: string;
      name_ta: string;
      icon: string;
      color: string;
      sort_order: number;
      is_active: boolean;
      lesson_count: number;
    }>`
      select s.id, s.slug, s.name_en, s.name_si, s.name_ta, s.icon, s.color, s.sort_order, s.is_active,
             (select count(*)::int from lessons l where l.subject_id = s.id and l.status = 'published') as lesson_count
      from subjects s
      where s.grade_id = ${grade.id} and s.is_active
      order by s.sort_order, s.id
    `;
    return {
      grade: mapGrade(grade),
      subjects: subjects.map((row) => ({
        id: row.id,
        gradeId: grade.id,
        gradeNumber: grade.number,
        slug: row.slug,
        name: tri(row.name_en, row.name_si, row.name_ta),
        icon: row.icon,
        color: row.color,
        sortOrder: row.sort_order,
        isActive: row.is_active,
        lessonCount: row.lesson_count,
      })),
    };
  });

export const getSubject = createServerFn({ method: "POST" })
  .validator((input: { grade: string; subject: string }) => input)
  .handler(async ({ data }) => {
    const pack = await getGrade({ data: data.grade });
    if (!pack) return null;
    const subject = pack.subjects.find((item) => item.slug === data.subject);
    if (!subject) return null;
    const sql = await getSql();
    const rows = await sql.query<LessonRow>(
      `${lessonSelect} where g.slug = $1 and s.slug = $2 and l.status = 'published' order by l.sort_order, l.id`,
      [data.grade, data.subject],
    );
    return {
      grade: pack.grade,
      subject,
      lessons: rows.map((row) => toCard(presentLesson(row, false))),
    };
  });

export const getLesson = createServerFn({ method: "POST" })
  .validator((slug: string) => slug.trim())
  .handler(async ({ data: slug }) => {
    const sql = await getSql();
    const rows = await sql.query<LessonRow>(
      `${lessonSelect} where l.slug = $1 and l.status = 'published' and g.is_active limit 1`,
      [slug],
    );
    const row = rows[0];
    if (!row) return null;
    const lesson = presentLesson(row, false);
    lesson.quiz = await questionsFor(row.id, lesson.locked);
    return lesson;
  });

export const searchLessons = createServerFn({ method: "POST" })
  .validator((query: string) => query.trim().slice(0, 80))
  .handler(async ({ data: query }) => {
    if (!query) return [];
    const sql = await getSql();
    const like = `%${query}%`;
    const rows = await sql.query<LessonRow>(
      `${lessonSelect}
       where l.status = 'published' and g.is_active
         and (l.title_en ilike $1 or l.title_si ilike $1 or l.title_ta ilike $1
              or s.name_en ilike $1 or s.name_si ilike $1 or s.name_ta ilike $1)
       order by g.number, l.sort_order
       limit 40`,
      [like],
    );
    return rows.map((row) => ({
      ...toCard(presentLesson(row, false)),
      gradeNumber: row.grade_number,
      subject: tri(row.subject_en, row.subject_si, row.subject_ta),
    }));
  });

export const listPublicAds = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  const rows = await sql<{
    id: number;
    name: string;
    placement: string;
    frequency: string;
    every_n: number;
  }>`
    select id, name, placement, frequency, every_n
    from ad_units where is_enabled order by id
  `;
  const ads: AdPublic[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    placement: row.placement,
    frequency: row.frequency,
    everyN: row.every_n,
  }));
  return ads;
});

export const sendContact = createServerFn({ method: "POST" })
  .validator((input: { name: string; email: string; reason: string; message: string }) => {
    const name = input.name.trim().slice(0, 80);
    const email = input.email.trim().slice(0, 120);
    const reason = ["general", "permission", "technical"].includes(input.reason)
      ? input.reason
      : "general";
    const message = input.message.trim().slice(0, 2000);
    if (name.length < 2) throw new Error("Name is too short");
    if (!email.includes("@")) throw new Error("Email looks wrong");
    if (message.length < 8) throw new Error("Message is too short");
    return { name, email, reason, message };
  })
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`
      insert into contact_messages (name, email, reason, message)
      values (${data.name}, ${data.email}, ${data.reason}, ${data.message})
    `;
    return { ok: true as const };
  });

export async function loadLessonRow(slug: string): Promise<LessonRow | null> {
  const sql = await getSql();
  const rows = await sql.query<LessonRow>(
    `${lessonSelect} where l.slug = $1 and l.status = 'published' limit 1`,
    [slug],
  );
  return rows[0] ?? null;
}

export { presentLesson, questionsFor, type LessonRow };
