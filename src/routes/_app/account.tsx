import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useDesk } from "@/components/shell";
import { Button } from "@/components/ui";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useI18n } from "@/lib/i18n";
import { tx, type Tier } from "@/lib/types";
import { myDesk, setMyTier } from "@/server/account";

export const Route = createFileRoute("/_app/account")({
  component: AccountPage,
});

const PLANS: { id: Tier; price: string; points: string[] }[] = [
  { id: "free", price: "0", points: ["Ads on", "About half the lessons", "No note download"] },
  { id: "premium", price: "500", points: ["No ads", "Every lesson", "Download notes"] },
  { id: "premium_plus", price: "1000", points: ["No ads", "Every lesson", "Download notes", "Same desk, kept for a future tutor"] },
];

function AccountPage() {
  const { user, isPending } = useCurrentUserState();
  const { lang, t } = useI18n();
  const desk = useDesk();
  const [data, setData] = useState<Awaited<ReturnType<typeof myDesk>> | null>(null);

  function load() {
    void myDesk().then(setData).catch(() => setData(null));
  }

  useEffect(() => {
    if (user) load();
  }, [user?.id]);

  if (isPending) return <main className="mx-auto max-w-6xl px-4 py-16"><div className="h-8 w-40 animate-pulse rounded bg-soft" /></main>;
  if (!user) return <RedirectToSignIn />;
  if (data && !data.ok) return <main className="mx-auto max-w-6xl px-4 py-16">{data.error}</main>;

  async function choose(tier: Tier) {
    await setMyTier({ data: tier });
    desk.refresh();
    load();
  }

  const profile = data && data.ok ? data.profile : null;

  return (
    <main id="content" className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-8">
      <header>
        <h1 className="font-display text-4xl">{t("account")}</h1>
        <p className="mt-2 text-muted">{profile ? `${profile.name} · ${t("currentPlan")}: ${profile.effectiveTier}` : ""}</p>
      </header>

      <section>
        <h2 className="font-display text-2xl">{t("plansTitle")}</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">{t("demoNote")}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {PLANS.map((plan) => {
            const current = profile?.effectiveTier === plan.id;
            return (
              <article key={plan.id} className={`rounded-2xl border p-5 ${current ? "border-primary bg-soft" : "border-border bg-surface"}`}>
                <h3 className="font-display text-2xl">{plan.id === "free" ? t("free") : plan.id === "premium" ? t("premium") : t("premiumPlus")}</h3>
                <p className="mt-2 font-display text-3xl tabular-nums">{t("lkr")} {plan.price}<span className="text-base text-muted">{t("perMonth")}</span></p>
                <ul className="mt-3 flex flex-col gap-1 text-sm">
                  {plan.points.map((point) => <li key={point}>{point}</li>)}
                </ul>
                <Button type="button" className="mt-4" variant={current ? "ghost" : "primary"} disabled={current} onClick={() => void choose(plan.id)}>
                  {current ? t("currentPlan") : t("activate")}
                </Button>
              </article>
            );
          })}
        </div>
        {profile && profile.effectiveTier !== "free" ? <p className="mt-3 text-sm text-primary">{t("adsHidden")}</p> : null}
      </section>

      <section>
        <h2 className="font-display text-2xl">{t("history")}</h2>
        {data?.ok && data.history.length === 0 ? <p className="mt-2 text-muted">{t("noHistory")}</p> : null}
        <ul className="mt-3 flex flex-col gap-2">
          {data?.ok ? data.history.map((item) => (
            <li key={item.slug}>
              <Link to="/lessons/$slug" params={{ slug: item.slug }} className="flex justify-between rounded-xl border border-border px-4 py-3">
                <span>{tx(lang, item.title)}</span>
                <span className="text-sm text-muted">{item.minutes} {t("minute")}</span>
              </Link>
            </li>
          )) : null}
        </ul>
      </section>

      <section>
        <h2 className="font-display text-2xl">{t("bookmark")}</h2>
        {data?.ok && data.bookmarks.length === 0 ? <p className="mt-2 text-muted">{t("noBookmarks")}</p> : null}
        <ul className="mt-3 flex flex-col gap-2">
          {data?.ok ? data.bookmarks.map((item) => (
            <li key={item.slug}>
              <Link to="/lessons/$slug" params={{ slug: item.slug }} className="block rounded-xl border border-border px-4 py-3">
                {tx(lang, item.title)}
              </Link>
            </li>
          )) : null}
        </ul>
      </section>

      <section>
        <h2 className="font-display text-2xl">{t("notes")}</h2>
        <ul className="mt-3 flex flex-col gap-3">
          {data?.ok ? data.notes.map((item) => (
            <li key={item.slug} className="rounded-2xl border border-border bg-surface p-4">
              <Link to="/lessons/$slug" params={{ slug: item.slug }} className="font-medium">{tx(lang, item.title)}</Link>
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{item.body}</p>
            </li>
          )) : null}
        </ul>
      </section>

      <section>
        <h2 className="font-display text-2xl">{t("certificates")}</h2>
        {data?.ok && data.certificates.length === 0 ? <p className="mt-2 text-muted">{t("noCert")}</p> : null}
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {data?.ok ? data.certificates.map((item) => (
            <article key={item.subject.en + item.gradeNumber} className="certificate rounded-2xl border border-primary bg-surface p-5">
              <p className="text-xs font-semibold tracking-wide text-primary">{t("certificateLead")}</p>
              <h3 className="mt-2 font-display text-2xl">{profile?.name}</h3>
              <p className="mt-1">{tx(lang, item.subject)} · {t("gradeLabel")} {item.gradeNumber}</p>
              <p className="text-sm text-muted">{t("score")} {item.score}%</p>
              <Button type="button" variant="ghost" className="mt-3 print:hidden" onClick={() => window.print()}>{t("print")}</Button>
            </article>
          )) : null}
        </div>
      </section>
    </main>
  );
}
