import { createServerFn } from "@tanstack/react-start";
import { getSql, type Sql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { parseYouTubeId, thumbnailUrl, watchUrl } from "@/lib/youtube";
import type { Tier, Tri } from "@/lib/types";

async function asAdmin(userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const sql = await getSql();
  const rows = await sql<{ role: string; banned_at: string | null }>`
    select role, banned_at::text as banned_at from profiles where user_id = ${userId}
  `;
  const row = rows[0];
  if (!row) return { ok: false, error: "Sign in first." };
  if (row.banned_at) return { ok: false, error: "This account is suspended." };
  if (row.role !== "admin") return { ok: false, error: "Admins only." };
  return { ok: true };
}

async function log(sql: Sql, actor: string, action: string, entity: string, id: string | number) {
  await sql`
    insert into activity_logs (actor_id, action, entity_type, entity_id)
    values (${actor}, ${action}, ${entity}, ${String(id)})
  `;
}

function tri(en: string, si: string, ta: string): Tri {
  return { en, si, ta };
}

export const adminStats = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const gate = await asAdmin(context.userId);
    if (!gate.ok) return gate;
    const sql = await getSql();
    const counts = await sql<{
      students: number;
      lessons: number;
      videos: number;
      premium: number;
      inbox: number;
    }>`
      select
        (select count(*)::int from profiles) as students,
        (select count(*)::int from lessons) as lessons,
        (select count(*)::int from videos) as videos,
        (select count(*)::int from profiles where tier <> 'free' and (tier_expires_at is null or tier_expires_at > now())) as premium,
        (select count(*)::int from contact_messages where status = 'new') as inbox
    `;
    const byGrade = await sql<{ grade: number; lessons: number }>`
      select g.number as grade, count(l.id)::int as lessons
      from grades g
      left join lessons l on l.grade_id = g.id
      group by g.number
      order by g.number
    `;
    const split = await sql<{ tier_required: string; lessons: number }>`
      select tier_required, count(*)::int as lessons from lessons group by tier_required
    `;
    const recent = await sql<{
      id: number;
      action: string;
      entity_type: string;
      entity_id: string;
      created_at: string;
      name: string | null;
    }>`
      select a.id, a.action, a.entity_type, a.entity_id, a.created_at::text as created_at, u.name
      from activity_logs a
      left join "user" u on u.id = a.actor_id
      order by a.id desc
      limit 12
    `;
    return { ok: true as const, counts: counts[0], byGrade, split, recent };
  });

export const adminListGrades = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const gate = await asAdmin(context.userId);
    if (!gate.ok) return gate;
    const sql = await getSql();
    const rows = await sql<{
      id: number;
      number: number;
      slug: string;
      name_en: string;
      name_si: string;
      name_ta: string;
      band: string;
      sort_order: number;
      is_active: boolean;
      subject_count: number;
    }>`
      select g.*, (select count(*)::int from subjects s where s.grade_id = g.id) as subject_count
      from grades g order by g.sort_order, g.number
    `;
    return {
      ok: true as const,
      grades: rows.map((row) => ({
        id: row.id,
        number: row.number,
        slug: row.slug,
        name: tri(row.name_en, row.name_si, row.name_ta),
        band: row.band,
        sortOrder: row.sort_order,
        isActive: row.is_active,
        subjectCount: row.subject_count,
      })),
    };
  });

type GradeInput = {
  id?: number;
  number: number;
  nameEn: string;
  nameSi: string;
  nameTa: string;
  band: string;
  isActive: boolean;
};

export const saveGrade = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: GradeInput) => {
    const number = Number(input.number);
    if (!Number.isInteger(number) || number < 1 || number > 13) throw new Error("Grade number must be 1–13");
    const nameEn = input.nameEn.trim();
    if (!nameEn) throw new Error("English name is required");
    const band = ["primary", "junior", "ol", "al"].includes(input.band) ? input.band : "primary";
    return {
      id: input.id,
      number,
      nameEn,
      nameSi: input.nameSi.trim() || nameEn,
      nameTa: input.nameTa.trim() || nameEn,
      band,
      isActive: Boolean(input.isActive),
    };
  })
  .handler(async ({ context, data }) => {
    const gate = await asAdmin(context.userId);
    if (!gate.ok) return gate;
    const sql = await getSql();
    const slug = `grade-${data.number}`;
    if (data.id) {
      await sql`
        update grades set number = ${data.number}, slug = ${slug}, name_en = ${data.nameEn},
          name_si = ${data.nameSi}, name_ta = ${data.nameTa}, band = ${data.band}, is_active = ${data.isActive}
        where id = ${data.id}
      `;
      await log(sql, context.userId, "update", "grade", data.id);
    } else {
      const inserted = await sql<{ id: number }>`
        insert into grades (number, slug, name_en, name_si, name_ta, band, sort_order, is_active)
        values (${data.number}, ${slug}, ${data.nameEn}, ${data.nameSi}, ${data.nameTa}, ${data.band}, ${data.number}, ${data.isActive})
        returning id
      `;
      await log(sql, context.userId, "create", "grade", inserted[0]?.id ?? slug);
    }
    return { ok: true as const };
  });

