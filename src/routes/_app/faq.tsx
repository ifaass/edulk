import { createFileRoute } from "@tanstack/react-router";
import { Page } from "@/components/shell";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_app/faq")({
  component: FaqPage,
});

function FaqPage() {
  const { t } = useI18n();
  const items = [
    [t("faq1q"), t("faq1a")],
    [t("faq2q"), t("faq2a")],
    [t("faq3q"), t("faq3a")],
    [t("faq4q"), t("faq4a")],
  ] as const;
  return (
    <Page title={t("faqTitle")}>
      <div className="flex max-w-2xl flex-col gap-3">
        {items.map(([q, a]) => (
          <details key={q} className="rounded-2xl border border-border bg-surface px-4 py-3" open>
            <summary className="min-h-11 cursor-pointer font-medium">{q}</summary>
            <p className="pb-2 text-muted">{a}</p>
          </details>
        ))}
      </div>
    </Page>
  );
}
