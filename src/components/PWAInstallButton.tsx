"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PWAInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showButton, setShowButton] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    // Already installed check
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setShowButton(false);
      return;
    }

    // Check iOS
    const ua = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(ua) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // Android/Desktop Chrome: beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowButton(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS: always show button (manual install)
    if (isIOSDevice) {
      setShowButton(true);
    }

    // App installed event
    window.addEventListener("appinstalled", () => {
      setShowButton(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  async function handleInstall() {
    // iOS: show guide
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }

    // Android/Desktop
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log("Install outcome:", outcome);
    setDeferredPrompt(null);
    setShowButton(false);
  }

  if (!showButton) return null;

  return (
    <>
      <Button
        type="button"
        onClick={handleInstall}
        className="bg-accent text-accent-fg"
      >
        📲 Install App
      </Button>

      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-w-md rounded-2xl bg-surface p-6">
            <h2 className="mb-4 font-display text-2xl">
              iPhone එකේ Install කරන්නේ කොහොමද?
            </h2>
            <ol className="flex flex-col gap-3 text-sm">
              <li>
                <strong>1.</strong> පහළ තියෙන <strong>Share</strong> button එක ඔබන්න ⬆️
              </li>
              <li>
                <strong>2.</strong> <strong>&quot;Add to Home Screen&quot;</strong> තෝරන්න
              </li>
              <li>
                <strong>3.</strong> <strong>&quot;Add&quot;</strong> ඔබන්න
              </li>
            </ol>
            <Button
              type="button"
              className="mt-6 w-full"
              onClick={() => setShowIOSGuide(false)}
            >
              හරි, තේරුනා!
            </Button>
          </div>
        </div>
      )}
    </>
  );
}