export const moveGrade = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: number; dir: "up" | "down" }) => input)
  .handler(async ({ context, data }) => {
    const gate = await asAdmin(context.userId);
    if (!gate.ok) return gate;
    const sql = await getSql();
    const rows = await sql<{ id: number; sort_order: number }>`select id, sort_order from grades order by sort_order, number`;
    const index = rows.findIndex((row) => row.id === data.id);
    const swapWith = data.dir === "up" ? index - 1 : index + 1;
    const current = rows[index];
    const other = rows[swapWith];
    if (!current || !other) return { ok: true as const };
    await sql`update grades set sort_order = ${other.sort_order} where id = ${current.id}`;
    await sql`update grades set sort_order = ${current.sort_order} where id = ${other.id}`;
    await log(sql, context.userId, "reorder", "grade", current.id);
    return { ok: true as const };
  });

export const deleteGrade = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: number) => id)
  .handler(async ({ context, data: id }) => {
    const gate = await asAdmin(context.userId);
    if (!gate.ok) return gate;
    const sql = await getSql();
    await sql`delete from grades where id = ${id}`;
    await log(sql, context.userId, "delete", "grade", id);
    return { ok: true as const };
  });

export const adminListSubjects = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((gradeId: number) => gradeId)
  .handler(async ({ context, data: gradeId }) => {
    const gate = await asAdmin(context.userId);
    if (!gate.ok) return gate;
    const sql = await getSql();
    const rows = await sql<{
      id: number;
      grade_id: number;
      grade_number: number;
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
      select s.id, s.grade_id, g.number as grade_number, s.slug, s.name_en, s.name_si, s.name_ta,
             s.icon, s.color, s.sort_order, s.is_active,
             (select count(*)::int from lessons l where l.subject_id = s.id) as lesson_count
      from subjects s
      join grades g on g.id = s.grade_id
      where (${gradeId} = 0 or s.grade_id = ${gradeId})
      order by g.number, s.sort_order, s.id
    `;
    return {
      ok: true as const,
      subjects: rows.map((row) => ({
        id: row.id,
        gradeId: row.grade_id,
        gradeNumber: row.grade_number,
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

type SubjectInput = {
  id?: number;
  gradeId: number;
  nameEn: string;
  nameSi: string;
  nameTa: string;
  icon: string;
  color: string;
  isActive: boolean;
};

function slugify(value: string) {
  const base = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  return base || `item-${Date.now()}`;
}

export const saveSubject = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: SubjectInput) => {
    const nameEn = input.nameEn.trim();
    if (!nameEn) throw new Error("English name is required");
    if (!input.gradeId) throw new Error("Pick a grade");
    return {
      ...input,
      nameEn,
      nameSi: input.nameSi.trim() || nameEn,
      nameTa: input.nameTa.trim() || nameEn,
      icon: input.icon || "book",
      color: ["lagoon", "cinnamon", "ink"].includes(input.color) ? input.color : "lagoon",
      isActive: Boolean(input.isActive),
    };
  })
  .handler(async ({ context, data }) => {
    const gate = await asAdmin(context.userId);
    if (!gate.ok) return gate;
    const sql = await getSql();
    if (data.id) {
      await sql`
        update subjects set grade_id = ${data.gradeId}, name_en = ${data.nameEn}, name_si = ${data.nameSi},
          name_ta = ${data.nameTa}, icon = ${data.icon}, color = ${data.color}, is_active = ${data.isActive}
        where id = ${data.id}
      `;
      await log(sql, context.userId, "update", "subject", data.id);
    } else {
      const slug = slugify(data.nameEn);
      const inserted = await sql<{ id: number }>`
        insert into subjects (grade_id, slug, name_en, name_si, name_ta, icon, color, sort_order, is_active)
        values (
          ${data.gradeId}, ${slug}, ${data.nameEn}, ${data.nameSi}, ${data.nameTa},
          ${data.icon}, ${data.color},
          (select coalesce(max(sort_order), 0) + 1 from subjects where grade_id = ${data.gradeId}),
          ${data.isActive}
        )
        returning id
      `;
      await log(sql, context.userId, "create", "subject", inserted[0]?.id ?? slug);
    }
    return { ok: true as const };
  });

export const moveSubject = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: number; dir: "up" | "down" }) => input)
  .handler(async ({ context, data }) => {
    const gate = await asAdmin(context.userId);
    if (!gate.ok) return gate;
    const sql = await getSql();
    const own = await sql<{ grade_id: number }>`select grade_id from subjects where id = ${data.id}`;
    const gradeId = own[0]?.grade_id;
    if (!gradeId) return { ok: false as const, error: "Missing subject" };
    const rows = await sql<{ id: number; sort_order: number }>`
      select id, sort_order from subjects where grade_id = ${gradeId} order by sort_order, id
    `;
    const index = rows.findIndex((row) => row.id === data.id);
    const other = rows[data.dir === "up" ? index - 1 : index + 1];
    const current = rows[index];
    if (!current || !other) return { ok: true as const };
    await sql`update subjects set sort_order = ${other.sort_order} where id = ${current.id}`;
    await sql`update subjects set sort_order = ${current.sort_order} where id = ${other.id}`;
    return { ok: true as const };
  });

export const deleteSubject = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: number) => id)
  .handler(async ({ context, data: id }) => {
    const gate = await asAdmin(context.userId);
    if (!gate.ok) return gate;
    const sql = await getSql();
    await sql`delete from subjects where id = ${id}`;
    await log(sql, context.userId, "delete", "subject", id);
    return { ok: true as const };
  });

export const adminListLessons = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { gradeId: number; subjectId: number }) => input)
  .handler(async ({ context, data }) => {
    const gate = await asAdmin(context.userId);
    if (!gate.ok) return gate;
    const sql = await getSql();
    const rows = await sql<{
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
      is_featured: boolean;
      grade_id: number;
      subject_id: number;
      grade_number: number;
      youtube_id: string | null;
      source_url: string | null;
    }>`
      select l.id, l.slug, l.title_en, l.title_si, l.title_ta, l.summary_en, l.summary_si, l.summary_ta,
             l.notes_en, l.notes_si, l.notes_ta, l.tier_required, l.status, l.is_featured,
             l.grade_id, l.subject_id, g.number as grade_number, v.youtube_id, v.source_url
      from lessons l
      join grades g on g.id = l.grade_id
      left join videos v on v.id = l.video_id
      where (${data.gradeId} = 0 or l.grade_id = ${data.gradeId})
        and (${data.subjectId} = 0 or l.subject_id = ${data.subjectId})
      order by g.number, l.sort_order, l.id
    `;
    return { ok: true as const, lessons: rows };
  });

type LessonInput = {
  id?: number;
  gradeId: number;
  subjectId: number;
  titleEn: string;
  titleSi: string;
  titleTa: string;
  summaryEn: string;
  notesEn: string;
  notesSi: string;
  notesTa: string;
  youtubeUrl: string;
  tier: "free" | "premium";
  status: "draft" | "published";
  featured: boolean;
};

async function upsertVideo(sql: Sql, youtubeUrl: string, title: string) {
  const trimmed = youtubeUrl.trim();
  if (!trimmed) return null;
  const id = parseYouTubeId(trimmed);
  if (!id) throw new Error("That does not look like a YouTube link.");
  const existing = await sql<{ id: number }>`select id from videos where youtube_id = ${id}`;
  if (existing[0]) return existing[0].id;
  const inserted = await sql<{ id: number }>`
    insert into videos (youtube_id, source_url, title_en, channel_name, thumbnail_url, permission_status, link_status)
    values (${id}, ${watchUrl(id)}, ${title}, '', ${thumbnailUrl(id)}, 'unknown', 'unchecked')
    returning id
  `;
  return inserted[0]?.id ?? null;
}

export const saveLesson = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: LessonInput) => {
    const titleEn = input.titleEn.trim();
    if (!titleEn) throw new Error("English title is required");
    if (!input.gradeId || !input.subjectId) throw new Error("Pick a grade and subject");
    const tier = input.tier === "premium" ? "premium" : "free";
    const status = input.status === "draft" ? "draft" : "published";
    return { ...input, titleEn, titleSi: input.titleSi.trim() || titleEn, titleTa: input.titleTa.trim() || titleEn, tier, status, featured: Boolean(input.featured) };
  })
  .handler(async ({ context, data }) => {
    const gate = await asAdmin(context.userId);
    if (!gate.ok) return gate;
    const sql = await getSql();
    let videoId: number | null = null;
    try {
      videoId = await upsertVideo(sql, data.youtubeUrl, data.titleEn);
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : "Video link failed" };
    }
    if (data.id) {
      await sql`
        update lessons set grade_id = ${data.gradeId}, subject_id = ${data.subjectId}, video_id = ${videoId},
          title_en = ${data.titleEn}, title_si = ${data.titleSi}, title_ta = ${data.titleTa},
          summary_en = ${data.summaryEn}, summary_si = ${data.titleSi}, summary_ta = ${data.titleTa},
          notes_en = ${data.notesEn}, notes_si = ${data.notesSi}, notes_ta = ${data.notesTa},
          tier_required = ${data.tier}, status = ${data.status}, is_featured = ${data.featured}
        where id = ${data.id}
      `;
      await log(sql, context.userId, "update", "lesson", data.id);
    } else {
      let slug = slugify(data.titleEn);
      const clash = await sql<{ id: number }>`select id from lessons where slug = ${slug}`;
      if (clash[0]) slug = `${slug}-${Date.now().toString().slice(-4)}`;
      const inserted = await sql<{ id: number }>`
        insert into lessons (
          grade_id, subject_id, video_id, slug, title_en, title_si, title_ta,
          summary_en, summary_si, summary_ta, notes_en, notes_si, notes_ta,
          tier_required, status, sort_order, is_featured
        ) values (
          ${data.gradeId}, ${data.subjectId}, ${videoId}, ${slug}, ${data.titleEn}, ${data.titleSi}, ${data.titleTa},
          ${data.summaryEn}, ${data.titleSi}, ${data.titleTa}, ${data.notesEn}, ${data.notesSi}, ${data.notesTa},
          ${data.tier}, ${data.status},
          (select coalesce(max(sort_order), 0) + 1 from lessons where subject_id = ${data.subjectId}),
          ${data.featured}
        ) returning id
      `;
      await log(sql, context.userId, "create", "lesson", inserted[0]?.id ?? slug);
    }
    return { ok: true as const };
  });

export const deleteLesson = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: number) => id)
  .handler(async ({ context, data: id }) => {
    const gate = await asAdmin(context.userId);
    if (!gate.ok) return gate;
    const sql = await getSql();
    await sql`delete from lessons where id = ${id}`;
    await log(sql, context.userId, "delete", "lesson", id);
    return { ok: true as const };
  });

export const previewYoutube = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((url: string) => url.trim())
  .handler(async ({ context, data: url }) => {
    const gate = await asAdmin(context.userId);
    if (!gate.ok) return gate;
    const id = parseYouTubeId(url);
    if (!id) return { ok: false as const, error: "Could not read a video id from that link." };
    let title = id;
    let author = "";
    try {
      const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl(id))}&format=json`);
      if (response.ok) {
        const json = (await response.json()) as { title?: string; author_name?: string };
        title = json.title || id;
        author = json.author_name || "";
      }
    } catch {
      title = id;
    }
    return { ok: true as const, id, title, author, thumbnail: thumbnailUrl(id) };
  });

