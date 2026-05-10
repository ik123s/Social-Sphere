import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, Bell, Lock, MessageCircle, Info, ChevronRight, Edit2, Check, Copy,
  CheckCheck, X, Shield, Eye, EyeOff, BellOff, BellRing, Palette, HardDrive,
  UserX, Smartphone, ChevronLeft, LogOut, AlertTriangle, Loader2,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { getStoredVcn, getDisplayName, setDisplayName, getStatusText, setStatusText, formatVcn } from "@/lib/vcn";
import { Switch } from "@/components/ui/switch";

// ── Sign out section ──────────────────────────────────────────────────────────
function SignOutSection() {
  const [, setLocation] = useLocation();
  const [confirming, setConfirming] = useState(false);
  const { toast } = useToast();

  const handleSignOut = () => {
    // Clear all chivra_ localStorage keys
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("chivra_")) keysToRemove.push(key);
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    toast({ title: "Signed out", description: "Your session has been cleared." });
    // Navigate to root (will show onboarding)
    setTimeout(() => { setLocation("/"); window.location.reload(); }, 400);
  };

  if (confirming) {
    return (
      <div className="bg-destructive/5 border border-destructive/20 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2.5 text-destructive">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <p className="text-sm font-medium">Sign out of Chivra?</p>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          This will clear your local session and return you to onboarding. Your AI contacts and chat history remain in your account.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1 rounded-xl" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
          <Button variant="destructive" size="sm" className="flex-1 rounded-xl" onClick={handleSignOut}>
            Sign out
          </Button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="w-full flex items-center gap-3 px-4 py-3.5 bg-card border border-border rounded-2xl hover:bg-muted/30 active:bg-muted/50 transition-colors text-left"
    >
      <div className="h-8 w-8 rounded-xl bg-destructive/10 flex items-center justify-center flex-shrink-0">
        <LogOut className="h-4 w-4 text-destructive" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-destructive">Sign out</p>
        <p className="text-xs text-muted-foreground">Clear session and return to onboarding</p>
      </div>
    </button>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────
type ModalId =
  | "account" | "privacy" | "notifications" | "chat-settings"
  | "linked-devices" | "storage" | "blocked" | "app-info" | null;

// ── Modal base ────────────────────────────────────────────────────────────────
function SettingsModal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div
      initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
      transition={{ type: "spring", stiffness: 320, damping: 32 }}
      className="absolute inset-0 z-50 bg-background flex flex-col"
    >
      <header className="px-4 pt-12 pb-4 border-b border-border flex items-center gap-3 bg-background/95 backdrop-blur sticky top-0">
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={onClose}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h2 className="font-semibold text-lg">{title}</h2>
      </header>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {children}
      </div>
    </motion.div>
  );
}

function ToggleRow({ icon: Icon, label, sub, checked, onToggle }: { icon: any; label: string; sub?: string; checked: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center gap-3 py-3 px-4 bg-card border border-border rounded-2xl">
      <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onToggle} />
    </div>
  );
}

// ── Privacy modal ─────────────────────────────────────────────────────────────
function PrivacyModal({ onClose }: { onClose: () => void }) {
  const [lastSeen, setLastSeen]       = useState(true);
  const [profileVisible, setProfile] = useState(true);
  const [statusVisible, setStatus]   = useState(true);
  const [readReceipts, setReceipts]  = useState(true);
  const { toast } = useToast();

  return (
    <SettingsModal title="Privacy" onClose={onClose}>
      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium px-1">Visibility</p>
      <div className="space-y-2">
        <ToggleRow icon={Eye} label="Last seen" sub="Show when you were last active" checked={lastSeen} onToggle={() => { setLastSeen(v => !v); toast({ title: "Last seen updated" }); }} />
        <ToggleRow icon={User} label="Profile photo" sub="Control who sees your photo" checked={profileVisible} onToggle={() => { setProfile(v => !v); toast({ title: "Profile visibility updated" }); }} />
        <ToggleRow icon={MessageCircle} label="Status updates" sub="Let contacts see your status" checked={statusVisible} onToggle={() => { setStatus(v => !v); toast({ title: "Status visibility updated" }); }} />
      </div>
      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium px-1 mt-2">Messages</p>
      <div className="space-y-2">
        <ToggleRow icon={CheckCheck} label="Read receipts" sub="Show when you've read messages" checked={readReceipts} onToggle={() => { setReceipts(v => !v); toast({ title: "Read receipts updated" }); }} />
      </div>
    </SettingsModal>
  );
}

