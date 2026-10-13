import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import type { Profile, Tier } from "@/lib/types";
import { loadLessonRow, presentLesson, questionsFor } from "@/server/catalog";

type ProfileRow = {
  id: string;
  name: string;
  email: string;
  role: "student" | "admin";
  tier: Tier;
  expires_at: string | null;
  banned_at: string | null;
};

function effectiveTier(row: ProfileRow): Tier {
  if (row.banned_at) return "free";
  if (row.tier === "free") return "free";
  if (!row.expires_at) return row.tier;
  return new Date(row.expires_at).getTime() > Date.now() ? row.tier : "free";
}

function toProfile(row: ProfileRow): Profile {
  return {
    userId: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    tier: row.tier,
    effectiveTier: effectiveTier(row),
    expiresAt: row.expires_at,
    banned: Boolean(row.banned_at),
  };
}

async function readProfile(userId: string): Promise<Profile | null> {
  const sql = await getSql();
  await sql`
    insert into profiles (user_id, role)
    values (
      ${userId},
      case when exists (select 1 from profiles where role = 'admin') then 'student' else 'admin' end
    )
    on conflict (user_id) do nothing
  `;
  const rows = await sql<ProfileRow>`
    select u.id, u.name, u.email, p.role, p.tier,
           p.tier_expires_at::text as expires_at,
           p.banned_at::text as banned_at
    from "user" u
    join profiles p on p.user_id = u.id
    where u.id = ${userId}
  `;
  const row = rows[0];
  return row ? toProfile(row) : null;
}

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const profile = await readProfile(context.userId);
    if (!profile) return { ok: false as const, error: "Profile missing" };
    return { ok: true as const, profile };
  });

async function entitled(userId: string): Promise<{ ok: true; profile: Profile } | { ok: false; error: string }> {
  const profile = await readProfile(userId);
  if (!profile) return { ok: false, error: "Profile missing" };
  if (profile.banned) return { ok: false, error: "This account is suspended." };
  return { ok: true, profile };
}

export const getPlayback = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((slug: string) => slug.trim())
  .handler(async ({ context, data: slug }) => {
    const access = await entitled(context.userId);
    if (!access.ok) return access;
    const row = await loadLessonRow(slug);
    if (!row) return { ok: false as const, error: "Lesson not found" };
    const allowed = row.tier_required === "free" || access.profile.effectiveTier !== "free" || access.profile.role === "admin";
    const lesson = presentLesson(row, allowed);
    lesson.quiz = await questionsFor(row.id, lesson.locked);
    const sql = await getSql();
    const history = await sql<{ position_seconds: number }>`
      select position_seconds from watch_history
      where user_id = ${context.userId} and lesson_id = ${row.id}
    `;
    const marks = await sql<{ lesson_id: number }>`
      select lesson_id from bookmarks where user_id = ${context.userId} and lesson_id = ${row.id}
    `;
    const notes = await sql<{ body: string }>`
      select body from student_notes where user_id = ${context.userId} and lesson_id = ${row.id}
    `;
    lesson.positionSeconds = history[0]?.position_seconds ?? 0;
    lesson.bookmarked = Boolean(marks[0]);
    lesson.note = notes[0]?.body ?? "";
    return { ok: true as const, lesson };
  });

export const setMyTier = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((tier: string) => {
    if (tier !== "free" && tier !== "premium" && tier !== "premium_plus") {
      throw new Error("Unknown plan");
    }
    return tier as Tier;
  })
  .handler(async ({ context, data: tier }) => {
    const access = await entitled(context.userId);
    if (!access.ok) return access;
    const sql = await getSql();
    if (tier === "free") {
      await sql`update profiles set tier = 'free', tier_expires_at = null where user_id = ${context.userId}`;
    } else {
      await sql`
        update profiles
        set tier = ${tier}, tier_expires_at = now() + interval '30 days'
        where user_id = ${context.userId}
      `;
    }
    const profile = await readProfile(context.userId);
    return { ok: true as const, profile };
  });

export const toggleBookmark = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((lessonId: number) => lessonId)
  .handler(async ({ context, data: lessonId }) => {
    const access = await entitled(context.userId);
    if (!access.ok) return access;
    const sql = await getSql();
    const existing = await sql`
      select lesson_id from bookmarks where user_id = ${context.userId} and lesson_id = ${lessonId}
    `;
    if (existing[0]) {
      await sql`delete from bookmarks where user_id = ${context.userId} and lesson_id = ${lessonId}`;
      return { ok: true as const, bookmarked: false };
    }
    await sql`insert into bookmarks (user_id, lesson_id) values (${context.userId}, ${lessonId})`;
    return { ok: true as const, bookmarked: true };
  });

export const saveProgress = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { lessonId: number; minutes: number }) => ({
    lessonId: input.lessonId,
    minutes: Math.max(0, Math.min(180, Math.round(input.minutes))),
  }))
  .handler(async ({ context, data }) => {
    const access = await entitled(context.userId);
    if (!access.ok) return access;
    const sql = await getSql();
    const seconds = data.minutes * 60;
    await sql`
      insert into watch_history (user_id, lesson_id, position_seconds, completed, updated_at)
      values (${context.userId}, ${data.lessonId}, ${seconds}, ${data.minutes >= 10}, now())
      on conflict (user_id, lesson_id) do update
      set position_seconds = ${seconds}, completed = ${data.minutes >= 10}, updated_at = now()
    `;
    return { ok: true as const };
  });

