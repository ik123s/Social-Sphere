import { useEffect, useState } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { initUser } from "@/lib/vcn";
import { isOnboardingComplete } from "@/lib/onboarding";

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

function AppShell() {
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const done = isOnboardingComplete();
    setOnboarded(done);
    if (done) {
      initUser().catch(() => {});
    }
  }, []);

  if (onboarded === null) return null; // brief flash prevention

  if (!onboarded) {
    return (
      <Onboarding
        onComplete={() => {
          initUser().catch(() => {});
          setOnboarded(true);
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
