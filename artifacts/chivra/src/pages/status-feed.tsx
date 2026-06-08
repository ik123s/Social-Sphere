import { useState, useEffect, useRef } from "react";
import { useGetStatusFeed } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { ContactAvatar } from "@/components/contact-avatar";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import {
  X, Plus, Camera, Send, Image as ImageIcon, Globe,
  Heart, Flame, Smile, ThumbsUp, Eye, MessageCircle,
} from "lucide-react";
import { getDisplayName } from "@/lib/vcn";

// ── Constants ─────────────────────────────────────────────────────────────────
const GRADIENTS = [
  "from-violet-900 to-purple-950",
  "from-indigo-900 to-blue-950",
  "from-rose-900 to-pink-950",
  "from-emerald-900 to-teal-950",
  "from-amber-900 to-orange-950",
  "from-fuchsia-900 to-violet-950",
  "from-sky-900 to-cyan-950",
];

const USER_STATUS_KEY   = "chivra_user_statuses";
const REACTIONS_KEY     = "chivra_status_reactions";

interface UserStatus {
  id: number;
  content: string;
  imageUrl?: string;
  createdAt: string;
  gradient: string;
}

// ── localStorage helpers ──────────────────────────────────────────────────────
function loadUserStatuses(): UserStatus[] {
  try {
    const raw = localStorage.getItem(USER_STATUS_KEY);
    if (!raw) return [];
    const all: UserStatus[] = JSON.parse(raw);
    const since = Date.now() - 24 * 60 * 60 * 1000;
    return all.filter(s => new Date(s.createdAt).getTime() > since);
  } catch { return []; }
}

function saveUserStatuses(statuses: UserStatus[]) {
  localStorage.setItem(USER_STATUS_KEY, JSON.stringify(statuses));
}

function getMyReaction(statusId: number): string | null {
  try {
    const raw = localStorage.getItem(REACTIONS_KEY);
    return raw ? (JSON.parse(raw)[String(statusId)] ?? null) : null;
  } catch { return null; }
}

function saveReaction(statusId: number, reaction: string | null) {
  try {
    const raw = localStorage.getItem(REACTIONS_KEY);
    const data = raw ? JSON.parse(raw) : {};
    if (reaction === null) delete data[String(statusId)];
    else data[String(statusId)] = reaction;
    localStorage.setItem(REACTIONS_KEY, JSON.stringify(data));
  } catch {}
}

function getViewCount(statusId: number): number {
  return 5 + ((statusId * 17 + 11) % 89);
}

// ── Feed helpers ───────────────────────────────────────────────────────────────
function groupByContact(feed: any[]) {
  const map = new Map<number, { contact: any; statuses: any[] }>();
  for (const item of feed) {
    if (!map.has(item.contactId)) {
      map.set(item.contactId, {
        contact: { id: item.contactId, name: item.contactName, avatarUrl: item.contactAvatarUrl },
        statuses: [],
      });
    }
    map.get(item.contactId)!.statuses.push(item);
  }
  return Array.from(map.values());
}

// ── Reaction bar config ────────────────────────────────────────────────────────
const REACTION_OPTS = [
  { type: "heart", Icon: Heart,    activeColor: "text-rose-400"   },
  { type: "fire",  Icon: Flame,    activeColor: "text-orange-400" },
  { type: "haha",  Icon: Smile,    activeColor: "text-yellow-400" },
  { type: "wow",   Icon: ThumbsUp, activeColor: "text-blue-400"  },
];

// ── Story viewer (AI contacts) ────────────────────────────────────────────────
interface StoryGroup { contact: any; statuses: any[] }

