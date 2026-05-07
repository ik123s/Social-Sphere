import { useEffect, useState } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { initUser } from "@/lib/vcn";
import { isOnboardingComplete } from "@/lib/onboarding";
import {
  fetchVersionInfo,
  isUpdateAvailable,
  isWithinGracePeriod,
  isForceUpdate,
  type VersionInfo,
} from "@/lib/version";

import UpdateScreen from "@/pages/update-screen";
import Onboarding from "@/pages/onboarding";
import Splash from "@/pages/splash";
import ChatList from "@/pages/chat-list";
import ChatScreen from "@/pages/chat-screen";
import ContactProfile from "@/pages/contact-profile";
import StatusFeed from "@/pages/status-feed";
import NewContact from "@/pages/new-contact";
import Profile from "@/pages/profile";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false },
  },
});

type AppPhase = "loading" | "update" | "onboarding" | "app";

function AppShell() {
  const [phase, setPhase] = useState<AppPhase>("loading");
  const [updateInfo, setUpdateInfo] = useState<VersionInfo | null>(null);
  const [forceUpdate, setForceUpdate] = useState(false);
  const [, setLocation] = useLocation();

  useEffect(() => {
    (async () => {
      // 1. Check for updates
      const info = await fetchVersionInfo();

      if (info && isUpdateAvailable(info)) {
        if (isForceUpdate()) {
          // Grace period expired — must update
          setUpdateInfo(info);
          setForceUpdate(true);
          setPhase("update");
          return;
        }
        if (!isWithinGracePeriod()) {
          // Never dismissed before — show update prompt
          setUpdateInfo(info);
          setForceUpdate(false);
          setPhase("update");
          return;
        }
        // Within grace period — silently skip update
      }

      // 2. Check onboarding
      if (!isOnboardingComplete()) {
        setPhase("onboarding");
        return;
      }

      // 3. Main app
      initUser().catch(() => {});
      setPhase("app");
    })();
  }, []);

  const handleUpdateDone = () => {
    if (!isOnboardingComplete()) {
      setPhase("onboarding");
    } else {
      initUser().catch(() => {});
      setPhase("app");
    }
  };

  if (phase === "loading") {
    return (
      <div className="flex h-[100dvh] w-full max-w-md mx-auto items-center justify-center border-x border-border bg-background">
        <div className="flex flex-col items-center gap-5">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-2 border-primary/15" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin" />
            <div className="absolute inset-2 bg-gradient-to-br from-primary to-violet-700 rounded-full flex items-center justify-center">
              <span className="text-white font-serif italic text-2xl">C</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground tracking-widest uppercase">Chivra</p>
        </div>
      </div>
    );
  }

  if (phase === "update" && updateInfo) {
    return (
      <UpdateScreen
        info={updateInfo}
        forced={forceUpdate}
        onLater={handleUpdateDone}
      />
    );
  }

  if (phase === "onboarding") {
    return (
      <Onboarding
        onComplete={() => {
          initUser().catch(() => {});
          setPhase("app");
          setLocation("/chats");
        }}
      />
    );
  }

  return (
    <Switch>
      <Route path="/" component={Splash} />
      <Route path="/chats" component={ChatList} />
      <Route path="/chats/:id" component={ChatScreen} />
      <Route path="/contacts/:id" component={ContactProfile} />
      <Route path="/status" component={StatusFeed} />
      <Route path="/new-contact" component={NewContact} />
      <Route path="/profile" component={Profile} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AppShell />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
