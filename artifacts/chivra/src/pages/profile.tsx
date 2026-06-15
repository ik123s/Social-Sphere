import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, Bell, Lock, MessageCircle, Info, ChevronRight, Edit2, Check, Copy,
  CheckCheck, X, Shield, Eye, BellOff, BellRing, Palette, HardDrive,
  UserX, Smartphone, ChevronLeft, LogOut, AlertTriangle, Loader2, Camera,
  Type, Image as ImageIcon, Bot, Activity, HelpCircle, KeyRound, Globe,
  Star, Zap,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { getStoredVcn, getDisplayName, setDisplayName, getStatusText, setStatusText, formatVcn } from "@/lib/vcn";
import { Switch } from "@/components/ui/switch";
import { saveFontSize, getSavedFontSize, type FontSizeOption } from "@/lib/font-size";

// ── Sign out ─────────────────────────────────────────────────────────────────
function SignOutSection() {
  const [, setLocation] = useLocation();
  const [confirming, setConfirming] = useState(false);
  const { toast } = useToast();

  const handleSignOut = () => {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("chivra_")) keysToRemove.push(key);
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    toast({ title: "Signed out" });
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
          This clears your local session. Your AI contacts and chat history remain in your account.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1 rounded-xl" onClick={() => setConfirming(false)}>Cancel</Button>
          <Button variant="destructive" size="sm" className="flex-1 rounded-xl" onClick={handleSignOut}>Sign out</Button>
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

// ── Modal type ────────────────────────────────────────────────────────────────
type ModalId =
  | "account" | "privacy" | "notifications" | "chat-appearance"
  | "font-size" | "wallpaper" | "linked-devices" | "storage"
  | "ai-settings" | "status-settings" | "security" | "help" | "about" | "blocked"
  | null;

// ── Shared helpers ─────────────────────────────────────────────────────────────
function ToggleRow({ icon: Icon, label, sub, checked, onToggle }: {
  icon: any; label: string; sub?: string; checked: boolean; onToggle: () => void;
}) {
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3 px-4 bg-card border border-border rounded-2xl">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

// ── SettingsModal — pushes browser history state so Android back closes it ────
function SettingsModal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  const closedRef = useRef(false);

  const closeModal = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    onClose();
  }, [onClose]);

  useEffect(() => {
    window.history.pushState({ chivraModal: true }, "");
    const handlePop = () => closeModal();
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, [closeModal]);

  const handleBackButton = () => {
    if (closedRef.current) return;
    closedRef.current = true;
    window.history.back();
    onClose();
  };

  return (
    <motion.div
      initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
      transition={{ type: "spring", stiffness: 320, damping: 32 }}
      className="absolute inset-0 z-50 bg-background flex flex-col"
    >
      <header className="flex-shrink-0 px-4 pt-12 pb-4 border-b border-border flex items-center gap-3 bg-background/95 backdrop-blur">
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={handleBackButton}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h2 className="font-semibold text-lg">{title}</h2>
      </header>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-8">
        {children}
      </div>
    </motion.div>
  );
}

// ── PRIVACY ─────────────────────────────────────────────────────────────────
function PrivacyModal({ onClose }: { onClose: () => void }) {
  const [lastSeen, setLastSeen]     = useState(true);
  const [profile,  setProfile]      = useState(true);
  const [status,   setStatus]       = useState(true);
  const [receipts, setReceipts]     = useState(true);
  const [groups,   setGroups]       = useState(true);
  const { toast } = useToast();
  const save = (label: string) => toast({ title: `${label} updated` });

  return (
    <SettingsModal title="Privacy" onClose={onClose}>
      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium px-1">Who can see</p>
      <div className="space-y-2">
        <ToggleRow icon={Eye} label="Last seen" sub="Show when you were last active" checked={lastSeen} onToggle={() => { setLastSeen(v => !v); save("Last seen"); }} />
        <ToggleRow icon={User} label="Profile photo" sub="Control who sees your photo" checked={profile} onToggle={() => { setProfile(v => !v); save("Profile photo"); }} />
        <ToggleRow icon={Activity} label="Status updates" sub="Let contacts see your status" checked={status} onToggle={() => { setStatus(v => !v); save("Status visibility"); }} />
        <ToggleRow icon={Globe} label="Groups" sub="Allow contacts to add you to groups" checked={groups} onToggle={() => { setGroups(v => !v); save("Groups"); }} />
      </div>
      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium px-1 mt-2">Messages</p>
      <div className="space-y-2">
        <ToggleRow icon={CheckCheck} label="Read receipts" sub="Show when you've read messages" checked={receipts} onToggle={() => { setReceipts(v => !v); save("Read receipts"); }} />
      </div>
    </SettingsModal>
  );
}

