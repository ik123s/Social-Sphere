import { Link, useLocation } from "wouter";
import { MessageCircle, Activity, PenSquare, UserCircle } from "lucide-react";

interface LayoutProps {
  children: React.ReactNode;
  showNav?: boolean;
}

export function Layout({ children, showNav = true }: LayoutProps) {
  const [location] = useLocation();

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-background text-foreground overflow-hidden max-w-[448px] mx-auto relative border-x border-border/30 shadow-2xl shadow-black/50">
      <main className="flex-1 overflow-hidden w-full relative z-0">
        {children}
      </main>

      {showNav && (
        <nav className="flex-shrink-0 w-full bg-[#0d0618]/95 backdrop-blur-xl border-t border-white/[0.06] z-50 h-[62px] flex items-center justify-around px-1 safe-area-inset-bottom">
          <NavItem href="/status"    icon={Activity}       label="Spaces"  active={location === "/status"} />
          <NavItem href="/chats"     icon={MessageCircle}  label="Chats"   active={location === "/chats" || location.startsWith("/chats/")} />
          <NavItem href="/new-contact" icon={PenSquare}    label="New"     active={location === "/new-contact"} />
          <NavItem href="/profile"   icon={UserCircle}     label="Profile" active={location === "/profile"} />
        </nav>
      )}
    </div>
  );
}

function NavItem({ href, icon: Icon, label, active }: { href: string; icon: any; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`flex flex-col items-center justify-center flex-1 h-full gap-[3px] transition-all duration-150 ${
        active ? "text-violet-400" : "text-white/35 hover:text-white/55"
      }`}
    >
      <div className={`relative p-1.5 rounded-xl transition-all ${active ? "bg-violet-500/15" : ""}`}>
        <Icon className={`w-[22px] h-[22px] ${active ? "drop-shadow-[0_0_10px_rgba(167,139,250,0.7)]" : ""}`} />
        {active && (
          <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-violet-400 rounded-full" />
        )}
      </div>
      <span className={`text-[9px] font-semibold tracking-wide ${active ? "text-violet-400" : ""}`}>{label}</span>
    </Link>
  );
}
