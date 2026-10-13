import { Link } from "@tanstack/react-router";
import { Bookmark, Download, Lock, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { AdSlot } from "@/components/shell";
import { useDesk } from "@/components/shell";
import { Badge, Button } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { tx, type LessonDetail } from "@/lib/types";
import { getPlayback, recordAttempt, saveNote, saveProgress, scoreQuiz, toggleBookmark } from "@/server/account";

export function LessonView({ initial }: { initial: LessonDetail }) {
  const { lang, t } = useI18n();
  const { user, isPending } = useCurrentUserState();
  const { tier } = useDesk();
  const [lesson, setLesson] = useState(initial);
  const [note, setNote] = useState("");
  const [noteState, setNoteState] = useState("");
  const [answers, setAnswers] = useState<number[]>([]);
  const [marked, setMarked] = useState<{ correct: number[]; score: number; passed: boolean } | null>(null);
  const [minutes, setMinutes] = useState(0);

  useEffect(() => {
    setLesson(initial);
    setMarked(null);
    setAnswers([]);
    const local = localStorage.getItem(`edulk-note-${initial.id}`) ?? "";
    setNote(local);
  }, [initial]);

  useEffect(() => {
    if (isPending || !user) return;
    let cancel = false;
    void getPlayback({ data: initial.slug }).then((result) => {
      if (cancel || !result.ok) return;
      setLesson(result.lesson);
      setMinutes(Math.round(result.lesson.positionSeconds / 60));
      const local = localStorage.getItem(`edulk-note-${result.lesson.id}`) ?? "";
      setNote(result.lesson.note || local);
    });
    return () => {
      cancel = true;
    };
  }, [user?.id, isPending, initial.slug]);

  const title = tx(lang, lesson.title);
  const canDownload = !lesson.locked && (tier === "premium" || tier === "premium_plus");

  function downloadNotes() {
    const text = tx(lang, lesson.notes);
    const blob = new Blob([`${title}\n\n${text}`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${lesson.slug}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function onBookmark() {
    const result = await toggleBookmark({ data: lesson.id });
    if (result.ok) setLesson((current) => ({ ...current, bookmarked: result.bookmarked }));
  }

  async function onPlace(value: number) {
    setMinutes(value);
    await saveProgress({ data: { lessonId: lesson.id, minutes: value } });
  }

  async function onSaveNote() {
    localStorage.setItem(`edulk-note-${lesson.id}`, note);
    if (!user) {
      setNoteState(t("signInToSave"));
      return;
    }
    await saveNote({ data: { lessonId: lesson.id, body: note } });
    setNoteState(t("saved"));
  }

  async function onQuiz() {
    if (!lesson.quiz) return;
    const payload = { quizId: lesson.quiz.id, answers };
    const result = user ? await recordAttempt({ data: payload }) : await scoreQuiz({ data: payload });
    if (result.ok) {
      setMarked({ correct: result.result.correct, score: result.result.score, passed: result.result.passed });
    }
  }

  return (
    <main id="content" className="mx-auto w-full max-w-6xl px-4 py-8">
      <p className="text-sm text-muted">
        <Link to="/grades/$slug" params={{ slug: lesson.grade.slug }} className="hover:text-primary">
          {tx(lang, lesson.grade.name)}
        </Link>
        <span aria-hidden="true"> / </span>
        <Link to="/subjects/$grade/$subject" params={{ grade: lesson.grade.slug, subject: lesson.subject.slug }} className="hover:text-primary">
          {tx(lang, lesson.subject.name)}
        </Link>
      </p>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <h1 className="max-w-3xl font-display text-4xl text-fg">{title}</h1>
        <Badge kind={lesson.tier === "premium" ? "premium" : "free"}>{lesson.tier === "premium" ? t("premium") : t("free")}</Badge>
      </div>
      <p className="mt-3 max-w-2xl text-muted">{tx(lang, lesson.summary)}</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex flex-col gap-6">
          <AdSlot placement="header" />
          {lesson.locked ? (
            <div className="rounded-2xl border border-border bg-accent-soft p-6">
              <Lock className="size-6 text-accent" aria-hidden="true" />
              <h2 className="mt-3 font-display text-2xl">{t("locked")}</h2>
              <p className="mt-2 max-w-lg text-sm text-fg">{t("faq2a")}</p>
              <Link to="/account" className="mt-4 inline-flex min-h-11 items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-fg">
                {t("plansTitle")}
              </Link>
            </div>
          ) : lesson.youtubeId ? (
            <Player id={lesson.youtubeId} title={title} />
          ) : (
            <p className="rounded-2xl border border-border bg-surface p-6 text-muted">{t("noVideo")}</p>
          )}
          {!lesson.locked && lesson.channel ? (
            <p className="text-sm text-muted">{t("related")} · {lesson.channel}</p>
          ) : null}
          <AdSlot placement="below_video" />
          {!lesson.locked && tx(lang, lesson.notes) ? (
            <article className="max-w-2xl">
              <h2 className="font-display text-2xl">{t("lessons")}</h2>
              <p className="mt-3 leading-relaxed text-fg">{tx(lang, lesson.notes)}</p>
            </article>
          ) : null}
          {lesson.quiz ? (
            <section className="max-w-2xl rounded-2xl border border-border bg-surface p-5">
              <h2 className="font-display text-2xl">{t("quiz")}</h2>
              <ol className="mt-4 flex flex-col gap-5">
                {lesson.quiz.questions.map((question, index) => (
                  <li key={question.id}>
                    <p className="font-medium">{tx(lang, question.prompt)}</p>
                    <div className="mt-2 flex flex-col gap-2">
                      {question.choices.map((choice, choiceIndex) => {
                        const picked = answers[index] === choiceIndex;
                        const reveal = marked ? marked.correct[index] === choiceIndex : false;
                        const wrong = marked && picked && !reveal;
                        return (
                          <label key={choice.en + choiceIndex} className={`flex min-h-11 items-center gap-3 rounded-xl border px-3 ${reveal ? "border-primary bg-soft" : wrong ? "border-accent bg-accent-soft" : "border-border"}`}>
                            <input
                              type="radio"
                              name={`q-${question.id}`}
                              checked={picked}
                              onChange={() => {
                                const next = [...answers];
                                next[index] = choiceIndex;
                                setAnswers(next);
                              }}
                            />
                            <span>{tx(lang, choice)}</span>
                            {reveal ? <span className="ml-auto text-xs font-semibold text-primary">{t("correct")}</span> : null}
                            {wrong ? <span className="ml-auto text-xs font-semibold text-accent">{t("notQuite")}</span> : null}
                          </label>
                        );
                      })}
                    </div>
                  </li>
                ))}
              </ol>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button type="button" onClick={() => void onQuiz()}>{t("submitQuiz")}</Button>
                {marked ? (
                  <p className="text-sm">
                    {t("score")} {marked.score}% · {marked.passed ? t("passed") : t("tryAgain")}
                  </p>
                ) : null}
              </div>
              {!user ? <p className="mt-2 text-sm text-muted">{t("guestQuiz")}</p> : null}
            </section>
          ) : null}
        </div>
        <aside className="flex flex-col gap-4">
          {user && minutes > 0 ? (
            <p className="rounded-2xl bg-soft px-4 py-3 text-sm text-fg">
              {t("resume")} {minutes} {t("minute")}
            </p>
          ) : null}
          {user ? (
            <div className="rounded-2xl border border-border bg-surface p-4">
              <p className="text-sm font-medium">{t("place")}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {[0, 5, 10, 15, 20].map((value) => (
                  <button key={value} type="button" onClick={() => void onPlace(value)} className={`min-h-11 rounded-full px-3 text-sm ${minutes === value ? "bg-primary text-primary-fg" : "border border-border"}`}>
                    {value}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {user ? (
            <Button type="button" variant="ghost" onClick={() => void onBookmark()}>
              <Bookmark className="size-4" />
              {lesson.bookmarked ? t("bookmarked") : t("bookmark")}
            </Button>
          ) : (
            <Link to="/login" className="inline-flex min-h-11 items-center justify-center rounded-full border border-border px-4 text-sm font-semibold">
              {t("bookmark")}
            </Link>
          )}
          {canDownload ? (
            <Button type="button" variant="ghost" onClick={downloadNotes}>
              <Download className="size-4" />
              {t("downloadNotes")}
            </Button>
          ) : (
            <p className="text-sm text-muted">{t("downloadLocked")}</p>
          )}
          <div className="rounded-2xl border border-border bg-surface p-4">
            <label htmlFor="lesson-note" className="text-sm font-medium">{t("notes")}</label>
            <textarea
              id="lesson-note"
              value={note}
              onChange={(event) => {
                setNote(event.target.value);
                localStorage.setItem(`edulk-note-${lesson.id}`, event.target.value);
              }}
              rows={6}
              className="mt-2 w-full rounded-xl border border-border bg-bg px-3 py-2 text-fg"
            />
            <p className="mt-2 text-xs text-muted">{t("writeNote")}</p>
            <Button type="button" className="mt-3" onClick={() => void onSaveNote()}>{t("save")}</Button>
            {noteState ? <p className="mt-2 text-sm text-primary">{noteState}</p> : null}
          </div>
        </aside>
      </div>
    </main>
  );
}

function Player({ id, title }: { id: string; title: string }) {
  const [on, setOn] = useState(false);
  const { t } = useI18n();
  if (!on) {
    return (
      <button type="button" onClick={() => setOn(true)} className="relative block aspect-video w-full overflow-hidden rounded-2xl bg-ink text-primary-fg">
        <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" className="h-full w-full object-cover opacity-90" />
        <span className="absolute inset-0 grid place-items-center">
          <span className="grid size-14 place-items-center rounded-full bg-primary text-primary-fg">
            <Play className="size-6" aria-hidden="true" />
          </span>
        </span>
        <span className="sr-only">{t("watch")} {title}</span>
      </button>
    );
  }
  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl bg-ink">
      <iframe
        className="absolute inset-0 h-full w-full"
        src={`https://www.youtube-nocookie.com/embed/${id}?rel=0`}
        title={title}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  );
}
