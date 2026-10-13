import { createFileRoute } from "@tanstack/react-router";
import { Page } from "@/components/shell";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_app/terms")({
  component: TermsPage,
});

function TermsPage() {
  const { t } = useI18n();
  return (
    <Page title={t("termsTitle")}>
      <p className="max-w-2xl">{t("termsBody")}</p>
    </Page>
  );
}
