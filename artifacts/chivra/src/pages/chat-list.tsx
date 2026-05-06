import { useState } from "react";
import { Link } from "wouter";
import { useListContacts, useGetDashboardSummary } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { ContactAvatar } from "@/components/contact-avatar";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";

export default function ChatList() {
  const [search, setSearch] = useState("");
  const { data: contacts, isLoading } = useListContacts();
  const { data: summary } = useGetDashboardSummary();

  const filteredContacts = contacts?.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout>
      <div className="flex flex-col min-h-full">
        <header className="px-4 pt-12 pb-4 bg-background/95 backdrop-blur z-10 sticky top-0 border-b border-border shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-semibold tracking-tight">Chats</h1>
            {summary && summary.totalUnread > 0 && (
              <span className="bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded-full">
                {summary.totalUnread} new
              </span>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search contacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-muted/50 border-transparent focus-visible:ring-primary/50 rounded-xl"
            />
          </div>
        </header>

        <div className="flex-1 px-2 py-2">
          {isLoading ? (
            <div className="space-y-4 px-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredContacts?.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <p>No contacts found.</p>
            </div>
          ) : (
            <motion.div
              initial="hidden"
              animate="show"
              variants={{
                hidden: { opacity: 0 },
                show: {
                  opacity: 1,
                  transition: { staggerChildren: 0.05 }
                }
              }}
              className="space-y-1"
            >
              {filteredContacts?.map((contact) => (
                <motion.div
                  key={contact.id}
                  variants={{
                    hidden: { opacity: 0, y: 10 },
                    show: { opacity: 1, y: 0 }
                  }}
                >
                  <Link
                    href={`/chats/${contact.id}`}
                    className="flex items-center gap-3 p-3 rounded-2xl hover:bg-muted/50 transition-colors active:scale-[0.98]"
                  >
                    <ContactAvatar
                      src={contact.avatarUrl}
                      name={contact.name}
                      activityState={contact.activityState}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold text-sm truncate pr-2">{contact.name}</h3>
                        {contact.lastMessageAt && (
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {formatDistanceToNow(new Date(contact.lastMessageAt), { addSuffix: true }).replace("about ", "")}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground truncate pr-4">
                          {contact.lastMessage || "No messages yet"}
                        </p>
                        {contact.unreadCount > 0 && (
                          <span className="flex-shrink-0 bg-primary text-primary-foreground text-[10px] font-bold h-5 w-5 flex items-center justify-center rounded-full shadow-sm">
                            {contact.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </div>
    </Layout>
  );
}