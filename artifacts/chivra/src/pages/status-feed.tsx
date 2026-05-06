import { useState, useEffect, useRef } from "react";
import { useGetStatusFeed, useListContacts } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { ContactAvatar } from "@/components/contact-avatar";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

// Group feed items by contact
function groupByContact(feed: any[]) {
  const map = new Map<number, { contact: any; statuses: any[] }>();
  for (const item of feed) {
    if (!map.has(item.contactId)) {
      map.set(item.contactId, {
        contact: {
          id: item.contactId,
          name: item.contactName,
          avatarUrl: item.contactAvatarUrl,
        },
        statuses: [],
      });
    }
    map.get(item.contactId)!.statuses.push(item);
  }
  return Array.from(map.values());
}

interface StoryViewerProps {
  groups: { contact: any; statuses: any[] }[];
  startGroupIndex: number;
  onClose: () => void;
}

function StoryViewer({ groups, startGroupIndex, onClose }: StoryViewerProps) {
  const [groupIndex, setGroupIndex] = useState(startGroupIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const STORY_DURATION = 5000;

  const currentGroup = groups[groupIndex];
  const currentStory = currentGroup?.statuses[storyIndex];
  const totalInGroup = currentGroup?.statuses.length || 1;

  const goNext = () => {
    if (storyIndex < totalInGroup - 1) {
      setStoryIndex((s) => s + 1);
      setProgress(0);
    } else if (groupIndex < groups.length - 1) {
      setGroupIndex((g) => g + 1);
      setStoryIndex(0);
      setProgress(0);
    } else {
      onClose();
    }
  };

  const goPrev = () => {
    if (storyIndex > 0) {
      setStoryIndex((s) => s - 1);
      setProgress(0);
    } else if (groupIndex > 0) {
      setGroupIndex((g) => g - 1);
      setStoryIndex(0);
      setProgress(0);
    }
  };

  useEffect(() => {
    setProgress(0);
    if (intervalRef.current) clearInterval(intervalRef.current);
    const tick = 100;
    intervalRef.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          goNext();
          return 0;
        }
        return p + (tick / STORY_DURATION) * 100;
      });
    }, tick);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [groupIndex, storyIndex]);

  if (!currentGroup || !currentStory) return null;

  // Generate a gradient background for text-only stories
  const gradients = [
    "from-violet-900 to-purple-950",
    "from-indigo-900 to-blue-950",
    "from-rose-900 to-pink-950",
    "from-emerald-900 to-teal-950",
    "from-amber-900 to-orange-950",
  ];
  const gradient = gradients[currentStory.id % gradients.length];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black"
      style={{ maxWidth: "448px", margin: "0 auto" }}
    >
      {/* Progress bars */}
      <div className="absolute top-0 left-0 right-0 flex gap-1 px-3 pt-3 z-10">
        {currentGroup.statuses.map((_: any, i: number) => (
          <div key={i} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-white transition-none rounded-full"
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
          <img
            src={currentStory.imageUrl}
            alt="Status"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center p-10`}>
            <p className="text-white text-xl font-medium text-center leading-relaxed tracking-wide">
              {currentStory.content}
            </p>
          </div>
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
      </div>

      {/* Contact info */}
      <div className="absolute top-10 left-0 right-0 px-4 z-10 flex items-center gap-3">
        <div className="ring-2 ring-white/70 rounded-full">
          <ContactAvatar src={currentGroup.contact.avatarUrl} name={currentGroup.contact.name} size="sm" />
        </div>
        <div>
          <p className="text-white font-semibold text-sm drop-shadow">{currentGroup.contact.name}</p>
          <p className="text-white/70 text-[10px]">
            {formatDistanceToNow(new Date(currentStory.createdAt), { addSuffix: true })}
          </p>
        </div>
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-10 right-4 z-10 text-white/80 hover:text-white"
      >
        <X className="h-6 w-6 drop-shadow" />
      </button>

      {/* Text overlay for image stories */}
      {currentStory.imageUrl && currentStory.content && (
        <div className="absolute bottom-24 left-0 right-0 px-6 z-10">
          <p className="text-white text-base font-medium drop-shadow-lg leading-snug">
            {currentStory.content}
          </p>
        </div>
      )}

      {/* Tap zones */}
      <button
        onClick={goPrev}
        className="absolute left-0 top-0 bottom-0 w-1/3 z-20"
        aria-label="Previous story"
      />
      <button
        onClick={goNext}
        className="absolute right-0 top-0 bottom-0 w-2/3 z-20"
        aria-label="Next story"
      />
    </motion.div>
  );
}

export default function StatusFeed() {
  const { data: feed, isLoading } = useGetStatusFeed();
  const [viewingGroupIndex, setViewingGroupIndex] = useState<number | null>(null);

  const groups = feed ? groupByContact(feed) : [];

  return (
    <Layout>
      <AnimatePresence>
        {viewingGroupIndex !== null && (
          <StoryViewer
            groups={groups}
            startGroupIndex={viewingGroupIndex}
            onClose={() => setViewingGroupIndex(null)}
          />
        )}
      </AnimatePresence>

      <div className="flex flex-col min-h-full pb-20">
        <header className="px-4 pt-12 pb-4 bg-background/95 backdrop-blur z-10 sticky top-0 border-b border-border">
          <h1 className="text-2xl font-semibold tracking-tight">Status</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Tap to view</p>
        </header>

        {/* Story bubbles row */}
        <div className="px-4 py-4 border-b border-border">
          {isLoading ? (
            <div className="flex gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex flex-col items-center gap-1.5">
                  <Skeleton className="h-16 w-16 rounded-full" />
                  <Skeleton className="h-2.5 w-12 rounded" />
                </div>
              ))}
            </div>
          ) : groups.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No status updates yet.</p>
          ) : (
            <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-1">
              {groups.map((group, idx) => (
                <button
                  key={group.contact.id}
                  onClick={() => setViewingGroupIndex(idx)}
                  className="flex flex-col items-center gap-1.5 min-w-[60px] group"
                >
                  <div className="relative p-0.5 rounded-full bg-gradient-to-tr from-violet-500 via-purple-500 to-pink-500 shadow-lg shadow-primary/20">
                    <div className="p-0.5 rounded-full bg-background">
                      <ContactAvatar
                        src={group.contact.avatarUrl}
                        name={group.contact.name}
                        size="md"
                      />
                    </div>
                    {group.statuses.length > 1 && (
                      <span className="absolute -bottom-0.5 -right-0.5 bg-primary text-primary-foreground text-[9px] font-bold h-4 w-4 flex items-center justify-center rounded-full border border-background">
                        {group.statuses.length}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground truncate w-full text-center group-hover:text-foreground transition-colors">
                    {group.contact.name.split(" ")[0]}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Recent updates list */}
        <div className="px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Recent</p>
          <div className="space-y-1">
            {isLoading ? (
              Array(4).fill(0).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-2.5">
                  <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-2.5 w-44" />
                  </div>
                  <Skeleton className="h-2.5 w-12" />
                </div>
              ))
            ) : (
              groups.map((group, idx) => {
                const latest = group.statuses[group.statuses.length - 1];
                return (
                  <motion.button
                    key={group.contact.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    onClick={() => setViewingGroupIndex(idx)}
                    className="w-full flex items-center gap-3 py-2.5 px-2 rounded-2xl hover:bg-muted/40 active:scale-[0.98] transition-all text-left"
                  >
                    <div className="p-0.5 rounded-full bg-gradient-to-tr from-violet-500 to-pink-500 flex-shrink-0">
                      <div className="p-0.5 rounded-full bg-background">
                        <ContactAvatar src={group.contact.avatarUrl} name={group.contact.name} size="md" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{group.contact.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{latest.content || "Posted a status"}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0">
                      {formatDistanceToNow(new Date(latest.createdAt), { addSuffix: true }).replace("about ", "")}
                    </span>
                  </motion.button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