export const adminListVideos = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const gate = await asAdmin(context.userId);
    if (!gate.ok) return gate;
    const sql = await getSql();
    const rows = await sql<{
      id: number;
      youtube_id: string;
      title_en: string;
      channel_name: string;
      thumbnail_url: string;
      permission_status: string;
      link_status: string;
      lesson_count: number;
    }>`
      select v.id, v.youtube_id, v.title_en, v.channel_name, v.thumbnail_url, v.permission_status, v.link_status,
             (select count(*)::int from lessons l where l.video_id = v.id) as lesson_count
      from videos v order by v.id desc
    `;
    return { ok: true as const, videos: rows };
  });

export const bulkVideos = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((text: string) => text)
  .handler(async ({ context, data: text }) => {
    const gate = await asAdmin(context.userId);
    if (!gate.ok) return gate;
    const sql = await getSql();
    const lines = text.split(/\s+/).map((line) => line.trim()).filter(Boolean);
    let added = 0;
    let duplicates = 0;
    let bad = 0;
    for (const line of lines.slice(0, 40)) {
      const id = parseYouTubeId(line);
      if (!id) {
        bad += 1;
        continue;
      }
      const existing = await sql`select id from videos where youtube_id = ${id}`;
      if (existing[0]) {
        duplicates += 1;
        continue;
      }
      await sql`
        insert into videos (youtube_id, source_url, title_en, thumbnail_url, permission_status, link_status)
        values (${id}, ${watchUrl(id)}, ${id}, ${thumbnailUrl(id)}, 'unknown', 'unchecked')
      `;
      added += 1;
    }
    await log(sql, context.userId, "bulk-import", "video", added);
    return { ok: true as const, added, duplicates, bad };
  });

