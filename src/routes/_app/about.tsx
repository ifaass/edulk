import { createFileRoute } from "@tanstack/react-router";
import { Page } from "@/components/shell";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_app/about")({
  component: AboutPage,
});

function AboutPage() {
  const { t } = useI18n();
  return (
    <Page title={t("aboutTitle")}>
      <div className="flex max-w-2xl flex-col gap-4 text-fg">
        <p>{t("about1")}</p>
        <p>{t("about2")}</p>
        <p>{t("about3")}</p>
      </div>
    </Page>
  );
}
