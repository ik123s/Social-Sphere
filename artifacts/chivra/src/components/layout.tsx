import { Link, useLocation } from "wouter";
import { MessageCircle, Activity, Plus, UserCircle } from "lucide-react";

interface LayoutProps {
  children: React.ReactNode;
  showNav?: boolean;
}

export function Layout({ children, showNav = true }: LayoutProps) {
  const [location] = useLocation();

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-background text-foreground overflow-hidden max-w-md mx-auto relative border-x border-border shadow-2xl">
      <main className="flex-1 overflow-hidden w-full relative z-0">
        {children}
      </main>

      {showNav && (
        <nav className="flex-shrink-0 w-full bg-card/90 backdrop-blur-xl border-t border-border z-50 h-16 flex items-center justify-around px-2">
          <NavItem href="/status" icon={Activity} label="Status" active={location === "/status"} />
          <NavItem href="/chats" icon={MessageCircle} label="Chats" active={location === "/chats" || location.startsWith("/chats/")} />
          <NavItem href="/new-contact" icon={Plus} label="New" active={location === "/new-contact"} />
          <NavItem href="/profile" icon={UserCircle} label="Profile" active={location === "/profile"} />
        </nav>
      )}
    </div>
  );
}

function NavItem({ href, icon: Icon, label, active }: { href: string; icon: any; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all duration-200 ${
        active ? "text-primary" : "text-muted-foreground hover:text-foreground/70"
      }`}
    >
      <div className={`relative p-1.5 rounded-xl transition-all ${active ? "bg-primary/10" : ""}`}>
        <Icon className={`w-5 h-5 ${active ? "drop-shadow-[0_0_8px_rgba(168,85,247,0.6)]" : ""}`} />
        {active && (
          <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />
        )}
      </div>
      <span className={`text-[9px] font-medium tracking-wide ${active ? "text-primary" : ""}`}>{label}</span>
    </Link>
  );
}
