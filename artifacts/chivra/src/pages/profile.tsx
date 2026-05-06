import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { User, Bell, Lock, MessageCircle, Info, ChevronRight, Edit2, Check, Copy, CheckCheck } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { getStoredVcn, getDisplayName, setDisplayName, getStatusText, setStatusText, formatVcn } from "@/lib/vcn";

export default function Profile() {
  const { toast } = useToast();
  const [vcn, setVcn] = useState<string | null>(null);
  const [displayName, setDisplayNameState] = useState(getDisplayName);
  const [statusText, setStatusTextState] = useState(getStatusText);
  const [editingName, setEditingName] = useState(false);
  const [editingStatus, setEditingStatus] = useState(false);
  const [tempName, setTempName] = useState(displayName);
  const [tempStatus, setTempStatus] = useState(statusText);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setVcn(getStoredVcn());
  }, []);

  const saveName = async () => {
    const trimmed = tempName.trim() || "You";
    setDisplayNameState(trimmed);
    setDisplayName(trimmed);
    setEditingName(false);
    if (vcn) {
      await fetch(`/api/users/${vcn}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: trimmed }),
      });
    }
    toast({ title: "Name updated" });
  };

  const saveStatus = async () => {
    const trimmed = tempStatus.trim() || "Available";
    setStatusTextState(trimmed);
    setStatusText(trimmed);
    setEditingStatus(false);
    if (vcn) {
      await fetch(`/api/users/${vcn}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statusText: trimmed }),
      });
    }
    toast({ title: "Status updated" });
  };

  const copyVcn = async () => {
    if (!vcn) return;
    await navigator.clipboard.writeText(formatVcn(vcn));
    setCopied(true);
    toast({ title: "VCN copied", description: "Share it so others can find you." });
    setTimeout(() => setCopied(false), 2500);
  };

  const initials = displayName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <Layout>
      <div className="flex flex-col min-h-full pb-24 overflow-y-auto">
        <header className="px-4 pt-12 pb-4 bg-background/95 backdrop-blur z-10 sticky top-0 border-b border-border">
          <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        </header>

        <div className="px-4 py-6 space-y-5">
          {/* Avatar + name */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-3"
          >
            <div className="p-0.5 rounded-full bg-gradient-to-tr from-violet-500 to-pink-500 shadow-xl">
              <div className="p-1 rounded-full bg-background">
                <Avatar className="h-24 w-24">
                  <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </div>
            </div>

            {editingName ? (
              <div className="flex items-center gap-2 w-full max-w-[240px]">
                <Input
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveName()}
                  className="text-center text-lg font-semibold h-10 rounded-xl"
                  autoFocus
                  maxLength={30}
                />
                <Button size="icon" className="h-10 w-10 rounded-xl flex-shrink-0" onClick={saveName}>
                  <Check className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <button onClick={() => { setTempName(displayName); setEditingName(true); }} className="flex items-center gap-2 group">
                <span className="text-xl font-bold">{displayName}</span>
                <Edit2 className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
              </button>
            )}

            {editingStatus ? (
              <div className="flex items-center gap-2 w-full max-w-[240px]">
                <Input
                  value={tempStatus}
                  onChange={(e) => setTempStatus(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveStatus()}
                  className="text-center text-sm h-9 rounded-xl"
                  autoFocus
                  maxLength={60}
                />
                <Button size="icon" variant="secondary" className="h-9 w-9 rounded-xl flex-shrink-0" onClick={saveStatus}>
                  <Check className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <button onClick={() => { setTempStatus(statusText); setEditingStatus(true); }} className="flex items-center gap-1.5 group">
                <span className="text-sm text-muted-foreground">{statusText}</span>
                <Edit2 className="h-3 w-3 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
              </button>
            )}
          </motion.div>

          {/* VCN Card — the main feature */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-primary/20 via-violet-900/20 to-pink-900/10 border border-primary/30 rounded-3xl p-5 shadow-lg"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-0.5">Your Chat Number</p>
                <p className="text-[11px] text-muted-foreground">Share this so others can find you</p>
              </div>
              <div className="h-8 w-8 rounded-xl bg-primary/15 flex items-center justify-center">
                <span className="text-primary text-xs font-bold">#</span>
              </div>
            </div>

            {vcn ? (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl font-mono font-bold tracking-[0.2em] text-foreground">
                    {formatVcn(vcn)}
                  </span>
                </div>
                <Button
                  onClick={copyVcn}
                  variant="secondary"
                  size="sm"
                  className="w-full rounded-xl h-9 border border-primary/20 bg-primary/10 hover:bg-primary/20 text-primary font-semibold text-sm transition-all"
                >
                  {copied ? (
                    <><CheckCheck className="h-4 w-4 mr-2" />Copied</>
                  ) : (
                    <><Copy className="h-4 w-4 mr-2" />Copy VCN</>
                  )}
                </Button>
              </>
            ) : (
              <div className="h-10 bg-muted/40 rounded-xl animate-pulse" />
            )}

            <p className="text-[10px] text-muted-foreground/60 mt-3 text-center">
              Your real number is never shared. Only your VCN is visible.
            </p>
          </motion.div>

          {/* Settings */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
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

          <p className="text-center text-xs text-muted-foreground/30 pt-1">Chivra — Your AI Social World</p>
        </div>
      </div>
    </Layout>
  );
}

function SettingsSection({ title, items }: { title: string; items: { icon: any; label: string; sub: string }[] }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1 mb-1.5">{title}</p>
      <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border/50">
        {items.map(({ icon: Icon, label, sub }) => (
          <button key={label} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 active:bg-muted/50 transition-colors text-left">
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
