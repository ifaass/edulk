import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Page } from "@/components/shell";
import { Button, fieldClass, labelClass } from "@/components/ui";
import { authClient } from "@/lib/auth/client";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_app/login")({
  component: LoginPage,
});

function LoginPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const name = String(form.get("name") ?? "Student");
    setPending(true);
    setError("");
    const result = mode === "up"
      ? await authClient.signUp.email({ email, password, name, callbackURL: "/account" })
      : await authClient.signIn.email({ email, password, callbackURL: "/account" });
    setPending(false);
    if (result.error) {
      setError(result.error.message ?? "Could not sign in");
      return;
    }
    await router.invalidate();
    window.location.href = "/account";
  }

  return (
    <Page title={t("signIn")} lede={t("notAdmin")}>
      <div className="grid max-w-lg gap-6">
        <form onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5">
          <div className="flex gap-2">
            <Button type="button" variant={mode === "in" ? "primary" : "ghost"} onClick={() => setMode("in")}>Sign in</Button>
            <Button type="button" variant={mode === "up" ? "primary" : "ghost"} onClick={() => setMode("up")}>Create account</Button>
          </div>
          {mode === "up" ? (
            <label className={labelClass}>Name
              <input name="name" required className={fieldClass} />
            </label>
          ) : null}
          <label className={labelClass}>Email
            <input name="email" type="email" required autoComplete="email" className={fieldClass} />
          </label>
          <label className={labelClass}>Password
            <input name="password" type="password" required minLength={8} autoComplete={mode === "up" ? "new-password" : "current-password"} className={fieldClass} />
          </label>
          {error ? <p className="text-sm text-accent">{error}</p> : null}
          <Button type="submit" disabled={pending}>{pending ? "…" : mode === "up" ? "Create account" : t("signIn")}</Button>
        </form>
      </div>
    </Page>
  );
}