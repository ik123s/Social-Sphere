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
  resolveUpdateState,
  type UpdateState,
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
import ReviewPrompt from "@/components/review-prompt";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false },
  },
});

type Phase = "loading" | "update" | "onboarding" | "app";

function AppShell() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [updateState, setUpdateState] = useState<UpdateState | null>(null);
  const [, setLocation] = useLocation();

  useEffect(() => {
    (async () => {
      // 1. Version check
      const info = await fetchVersionInfo();
      if (info) {
        const state = resolveUpdateState(info);
        if (state) {
          setUpdateState(state);
          setPhase("update");
          return;
        }
      }

      // 2. Onboarding check
      if (!isOnboardingComplete()) {
        setPhase("onboarding");
        return;
      }

      // 3. Main app
      initUser().catch(() => {});
      setPhase("app");
    })();
  }, []);

  const afterUpdate = () => {
    if (!isOnboardingComplete()) {
      setPhase("onboarding");
    } else {
      initUser().catch(() => {});
      setPhase("app");
      setLocation("/chats");
    }
  };

  // ── Loading splash ───────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <div className="flex h-[100dvh] w-full max-w-md mx-auto items-center justify-center border-x border-border bg-background">
        <div className="flex flex-col items-center gap-5">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-2 border-primary/15" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin" />
            <div className="absolute inset-2 bg-gradient-to-br from-primary to-violet-700 rounded-full flex items-center justify-center">
              <span className="text-white font-serif italic text-2xl select-none">C</span>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground tracking-widest uppercase">Chivra</p>
        </div>
      </div>
    );
  }

  // ── Update gate ──────────────────────────────────────────────────────────
  if (phase === "update" && updateState) {
    return <UpdateScreen state={updateState} onComplete={afterUpdate} />;
  }

  // ── Onboarding ───────────────────────────────────────────────────────────
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

  // ── Main app ─────────────────────────────────────────────────────────────
  return (
    <>
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
      <ReviewPrompt />
    </>
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
