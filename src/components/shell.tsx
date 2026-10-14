import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { Monitor, Moon, Search, Sun } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { SignedIn, SignedOut, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import type { AdPublic, Lang, Tier } from "@/lib/types";
import { listPublicAds } from "@/server/catalog";
import { getMyProfile } from "@/server/account";
import { createContext, useContext } from "react";
import { PWAInstallButton } from "@/components/PWAInstallButton";

type Desk = {
  tier: Tier;
  role: "guest" | "student" | "admin";
  ready: boolean;
  showAds: boolean;
  refresh: () => void;
};

const DeskContext = createContext<Desk>({
  tier: "free",
  role: "guest",
  ready: false,
  showAds: false,
  refresh: () => undefined,
});

export function useDesk() {
  return useContext(DeskContext);
}

export function PublicShell() {
  const { user, isPending } = useCurrentUserState();
  const [tier, setTier] = useState<Tier>("free");
  const [role, setRole] = useState<Desk["role"]>("guest");
  const [ready, setReady] = useState(false);
  const [ads, setAds] = useState<AdPublic[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    void listPublicAds().then(setAds).catch(() => setAds([]));
  }, []);

  useEffect(() => {
    if (isPending) return;
    if (!user) {
      setTier("free");
      setRole("guest");
      setReady(true);
      return;
    }
    let cancel = false;
    void getMyProfile()
      .then((result) => {
        if (cancel) return;
        if (result.ok) {
          setTier(result.profile.effectiveTier);
          setRole(result.profile.role);
        }
        setReady(true);
      })
      .catch(() => {
        if (!cancel) setReady(true);
      });
    return () => {
      cancel = true;
    };
  }, [user?.id, isPending, tick]);

  const desk: Desk = {
    tier,
    role,
    ready,
    showAds: ready && tier === "free",
    refresh: () => setTick((n) => n + 1),
  };

  return (
    <DeskContext.Provider value={desk}>
      <AdsContext.Provider value={ads}>
        <div className="flex min-h-screen flex-col">
          <SiteHeader />
          <div className="flex-1">
            <Outlet />
          </div>
          <SiteFooter />
        </div>
      </AdsContext.Provider>
    </DeskContext.Provider>
  );
}

const AdsContext = createContext<AdPublic[]>([]);

export function AdSlot({ placement }: { placement: string }) {
  const ads = useContext(AdsContext);
  const { showAds, ready } = useDesk();
  const { t } = useI18n();
  const unit = ads.find((item) => item.placement === placement);
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (!ready || !showAds || !unit) {
      setOn(false);
      return;
    }
    if (unit.frequency !== "every_n") {
      setOn(true);
      return;
    }
    const key = `edulk-ad-${unit.id}`;
    const next = Number(localStorage.getItem(key) || "0") + 1;
    localStorage.setItem(key, String(next));
    setOn(next % Math.max(1, unit.everyN) === 1);
  }, [ready, showAds, unit?.id, unit?.frequency, unit?.everyN]);

  if (!on || !unit) return null;
  return (
    <aside className="rounded-2xl border border-dashed border-border bg-surface px-4 py-3" aria-label={t("adLabel")}>
      <p className="text-xs font-semibold tracking-wide text-muted uppercase">{t("adLabel")}</p>
      <p className="mt-1 text-sm text-fg">{unit.name}</p>
      <p className="text-xs text-muted">{t("adWhy")}</p>
    </aside>
  );
}