// ── NOTIFICATIONS ────────────────────────────────────────────────────────────
function NotificationsModal({ onClose }: { onClose: () => void }) {
  const [msgs,    setMsgs]    = useState(true);
  const [spaces,  setSpaces]  = useState(true);
  const [sounds,  setSounds]  = useState(true);
  const [vibrate, setVibrate] = useState(true);
  const [preview, setPreview] = useState(true);
  const { toast } = useToast();
  const save = () => toast({ title: "Preference saved" });

  return (
    <SettingsModal title="Notifications" onClose={onClose}>
      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium px-1">Alerts</p>
      <div className="space-y-2">
        <ToggleRow icon={BellRing} label="Messages" sub="Get notified when contacts message you" checked={msgs} onToggle={() => { setMsgs(v => !v); save(); }} />
        <ToggleRow icon={Activity} label="Status updates" sub="When contacts post new statuses" checked={spaces} onToggle={() => { setSpaces(v => !v); save(); }} />
        <ToggleRow icon={Bell} label="Show preview" sub="Show message content in notifications" checked={preview} onToggle={() => { setPreview(v => !v); save(); }} />
      </div>
      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium px-1 mt-2">Sound & Vibration</p>
      <div className="space-y-2">
        <ToggleRow icon={Bell} label="Notification sounds" sub="Play sound for new messages" checked={sounds} onToggle={() => { setSounds(v => !v); save(); }} />
        <ToggleRow icon={Smartphone} label="Vibration" sub="Vibrate for new messages" checked={vibrate} onToggle={() => { setVibrate(v => !v); save(); }} />
      </div>
    </SettingsModal>
  );
}