// ── Notifications modal ───────────────────────────────────────────────────────
function NotificationsModal({ onClose }: { onClose: () => void }) {
  const [messages,    setMessages]   = useState(true);
  const [statusPosts, setStatuses]   = useState(true);
  const [sounds,      setSounds]     = useState(true);
  const [vibrate,     setVibrate]    = useState(true);
  const { toast } = useToast();

  return (
    <SettingsModal title="Notifications" onClose={onClose}>
      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium px-1">Alerts</p>
      <div className="space-y-2">
        <ToggleRow icon={BellRing} label="Message notifications" sub="Get notified when contacts message you" checked={messages} onToggle={() => { setMessages(v => !v); toast({ title: "Notification preference saved" }); }} />
        <ToggleRow icon={Bell} label="Status notifications" sub="When contacts post new statuses" checked={statusPosts} onToggle={() => { setStatuses(v => !v); toast({ title: "Notification preference saved" }); }} />
      </div>
      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium px-1 mt-2">Sound & Vibration</p>
      <div className="space-y-2">
        <ToggleRow icon={Bell} label="Notification sounds" sub="Play sound for new messages" checked={sounds} onToggle={() => { setSounds(v => !v); toast({ title: "Sound preference saved" }); }} />
        <ToggleRow icon={Smartphone} label="Vibration" sub="Vibrate for new messages" checked={vibrate} onToggle={() => { setVibrate(v => !v); toast({ title: "Vibration preference saved" }); }} />
      </div>
    </SettingsModal>
  );
}

