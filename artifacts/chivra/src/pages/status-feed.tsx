import { useState, useEffect, useRef } from "react";
import { useGetStatusFeed, useListContacts } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { ContactAvatar } from "@/components/contact-avatar";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { X, ChevronLeft, ChevronRight, Plus, Camera, Type, Send } from "lucide-react";
import { getDisplayName, getStoredVcn } from "@/lib/vcn";

// ── Local user status store ───────────────────────────────────────────────────
const USER_STATUS_KEY = "chivra_user_statuses";

interface UserStatus {
  id: number;
  content: string;
  createdAt: string;
  gradient: string;
}

const GRADIENTS = [
  "from-violet-900 to-purple-950",
  "from-indigo-900 to-blue-950",
  "from-rose-900 to-pink-950",
  "from-emerald-900 to-teal-950",
  "from-amber-900 to-orange-950",
  "from-fuchsia-900 to-violet-950",
  "from-sky-900 to-cyan-950",
];

function loadUserStatuses(): UserStatus[] {
  try {
    const raw = localStorage.getItem(USER_STATUS_KEY);
    if (!raw) return [];
    const all: UserStatus[] = JSON.parse(raw);
    // Keep only last 24h
    const since = Date.now() - 24 * 60 * 60 * 1000;
    return all.filter(s => new Date(s.createdAt).getTime() > since);
  } catch { return []; }
}

function saveUserStatuses(statuses: UserStatus[]) {
  localStorage.setItem(USER_STATUS_KEY, JSON.stringify(statuses));
}

// ── Group feed by contact ─────────────────────────────────────────────────────
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

// ── Story viewer ──────────────────────────────────────────────────────────────
interface StoryGroup { contact: any; statuses: any[] }

function StoryViewer({ groups, startGroupIndex, onClose }: { groups: StoryGroup[]; startGroupIndex: number; onClose: () => void }) {
  const [groupIndex, setGroupIndex]   = useState(startGroupIndex);
  const [storyIndex, setStoryIndex]   = useState(0);
  const [progress,   setProgress]     = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const STORY_DURATION = 5000;

  const currentGroup = groups[groupIndex];
  const currentStory = currentGroup?.statuses[storyIndex];
  const totalInGroup = currentGroup?.statuses.length || 1;

  const goNext = () => {
    if (storyIndex < totalInGroup - 1) { setStoryIndex(s => s + 1); setProgress(0); }
    else if (groupIndex < groups.length - 1) { setGroupIndex(g => g + 1); setStoryIndex(0); setProgress(0); }
    else { onClose(); }
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

  if (!currentGroup || !currentStory) return null;

  const gradient = GRADIENTS[currentStory.id % GRADIENTS.length];

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
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />
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
        <button onClick={onClose} className="text-white/80 hover:text-white">
          <X className="h-6 w-6 drop-shadow" />
        </button>
      </div>

      {/* Text overlay on image */}
      {currentStory.imageUrl && currentStory.content && (
        <div className="absolute bottom-24 left-0 right-0 px-6 z-10">
          <p className="text-white text-base font-medium drop-shadow-lg leading-snug">{currentStory.content}</p>
        </div>
      )}

      {/* Tap zones */}
      <button onClick={goPrev} className="absolute left-0 top-0 bottom-0 w-1/3 z-20" aria-label="Previous" />
      <button onClick={goNext} className="absolute right-0 top-0 bottom-0 w-2/3 z-20" aria-label="Next" />
    </motion.div>
  );
}

// ── My status story viewer ────────────────────────────────────────────────────
function MyStoryViewer({ statuses, onClose }: { statuses: UserStatus[]; onClose: () => void }) {
  const [index, setIndex]     = useState(0);
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
      <div className="absolute top-0 left-0 right-0 flex gap-1 px-3 pt-3 z-10">
        {statuses.map((_, i) => (
          <div key={i} className="flex-1 h-0.5 bg-white/25 rounded-full overflow-hidden">
            <div className="h-full bg-white rounded-full" style={{ width: i < index ? "100%" : i === index ? `${progress}%` : "0%", transition: i === index ? "width 0.1s linear" : "none" }} />
          </div>
        ))}
      </div>
      <div className={`absolute inset-0 bg-gradient-to-br ${current.gradient} flex items-center justify-center p-10`}>
        <p className="text-white text-xl font-medium text-center leading-relaxed">{current.content}</p>
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />
      <div className="absolute top-10 left-0 right-0 px-4 z-10 flex items-center justify-between">
        <p className="text-white font-semibold text-sm">Your Status</p>
        <button onClick={onClose}><X className="h-6 w-6 text-white/80" /></button>
      </div>
    </motion.div>
  );
}

