import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Page } from "@/components/shell";
import { Badge } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import { tx } from "@/lib/types";
import { getSubject } from "@/server/catalog";

export const Route = createFileRoute("/_app/subjects/$grade/$subject")({
  loader: async ({ params }) => {
    const data = await getSubject({ data: { grade: params.grade, subject: params.subject } });
    if (!data) throw notFound();
    return data;
  },
  component: SubjectPage,
});

function SubjectPage() {
  const { grade, subject, lessons } = Route.useLoaderData();
  const { lang, t } = useI18n();
  return (
    <Page title={tx(lang, subject.name)} lede={tx(lang, grade.name)}>
      {lessons.length === 0 ? <p className="text-muted">{t("noLessons")}</p> : null}
      <ul className="flex flex-col gap-3">
        {lessons.map((lesson) => (
          <li key={lesson.id}>
            <Link to="/lessons/$slug" params={{ slug: lesson.slug }} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-4 hover:border-primary">
              <span className="font-medium">{tx(lang, lesson.title)}</span>
              <Badge kind={lesson.locked ? "premium" : "free"}>{lesson.locked ? t("locked") : lesson.hasVideo ? t("watch") : t("free")}</Badge>
            </Link>
          </li>
        ))}
      </ul>
    </Page>
  );
}
