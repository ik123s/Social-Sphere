import { useState } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { User, Bell, Lock, MessageCircle, Info, ChevronRight, Edit2, Check } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";

const DISPLAY_NAME_KEY = "chivra_display_name";
const STATUS_TEXT_KEY = "chivra_status_text";

export default function Profile() {
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState(
    () => localStorage.getItem(DISPLAY_NAME_KEY) || "You"
  );
  const [statusText, setStatusText] = useState(
    () => localStorage.getItem(STATUS_TEXT_KEY) || "Available"
  );
  const [editingName, setEditingName] = useState(false);
  const [editingStatus, setEditingStatus] = useState(false);
  const [tempName, setTempName] = useState(displayName);
  const [tempStatus, setTempStatus] = useState(statusText);

  const saveName = () => {
    const trimmed = tempName.trim() || "You";
    setDisplayName(trimmed);
    localStorage.setItem(DISPLAY_NAME_KEY, trimmed);
    setEditingName(false);
    toast({ title: "Name updated" });
  };

  const saveStatus = () => {
    const trimmed = tempStatus.trim() || "Available";
    setStatusText(trimmed);
    localStorage.setItem(STATUS_TEXT_KEY, trimmed);
    setEditingStatus(false);
    toast({ title: "Status updated" });
  };

  const initials = displayName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <Layout>
      <div className="flex flex-col min-h-full pb-24">
        <header className="px-4 pt-12 pb-4 bg-background/95 backdrop-blur z-10 sticky top-0 border-b border-border">
          <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        </header>

        <div className="px-4 py-6 space-y-6">
          {/* Avatar + name */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-4"
          >
            <div className="relative">
              <div className="p-1 rounded-full bg-gradient-to-tr from-violet-500 to-pink-500 shadow-xl">
                <div className="p-0.5 rounded-full bg-background">
                  <Avatar className="h-24 w-24">
                    <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </div>
              </div>
            </div>

            {/* Display name */}
            <div className="flex flex-col items-center gap-1 w-full">
              {editingName ? (
                <div className="flex items-center gap-2 w-full max-w-[220px]">
                  <Input
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveName()}
                    className="text-center text-lg font-semibold h-9 rounded-xl"
                    autoFocus
                    maxLength={30}
                  />
                  <Button size="icon" className="h-9 w-9 rounded-xl flex-shrink-0" onClick={saveName}>
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => { setTempName(displayName); setEditingName(true); }}
                  className="flex items-center gap-2 group"
                >
                  <span className="text-xl font-bold">{displayName}</span>
                  <Edit2 className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </button>
              )}

              {/* Status text */}
              {editingStatus ? (
                <div className="flex items-center gap-2 w-full max-w-[220px]">
                  <Input
                    value={tempStatus}
                    onChange={(e) => setTempStatus(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveStatus()}
                    className="text-center text-sm h-8 rounded-xl"
                    autoFocus
                    maxLength={60}
                  />
                  <Button size="icon" variant="secondary" className="h-8 w-8 rounded-xl flex-shrink-0" onClick={saveStatus}>
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => { setTempStatus(statusText); setEditingStatus(true); }}
                  className="flex items-center gap-1.5 group"
                >
                  <span className="text-sm text-muted-foreground">{statusText}</span>
                  <Edit2 className="h-3 w-3 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
                </button>
              )}
            </div>
          </motion.div>

          {/* Settings sections */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-3"
          >
            <SettingsSection title="Account" items={[
              { icon: User, label: "Account info", sub: displayName },
              { icon: Lock, label: "Privacy", sub: "Control who sees your info" },
              { icon: Bell, label: "Notifications", sub: "Messages, status, calls" },
            ]} />

            <SettingsSection title="Chats" items={[
              { icon: MessageCircle, label: "Chat settings", sub: "Themes, wallpaper, font size" },
            ]} />

            <SettingsSection title="About" items={[
              { icon: Info, label: "App info", sub: "Chivra v1.0" },
            ]} />
          </motion.div>

          {/* App version */}
          <p className="text-center text-xs text-muted-foreground/40 pt-2">
            Chivra — Your AI Social World
          </p>
        </div>
      </div>
    </Layout>
  );
}

function SettingsSection({ title, items }: {
  title: string;
  items: { icon: any; label: string; sub: string }[];
}) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1 mb-1.5">{title}</p>
      <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border/50">
        {items.map(({ icon: Icon, label, sub }) => (
          <button
            key={label}
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 active:bg-muted/50 transition-colors text-left"
          >
            <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-muted-foreground truncate">{sub}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}
