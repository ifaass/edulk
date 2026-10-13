import { createFileRoute, Link } from "@tanstack/react-router";
import { Page } from "@/components/shell";
import { useI18n } from "@/lib/i18n";
import { tx, type Band } from "@/lib/types";
import { getHome } from "@/server/catalog";

export const Route = createFileRoute("/_app/grades/")({
  loader: () => getHome(),
  component: GradesPage,
});

function GradesPage() {
  const { grades } = Route.useLoaderData();
  const { lang, t } = useI18n();
  const bandKey = (band: Band) =>
    band === "primary" ? t("band_primary") : band === "junior" ? t("band_junior") : band === "ol" ? t("band_ol") : t("band_al");
  return (
    <Page title={t("grades")} lede={t("heroSub")}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {grades.map((grade) => (
          <Link key={grade.id} to="/grades/$slug" params={{ slug: grade.slug }} className="flex min-h-28 flex-col rounded-2xl border border-border bg-surface p-4 hover:border-primary">
            <span className="font-display text-4xl text-primary tabular-nums">{grade.number}</span>
            <span className="mt-2 text-sm text-muted">{bandKey(grade.band)} · {grade.subjectCount} {t("subjects")}</span>
            <span className="mt-auto pt-3 text-sm font-medium">{tx(lang, grade.name)}</span>
          </Link>
        ))}
      </div>
    </Page>
  );
}