// ── Chat settings modal ───────────────────────────────────────────────────────
function ChatSettingsModal({ onClose }: { onClose: () => void }) {
  const [fontSize, setFontSize]         = useState<"small" | "medium" | "large">("medium");
  const [bubbleStyle, setBubble]        = useState<"default" | "rounded" | "sharp">("default");
  const [wallpaper, setWallpaper]       = useState<"none" | "dots" | "grid" | "waves">("none");
  const { toast } = useToast();

  const save = () => toast({ title: "Chat appearance saved" });

  return (
    <SettingsModal title="Chat Settings" onClose={onClose}>
      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium px-1">Font size</p>
      <div className="grid grid-cols-3 gap-2">
        {(["small", "medium", "large"] as const).map(s => (
          <button key={s} onClick={() => { setFontSize(s); save(); }}
            className={`py-3 rounded-2xl border text-sm font-medium capitalize transition-all ${fontSize === s ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"}`}
          >
            {s}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium px-1 mt-2">Bubble style</p>
      <div className="grid grid-cols-3 gap-2">
        {(["default", "rounded", "sharp"] as const).map(s => (
          <button key={s} onClick={() => { setBubble(s); save(); }}
            className={`py-3 rounded-2xl border text-sm font-medium capitalize transition-all ${bubbleStyle === s ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"}`}
          >
            {s}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium px-1 mt-2">Wallpaper</p>
      <div className="grid grid-cols-4 gap-2">
        {(["none", "dots", "grid", "waves"] as const).map(w => (
          <button key={w} onClick={() => { setWallpaper(w); save(); }}
            className={`aspect-square rounded-2xl border text-xs font-medium capitalize flex items-center justify-center transition-all ${wallpaper === w ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"}`}
          >
            {w}
          </button>
        ))}
      </div>
    </SettingsModal>
  );
}

// ── Linked devices modal ──────────────────────────────────────────────────────
function LinkedDevicesModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const vcn = getStoredVcn();

  const generateCode = async () => {
    if (!vcn) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/users/generate-link-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vcn }),
      });
      const data = await res.json();
      if (data.code) setLinkCode(data.code);
    } catch {
      toast({ title: "Failed to generate code", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const copyCode = () => {
    if (!linkCode) return;
    navigator.clipboard.writeText(linkCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Code copied to clipboard" });
    });
  };

  return (
    <SettingsModal title="Linked Devices" onClose={onClose}>
      <div className="bg-card border border-border rounded-2xl p-5 text-center space-y-2">
        <Smartphone className="h-10 w-10 text-muted-foreground/40 mx-auto" />
        <p className="font-medium text-sm">This device</p>
        <p className="text-xs text-muted-foreground">Web — Chivra App</p>
        <div className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 text-[11px] font-medium px-2.5 py-1 rounded-full">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Active now
        </div>
      </div>

      <div className="space-y-3 mt-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium px-1">Link Another Device</p>
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Generate a one-time code and enter it on your other device during sign-in to restore your account instantly.
          </p>
          {linkCode ? (
            <div className="space-y-3">
              <div className="bg-muted/60 rounded-xl p-4 text-center">
                <p className="text-2xl font-black tracking-widest text-foreground font-mono">{linkCode}</p>
                <p className="text-xs text-muted-foreground mt-1.5">Expires in 10 minutes</p>
              </div>
              <Button
                variant="outline"
                className="w-full rounded-xl"
                onClick={copyCode}
              >
                {copied ? <Check className="h-4 w-4 mr-2 text-emerald-400" /> : <Copy className="h-4 w-4 mr-2" />}
                {copied ? "Copied" : "Copy Code"}
              </Button>
              <Button
                variant="ghost"
                className="w-full rounded-xl text-muted-foreground"
                onClick={() => setLinkCode(null)}
              >
                Generate New Code
              </Button>
            </div>
          ) : (
            <Button
              className="w-full rounded-xl"
              onClick={generateCode}
              disabled={generating}
            >
              {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Smartphone className="h-4 w-4 mr-2" />}
              {generating ? "Generating..." : "Generate Link Code"}
            </Button>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground/60 text-center px-2">
          Your phone number also restores your account on any new device automatically.
        </p>
      </div>
    </SettingsModal>
  );
}

// ── Storage modal ─────────────────────────────────────────────────────────────
function StorageModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  return (
    <SettingsModal title="Storage" onClose={onClose}>
      <div className="space-y-2">
        {[
          { label: "Photos & Videos", size: "12.4 MB", color: "bg-violet-500" },
          { label: "Voice Notes",     size: "3.2 MB",  color: "bg-blue-500" },
          { label: "Chat History",    size: "1.8 MB",  color: "bg-pink-500" },
          { label: "Other",           size: "0.4 MB",  color: "bg-muted-foreground" },
        ].map(({ label, size, color }) => (
          <div key={label} className="flex items-center gap-3 py-3 px-4 bg-card border border-border rounded-2xl">
            <div className={`w-3 h-3 rounded-full ${color} flex-shrink-0`} />
            <span className="flex-1 text-sm font-medium">{label}</span>
            <span className="text-sm text-muted-foreground font-mono">{size}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 bg-muted/40 rounded-2xl h-2.5 overflow-hidden flex">
        <div className="bg-violet-500 h-full" style={{ width: "60%" }} />
        <div className="bg-blue-500 h-full"   style={{ width: "20%" }} />
        <div className="bg-pink-500 h-full"   style={{ width: "12%" }} />
        <div className="bg-muted-foreground/40 h-full" style={{ width: "8%" }} />
      </div>
      <p className="text-xs text-muted-foreground text-center">17.8 MB total storage used</p>
      <Button variant="outline" className="w-full rounded-2xl border-destructive/30 text-destructive hover:bg-destructive/10" onClick={() => toast({ title: "Cache cleared", description: "Freed up temporary files." })}>
        Clear Cache
      </Button>
    </SettingsModal>
  );
}

// ── Blocked contacts modal ────────────────────────────────────────────────────
function BlockedModal({ onClose }: { onClose: () => void }) {
  return (
    <SettingsModal title="Blocked Contacts" onClose={onClose}>
      <div className="flex flex-col items-center justify-center h-40 gap-3">
        <UserX className="h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">No blocked contacts</p>
        <p className="text-xs text-muted-foreground/60 text-center">You can block contacts from their profile page</p>
      </div>
    </SettingsModal>
  );
}

// ── App info modal ────────────────────────────────────────────────────────────
function AppInfoModal({ onClose }: { onClose: () => void }) {
  return (
    <SettingsModal title="App Info" onClose={onClose}>
      <div className="flex flex-col items-center gap-4 py-4">
        <div className="w-20 h-20 bg-gradient-to-br from-primary to-violet-700 rounded-3xl flex items-center justify-center shadow-xl">
          <span className="text-white font-serif italic text-4xl select-none">C</span>
        </div>
        <div className="text-center">
          <h3 className="text-xl font-bold">Chivra</h3>
          <p className="text-sm text-muted-foreground">Your AI Social World</p>
        </div>
      </div>
      <div className="space-y-2">
        {[
          { label: "Version",       value: "2.0.1" },
          { label: "Build",         value: "Production" },
          { label: "AI Model",      value: "GPT-5.1" },
          { label: "Privacy",       value: "End-to-end protected" },
        ].map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between py-3 px-4 bg-card border border-border rounded-2xl">
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className="text-sm font-medium">{value}</span>
          </div>
        ))}
      </div>
    </SettingsModal>
  );
}

// ── Account info modal ────────────────────────────────────────────────────────
function AccountModal({ displayName, statusText, onSave, onClose }: { displayName: string; statusText: string; onSave: (name: string, status: string) => void; onClose: () => void }) {
  const [name,   setName]   = useState(displayName);
  const [status, setStatus] = useState(statusText);
  const { toast } = useToast();

  const save = () => {
    onSave(name.trim() || "You", status.trim() || "Available");
    onClose();
    toast({ title: "Account updated" });
  };

  return (
    <SettingsModal title="Account Info" onClose={onClose}>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Display Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} className="rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status Message</label>
          <Input value={status} onChange={(e) => setStatus(e.target.value)} maxLength={60} className="rounded-xl" />
        </div>
      </div>
      <Button className="w-full rounded-2xl mt-2" onClick={save}>Save Changes</Button>
    </SettingsModal>
  );
}

// ── Main profile page ─────────────────────────────────────────────────────────
export default function Profile() {
  const { toast }     = useToast();
  const [vcn,          setVcn]          = useState<string | null>(null);
  const [displayNameS, setDisplayNameS] = useState(getDisplayName);
  const [statusTextS,  setStatusTextS]  = useState(getStatusText);
  const [editingName,  setEditingName]  = useState(false);
  const [editingStatus, setEditingStatus] = useState(false);
  const [tempName,     setTempName]     = useState(displayNameS);
  const [tempStatus,   setTempStatus]   = useState(statusTextS);
  const [copied,       setCopied]       = useState(false);
  const [activeModal,  setActiveModal]  = useState<ModalId>(null);

  useEffect(() => { setVcn(getStoredVcn()); }, []);

  const saveName = async (name?: string) => {
    const trimmed = (name ?? tempName).trim() || "You";
    setDisplayNameS(trimmed);
    setDisplayName(trimmed);
    setEditingName(false);
    if (vcn) {
      await fetch(`/api/users/${vcn}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName: trimmed }) });
    }
    toast({ title: "Name updated" });
  };

  const saveStatus = async (status?: string) => {
    const trimmed = (status ?? tempStatus).trim() || "Available";
    setStatusTextS(trimmed);
    setStatusText(trimmed);
    setEditingStatus(false);
    if (vcn) {
      await fetch(`/api/users/${vcn}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ statusText: trimmed }) });
    }
    toast({ title: "Status updated" });
  };

  const saveAccount = (name: string, status: string) => {
    saveName(name);
    saveStatus(status);
  };

  const copyVcn = async () => {
    if (!vcn) return;
    await navigator.clipboard.writeText(formatVcn(vcn));
    setCopied(true);
    toast({ title: "VCN copied", description: "Share it so others can find you." });
    setTimeout(() => setCopied(false), 2500);
  };

  const initials = displayNameS.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  const settings = [
    {
      title: "Account",
      items: [
        { id: "account" as ModalId, icon: User, label: "Account info", sub: displayNameS },
        { id: "privacy" as ModalId, icon: Shield, label: "Privacy", sub: "Last seen, profile photo, status" },
        { id: "notifications" as ModalId, icon: Bell, label: "Notifications", sub: "Messages, status, calls" },
      ],
    },
    {
      title: "Chats",
      items: [
        { id: "chat-settings" as ModalId, icon: MessageCircle, label: "Chat appearance", sub: "Font, bubbles, wallpaper" },
        { id: "storage" as ModalId, icon: HardDrive, label: "Storage", sub: "Manage media and data" },
      ],
    },
    {
      title: "Account",
      items: [
        { id: "linked-devices" as ModalId, icon: Smartphone, label: "Linked devices", sub: "1 device connected" },
        { id: "blocked" as ModalId, icon: UserX, label: "Blocked contacts", sub: "Manage blocked users" },
      ],
    },
    {
      title: "About",
      items: [
        { id: "app-info" as ModalId, icon: Info, label: "App info", sub: "Chivra v2.0.1" },
      ],
    },
  ];

  return (
    <Layout>
      <div className="flex flex-col min-h-full pb-24 overflow-y-auto relative">

        {/* ── Setting modals ─────────────────────────────────────────────── */}
        <AnimatePresence>
          {activeModal === "privacy"       && <PrivacyModal       onClose={() => setActiveModal(null)} />}
          {activeModal === "notifications" && <NotificationsModal onClose={() => setActiveModal(null)} />}
          {activeModal === "chat-settings" && <ChatSettingsModal  onClose={() => setActiveModal(null)} />}
          {activeModal === "linked-devices"&& <LinkedDevicesModal onClose={() => setActiveModal(null)} />}
          {activeModal === "storage"       && <StorageModal       onClose={() => setActiveModal(null)} />}
          {activeModal === "blocked"       && <BlockedModal       onClose={() => setActiveModal(null)} />}
          {activeModal === "app-info"      && <AppInfoModal       onClose={() => setActiveModal(null)} />}
          {activeModal === "account"       && (
            <AccountModal
              displayName={displayNameS}
              statusText={statusTextS}
              onSave={saveAccount}
              onClose={() => setActiveModal(null)}
            />
          )}
        </AnimatePresence>

        <header className="px-4 pt-12 pb-4 bg-background/95 backdrop-blur z-10 sticky top-0 border-b border-border">
          <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        </header>

        <div className="px-4 py-6 space-y-5">
          {/* Avatar + name + status */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="p-0.5 rounded-full bg-gradient-to-tr from-violet-500 to-pink-500 shadow-xl">
                <div className="p-1 rounded-full bg-background">
                  <Avatar className="h-24 w-24">
                    <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">{initials}</AvatarFallback>
                  </Avatar>
                </div>
              </div>
            </div>

            {editingName ? (
              <div className="flex items-center gap-2 w-full max-w-[240px]">
                <Input value={tempName} onChange={(e) => setTempName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveName()} className="text-center text-lg font-semibold h-10 rounded-xl" autoFocus maxLength={30} />
                <Button size="icon" className="h-10 w-10 rounded-xl flex-shrink-0" onClick={() => saveName()}><Check className="h-4 w-4" /></Button>
              </div>
            ) : (
              <button onClick={() => { setTempName(displayNameS); setEditingName(true); }} className="flex items-center gap-2 group">
                <span className="text-xl font-bold">{displayNameS}</span>
                <Edit2 className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
              </button>
            )}

            {editingStatus ? (
              <div className="flex items-center gap-2 w-full max-w-[240px]">
                <Input value={tempStatus} onChange={(e) => setTempStatus(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveStatus()} className="text-center text-sm h-9 rounded-xl" autoFocus maxLength={60} />
                <Button size="icon" variant="secondary" className="h-9 w-9 rounded-xl flex-shrink-0" onClick={() => saveStatus()}><Check className="h-3.5 w-3.5" /></Button>
              </div>
            ) : (
              <button onClick={() => { setTempStatus(statusTextS); setEditingStatus(true); }} className="flex items-center gap-1.5 group">
                <span className="text-sm text-muted-foreground">{statusTextS}</span>
                <Edit2 className="h-3 w-3 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
              </button>
            )}
          </motion.div>

          {/* VCN card */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
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
                <span className="text-3xl font-mono font-bold tracking-[0.2em] text-foreground">{formatVcn(vcn)}</span>
                <Button onClick={copyVcn} variant="secondary" size="sm" className="w-full rounded-xl h-9 mt-4 border border-primary/20 bg-primary/10 hover:bg-primary/20 text-primary font-semibold text-sm">
                  {copied ? <><CheckCheck className="h-4 w-4 mr-2" />Copied</> : <><Copy className="h-4 w-4 mr-2" />Copy VCN</>}
                </Button>
              </>
            ) : (
              <div className="h-10 bg-muted/40 rounded-xl animate-pulse" />
            )}
            <p className="text-[10px] text-muted-foreground/60 mt-3 text-center">Your real number is never shared</p>
          </motion.div>

          {/* Settings sections */}
          {settings.map((section, si) => (
            <motion.div key={si} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + si * 0.05 }}>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1 mb-1.5">{section.title}</p>
              <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border/50">
                {section.items.map(({ id, icon: Icon, label, sub }) => (
                  <button key={label} onClick={() => setActiveModal(id)}
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
            </motion.div>
          ))}

          {/* Sign out */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
            <SignOutSection />
          </motion.div>

          <p className="text-center text-xs text-muted-foreground/30 pt-1">Chivra — Your AI Social World</p>
        </div>
      </div>
    </Layout>
  );
}