export const checkVideoLinks = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const gate = await asAdmin(context.userId);
    if (!gate.ok) return gate;
    const sql = await getSql();
    const rows = await sql<{ id: number; youtube_id: string }>`select id, youtube_id from videos order by id desc limit 30`;
    let ok = 0;
    let broken = 0;
    for (const row of rows) {
      try {
        const response = await fetch(
          `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl(row.youtube_id))}&format=json`,
        );
        if (!response.ok) {
          await sql`update videos set link_status = 'broken' where id = ${row.id}`;
          broken += 1;
          continue;
        }
        const json = (await response.json()) as { title?: string; author_name?: string };
        await sql`
          update videos set link_status = 'ok', title_en = ${json.title || row.youtube_id},
            channel_name = ${json.author_name || ""}, thumbnail_url = ${thumbnailUrl(row.youtube_id)}
          where id = ${row.id}
        `;
        ok += 1;
      } catch {
        await sql`update videos set link_status = 'broken' where id = ${row.id}`;
        broken += 1;
      }
    }
    await log(sql, context.userId, "check-links", "video", ok);
    return { ok: true as const, okCount: ok, broken };
  });

export const setVideoPermission = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: number; status: string }) => {
    const status = ["unknown", "pending", "granted", "denied"].includes(input.status) ? input.status : "unknown";
    return { id: input.id, status };
  })
  .handler(async ({ context, data }) => {
    const gate = await asAdmin(context.userId);
    if (!gate.ok) return gate;
    const sql = await getSql();
    await sql`update videos set permission_status = ${data.status} where id = ${data.id}`;
    await log(sql, context.userId, "permission", "video", data.id);
    return { ok: true as const };
  });

