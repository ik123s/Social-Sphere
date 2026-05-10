import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useListContacts, useGetStatusFeed, useGetDashboardSummary } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { ContactAvatar } from "@/components/contact-avatar";
import { Input } from "@/components/ui/input";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search, Plus, Camera, MoreVertical, Phone, Video,
  PenSquare,
} from "lucide-react";
import CallOverlay, { type CallContact, type CallType } from "@/components/call-overlay";

type Tab = "chats" | "spaces" | "calls";

function getStatusContacts(feed: any[]) {
  const seen = new Set<number>();
  const result: { contactId: number; contactName: string; avatarUrl: string | null }[] = [];
  for (const item of feed) {
    if (!seen.has(item.contactId)) {
      seen.add(item.contactId);
      result.push({ contactId: item.contactId, contactName: item.contactName, avatarUrl: item.contactAvatarUrl });
    }
  }
  return result.slice(0, 8);
}

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

function fmtTime(dateStr: string | null): string {
  if (!dateStr) return "";
  return formatDistanceToNow(new Date(dateStr), { addSuffix: false })
    .replace("about ", "")
    .replace(" minutes", "m").replace(" minute", "m")
    .replace(" hours", "h").replace(" hour", "h")
    .replace(" days", "d").replace(" day", "d")
    .replace(" months", "mo").replace(" month", "mo");
}

