import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Page } from "@/components/shell";
import { Button, fieldClass, labelClass } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import { sendContact } from "@/server/catalog";

export const Route = createFileRoute("/_app/contact")({
  component: ContactPage,
});

function ContactPage() {
  const { t } = useI18n();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      await sendContact({
        data: {
          name: String(form.get("name") ?? ""),
          email: String(form.get("email") ?? ""),
          reason: String(form.get("reason") ?? "general"),
          message: String(form.get("message") ?? ""),
        },
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send");
    } finally {
      setPending(false);
    }
  }

  return (
    <Page title={t("contact")} lede={t("contactIntro")}>
      {sent ? <p className="text-primary">{t("contactSent")}</p> : (
        <form onSubmit={(event) => void onSubmit(event)} className="flex max-w-lg flex-col gap-4">
          <label className={labelClass}>{t("contactName")}
            <input name="name" required className={fieldClass} />
          </label>
          <label className={labelClass}>{t("contactEmail")}
            <input name="email" type="email" required className={fieldClass} />
          </label>
          <label className={labelClass}>{t("contactReason")}
            <select name="reason" className={fieldClass}>
              <option value="general">{t("general")}</option>
              <option value="permission">{t("permission")}</option>
              <option value="technical">{t("technical")}</option>
            </select>
          </label>
          <label className={labelClass}>{t("contactMessage")}
            <textarea name="message" required rows={5} className={fieldClass} />
          </label>
          {error ? <p className="text-sm text-accent">{error}</p> : null}
          <Button type="submit" disabled={pending}>{t("contactSend")}</Button>
        </form>
      )}
    </Page>
  );
}