export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const gate = await asAdmin(context.userId);
    if (!gate.ok) return gate;
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      name: string;
      email: string;
      role: "student" | "admin" | null;
      tier: Tier | null;
      expires_at: string | null;
      banned_at: string | null;
    }>`
      select u.id, u.name, u.email, p.role, p.tier,
             p.tier_expires_at::text as expires_at, p.banned_at::text as banned_at
      from "user" u
      left join profiles p on p.user_id = u.id
      order by u."createdAt" desc
    `;
    return { ok: true as const, users: rows };
  });

export const setUserAccess = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { userId: string; role?: "student" | "admin"; tier?: Tier; banned?: boolean }) => input)
  .handler(async ({ context, data }) => {
    const gate = await asAdmin(context.userId);
    if (!gate.ok) return gate;
    const sql = await getSql();
    await sql`
      insert into profiles (user_id, role) values (${data.userId}, 'student')
      on conflict (user_id) do nothing
    `;
    if (data.role) {
      if (data.role === "student" && data.userId === context.userId) {
        return { ok: false as const, error: "You cannot remove your own admin seat." };
      }
      if (data.role === "student") {
        const admins = await sql<{ n: number }>`select count(*)::int as n from profiles where role = 'admin'`;
        const mine = await sql<{ role: string }>`select role from profiles where user_id = ${data.userId}`;
        if ((admins[0]?.n ?? 0) <= 1 && mine[0]?.role === "admin") {
          return { ok: false as const, error: "Keep at least one admin." };
        }
      }
      await sql`update profiles set role = ${data.role} where user_id = ${data.userId}`;
    }
    if (data.tier) {
      if (data.tier === "free") {
        await sql`update profiles set tier = 'free', tier_expires_at = null where user_id = ${data.userId}`;
      } else {
        await sql`
          update profiles set tier = ${data.tier}, tier_expires_at = now() + interval '30 days'
          where user_id = ${data.userId}
        `;
      }
    }
    if (typeof data.banned === "boolean") {
      if (data.banned && data.userId === context.userId) {
        return { ok: false as const, error: "You cannot suspend yourself." };
      }
      await sql`
        update profiles set banned_at = ${data.banned ? new Date().toISOString() : null}
        where user_id = ${data.userId}
      `;
    }
    await log(sql, context.userId, "access", "user", data.userId);
    return { ok: true as const };
  });