// ── Compose status sheet ──────────────────────────────────────────────────────
function ComposeStatus({ onPost, onClose }: { onPost: (text: string) => void; onClose: () => void }) {
  const [text, setText] = useState("");
  const [gradIdx, setGradIdx] = useState(Math.floor(Math.random() * GRADIENTS.length));

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col"
      style={{ maxWidth: "448px", margin: "0 auto" }}
    >
      {/* Gradient background preview */}
      <div className={`absolute inset-0 bg-gradient-to-br ${GRADIENTS[gradIdx]} transition-all duration-500`} />
      <div className="absolute inset-0 bg-black/20" />

      <div className="relative z-10 flex flex-col h-full px-5 pt-14 pb-8">
        <div className="flex items-center justify-between mb-8">
          <button onClick={onClose} className="text-white/80 hover:text-white">
            <X className="h-6 w-6" />
          </button>
          <p className="text-white font-semibold">New Status</p>
          <div className="w-6" />
        </div>

        {/* Gradient switcher */}
        <div className="flex gap-2 justify-center mb-8">
          {GRADIENTS.map((g, i) => (
            <button
              key={i}
              onClick={() => setGradIdx(i)}
              className={`w-7 h-7 rounded-full bg-gradient-to-br ${g} border-2 transition-all ${i === gradIdx ? "border-white scale-110" : "border-white/30"}`}
            />
          ))}
        </div>

        {/* Text input */}
        <div className="flex-1 flex items-center justify-center">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What's on your mind?"
            maxLength={200}
            autoFocus
            className="w-full bg-transparent text-white text-xl text-center font-medium placeholder:text-white/40 resize-none outline-none leading-relaxed"
            rows={4}
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-white/40 text-xs">{200 - text.length} chars</span>
          <Button
            disabled={!text.trim()}
            onClick={() => { if (text.trim()) { onPost(text.trim()); onClose(); } }}
            className="rounded-full px-6 bg-white text-black font-semibold hover:bg-white/90"
          >
            <Send className="h-4 w-4 mr-2" />
            Share
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Status feed page ──────────────────────────────────────────────────────────
export default function StatusFeed() {
  const { data: feed, isLoading } = useGetStatusFeed();
  const [viewingGroupIndex, setViewingGroupIndex] = useState<number | null>(null);
  const [viewingMyStatus, setViewingMyStatus]     = useState(false);
  const [composing, setComposing]                 = useState(false);
  const [userStatuses, setUserStatuses]           = useState<UserStatus[]>(loadUserStatuses);
  const displayName = getDisplayName();

  const groups = feed ? groupByContact(feed) : [];

  const postStatus = (text: string) => {
    const newStatus: UserStatus = {
      id: Date.now(),
      content: text,
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
          <StoryViewer groups={groups} startGroupIndex={viewingGroupIndex} onClose={() => setViewingGroupIndex(null)} />
        )}
        {viewingMyStatus && userStatuses.length > 0 && (
          <MyStoryViewer statuses={userStatuses} onClose={() => setViewingMyStatus(false)} />
        )}
        {composing && (
          <ComposeStatus onPost={postStatus} onClose={() => setComposing(false)} />
        )}
      </AnimatePresence>

      <div className="flex flex-col min-h-full pb-20 overflow-y-auto">
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
              New
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
              <button
                onClick={() => setComposing(true)}
                className="flex items-center gap-3 flex-1 text-left"
              >
                <div className="h-12 w-12 rounded-full bg-muted/60 border-2 border-dashed border-primary/40 flex items-center justify-center flex-shrink-0">
                  <Plus className="h-5 w-5 text-primary/60" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{displayName}</p>
                  <p className="text-xs text-muted-foreground">Tap to add a status update</p>
                </div>
              </button>
            )}
          </div>
        </div>

        {/* AI contacts status bubbles */}
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

        {/* Full list */}
        <div className="px-4 py-3 flex-1">
          {isLoading ? (
            <div className="space-y-1">
              {Array(5).fill(0).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-3">
                  <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-1.5"><Skeleton className="h-3.5 w-28" /><Skeleton className="h-3 w-44" /></div>
                  <Skeleton className="h-3 w-10" />
                </div>
              ))}
            </div>
          ) : groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3">
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
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0">
                      {latest ? formatDistanceToNow(new Date(latest.createdAt), { addSuffix: true }).replace("about ", "") : ""}
                    </span>
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
