import { createFileRoute } from "@tanstack/react-router";
import { Page } from "@/components/shell";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_app/privacy")({
  component: PrivacyPage,
});

function PrivacyPage() {
  const { t } = useI18n();
  return (
    <Page title={t("privacyTitle")}>
      <p className="max-w-2xl">{t("privacyBody")}</p>
    </Page>
  );
}
