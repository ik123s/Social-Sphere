import { useState } from "react";
import { Link } from "wouter";
import { useListContacts, useGetStatusFeed, useGetDashboardSummary } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { ContactAvatar } from "@/components/contact-avatar";
import { Input } from "@/components/ui/input";
import { Search, Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";

// Group status feed by contact (first status per contact)
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

export default function ChatList() {
  const [search, setSearch] = useState("");
  const { data: contacts, isLoading }     = useListContacts();
  const { data: summary }                 = useGetDashboardSummary();
  const { data: statusFeed }              = useGetStatusFeed();

  const statusContacts = statusFeed ? getStatusContacts(statusFeed) : [];

  const filteredContacts = contacts?.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout>
      <div className="flex flex-col h-full overflow-hidden">

        {/* Header */}
        <header className="px-4 pt-12 pb-3 bg-background/95 backdrop-blur z-10 sticky top-0 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-2xl font-bold tracking-tight">Chats</h1>
            {summary && summary.totalUnread > 0 && (
              <motion.span
                initial={{ scale: 0.8 }} animate={{ scale: 1 }}
                className="bg-primary text-primary-foreground text-xs font-bold px-2.5 py-1 rounded-full shadow-sm shadow-primary/30"
              >
                {summary.totalUnread} new
              </motion.span>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-muted/50 border-transparent focus-visible:ring-primary/50 rounded-xl h-10"
            />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {/* Status bubbles row */}
          {!search && statusContacts.length > 0 && (
            <div className="px-4 py-3 border-b border-border/50">
              <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-1">
                {/* My Status placeholder */}
                <Link href="/status" className="flex flex-col items-center gap-1.5 min-w-[56px]">
                  <div className="relative w-14 h-14 rounded-full bg-muted/60 border-2 border-dashed border-primary/40 flex items-center justify-center">
                    <Plus className="h-5 w-5 text-primary/70" />
                  </div>
                  <span className="text-[10px] text-muted-foreground w-14 text-center truncate">My Status</span>
                </Link>

                {statusContacts.map((sc) => (
                  <Link
                    key={sc.contactId}
                    href="/status"
                    className="flex flex-col items-center gap-1.5 min-w-[56px]"
                  >
                    <div className="p-0.5 rounded-full bg-gradient-to-tr from-violet-500 via-purple-500 to-pink-500 shadow-md shadow-primary/20">
                      <div className="p-0.5 rounded-full bg-background">
                        <ContactAvatar src={sc.avatarUrl} name={sc.contactName} size="md" />
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground w-14 text-center truncate">
                      {sc.contactName.split(" ")[0]}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Chat list */}
          <div className="px-2 py-2">
            {isLoading ? (
              <div className="space-y-1 px-2 pt-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-3 p-3">
                    <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="flex justify-between">
                        <Skeleton className="h-3.5 w-28" />
                        <Skeleton className="h-2.5 w-12" />
                      </div>
                      <Skeleton className="h-3 w-44" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredContacts?.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
                <p className="text-sm">No chats found</p>
              </div>
            ) : (
              <motion.div
                initial="hidden" animate="show"
                variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } }}
              >
                {filteredContacts?.map((contact) => {
                  const hasUnread = contact.unreadCount > 0;
                  const isThinking = contact.activityState === "thinking";

                  return (
                    <motion.div
                      key={contact.id}
                      variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
                    >
                      <Link
                        href={`/chats/${contact.id}`}
                        className={`flex items-center gap-3 px-3 py-3 rounded-2xl transition-all active:scale-[0.98] ${
                          hasUnread ? "bg-primary/5" : "hover:bg-muted/40"
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
                          <div className="flex items-center justify-between mb-0.5">
                            <h3 className={`text-sm truncate pr-2 ${hasUnread ? "font-bold" : "font-semibold"}`}>
                              {contact.name}
                            </h3>
                            {contact.lastMessageAt && (
                              <span className={`text-[10px] whitespace-nowrap flex-shrink-0 ${hasUnread ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                                {formatDistanceToNow(new Date(contact.lastMessageAt), { addSuffix: false }).replace("about ", "").replace(" minutes", "m").replace(" hours", "h").replace(" days", "d")}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <p className={`text-xs truncate flex-1 ${hasUnread ? "text-foreground/80" : "text-muted-foreground"}`}>
                              {isThinking ? (
                                <span className="text-primary font-medium">typing...</span>
                              ) : (
                                contact.lastMessage
                                  ? contact.lastMessage.startsWith("data:audio")
                                    ? "Voice note"
                                    : contact.lastMessage.startsWith("data:image")
                                      ? "Photo"
                                      : contact.lastMessage.slice(0, 60)
                                  : "No messages yet"
                              )}
                            </p>
                            {hasUnread && (
                              <span className="flex-shrink-0 bg-primary text-primary-foreground text-[10px] font-bold h-5 min-w-[20px] px-1 flex items-center justify-center rounded-full shadow-sm shadow-primary/30">
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
        </div>
      </div>
    </Layout>
  );
}