function StoryViewer({
  groups,
  startGroupIndex,
  onClose,
  onNavigate,
}: {
  groups: StoryGroup[];
  startGroupIndex: number;
  onClose: () => void;
  onNavigate: (path: string) => void;
}) {
  const [groupIndex, setGroupIndex] = useState(startGroupIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress]     = useState(0);
  const [myReaction, setMyReactionState] = useState<string | null>(null);
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const STORY_DURATION = 5000;

  const currentGroup = groups[groupIndex];
  const currentStory = currentGroup?.statuses[storyIndex];
  const totalInGroup = currentGroup?.statuses.length || 1;

  const goNext = () => {
    if (storyIndex < totalInGroup - 1) { setStoryIndex(s => s + 1); setProgress(0); }
    else if (groupIndex < groups.length - 1) { setGroupIndex(g => g + 1); setStoryIndex(0); setProgress(0); }
    else onClose();
  };

  const goPrev = () => {
    if (storyIndex > 0) { setStoryIndex(s => s - 1); setProgress(0); }
    else if (groupIndex > 0) { setGroupIndex(g => g - 1); setStoryIndex(0); setProgress(0); }
  };

  useEffect(() => {
    setProgress(0);
    if (intervalRef.current) clearInterval(intervalRef.current);
    const tick = 100;
    intervalRef.current = setInterval(() => {
      setProgress(p => {
        if (p >= 100) { goNext(); return 0; }
        return p + (tick / STORY_DURATION) * 100;
      });
    }, tick);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [groupIndex, storyIndex]);

  useEffect(() => {
    if (currentStory?.id) setMyReactionState(getMyReaction(currentStory.id));
  }, [currentStory?.id]);

  const handleReact = (type: string) => {
    if (!currentStory) return;
    const next = myReaction === type ? null : type;
    saveReaction(currentStory.id, next);
    setMyReactionState(next);
  };

  if (!currentGroup || !currentStory) return null;

  const gradient   = GRADIENTS[currentStory.id % GRADIENTS.length];
  const viewCount  = getViewCount(currentStory.id);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black"
      style={{ maxWidth: "448px", margin: "0 auto" }}
    >
      {/* Progress bars */}
      <div className="absolute top-0 left-0 right-0 flex gap-1 px-3 pt-3 z-10">
        {currentGroup.statuses.map((_: any, i: number) => (
          <div key={i} className="flex-1 h-0.5 bg-white/25 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full"
              style={{
                width: i < storyIndex ? "100%" : i === storyIndex ? `${progress}%` : "0%",
                transition: i === storyIndex ? "width 0.1s linear" : "none",
              }}
            />
          </div>
        ))}
      </div>

      {/* Story content */}
      <div className="absolute inset-0">
        {currentStory.imageUrl ? (
          <img src={currentStory.imageUrl} alt="Status" className="w-full h-full object-cover" />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center p-10`}>
            <p className="text-white text-xl font-medium text-center leading-relaxed tracking-wide">{currentStory.content}</p>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/35" />
      </div>

      {/* Header */}
      <div className="absolute top-10 left-0 right-0 px-4 z-10 flex items-center gap-3">
        <div className="ring-2 ring-white/60 rounded-full">
          <ContactAvatar src={currentGroup.contact.avatarUrl} name={currentGroup.contact.name} size="sm" />
        </div>
        <div className="flex-1">
          <p className="text-white font-semibold text-sm drop-shadow">{currentGroup.contact.name}</p>
          <p className="text-white/60 text-[10px]">
            {formatDistanceToNow(new Date(currentStory.createdAt), { addSuffix: true })}
          </p>
        </div>
        <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-full bg-black/30">
          <X className="h-5 w-5 text-white/80" />
        </button>
      </div>

      {/* Text overlay on image */}
      {currentStory.imageUrl && currentStory.content && (
        <div className="absolute bottom-36 left-0 right-0 px-6 z-10">
          <p className="text-white text-base font-medium drop-shadow-lg leading-snug">{currentStory.content}</p>
        </div>
      )}

      {/* Bottom interaction bar — z-30, above tap zones */}
      <div className="absolute bottom-0 left-0 right-0 z-30 px-4 pb-8 pt-6 bg-gradient-to-t from-black/55 to-transparent">
        <div className="flex items-center gap-2.5">
          {/* View count */}
          <div className="flex items-center gap-1 text-white/50 text-xs flex-shrink-0">
            <Eye className="h-3.5 w-3.5" />
            <span>{viewCount}</span>
          </div>

          {/* Reply */}
          <button
            onClick={() => { onClose(); onNavigate(`/chats/${currentGroup.contact.id}`); }}
            className="flex-1 h-10 flex items-center gap-2 pl-3 pr-3 rounded-full border border-white/20 bg-white/5 backdrop-blur-sm text-left min-w-0"
          >
            <MessageCircle className="h-3.5 w-3.5 text-white/50 flex-shrink-0" />
            <span className="text-sm text-white/50 truncate">Reply...</span>
          </button>

          {/* Reactions */}
          {REACTION_OPTS.map(r => (
            <button
              key={r.type}
              onClick={() => handleReact(r.type)}
              className={`h-9 w-9 flex items-center justify-center rounded-full transition-all flex-shrink-0 ${
                myReaction === r.type
                  ? "bg-white/20 scale-110"
                  : "bg-black/25 active:scale-90"
              }`}
            >
              <r.Icon
                className={`h-[18px] w-[18px] ${myReaction === r.type ? r.activeColor : "text-white/65"}`}
                strokeWidth={myReaction === r.type ? 2.5 : 1.75}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Tap zones (stop above reaction bar) */}
      <button onClick={goPrev} className="absolute left-0 top-0 bottom-32 w-1/3 z-20" aria-label="Previous" />
      <button onClick={goNext} className="absolute right-0 top-0 bottom-32 w-2/3 z-20" aria-label="Next" />
    </motion.div>
  );
}

// ── My status viewer ──────────────────────────────────────────────────────────
function MyStoryViewer({ statuses, onClose }: { statuses: UserStatus[]; onClose: () => void }) {
  const [index, setIndex]       = useState(0);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const DURATION = 5000;
  const current = statuses[index];

  useEffect(() => {
    setProgress(0);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          if (index < statuses.length - 1) setIndex(i => i + 1);
          else onClose();
          return 0;
        }
        return p + (100 / (DURATION / 100));
      });
    }, 100);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [index]);

  if (!current) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col bg-black"
      style={{ maxWidth: "448px", margin: "0 auto" }}
    >
      {/* Progress */}
      <div className="absolute top-0 left-0 right-0 flex gap-1 px-3 pt-3 z-10">
        {statuses.map((_, i) => (
          <div key={i} className="flex-1 h-0.5 bg-white/25 rounded-full overflow-hidden">
            <div className="h-full bg-white rounded-full" style={{ width: i < index ? "100%" : i === index ? `${progress}%` : "0%", transition: i === index ? "width 0.1s linear" : "none" }} />
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="absolute inset-0">
        {current.imageUrl ? (
          <img src={current.imageUrl} alt="My status" className="w-full h-full object-cover" />
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-br ${current.gradient} flex items-center justify-center p-10`}>
            <p className="text-white text-xl font-medium text-center leading-relaxed">{current.content}</p>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />
      </div>

      {/* Header */}
      <div className="absolute top-10 left-0 right-0 px-4 z-10 flex items-center justify-between">
        <p className="text-white font-semibold text-sm">Your Status</p>
        <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-full bg-black/30">
          <X className="h-5 w-5 text-white/80" />
        </button>
      </div>

      {/* Image caption */}
      {current.imageUrl && current.content && (
        <div className="absolute bottom-12 left-0 right-0 px-6 z-10">
          <p className="text-white text-base font-medium drop-shadow-lg">{current.content}</p>
        </div>
      )}
    </motion.div>
  );
}

// ── Compose status ────────────────────────────────────────────────────────────
function ComposeStatus({
  onPost,
  onClose,
}: {
  onPost: (text: string, imageData?: string) => void;
  onClose: () => void;
}) {
  const [text, setText]                 = useState("");
  const [gradIdx, setGradIdx]           = useState(Math.floor(Math.random() * GRADIENTS.length));
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef                    = useRef<HTMLInputElement>(null);

  // Paste image from clipboard
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items ?? []);
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (!file) continue;
          const reader = new FileReader();
          reader.onload = ev => setImagePreview(ev.target?.result as string);
          reader.readAsDataURL(file);
          e.preventDefault();
          break;
        }
      }
    };
    window.addEventListener("paste", handler);
    return () => window.removeEventListener("paste", handler);
  }, []);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = ev => setImagePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  };

  const canPost = text.trim().length > 0 || !!imagePreview;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col"
      style={{ maxWidth: "448px", margin: "0 auto" }}
    >
      {/* Background */}
      <div className="absolute inset-0">
        {imagePreview ? (
          <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${GRADIENTS[gradIdx]} transition-all duration-500`} />
        )}
        <div className="absolute inset-0 bg-black/20" />
      </div>

      {/* ── TOP BAR ───────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex items-center justify-between px-4 pt-12 pb-4">
        <button
          onClick={onClose}
          className="h-10 w-10 flex items-center justify-center rounded-full bg-black/35 backdrop-blur-sm active:bg-black/55 transition-all"
        >
          <X className="h-5 w-5 text-white" />
        </button>

        <span className="text-white font-bold text-base tracking-wide">New Status</span>

        <div className="h-10 px-3.5 flex items-center gap-1.5 rounded-full bg-black/35 backdrop-blur-sm">
          <Globe className="h-3.5 w-3.5 text-white/80" />
          <span className="text-white/80 text-xs font-semibold">Everyone</span>
        </div>
      </div>

      {/* ── MIDDLE: gradient picker / caption ─────────────────────────────── */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 gap-6">
        {!imagePreview && (
          <div className="flex gap-2.5 flex-wrap justify-center">
            {GRADIENTS.map((g, i) => (
              <button
                key={i}
                onClick={() => setGradIdx(i)}
                className={`w-8 h-8 rounded-full bg-gradient-to-br ${g} border-2 transition-all ${i === gradIdx ? "border-white scale-110 shadow-xl" : "border-white/30"}`}
              />
            ))}
          </div>
        )}

        {imagePreview && (
          <button
            onClick={() => setImagePreview(null)}
            className="h-9 px-4 rounded-full bg-black/45 text-white text-xs font-semibold flex items-center gap-1.5 backdrop-blur-sm"
          >
            <X className="h-3.5 w-3.5" />
            Remove photo
          </button>
        )}

        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={imagePreview ? "Add a caption..." : "What's on your mind?"}
          maxLength={200}
          autoFocus
          rows={imagePreview ? 2 : 4}
          className="w-full bg-transparent text-white text-xl text-center font-medium placeholder:text-white/40 resize-none outline-none leading-relaxed"
        />
      </div>

      {/* ── BOTTOM BAR ────────────────────────────────────────────────────── */}
      <div className="relative z-10 px-4 pb-10 pt-2 space-y-3">
        {!imagePreview && (
          <p className="text-white/40 text-xs text-center">
            {200 - text.length} remaining &middot; paste or upload a photo below
          </p>
        )}

        <div className="flex items-center gap-3">
          {/* Image picker */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="h-13 w-13 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center active:bg-black/60 transition-all flex-shrink-0"
            style={{ height: 52, width: 52 }}
          >
            <ImageIcon className="h-[22px] w-[22px] text-white" />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

          {/* Camera (alias for image picker) */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="h-13 w-13 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center active:bg-black/60 transition-all flex-shrink-0"
            style={{ height: 52, width: 52 }}
          >
            <Camera className="h-[22px] w-[22px] text-white" />
          </button>

          {/* Share button */}
          <Button
            disabled={!canPost}
            onClick={() => {
              if (canPost) {
                onPost(text.trim(), imagePreview ?? undefined);
                onClose();
              }
            }}
            className="flex-1 rounded-full bg-white text-black font-bold hover:bg-white/90 disabled:opacity-35 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{ height: 52 }}
          >
            <Send className="h-[18px] w-[18px]" />
            Share Status
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Status feed page ──────────────────────────────────────────────────────────
export default function StatusFeed() {
  const [, setLocation]                         = useLocation();
  const { data: feed, isLoading }               = useGetStatusFeed();
  const [viewingGroupIndex, setViewingGroupIndex] = useState<number | null>(null);
  const [viewingMyStatus, setViewingMyStatus]     = useState(false);
  const [composing, setComposing]                 = useState(false);
  const [userStatuses, setUserStatuses]           = useState<UserStatus[]>(loadUserStatuses);
  const displayName = getDisplayName();

  const groups = feed ? groupByContact(feed) : [];

  const postStatus = (text: string, imageData?: string) => {
    const newStatus: UserStatus = {
      id: Date.now(),
      content: text,
      imageUrl: imageData,
      createdAt: new Date().toISOString(),
      gradient: GRADIENTS[Math.floor(Math.random() * GRADIENTS.length)]!,
    };
    const updated = [newStatus, ...userStatuses];
    setUserStatuses(updated);
    saveUserStatuses(updated);
  };

  return (
    <Layout>
      <AnimatePresence>
        {viewingGroupIndex !== null && (
          <StoryViewer
            groups={groups}
            startGroupIndex={viewingGroupIndex}
            onClose={() => setViewingGroupIndex(null)}
            onNavigate={setLocation}
          />
        )}
        {viewingMyStatus && userStatuses.length > 0 && (
          <MyStoryViewer statuses={userStatuses} onClose={() => setViewingMyStatus(false)} />
        )}
        {composing && (
          <ComposeStatus onPost={postStatus} onClose={() => setComposing(false)} />
        )}
      </AnimatePresence>

      <div className="flex flex-col min-h-full pb-20 overflow-y-auto">
        {/* Header */}
        <header className="px-4 pt-12 pb-4 bg-background/95 backdrop-blur z-10 sticky top-0 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Status</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Updates from your contacts</p>
            </div>
            <Button
              size="sm" variant="outline"
              className="rounded-xl border-primary/30 text-primary hover:bg-primary/10"
              onClick={() => setComposing(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              New Status
            </Button>
          </div>
        </header>

        {/* My status row */}
        <div className="px-4 py-4 border-b border-border/50">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">My Status</p>
          <div className="flex items-center gap-3">
            {userStatuses.length > 0 ? (
              <button onClick={() => setViewingMyStatus(true)} className="flex items-center gap-3 flex-1">
                <div className="p-0.5 rounded-full bg-gradient-to-tr from-violet-500 to-pink-500">
                  <div className="p-0.5 rounded-full bg-background">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-lg font-bold text-primary">{displayName[0]?.toUpperCase()}</span>
                    </div>
                  </div>
                </div>
                <div className="text-left">
                  <p className="font-semibold text-sm">{displayName}</p>
                  <p className="text-xs text-muted-foreground">
                    {userStatuses.length} update{userStatuses.length > 1 ? "s" : ""} &middot; tap to view
                  </p>
                </div>
              </button>
            ) : (
              <button onClick={() => setComposing(true)} className="flex items-center gap-3 flex-1 text-left">
                <div className="h-12 w-12 rounded-full bg-muted/60 border-2 border-dashed border-primary/40 flex items-center justify-center flex-shrink-0">
                  <Plus className="h-5 w-5 text-primary/60" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{displayName}</p>
                  <p className="text-xs text-muted-foreground">Tap to add a status update</p>
                </div>
              </button>
            )}

            {userStatuses.length > 0 && (
              <button
                onClick={() => setComposing(true)}
                className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0"
              >
                <Plus className="h-4 w-4 text-primary" />
              </button>
            )}
          </div>
        </div>

        {/* AI contacts story bubbles */}
        {!isLoading && groups.length > 0 && (
          <div className="px-4 py-4 border-b border-border/50">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Recent Updates</p>
            <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-1">
              {groups.map((group, idx) => (
                <button
                  key={group.contact.id}
                  onClick={() => setViewingGroupIndex(idx)}
                  className="flex flex-col items-center gap-1.5 min-w-[56px]"
                >
                  <div className="relative p-0.5 rounded-full bg-gradient-to-tr from-violet-500 via-purple-500 to-pink-500 shadow-md shadow-primary/20">
                    <div className="p-0.5 rounded-full bg-background">
                      <ContactAvatar src={group.contact.avatarUrl} name={group.contact.name} size="md" />
                    </div>
                    {group.statuses.length > 1 && (
                      <span className="absolute -bottom-0.5 -right-0.5 bg-primary text-primary-foreground text-[9px] font-bold h-4 w-4 flex items-center justify-center rounded-full border border-background">
                        {group.statuses.length}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground truncate w-14 text-center">
                    {group.contact.name.split(" ")[0]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Full contact list */}
        <div className="px-4 py-3 flex-1">
          {isLoading ? (
            <div className="space-y-1">
              {Array(5).fill(0).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-3">
                  <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-3 w-44" />
                  </div>
                  <Skeleton className="h-3 w-10" />
                </div>
              ))}
            </div>
          ) : groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <p className="text-sm text-muted-foreground">No status updates in the last 24 hours</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {groups.map((group, idx) => {
                const latest = group.statuses[group.statuses.length - 1];
                return (
                  <motion.button
                    key={group.contact.id}
                    initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    onClick={() => setViewingGroupIndex(idx)}
                    className="w-full flex items-center gap-3 py-3 px-2 rounded-2xl hover:bg-muted/40 active:scale-[0.98] transition-all text-left"
                  >
                    <div className="p-0.5 rounded-full bg-gradient-to-tr from-violet-500 to-pink-500 flex-shrink-0">
                      <div className="p-0.5 rounded-full bg-background">
                        <ContactAvatar src={group.contact.avatarUrl} name={group.contact.name} size="md" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{group.contact.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {latest?.imageUrl ? "Posted a photo" : latest?.content || "Posted a status"}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {latest ? formatDistanceToNow(new Date(latest.createdAt), { addSuffix: true }).replace("about ", "") : ""}
                      </span>
                      <div className="flex items-center gap-0.5 text-muted-foreground/50">
                        <Eye className="h-3 w-3" />
                        <span className="text-[10px]">{getViewCount(latest?.id ?? idx)}</span>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