export default function ChatList() {
  const [activeTab, setActiveTab] = useState<Tab>("chats");
  const [search, setSearch] = useState("");
  const [callState, setCallState] = useState<{ contact: CallContact; callType: CallType } | null>(null);

  const { data: contacts, isLoading }     = useListContacts();
  const { data: summary }                 = useGetDashboardSummary();
  const { data: statusFeed, isLoading: isStatusLoading } = useGetStatusFeed();

  const statusContacts = useMemo(() => statusFeed ? getStatusContacts(statusFeed) : [], [statusFeed]);
  const statusGroups   = useMemo(() => statusFeed ? groupByContact(statusFeed) : [], [statusFeed]);

  const activePersonals = useMemo(() =>
    (contacts ?? []).filter(c => c.activityState === "online" || c.activityState === "idle").slice(0, 10),
    [contacts]
  );

  const filteredContacts = useMemo(() =>
    (contacts ?? []).filter(c => c.name.toLowerCase().includes(search.toLowerCase())),
    [contacts, search]
  );

  const recentForCalls = useMemo(() =>
    [...(contacts ?? [])]
      .sort((a, b) => new Date(b.lastMessageAt ?? 0).getTime() - new Date(a.lastMessageAt ?? 0).getTime())
      .slice(0, 20),
    [contacts]
  );

  return (
    <Layout>
      <AnimatePresence>
        {callState && (
          <CallOverlay
            contact={callState.contact}
            callType={callState.callType}
            onEnd={() => setCallState(null)}
          />
        )}
      </AnimatePresence>

      <div className="flex flex-col h-full overflow-hidden relative">

        {/* ── Android-native header ──────────────────────────────────────────── */}
        <header className="bg-[#160530] flex-shrink-0 shadow-lg shadow-black/40">
          {/* Title row */}
          <div className="px-4 pt-10 pb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-violet-400 to-purple-700 rounded-xl flex items-center justify-center shadow shadow-purple-900/60">
                <span className="text-white font-black text-[15px]">C</span>
              </div>
              <h1 className="text-[20px] font-bold text-white tracking-wide">Chivra</h1>
              {(summary?.totalUnread ?? 0) > 0 && (
                <motion.span
                  initial={{ scale: 0.7 }} animate={{ scale: 1 }}
                  className="bg-violet-400 text-black text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none"
                >
                  {summary!.totalUnread}
                </motion.span>
              )}
            </div>
            <div className="flex items-center">
              <button className="h-9 w-9 flex items-center justify-center rounded-full active:bg-white/10 transition-colors">
                <Search className="h-[18px] w-[18px] text-white/75" />
              </button>
              <button className="h-9 w-9 flex items-center justify-center rounded-full active:bg-white/10 transition-colors">
                <MoreVertical className="h-[18px] w-[18px] text-white/75" />
              </button>
            </div>
          </div>

          {/* Tabs row */}
          <div className="flex items-end pl-1">
            <Link href="/status" className="px-3 pb-3.5 flex items-center justify-center">
              <Camera className="h-[18px] w-[18px] text-white/55" />
            </Link>
            {(["chats", "spaces", "calls"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-0 pt-0 flex-1 flex flex-col items-center relative transition-colors ${
                  activeTab === tab ? "text-white" : "text-white/45"
                }`}
              >
                <span className="text-[11px] font-bold tracking-widest uppercase pb-3 px-1">
                  {tab === "chats" ? "CHATS" : tab === "spaces" ? "CHIVRA SPACES" : "CALLS"}
                </span>
                {activeTab === tab && (
                  <motion.div
                    layoutId="tab-underline"
                    className="absolute bottom-0 left-2 right-2 h-[2.5px] bg-white rounded-full"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
              </button>
            ))}
          </div>
        </header>

        {/* ── Content ───────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto scrollbar-hide">

          {/* ━━ CHATS TAB ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {activeTab === "chats" && (
            <>
              {/* Search bar */}
              <div className="px-3 py-2 bg-background border-b border-border/20">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-[15px] w-[15px] text-muted-foreground" />
                  <Input
                    placeholder="Search"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-8 bg-muted/50 border-transparent rounded-full h-9 text-[14px] focus-visible:ring-primary/30"
                  />
                </div>
              </div>

              {/* ACTIVE CHIVRA PERSONALS */}
              {!search && activePersonals.length > 0 && (
                <div className="px-4 pt-4 pb-3 border-b border-border/25 bg-background/60">
                  <p className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-[0.18em] mb-3">
                    Active Chivra Personals
                  </p>
                  <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-1">
                    {activePersonals.map(contact => (
                      <Link
                        key={contact.id}
                        href={`/chats/${contact.id}`}
                        className="flex flex-col items-center gap-1.5 min-w-[54px]"
                      >
                        <div
                          className={`p-[2.5px] rounded-full ${
                            contact.activityState === "online"
                              ? "bg-gradient-to-tr from-violet-500 via-fuchsia-400 to-pink-400 shadow-md shadow-violet-500/30"
                              : "bg-gradient-to-tr from-amber-400 to-yellow-300 shadow-sm shadow-yellow-500/20"
                          }`}
                        >
                          <div className="p-[2px] rounded-full bg-background">
                            <ContactAvatar src={contact.avatarUrl} name={contact.name} size="md" />
                          </div>
                        </div>
                        <span className="text-[10px] text-foreground/65 w-[54px] text-center truncate font-medium">
                          {contact.name.split(" ")[0]}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Status bubbles row */}
              {!search && statusContacts.length > 0 && (
                <div className="px-4 py-3 border-b border-border/20">
                  <div className="flex gap-3.5 overflow-x-auto scrollbar-hide pb-1">
                    <Link href="/status" className="flex flex-col items-center gap-1.5 min-w-[52px]">
                      <div className="w-[52px] h-[52px] rounded-full bg-muted/50 border-2 border-dashed border-primary/35 flex items-center justify-center">
                        <Plus className="h-4 w-4 text-primary/60" />
                      </div>
                      <span className="text-[9px] text-muted-foreground w-[52px] text-center truncate">Status</span>
                    </Link>
                    {statusContacts.slice(0, 6).map(sc => (
                      <Link key={sc.contactId} href="/status" className="flex flex-col items-center gap-1.5 min-w-[52px]">
                        <div className="p-[2.5px] rounded-full bg-gradient-to-tr from-violet-500 via-purple-500 to-pink-500 shadow-sm shadow-primary/20">
                          <div className="p-[2px] rounded-full bg-background">
                            <ContactAvatar src={sc.avatarUrl} name={sc.contactName} size="md" />
                          </div>
                        </div>
                        <span className="text-[9px] text-muted-foreground w-[52px] text-center truncate">
                          {sc.contactName.split(" ")[0]}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Chat list rows */}
              <div className="pb-24">
                {isLoading ? (
                  <div className="pt-1">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} className="flex items-center gap-3 px-4 py-3.5 border-b border-border/15">
                        <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="flex justify-between">
                            <Skeleton className="h-3.5 w-28" />
                            <Skeleton className="h-2.5 w-10" />
                          </div>
                          <Skeleton className="h-3 w-44" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredContacts?.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
                    <p className="text-sm">{search ? "No chats found" : "No contacts yet"}</p>
                    {!search && (
                      <Link href="/new-contact" className="text-xs text-primary font-medium">
                        Create your first AI contact
                      </Link>
                    )}
                  </div>
                ) : (
                  <motion.div
                    initial="hidden" animate="show"
                    variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.03 } } }}
                  >
                    {filteredContacts?.map(contact => {
                      const hasUnread   = contact.unreadCount > 0;
                      const isThinking  = contact.activityState === "thinking";

                      return (
                        <motion.div
                          key={contact.id}
                          variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }}
                        >
                          <Link
                            href={`/chats/${contact.id}`}
                            className={`flex items-center gap-3 px-4 py-3.5 border-b border-border/15 transition-all active:bg-muted/30 ${
                              hasUnread ? "bg-primary/[0.035]" : ""
                            }`}
                          >
                            <div className="flex-shrink-0">
                              <ContactAvatar
                                src={contact.avatarUrl}
                                name={contact.name}
                                activityState={contact.activityState}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-[3px]">
                                <h3 className={`text-[15px] truncate pr-2 leading-snug ${
                                  hasUnread ? "font-bold text-foreground" : "font-semibold text-foreground/90"
                                }`}>
                                  {contact.name}
                                </h3>
                                {contact.lastMessageAt && (
                                  <span className={`text-[11px] whitespace-nowrap flex-shrink-0 ${
                                    hasUnread ? "text-primary font-bold" : "text-muted-foreground/70"
                                  }`}>
                                    {fmtTime(contact.lastMessageAt)}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <p className={`text-[13px] truncate flex-1 leading-snug ${
                                  hasUnread ? "text-foreground/75 font-medium" : "text-muted-foreground/80"
                                }`}>
                                  {isThinking ? (
                                    <span className="text-primary font-semibold">typing...</span>
                                  ) : (
                                    contact.lastMessage
                                      ? contact.lastMessage.startsWith("data:audio")
                                        ? "Voice note"
                                        : contact.lastMessage.startsWith("data:image")
                                          ? "Photo"
                                          : contact.lastMessage.slice(0, 55)
                                      : "Say hello"
                                  )}
                                </p>
                                {hasUnread && (
                                  <span className="flex-shrink-0 bg-primary text-primary-foreground text-[11px] font-bold h-[20px] min-w-[20px] px-1 flex items-center justify-center rounded-full shadow-sm shadow-primary/30">
                                    {contact.unreadCount > 9 ? "9+" : contact.unreadCount}
                                  </span>
                                )}
                              </div>
                            </div>
                          </Link>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                )}
              </div>
            </>
          )}

          {/* ━━ CHIVRA SPACES TAB ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {activeTab === "spaces" && (
            <div className="pb-4">
              <div className="px-4 py-4 flex items-center justify-between border-b border-border/25">
                <div>
                  <h2 className="font-bold text-base leading-tight">Chivra Spaces</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Stories from your world</p>
                </div>
                <Link
                  href="/status"
                  className="text-xs text-primary font-bold px-3 py-1.5 rounded-full bg-primary/10 active:bg-primary/20 transition-colors"
                >
                  See All
                </Link>
              </div>

              {isStatusLoading ? (
                <div className="p-4 space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-3.5 w-28" />
                        <Skeleton className="h-3 w-44" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : statusGroups.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 gap-2">
                  <p className="text-sm text-muted-foreground">No status updates in the last 24 hours</p>
                  <Link href="/status" className="text-xs text-primary font-medium">Go to Status</Link>
                </div>
              ) : (
                <div>
                  {statusGroups.map(group => {
                    const latest = group.statuses[group.statuses.length - 1];
                    return (
                      <Link
                        key={group.contact.id}
                        href="/status"
                        className="flex items-center gap-3 px-4 py-3.5 border-b border-border/15 active:bg-muted/30 transition-all"
                      >
                        <div className="p-[2.5px] rounded-full bg-gradient-to-tr from-violet-500 via-purple-500 to-pink-500 flex-shrink-0 shadow-sm shadow-primary/20">
                          <div className="p-[2px] rounded-full bg-background">
                            <ContactAvatar src={group.contact.avatarUrl} name={group.contact.name} size="md" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-[15px] leading-snug">{group.contact.name}</p>
                          <p className="text-[13px] text-muted-foreground truncate">
                            {latest?.imageUrl ? "Posted a photo" : latest?.content || "Posted a status"}
                          </p>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <p className="text-[11px] text-muted-foreground">
                            {latest ? fmtTime(latest.createdAt) : ""}
                          </p>
                          {group.statuses.length > 1 && (
                            <span className="text-[10px] text-primary font-semibold">{group.statuses.length} updates</span>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ━━ CALLS TAB ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {activeTab === "calls" && (
            <div className="pb-4">
              <div className="px-4 py-4 border-b border-border/25">
                <h2 className="font-bold text-base">Recent</h2>
              </div>

              {recentForCalls.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 gap-2">
                  <Phone className="h-10 w-10 text-muted-foreground/25" />
                  <p className="text-sm text-muted-foreground">No recent calls</p>
                </div>
              ) : (
                <div>
                  {recentForCalls.map(contact => (
                    <div
                      key={contact.id}
                      className="flex items-center gap-3 px-4 py-3.5 border-b border-border/15"
                    >
                      <Link href={`/chats/${contact.id}`} className="flex-shrink-0">
                        <ContactAvatar
                          src={contact.avatarUrl}
                          name={contact.name}
                          activityState={contact.activityState}
                        />
                      </Link>
                      <Link href={`/chats/${contact.id}`} className="flex-1 min-w-0">
                        <p className="font-semibold text-[15px] leading-snug">{contact.name}</p>
                        <p className="text-[12px] text-muted-foreground/70 flex items-center gap-1 mt-0.5">
                          <Phone className="h-[11px] w-[11px]" />
                          <span>Voice call</span>
                          {contact.lastMessageAt && (
                            <span className="text-muted-foreground/50">&middot; {fmtTime(contact.lastMessageAt)}</span>
                          )}
                        </p>
                      </Link>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => setCallState({
                            contact: { id: contact.id, name: contact.name, avatarUrl: contact.avatarUrl },
                            callType: "voice",
                          })}
                          className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center active:bg-primary/25 transition-all"
                        >
                          <Phone className="h-[17px] w-[17px] text-primary" />
                        </button>
                        <button
                          onClick={() => setCallState({
                            contact: { id: contact.id, name: contact.name, avatarUrl: contact.avatarUrl },
                            callType: "video",
                          })}
                          className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center active:bg-primary/25 transition-all"
                        >
                          <Video className="h-[17px] w-[17px] text-primary" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── FAB (Chats tab only) ───────────────────────────────────────────── */}
        <AnimatePresence>
          {activeTab === "chats" && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="absolute bottom-[76px] right-4 z-20"
            >
              <Link href="/new-contact">
                <button className="w-14 h-14 rounded-full bg-primary shadow-xl shadow-primary/40 flex items-center justify-center active:scale-95 transition-transform">
                  <PenSquare className="w-6 h-6 text-white" />
                </button>
              </Link>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </Layout>
  );
}
