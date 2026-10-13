import { createFileRoute, Link } from "@tanstack/react-router";
import { Page } from "@/components/shell";
import { Badge } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import { tx } from "@/lib/types";
import { searchLessons } from "@/server/catalog";

export const Route = createFileRoute("/_app/search")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : "",
  }),
  loaderDeps: ({ search }) => ({ q: search.q }),
  loader: ({ deps }) => searchLessons({ data: deps.q }),
  component: SearchPage,
});

function SearchPage() {
  const lessons = Route.useLoaderData();
  const { q } = Route.useSearch();
  const { lang, t } = useI18n();
  return (
    <Page title={t("search")} lede={q}>
      {q && lessons.length === 0 ? <p className="text-muted">{t("noResults")}</p> : null}
      <ul className="flex flex-col gap-3">
        {lessons.map((lesson) => (
          <li key={lesson.id}>
            <Link to="/lessons/$slug" params={{ slug: lesson.slug }} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-4">
              <span>
                <span className="block text-xs text-muted">{t("gradeLabel")} {lesson.gradeNumber} · {tx(lang, lesson.subject)}</span>
                <span className="font-medium">{tx(lang, lesson.title)}</span>
              </span>
              <Badge kind={lesson.locked ? "premium" : "free"}>{lesson.locked ? t("locked") : t("free")}</Badge>
            </Link>
          </li>
        ))}
      </ul>
    </Page>
  );
}
