import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { initUser } from "@/lib/vcn";

import Splash from "@/pages/splash";
import ChatList from "@/pages/chat-list";
import ChatScreen from "@/pages/chat-screen";
import ContactProfile from "@/pages/contact-profile";
import StatusFeed from "@/pages/status-feed";
import NewContact from "@/pages/new-contact";
import Profile from "@/pages/profile";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

function VcnInit() {
  useEffect(() => {
    initUser().catch(() => {
      // Silent fail — VCN init is non-blocking
    });
  }, []);
  return null;
}

function Router() {
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
          <VcnInit />
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
