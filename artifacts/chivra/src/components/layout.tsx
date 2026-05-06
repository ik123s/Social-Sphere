import { Link, useLocation } from "wouter";
import { MessageCircle, Users, Activity, Plus } from "lucide-react";

interface LayoutProps {
  children: React.ReactNode;
  showNav?: boolean;
}

export function Layout({ children, showNav = true }: LayoutProps) {
  const [location] = useLocation();

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-background text-foreground overflow-hidden max-w-md mx-auto relative border-x border-border shadow-2xl">
      <main className="flex-1 overflow-y-auto w-full relative z-0 pb-16 scrollbar-hide">
        {children}
      </main>

      {showNav && (
        <nav className="absolute bottom-0 w-full bg-card/80 backdrop-blur-xl border-t border-border z-50 h-16 flex items-center justify-around px-4 pb-safe">
          <NavItem href="/status" icon={Activity} label="Status" active={location === "/status"} />
          <NavItem href="/chats" icon={MessageCircle} label="Chats" active={location === "/chats" || location.startsWith("/chats/") && !location.includes("/contacts")} />
          <NavItem href="/new-contact" icon={Plus} label="New" active={location === "/new-contact"} />
        </nav>
      )}
    </div>
  );
}

function NavItem({ href, icon: Icon, label, active }: { href: string; icon: any; label: string; active: boolean }) {
  return (
    <Link href={href} className={`flex flex-col items-center justify-center w-16 h-full space-y-1 transition-all duration-300 ${active ? "text-primary scale-110" : "text-muted-foreground hover:text-foreground"}`}>
      <div className={`relative p-1 rounded-xl transition-all ${active ? "bg-primary/10" : ""}`}>
        <Icon className={`w-6 h-6 ${active ? "drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]" : ""}`} />
      </div>
      <span className="text-[10px] font-medium tracking-wide">{label}</span>
    </Link>
  );
}