export const saveNote = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { lessonId: number; body: string }) => ({
    lessonId: input.lessonId,
    body: input.body.slice(0, 8000),
  }))
  .handler(async ({ context, data }) => {
    const access = await entitled(context.userId);
    if (!access.ok) return access;
    const sql = await getSql();
    await sql`
      insert into student_notes (user_id, lesson_id, body, updated_at)
      values (${context.userId}, ${data.lessonId}, ${data.body}, now())
      on conflict (user_id, lesson_id) do update set body = ${data.body}, updated_at = now()
    `;
    return { ok: true as const };
  });

type ScoreResult = { score: number; total: number; passed: boolean; correct: number[]; passPercent: number };

async function score(quizId: number, answers: number[]): Promise<ScoreResult | null> {
  const sql = await getSql();
  const quizzes = await sql<{ pass_percent: number }>`select pass_percent from quizzes where id = ${quizId}`;
  const quiz = quizzes[0];
  if (!quiz) return null;
  const questions = await sql<{ correct_index: number }>`
    select correct_index from quiz_questions where quiz_id = ${quizId} order by sort_order, id
  `;
  const correct = questions.map((q) => q.correct_index);
  const hits = correct.filter((value, index) => answers[index] === value).length;
  const total = correct.length;
  const scorePercent = total === 0 ? 0 : Math.round((hits / total) * 100);
  return {
    score: scorePercent,
    total,
    passed: scorePercent >= quiz.pass_percent,
    correct,
    passPercent: quiz.pass_percent,
  };
}

export const scoreQuiz = createServerFn({ method: "POST" })
  .validator((input: { quizId: number; answers: number[] }) => ({
    quizId: input.quizId,
    answers: input.answers.map((n) => Number(n)),
  }))
  .handler(async ({ data }) => {
    const result = await score(data.quizId, data.answers);
    if (!result) return { ok: false as const, error: "Quiz not found" };
    return { ok: true as const, result };
  });

export const recordAttempt = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { quizId: number; answers: number[] }) => ({
    quizId: input.quizId,
    answers: input.answers.map((n) => Number(n)),
  }))
  .handler(async ({ context, data }) => {
    const access = await entitled(context.userId);
    if (!access.ok) return access;
    const result = await score(data.quizId, data.answers);
    if (!result) return { ok: false as const, error: "Quiz not found" };
    const sql = await getSql();
    await sql`
      insert into quiz_attempts (user_id, quiz_id, score_percent, passed)
      values (${context.userId}, ${data.quizId}, ${result.score}, ${result.passed})
    `;
    return { ok: true as const, result };
  });

export const myDesk = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const access = await entitled(context.userId);
    if (!access.ok) return access;
    const sql = await getSql();
    const history = await sql<{
      slug: string;
      title_en: string;
      title_si: string;
      title_ta: string;
      position_seconds: number;
      grade_number: number;
    }>`
      select l.slug, l.title_en, l.title_si, l.title_ta, h.position_seconds, g.number as grade_number
      from watch_history h
      join lessons l on l.id = h.lesson_id
      join grades g on g.id = l.grade_id
      where h.user_id = ${context.userId}
      order by h.updated_at desc
      limit 20
    `;
    const bookmarks = await sql<{
      slug: string;
      title_en: string;
      title_si: string;
      title_ta: string;
      grade_number: number;
    }>`
      select l.slug, l.title_en, l.title_si, l.title_ta, g.number as grade_number
      from bookmarks b
      join lessons l on l.id = b.lesson_id
      join grades g on g.id = l.grade_id
      where b.user_id = ${context.userId}
      order by b.created_at desc
    `;
    const notes = await sql<{
      slug: string;
      title_en: string;
      title_si: string;
      title_ta: string;
      body: string;
    }>`
      select l.slug, l.title_en, l.title_si, l.title_ta, n.body
      from student_notes n
      join lessons l on l.id = n.lesson_id
      where n.user_id = ${context.userId} and length(trim(n.body)) > 0
      order by n.updated_at desc
    `;
    const certs = await sql<{
      subject_en: string;
      subject_si: string;
      subject_ta: string;
      grade_number: number;
      score_percent: number;
      created_at: string;
    }>`
      select distinct on (s.id) s.name_en as subject_en, s.name_si as subject_si, s.name_ta as subject_ta,
             g.number as grade_number, a.score_percent, a.created_at::text as created_at
      from quiz_attempts a
      join quizzes q on q.id = a.quiz_id
      join lessons l on l.id = q.lesson_id
      join subjects s on s.id = l.subject_id
      join grades g on g.id = l.grade_id
      where a.user_id = ${context.userId} and a.passed
      order by s.id, a.created_at desc
    `;
    const tri = (en: string, si: string, ta: string) => ({ en, si, ta });
    return {
      ok: true as const,
      profile: access.profile,
      history: history.map((row) => ({
        slug: row.slug,
        title: tri(row.title_en, row.title_si, row.title_ta),
        minutes: Math.round(row.position_seconds / 60),
        gradeNumber: row.grade_number,
      })),
      bookmarks: bookmarks.map((row) => ({
        slug: row.slug,
        title: tri(row.title_en, row.title_si, row.title_ta),
        gradeNumber: row.grade_number,
      })),
      notes: notes.map((row) => ({
        slug: row.slug,
        title: tri(row.title_en, row.title_si, row.title_ta),
        body: row.body,
      })),
      certificates: certs.map((row) => ({
        subject: tri(row.subject_en, row.subject_si, row.subject_ta),
        gradeNumber: row.grade_number,
        score: row.score_percent,
        at: row.created_at,
      })),
    };
  });
