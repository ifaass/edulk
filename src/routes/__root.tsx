import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { I18nProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";
import appCss from "../styles.css?url";

const themeBoot = `(function(){try{var t=localStorage.getItem('edulk-theme')||'system';var d=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);var h=document.documentElement;h.classList.toggle('dark',d);h.style.colorScheme=d?'dark':'light';}catch(e){}})();`;

const swRegister = `(function(){if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').then(function(r){console.log('SW registered');}).catch(function(e){console.log('SW failed:',e);});});}})();`;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "EduLK" },
      { name: "description", content: "Free Sinhala, Tamil and English lessons for Sri Lankan grades 1 to 13." },
      { name: "theme-color", content: "#0f6b5c" },
      // PWA iOS meta tags
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "EduLK" },
      { name: "mobile-web-app-capable", content: "yes" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,560;9..144,650&family=Noto+Sans:wght@400;600;700&family=Noto+Sans+Sinhala:wght@400;600;700&family=Noto+Sans+Tamil:wght@400;600;700&display=swap",
      },
    ],
  }),
  component: Root,
  notFoundComponent: Missing,
});

function Root() {
  return (
    <html lang="si" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <AuthProvider>
          <ThemeProvider>
            <I18nProvider>
              <Outlet />
            </I18nProvider>
          </ThemeProvider>
        </AuthProvider>
        <Scripts />
        <script dangerouslySetInnerHTML={{ __html: swRegister }} />
      </body>
    </html>
  );
}

function Missing() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-3 px-6">
      <p className="font-display text-4xl text-fg">EduLK</p>
      <p>මෙම පිටුව නැත.</p>
      <p>இந்தப் பக்கம் இல்லை.</p>
      <p>This page is not on EduLK.</p>
      <a href="/" className="mt-2 inline-flex min-h-11 items-center text-primary">Home</a>
    </main>
  );
}