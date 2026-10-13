import { createFileRoute, Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import { tx, type Band } from "@/lib/types";
import { getHome } from "@/server/catalog";

export const Route = createFileRoute("/_app/")({
  loader: () => getHome(),
  component: Home,
});

function Home() {
  const data = Route.useLoaderData();
  const { lang, t } = useI18n();
  const bandKey = (band: Band) =>
    band === "primary" ? t("band_primary") : band === "junior" ? t("band_junior") : band === "ol" ? t("band_ol") : t("band_al");

  return (
    <main id="content">
      {data.announcement ? (
        <div className="border-b border-border bg-soft">
          <p className="mx-auto max-w-6xl px-4 py-3 text-sm text-fg">
            <span className="font-semibold">{tx(lang, data.announcement.title)}. </span>
            {tx(lang, data.announcement.body)}
          </p>
        </div>
      ) : null}
      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-end">
        <div>
          <p className="text-sm font-semibold tracking-wide text-accent">{t("heroKicker")}</p>
          <h1 className="mt-3 max-w-xl font-display text-5xl leading-tight text-fg">{t("heroTitle")}</h1>
          <p className="mt-4 max-w-xl text-lg text-muted">{t("heroSub")}</p>
          <Link to="/grades" className="mt-6 inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-fg">
            {t("browse")}
          </Link>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="font-display text-2xl">{t("today")}</h2>
          <ul className="mt-4 flex flex-col">
            {data.featured.map((lesson) => (
              <li key={lesson.id} className="border-t border-border first:border-t-0">
                <Link to="/lessons/$slug" params={{ slug: lesson.slug }} className="flex items-start justify-between gap-3 py-3">
                  <span>
                    <span className="block text-xs text-muted">{tx(lang, lesson.grade.name)} · {tx(lang, lesson.subject.name)}</span>
                    <span className="mt-1 block font-medium text-fg">{tx(lang, lesson.title)}</span>
                  </span>
                  <Badge kind={lesson.locked ? "premium" : "free"}>{lesson.locked ? t("locked") : t("free")}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 pb-4">
        <h2 className="font-display text-3xl">{t("grades")}</h2>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {data.grades.map((grade) => (
            <Link key={grade.id} to="/grades/$slug" params={{ slug: grade.slug }} className="flex min-h-28 flex-col rounded-2xl border border-border bg-surface p-4 hover:border-primary">
              <span className="font-display text-4xl text-primary tabular-nums">{grade.number}</span>
              <span className="mt-2 text-sm text-muted">{bandKey(grade.band)}</span>
              <span className="mt-auto pt-3 text-sm font-medium">{tx(lang, grade.name)}</span>
            </Link>
          ))}
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-4 px-4 py-12 md:grid-cols-3">
        <h2 className="font-display text-3xl md:col-span-3">{t("worksTitle")}</h2>
        {[t("works1"), t("works2"), t("works3")].map((step, index) => (
          <p key={step} className="rounded-2xl border border-border bg-surface p-5">
            <span className="font-display text-3xl text-primary tabular-nums">0{index + 1}</span>
            <span className="mt-3 block text-fg">{step}</span>
          </p>
        ))}
      </section>
    </main>
  );
}