export const adminListAds = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const gate = await asAdmin(context.userId);
    if (!gate.ok) return gate;
    const sql = await getSql();
    const rows = await sql`
      select id, name, provider, code, placement, frequency, every_n, is_enabled from ad_units order by id
    `;
    return { ok: true as const, ads: rows };
  });

type AdInput = {
  id?: number;
  name: string;
  provider: string;
  code: string;
  placement: string;
  frequency: string;
  everyN: number;
  isEnabled: boolean;
};

export const saveAd = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: AdInput) => {
    const name = input.name.trim();
    if (!name) throw new Error("Name the ad unit");
    const placement = ["header", "sidebar", "below_video", "footer", "in_content"].includes(input.placement)
      ? input.placement
      : "footer";
    const frequency = input.frequency === "every_n" ? "every_n" : "always";
    const provider = ["adsense", "admob", "custom_html"].includes(input.provider) ? input.provider : "adsense";
    return {
      ...input,
      name,
      provider,
      code: input.code.slice(0, 4000),
      placement,
      frequency,
      everyN: Math.max(1, Math.min(20, Number(input.everyN) || 1)),
      isEnabled: Boolean(input.isEnabled),
    };
  })
  .handler(async ({ context, data }) => {
    const gate = await asAdmin(context.userId);
    if (!gate.ok) return gate;
    const sql = await getSql();
    if (data.id) {
      await sql`
        update ad_units set name = ${data.name}, provider = ${data.provider}, code = ${data.code},
          placement = ${data.placement}, frequency = ${data.frequency}, every_n = ${data.everyN},
          is_enabled = ${data.isEnabled}
        where id = ${data.id}
      `;
    } else {
      await sql`
        insert into ad_units (name, provider, code, placement, frequency, every_n, is_enabled)
        values (${data.name}, ${data.provider}, ${data.code}, ${data.placement}, ${data.frequency}, ${data.everyN}, ${data.isEnabled})
      `;
    }
    await log(sql, context.userId, "save", "ad", data.id ?? data.name);
    return { ok: true as const };
  });

export const deleteAd = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: number) => id)
  .handler(async ({ context, data: id }) => {
    const gate = await asAdmin(context.userId);
    if (!gate.ok) return gate;
    const sql = await getSql();
    await sql`delete from ad_units where id = ${id}`;
    await log(sql, context.userId, "delete", "ad", id);
    return { ok: true as const };
  });

export const adminListContact = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const gate = await asAdmin(context.userId);
    if (!gate.ok) return gate;
    const sql = await getSql();
    const rows = await sql`
      select id, name, email, reason, message, status, created_at::text as created_at
      from contact_messages order by id desc limit 100
    `;
    return { ok: true as const, messages: rows };
  });

export const setContactStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: number; status: string }) => ({
    id: input.id,
    status: ["new", "read", "resolved"].includes(input.status) ? input.status : "read",
  }))
  .handler(async ({ context, data }) => {
    const gate = await asAdmin(context.userId);
    if (!gate.ok) return gate;
    const sql = await getSql();
    await sql`update contact_messages set status = ${data.status} where id = ${data.id}`;
    await log(sql, context.userId, data.status, "contact", data.id);
    return { ok: true as const };
  });

export const adminLogs = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const gate = await asAdmin(context.userId);
    if (!gate.ok) return gate;
    const sql = await getSql();
    const rows = await sql`
      select a.id, a.action, a.entity_type, a.entity_id, a.created_at::text as created_at, u.name, u.email
      from activity_logs a
      left join "user" u on u.id = a.actor_id
      order by a.id desc
      limit 80
    `;
    return { ok: true as const, logs: rows };
  });
