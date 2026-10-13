import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Page } from "@/components/shell";
import { SubjectIcon, toneClass } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import { tx } from "@/lib/types";
import { getGrade } from "@/server/catalog";

export const Route = createFileRoute("/_app/grades/$slug")({
  loader: async ({ params }) => {
    const data = await getGrade({ data: params.slug });
    if (!data) throw notFound();
    return data;
  },
  component: GradePage,
});

function GradePage() {
  const { grade, subjects } = Route.useLoaderData();
  const { lang, t } = useI18n();
  return (
    <Page title={tx(lang, grade.name)} lede={`${subjects.length} ${t("subjects")}`}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {subjects.map((subject) => (
          <Link
            key={subject.id}
            to="/subjects/$grade/$subject"
            params={{ grade: grade.slug, subject: subject.slug }}
            className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 hover:border-primary"
          >
            <span className={`grid size-12 place-items-center rounded-xl ${toneClass(subject.color)}`}>
              <SubjectIcon name={subject.icon} />
            </span>
            <span>
              <span className="block font-medium">{tx(lang, subject.name)}</span>
              <span className="text-sm text-muted">{subject.lessonCount} {t("lessons")}</span>
            </span>
          </Link>
        ))}
      </div>
    </Page>
  );
}
