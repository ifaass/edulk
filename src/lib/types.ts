export type Lang = "en" | "si" | "ta";
export type Tri = { en: string; si: string; ta: string };
export type Tier = "free" | "premium" | "premium_plus";
export type Band = "primary" | "junior" | "ol" | "al";

export type GradeCard = {
  id: number;
  number: number;
  slug: string;
  name: Tri;
  band: Band;
  subjectCount: number;
  isActive: boolean;
  sortOrder: number;
};

export type SubjectCard = {
  id: number;
  gradeId: number;
  gradeNumber: number;
  slug: string;
  name: Tri;
  icon: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
  lessonCount: number;
};

export type QuizQuestion = {
  id: number;
  prompt: Tri;
  choices: Tri[];
};

export type LessonDetail = {
  id: number;
  slug: string;
  title: Tri;
  summary: Tri;
  notes: Tri;
  tier: "free" | "premium";
  locked: boolean;
  status: string;
  featured: boolean;
  sortOrder: number;
  youtubeId: string | null;
  channel: string;
  thumbnail: string;
  grade: { number: number; slug: string; name: Tri };
  subject: { slug: string; name: Tri; icon: string; color: string };
  quiz: { id: number; passPercent: number; questions: QuizQuestion[] } | null;
  positionSeconds: number;
  bookmarked: boolean;
  note: string;
};

export type LessonCard = {
  id: number;
  slug: string;
  title: Tri;
  tier: "free" | "premium";
  locked: boolean;
  hasVideo: boolean;
  sortOrder: number;
  status: string;
  featured: boolean;
};

export type Profile = {
  userId: string;
  name: string;
  email: string;
  role: "student" | "admin";
  tier: Tier;
  effectiveTier: Tier;
  expiresAt: string | null;
  banned: boolean;
};

export type AdPublic = {
  id: number;
  name: string;
  placement: string;
  frequency: string;
  everyN: number;
};

export function tx(lang: Lang, tri: Tri): string {
  const value = tri[lang]?.trim();
  return value || tri.en;
}