function SiteHeader() {
  const { t, lang, setLang } = useI18n();
  const { theme, cycle } = useTheme();
  const { role } = useDesk();
  const { isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ThemeIcon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;

  function onSearch(event: FormEvent) {
    event.preventDefault();
    void navigate({ to: "/search", search: { q } });
    setOpen(false);
  }

  const links = [
    ["/grades", t("grades")],
    ["/search", t("search")],
    ["/about", t("about")],
    ["/faq", t("faq")],
    ["/contact", t("contact")],
  ] as const;

  return (
    <header className="border-b border-border bg-bg">
      <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-surface focus:px-3 focus:py-2">
        Skip
      </a>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
        <Link to="/" className="flex items-center gap-2 font-display text-xl text-fg">
          <span className="grid size-9 place-items-center rounded-lg bg-primary text-sm font-semibold text-primary-fg">LK</span>
          {t("brand")}
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {links.map(([to, label]) => (
            <Link key={to} to={to} className="rounded-full px-3 py-2 text-sm text-fg hover:bg-soft">
              {label}
            </Link>
          ))}
          {role === "admin" ? (
            <Link to="/admin" className="rounded-full px-3 py-2 text-sm text-primary hover:bg-soft">
              {t("admin")}
            </Link>
          ) : null}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex rounded-full border border-border bg-surface p-1" role="group" aria-label={t("language")}>
            {(["si", "ta", "en"] as Lang[]).map((code) => (
              <button
                key={code}
                type="button"
                aria-pressed={lang === code}
                onClick={() => setLang(code)}
                className={`min-h-9 rounded-full px-2.5 text-xs font-semibold ${lang === code ? "bg-primary text-primary-fg" : "text-fg"}`}
              >
                {code === "si" ? "සිං" : code === "ta" ? "தமிழ்" : "EN"}
              </button>
            ))}
          </div>
          <button type="button" onClick={cycle} className="grid size-11 place-items-center rounded-full border border-border bg-surface" aria-label={`${t("theme")}: ${theme}`}>
            <ThemeIcon className="size-4" />
          </button>
          <PWAInstallButton />
          <div className="min-w-11">
            {isPending ? <div className="h-11 w-11 animate-pulse rounded-full bg-soft" /> : null}
            <SignedOut>
              <Link to="/login" className="inline-flex min-h-11 items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-fg">
                {t("signIn")}
              </Link>
            </SignedOut>
            <SignedIn>
              <UserButton />
            </SignedIn>
          </div>
          <button type="button" className="grid size-11 place-items-center rounded-full border border-border md:hidden" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            <span className="sr-only">{t("menu")}</span>
            <span className="flex w-4 flex-col gap-1" aria-hidden="true">
              <span className="h-0.5 bg-fg" />
              <span className="h-0.5 bg-fg" />
              <span className="h-0.5 bg-fg" />
            </span>
          </button>
        </div>
        {open ? (
          <nav className="flex w-full flex-col gap-1 md:hidden">
            {links.map(([to, label]) => (
              <Link key={to} to={to} onClick={() => setOpen(false)} className="rounded-xl px-3 py-3 text-fg hover:bg-soft">
                {label}
              </Link>
            ))}
            {role === "admin" ? (
              <Link to="/admin" onClick={() => setOpen(false)} className="rounded-xl px-3 py-3 text-primary">
                {t("admin")}
              </Link>
            ) : null}
          </nav>
        ) : null}
        <form onSubmit={onSearch} className="flex w-full gap-2 md:w-auto md:min-w-64">
          <label className="sr-only" htmlFor="site-search">{t("search")}</label>
          <input
            id="site-search"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder={t("searchPlaceholder")}
            className="min-h-11 w-full rounded-full border border-border bg-surface px-4 text-sm text-fg"
          />
          <button type="submit" className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-fg" aria-label={t("search")}>
            <Search className="size-4" />
          </button>
        </form>
      </div>
    </header>
  );
}

function SiteFooter() {
  const { t } = useI18n();
  return (
    <footer className="mt-16 border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
        <AdSlot placement="footer" />
        <div className="flex flex-wrap gap-4 text-sm">
          <Link to="/about" className="text-fg hover:text-primary">{t("about")}</Link>
          <Link to="/faq" className="text-fg hover:text-primary">{t("faq")}</Link>
          <Link to="/contact" className="text-fg hover:text-primary">{t("contact")}</Link>
          <Link to="/privacy" className="text-fg hover:text-primary">{t("privacy")}</Link>
          <Link to="/terms" className="text-fg hover:text-primary">{t("terms")}</Link>
        </div>
        <p className="max-w-xl text-sm text-muted">{t("footer")}</p>
        <p className="max-w-xl text-sm text-muted">{t("videosNote")}</p>
      </div>
    </footer>
  );
}

export function Page({ children, title, lede }: { children: ReactNode; title: string; lede?: string }) {
  return (
    <main id="content" className="mx-auto w-full max-w-6xl px-4 py-8">
      <h1 className="font-display text-4xl text-fg">{title}</h1>
      {lede ? <p className="mt-3 max-w-2xl text-muted">{lede}</p> : null}
      <div className="mt-8">{children}</div>
    </main>
  );
}
