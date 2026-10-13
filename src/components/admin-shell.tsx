import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useI18n } from "@/lib/i18n";
import { getMyProfile } from "@/server/account";

const LINKS = [
  ["/admin", "Overview"],
  ["/admin/grades", "Grades"],
  ["/admin/subjects", "Subjects"],
  ["/admin/lessons", "Lessons"],
  ["/admin/videos", "Videos"],
  ["/admin/users", "Students"],
  ["/admin/ads", "Ads"],
  ["/admin/contact", "Inbox"],
  ["/admin/logs", "Log"],
] as const;

export function AdminLayout() {
  const { user, isPending } = useCurrentUserState();
  const { t } = useI18n();
  const path = useRouterState({ select: (state) => state.location.pathname });
  const [role, setRole] = useState<string | null>(null);
  const [banned, setBanned] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    void getMyProfile().then((result) => {
      if (result.ok) {
        setRole(result.profile.role);
        setBanned(result.profile.banned);
      } else setRole("student");
    });
  }, [user?.id]);

  if (isPending || (user && role === null)) {
    return <main className="p-8"><div className="h-8 w-40 animate-pulse rounded bg-soft" /></main>;
  }
  if (!user) return <RedirectToSignIn />;
  if (banned) return <main className="p-8">{t("suspended")}</main>;
  if (role !== "admin") {
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <h1 className="font-display text-3xl">{t("admin")}</h1>
        <p className="mt-3 text-muted">{t("notAdmin")}</p>
        <Link to="/" className="mt-4 inline-flex min-h-11 items-center text-primary">{t("backSite")}</Link>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-fg md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
      <button type="button" className="m-3 min-h-11 rounded-full border border-border px-4 md:hidden" onClick={() => setOpen((v) => !v)}>
        {t("menu")}
      </button>
      <aside className={`${open ? "block" : "hidden"} border-b border-border bg-surface md:block md:border-b-0 md:border-r`}>
        <div className="flex items-center justify-between px-4 py-4">
          <Link to="/" className="font-display text-xl">EduLK</Link>
          <Link to="/" className="text-sm text-primary">{t("backSite")}</Link>
        </div>
        <nav className="flex flex-col px-2 pb-4">
          {LINKS.map(([to, label]) => {
            const active = to === "/admin" ? path === "/admin" : path.startsWith(to);
            return (
              <Link key={to} to={to} onClick={() => setOpen(false)} className={`rounded-xl px-3 py-3 text-sm ${active ? "bg-soft font-semibold text-primary" : "text-fg"}`}>
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="min-w-0 px-4 py-6 md:px-8">
        <Outlet />
      </div>
    </div>
  );
}