// ── CHAT APPEARANCE ──────────────────────────────────────────────────────────
function ChatAppearanceModal({ onClose }: { onClose: () => void }) {
  const [bubble, setBubble] = useState<"default" | "rounded" | "sharp">("default");
  const { toast } = useToast();
  const save = () => toast({ title: "Chat appearance saved" });

  return (
    <SettingsModal title="Chat Appearance" onClose={onClose}>
      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium px-1">Bubble style</p>
      <div className="grid grid-cols-3 gap-2">
        {(["default", "rounded", "sharp"] as const).map(s => (
          <button key={s}
            onClick={() => { setBubble(s); save(); }}
            className={`py-4 rounded-2xl border text-sm font-medium capitalize transition-all ${bubble === s ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"}`}
          >
            {s}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium px-1 mt-2">Background</p>
      <div className="grid grid-cols-2 gap-2">
        {[
          { id: "none",    label: "Default dark",  cls: "bg-[#0a0014]" },
          { id: "violet",  label: "Violet haze",   cls: "bg-gradient-to-br from-[#0a0014] to-violet-950" },
          { id: "midnight",label: "Midnight blue",  cls: "bg-gradient-to-br from-slate-950 to-blue-950" },
          { id: "forest",  label: "Forest night",   cls: "bg-gradient-to-br from-[#071a0e] to-emerald-950" },
        ].map(w => (
          <button key={w.id}
            onClick={() => { localStorage.setItem("chivra_wallpaper", w.id); save(); }}
            className={`h-20 rounded-2xl border-2 overflow-hidden transition-all ${localStorage.getItem("chivra_wallpaper") === w.id || (w.id === "none" && !localStorage.getItem("chivra_wallpaper")) ? "border-primary shadow-md shadow-primary/20" : "border-border"} ${w.cls}`}
          >
            <div className="h-full w-full flex items-end p-2">
              <span className="text-[10px] text-white/70 font-medium">{w.label}</span>
            </div>
          </button>
        ))}
      </div>
    </SettingsModal>
  );
}

// ── FONT SIZE ────────────────────────────────────────────────────────────────
function FontSizeModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState<FontSizeOption>(getSavedFontSize);
  const { toast } = useToast();

  const select = (size: FontSizeOption) => {
    setCurrent(size);
    saveFontSize(size);
    toast({ title: "Font size updated", description: `Set to ${size}` });
  };

  const options: { id: FontSizeOption; label: string; desc: string; preview: string }[] = [
    { id: "small",   label: "Small",       desc: "Compact — fits more messages",      preview: "text-[12px]" },
    { id: "default", label: "Default",     desc: "Balanced — recommended",            preview: "text-[14px]" },
    { id: "large",   label: "Large",       desc: "Comfortable — easier to read",      preview: "text-[17px]" },
    { id: "xlarge",  label: "Extra Large", desc: "Maximum — for accessibility",       preview: "text-[20px]" },
  ];

  return (
    <SettingsModal title="Font Size" onClose={onClose}>
      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 space-y-2">
        <p className="text-xs text-muted-foreground">Preview — chat bubble</p>
        <div className="bg-primary rounded-2xl rounded-br-sm px-4 py-3 self-end w-fit max-w-[80%]">
          <p className={`text-primary-foreground font-medium ${options.find(o => o.id === current)?.preview ?? "text-sm"}`}>
            Hey! How are you doing today?
          </p>
        </div>
      </div>
      <div className="space-y-2">
        {options.map(opt => (
          <button
            key={opt.id}
            onClick={() => select(opt.id)}
            className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl border text-left transition-all ${current === opt.id ? "border-primary bg-primary/8" : "border-border bg-card"}`}
          >
            <div className={`flex-shrink-0 font-bold text-foreground ${opt.preview}`}>Aa</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-tight">{opt.label}</p>
              <p className="text-xs text-muted-foreground">{opt.desc}</p>
            </div>
            {current === opt.id && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
          </button>
        ))}
      </div>
    </SettingsModal>
  );
}

// ── WALLPAPER ────────────────────────────────────────────────────────────────
function WallpaperModal({ onClose }: { onClose: () => void }) {
  const [selected, setSelected] = useState(localStorage.getItem("chivra_wallpaper") ?? "none");
  const { toast } = useToast();

  const wallpapers = [
    { id: "none",     label: "Default Dark",    cls: "bg-[#0a0014]" },
    { id: "violet",   label: "Violet Haze",     cls: "bg-gradient-to-br from-[#0a0014] to-violet-950" },
    { id: "midnight", label: "Midnight Blue",   cls: "bg-gradient-to-br from-slate-950 to-blue-950" },
    { id: "forest",   label: "Forest Night",    cls: "bg-gradient-to-br from-[#071a0e] to-emerald-950" },
    { id: "aurora",   label: "Aurora",          cls: "bg-gradient-to-br from-purple-950 to-cyan-950" },
    { id: "ember",    label: "Ember",           cls: "bg-gradient-to-br from-[#1a0600] to-rose-950" },
    { id: "cosmos",   label: "Cosmos",          cls: "bg-gradient-to-tr from-indigo-950 via-purple-950 to-black" },
    { id: "minimal",  label: "Minimal",         cls: "bg-[#111111]" },
  ];

  const select = (id: string) => {
    setSelected(id);
    localStorage.setItem("chivra_wallpaper", id);
    toast({ title: "Wallpaper updated" });
  };

  return (
    <SettingsModal title="Wallpaper" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        {wallpapers.map(w => (
          <button
            key={w.id}
            onClick={() => select(w.id)}
            className={`relative h-32 rounded-2xl border-2 overflow-hidden transition-all ${selected === w.id ? "border-primary shadow-lg shadow-primary/25" : "border-border"} ${w.cls}`}
          >
            <div className="absolute inset-0 flex flex-col justify-between p-3">
              <div className="self-end">
                <div className="h-6 w-20 bg-primary/70 rounded-xl rounded-br-sm" />
              </div>
              <div>
                <div className="h-5 w-16 bg-white/10 rounded-xl rounded-bl-sm" />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1.5">
              <span className="text-[10px] text-white font-semibold">{w.label}</span>
            </div>
            {selected === w.id && (
              <div className="absolute top-2 right-2 h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                <Check className="h-3.5 w-3.5 text-white" />
              </div>
            )}
          </button>
        ))}
      </div>
    </SettingsModal>
  );
}

// ── AI SETTINGS ──────────────────────────────────────────────────────────────
function AiSettingsModal({ onClose }: { onClose: () => void }) {
  const [memory,      setMemory]      = useState(true);
  const [initiative,  setInitiative]  = useState(true);
  const [multiMsg,    setMultiMsg]    = useState(true);
  const [imgSend,     setImgSend]     = useState(true);
  const [pidgin,      setPidgin]      = useState(true);
  const [typing,      setTyping]      = useState(true);
  const { toast } = useToast();
  const save = (label: string) => toast({ title: `${label} updated` });

  return (
    <SettingsModal title="AI Settings" onClose={onClose}>
      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium px-1">Memory & Intelligence</p>
      <div className="space-y-2">
        <ToggleRow icon={Bot} label="AI Memory" sub="Contacts remember facts about you across chats" checked={memory} onToggle={() => { setMemory(v => !v); save("AI Memory"); }} />
        <ToggleRow icon={Zap} label="Proactive messages" sub="AI contacts message you first occasionally" checked={initiative} onToggle={() => { setInitiative(v => !v); save("Proactive messages"); }} />
      </div>
      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium px-1 mt-2">Behavior</p>
      <div className="space-y-2">
        <ToggleRow icon={MessageCircle} label="Split messages" sub="AI sends multi-part messages like a real person" checked={multiMsg} onToggle={() => { setMultiMsg(v => !v); save("Split messages"); }} />
        <ToggleRow icon={ImageIcon} label="AI image sending" sub="Contacts can send photos and memes to you" checked={imgSend} onToggle={() => { setImgSend(v => !v); save("AI image sending"); }} />
        <ToggleRow icon={Globe} label="Nigerian Pidgin" sub="AI can use Naija slang when appropriate" checked={pidgin} onToggle={() => { setPidgin(v => !v); save("Pidgin support"); }} />
        <ToggleRow icon={Type} label="Typing indicator" sub="Show thinking animation while AI composes" checked={typing} onToggle={() => { setTyping(v => !v); save("Typing indicator"); }} />
      </div>
      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4">
        <p className="text-xs text-muted-foreground">AI model: <span className="text-foreground font-semibold">GPT-5.1</span></p>
        <p className="text-xs text-muted-foreground mt-1">Memory: <span className="text-foreground font-semibold">GPT-5-nano</span></p>
        <p className="text-xs text-muted-foreground mt-1">Avatars: <span className="text-foreground font-semibold">gpt-image-1</span></p>
      </div>
    </SettingsModal>
  );
}

// ── STATUS SETTINGS ──────────────────────────────────────────────────────────
function StatusSettingsModal({ onClose }: { onClose: () => void }) {
  const [visible, setVisible]     = useState(true);
  const [reactions, setReactions] = useState(true);
  const [autoView, setAutoView]   = useState(false);
  const { toast } = useToast();
  const save = () => toast({ title: "Status setting saved" });

  return (
    <SettingsModal title="Status Settings" onClose={onClose}>
      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium px-1">Visibility</p>
      <div className="space-y-2">
        <ToggleRow icon={Eye} label="Show my status views" sub="Let contacts see who viewed your status" checked={visible} onToggle={() => { setVisible(v => !v); save(); }} />
        <ToggleRow icon={Star} label="Status reactions" sub="Allow contacts to react to your status" checked={reactions} onToggle={() => { setReactions(v => !v); save(); }} />
        <ToggleRow icon={Activity} label="Auto-view AI statuses" sub="Automatically mark AI statuses as seen" checked={autoView} onToggle={() => { setAutoView(v => !v); save(); }} />
      </div>
      <div className="space-y-2 mt-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium px-1">Info</p>
        <InfoRow label="Status posts expire" value="After 24 hours" />
        <InfoRow label="Post frequency (AI)" value="Every 2-8 hours" />
      </div>
    </SettingsModal>
  );
}

// ── SECURITY ─────────────────────────────────────────────────────────────────
function SecurityModal({ onClose }: { onClose: () => void }) {
  const [biometrics, setBiometrics] = useState(false);
  const [twoFactor,  setTwoFactor]  = useState(false);
  const [screenLock, setScreenLock] = useState(false);
  const { toast } = useToast();
  const save = (label: string) => toast({ title: `${label} updated` });

  return (
    <SettingsModal title="Security" onClose={onClose}>
      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium px-1">App Protection</p>
      <div className="space-y-2">
        <ToggleRow icon={KeyRound} label="Biometric lock" sub="Use fingerprint or face to unlock Chivra" checked={biometrics} onToggle={() => { setBiometrics(v => !v); save("Biometric lock"); }} />
        <ToggleRow icon={Smartphone} label="Screen lock" sub="Lock app when you switch away" checked={screenLock} onToggle={() => { setScreenLock(v => !v); save("Screen lock"); }} />
        <ToggleRow icon={Shield} label="Two-factor auth" sub="Extra protection for your account" checked={twoFactor} onToggle={() => { setTwoFactor(v => !v); save("Two-factor auth"); }} />
      </div>
      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium px-1 mt-2">Data</p>
      <div className="space-y-2">
        <InfoRow label="Encryption" value="End-to-end" />
        <InfoRow label="Data stored" value="Your device + cloud" />
        <InfoRow label="Account" value="VCN-protected" />
      </div>
    </SettingsModal>
  );
}

// ── HELP CENTER ───────────────────────────────────────────────────────────────
function HelpCenterModal({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState<number | null>(null);

  const faqs = [
    { q: "What is Chivra?", a: "Chivra is a social messaging app where every contact is an autonomous AI companion with a unique personality, memory, and social life. They think, feel, and message you like real people." },
    { q: "Do AI contacts remember me?", a: "Yes. After each conversation, Chivra extracts key facts and stores them as memories. Your AI contacts use these memories to personalise future chats." },
    { q: "Why is my AI contact offline?", a: "AI contacts follow realistic online/offline schedules based on their personality and time of day. They will come back online and may send you a message when they do." },
    { q: "How do I connect with real users?", a: "Go to Add Contact → VCN tab. Enter someone's VCN (their unique 7-character ID) to send them a connection request. They accept or decline." },
    { q: "Can AI contacts send me images?", a: "Yes! AI contacts can share generated photos, selfies, and memes. Tap and hold any image to save it." },
    { q: "How do I share a contact?", a: "AI contacts will naturally share other contacts' cards in conversation when it feels relevant. You can also find contacts by ID in Add Contact." },
    { q: "What is VCN?", a: "Your Virtual Chat Number is a unique 7-character ID like ABC-1234. Share it so real users can find and connect with you." },
    { q: "How do I recover my account?", a: "Log in with the same phone number you used originally. Or use a link code from Profile → Linked Devices on your old device." },
  ];

  return (
    <SettingsModal title="Help Center" onClose={onClose}>
      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium px-1">Frequently Asked Questions</p>
      <div className="space-y-2">
        {faqs.map((faq, i) => (
          <div key={i} className="bg-card border border-border rounded-2xl overflow-hidden">
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="w-full flex items-center justify-between px-4 py-3.5 text-left gap-2"
            >
              <span className="text-sm font-medium">{faq.q}</span>
              <ChevronRight className={`h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform ${open === i ? "rotate-90" : ""}`} />
            </button>
            <AnimatePresence>
              {open === i && (
                <motion.div
                  initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                  className="overflow-hidden"
                >
                  <p className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </SettingsModal>
  );
}

// ── ABOUT CHIVRA ──────────────────────────────────────────────────────────────
function AboutModal({ onClose }: { onClose: () => void }) {
  return (
    <SettingsModal title="About Chivra" onClose={onClose}>
      <div className="flex flex-col items-center gap-4 py-4">
        <div className="w-20 h-20 bg-gradient-to-br from-primary to-violet-700 rounded-3xl flex items-center justify-center shadow-xl">
          <span className="text-white font-serif italic text-4xl select-none">C</span>
        </div>
        <div className="text-center">
          <h3 className="text-xl font-bold">Chivra</h3>
          <p className="text-sm text-muted-foreground">Your AI Social World</p>
          <p className="text-xs text-primary font-semibold mt-1">Version 3.5.1</p>
        </div>
      </div>
      <div className="space-y-2">
        <InfoRow label="Version"     value="3.5.1" />
        <InfoRow label="Build"       value="Production" />
        <InfoRow label="AI Model"    value="GPT-5.1" />
        <InfoRow label="Privacy"     value="End-to-end protected" />
        <InfoRow label="Platform"    value="Web — Progressive App" />
      </div>
      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium px-1 mt-2">Changelog</p>
      <div className="space-y-2">
        {[
          { ver: "3.5.1", note: "Profile scrolling, font size, back navigation, AI generation stability" },
          { ver: "3.4.3", note: "AI vision, image sending, voice notes, emoji picker, image persistence" },
          { ver: "3.4.0", note: "Multi-message splitting, Nigerian Pidgin, sticker picker, image long-press" },
          { ver: "3.3.0", note: "Status feed, contact sharing, add by ID, avatar generation" },
          { ver: "3.2.0", note: "VCN system, human connections, presence scheduler, auto-spawn" },
        ].map(({ ver, note }) => (
          <div key={ver} className="bg-card border border-border rounded-2xl px-4 py-3 flex gap-3">
            <span className="text-xs font-mono text-primary font-bold flex-shrink-0 mt-0.5">v{ver}</span>
            <span className="text-xs text-muted-foreground leading-relaxed">{note}</span>
          </div>
        ))}
      </div>
    </SettingsModal>
  );
}

// ── LINKED DEVICES ───────────────────────────────────────────────────────────
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
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vcn }),
      });
      const data = await res.json();
      if (data.code) setLinkCode(data.code);
    } catch { toast({ title: "Failed to generate code", variant: "destructive" }); }
    finally { setGenerating(false); }
  };

  const copyCode = () => {
    if (!linkCode) return;
    navigator.clipboard.writeText(linkCode).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
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
            <Button variant="outline" className="w-full rounded-xl" onClick={copyCode}>
              {copied ? <><Check className="h-4 w-4 mr-2 text-emerald-400" />Copied</> : <><Copy className="h-4 w-4 mr-2" />Copy Code</>}
            </Button>
            <Button variant="ghost" className="w-full rounded-xl text-muted-foreground" onClick={() => setLinkCode(null)}>Generate New Code</Button>
          </div>
        ) : (
          <Button className="w-full rounded-xl" onClick={generateCode} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Smartphone className="h-4 w-4 mr-2" />}
            {generating ? "Generating..." : "Generate Link Code"}
          </Button>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground/60 text-center px-2">Your phone number also restores your account automatically.</p>
    </SettingsModal>
  );
}

// ── STORAGE ───────────────────────────────────────────────────────────────────
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
      <Button variant="outline"
        className="w-full rounded-2xl border-destructive/30 text-destructive hover:bg-destructive/10"
        onClick={() => toast({ title: "Cache cleared", description: "Freed up temporary files." })}
      >
        Clear Cache
      </Button>
    </SettingsModal>
  );
}

// ── BLOCKED ───────────────────────────────────────────────────────────────────
function BlockedModal({ onClose }: { onClose: () => void }) {
  return (
    <SettingsModal title="Blocked Contacts" onClose={onClose}>
      <div className="flex flex-col items-center justify-center h-40 gap-3">
        <UserX className="h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">No blocked contacts</p>
        <p className="text-xs text-muted-foreground/60 text-center">Block contacts from their profile page</p>
      </div>
    </SettingsModal>
  );
}

// ── ACCOUNT INFO ───────────────────────────────────────────────────────────────
function AccountModal({ displayName, statusText, onSave, onClose }: {
  displayName: string; statusText: string; onSave: (n: string, s: string) => void; onClose: () => void;
}) {
  const [name,   setName]   = useState(displayName);
  const [status, setStatus] = useState(statusText);
  const { toast } = useToast();

  const save = () => { onSave(name.trim() || "You", status.trim() || "Available"); onClose(); toast({ title: "Account updated" }); };

  return (
    <SettingsModal title="Account Info" onClose={onClose}>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Display Name</label>
          <Input value={name} onChange={e => setName(e.target.value)} maxLength={30} className="rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status Message</label>
          <Input value={status} onChange={e => setStatus(e.target.value)} maxLength={60} className="rounded-xl" />
        </div>
      </div>
      <Button className="w-full rounded-2xl mt-2" onClick={save}>Save Changes</Button>
    </SettingsModal>
  );
}

// ── Profile avatar LS key ─────────────────────────────────────────────────────
const PROFILE_AVATAR_KEY = "chivra_profile_avatar";

// ── Main Profile page ─────────────────────────────────────────────────────────
export default function Profile() {
  const { toast }            = useToast();
  const [vcn, setVcn]        = useState<string | null>(null);
  const [displayNameS, setDisplayNameS] = useState(getDisplayName);
  const [statusTextS,  setStatusTextS]  = useState(getStatusText);
  const [editingName,  setEditingName]  = useState(false);
  const [editingStatus,setEditingStatus]= useState(false);
  const [tempName,     setTempName]     = useState(displayNameS);
  const [tempStatus,   setTempStatus]   = useState(statusTextS);
  const [copied,       setCopied]       = useState(false);
  const [activeModal,  setActiveModal]  = useState<ModalId>(null);
  const [profileAvatar,setProfileAvatar]= useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setVcn(getStoredVcn()); }, []);
  useEffect(() => {
    const saved = localStorage.getItem(PROFILE_AVATAR_KEY);
    if (saved) setProfileAvatar(saved);
  }, []);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const b64 = ev.target?.result as string;
      setProfileAvatar(b64);
      localStorage.setItem(PROFILE_AVATAR_KEY, b64);
      toast({ title: "Profile photo updated" });
    };
    reader.readAsDataURL(file);
    if (avatarInputRef.current) avatarInputRef.current.value = "";
  };

  const saveName = async (name?: string) => {
    const trimmed = (name ?? tempName).trim() || "You";
    setDisplayNameS(trimmed); setDisplayName(trimmed); setEditingName(false);
    if (vcn) await fetch(`/api/users/${vcn}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName: trimmed }) });
    toast({ title: "Name updated" });
  };

  const saveStatus = async (status?: string) => {
    const trimmed = (status ?? tempStatus).trim() || "Available";
    setStatusTextS(trimmed); setStatusText(trimmed); setEditingStatus(false);
    if (vcn) await fetch(`/api/users/${vcn}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ statusText: trimmed }) });
    toast({ title: "Status updated" });
  };

  const saveAccount = (name: string, status: string) => { saveName(name); saveStatus(status); };

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
        { id: "account" as ModalId,       icon: User,        label: "Account Information",  sub: displayNameS },
        { id: "privacy" as ModalId,       icon: Shield,      label: "Privacy",               sub: "Last seen, profile photo, status" },
        { id: "notifications" as ModalId, icon: Bell,        label: "Notifications",         sub: "Messages, status, calls" },
        { id: "security" as ModalId,      icon: Lock,        label: "Security",              sub: "App lock, two-factor auth" },
      ],
    },
    {
      title: "Chats",
      items: [
        { id: "chat-appearance" as ModalId, icon: Palette,    label: "Chat Appearance",     sub: "Bubble style, background" },
        { id: "font-size" as ModalId,       icon: Type,       label: "Font Size",            sub: "Small, Default, Large, Extra Large" },
        { id: "wallpaper" as ModalId,       icon: ImageIcon,  label: "Wallpaper",            sub: "Change chat background theme" },
      ],
    },
    {
      title: "Advanced",
      items: [
        { id: "ai-settings" as ModalId,     icon: Bot,         label: "AI Settings",        sub: "Memory, behavior, model" },
        { id: "status-settings" as ModalId, icon: Activity,    label: "Status Settings",    sub: "Visibility, reactions, auto-view" },
        { id: "linked-devices" as ModalId,  icon: Smartphone,  label: "Linked Devices",     sub: "1 device connected" },
        { id: "storage" as ModalId,         icon: HardDrive,   label: "Storage",             sub: "Manage media and data" },
      ],
    },
    {
      title: "Support",
      items: [
        { id: "help" as ModalId,    icon: HelpCircle,  label: "Help Center",   sub: "FAQ and support" },
        { id: "about" as ModalId,   icon: Info,        label: "About Chivra",  sub: "Version 3.5.1 — changelog" },
        { id: "blocked" as ModalId, icon: UserX,       label: "Blocked Contacts", sub: "Manage blocked users" },
      ],
    },
  ];

  return (
    <Layout>
      {/* h-full + relative: modals use absolute inset-0 relative to this container */}
      <div className="flex flex-col h-full relative">

        {/* ── Modals — absolutely positioned over the scroll area ─────────── */}
        <AnimatePresence>
          {activeModal === "privacy"         && <PrivacyModal         onClose={() => setActiveModal(null)} />}
          {activeModal === "notifications"   && <NotificationsModal   onClose={() => setActiveModal(null)} />}
          {activeModal === "chat-appearance" && <ChatAppearanceModal  onClose={() => setActiveModal(null)} />}
          {activeModal === "font-size"       && <FontSizeModal        onClose={() => setActiveModal(null)} />}
          {activeModal === "wallpaper"       && <WallpaperModal       onClose={() => setActiveModal(null)} />}
          {activeModal === "ai-settings"     && <AiSettingsModal      onClose={() => setActiveModal(null)} />}
          {activeModal === "status-settings" && <StatusSettingsModal  onClose={() => setActiveModal(null)} />}
          {activeModal === "security"        && <SecurityModal        onClose={() => setActiveModal(null)} />}
          {activeModal === "help"            && <HelpCenterModal      onClose={() => setActiveModal(null)} />}
          {activeModal === "about"           && <AboutModal           onClose={() => setActiveModal(null)} />}
          {activeModal === "linked-devices"  && <LinkedDevicesModal   onClose={() => setActiveModal(null)} />}
          {activeModal === "storage"         && <StorageModal         onClose={() => setActiveModal(null)} />}
          {activeModal === "blocked"         && <BlockedModal         onClose={() => setActiveModal(null)} />}
          {activeModal === "account"         && (
            <AccountModal
              displayName={displayNameS} statusText={statusTextS}
              onSave={saveAccount} onClose={() => setActiveModal(null)}
            />
          )}
        </AnimatePresence>

        {/* ── Sticky header ───────────────────────────────────────────────── */}
        <header className="flex-shrink-0 px-4 pt-12 pb-4 bg-background/95 backdrop-blur border-b border-border">
          <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        </header>

        {/* ── Scrollable body ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-6 space-y-5 pb-10">

            {/* Avatar + name + status */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-3">
              <div className="relative">
                <div className="p-0.5 rounded-full bg-gradient-to-tr from-violet-500 to-pink-500 shadow-xl">
                  <div className="p-1 rounded-full bg-background">
                    <Avatar className="h-24 w-24">
                      <AvatarImage src={profileAvatar ?? undefined} className="object-cover" />
                      <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">{initials}</AvatarFallback>
                    </Avatar>
                  </div>
                </div>
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-primary flex items-center justify-center shadow-lg border-2 border-background active:scale-95 transition-transform"
                >
                  <Camera className="h-3.5 w-3.5 text-primary-foreground" />
                </button>
                <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleAvatarUpload} />
              </div>

              {editingName ? (
                <div className="flex items-center gap-2 w-full max-w-[240px]">
                  <Input value={tempName} onChange={e => setTempName(e.target.value)} onKeyDown={e => e.key === "Enter" && saveName()} className="text-center text-lg font-semibold h-10 rounded-xl" autoFocus maxLength={30} />
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
                  <Input value={tempStatus} onChange={e => setTempStatus(e.target.value)} onKeyDown={e => e.key === "Enter" && saveStatus()} className="text-center text-sm h-9 rounded-xl" autoFocus maxLength={60} />
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
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
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
              <motion.div key={section.title + si} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 + si * 0.04 }}>
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
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
              <SignOutSection />
            </motion.div>

            <p className="text-center text-xs text-muted-foreground/30 pt-1">Chivra v3.5.1 — Your AI Social World</p>
          </div>
        </div>

      </div>
    </Layout>
  );
}
