import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation, useParams, Link } from "wouter";
import { 
  useGetContact, 
  useGetContactActivity, 
  useListMessages, 
  useMarkMessagesRead,
  getListMessagesQueryKey,
  getListContactsQueryKey,
  getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { ContactAvatar } from "@/components/contact-avatar";
import { TypingIndicator } from "@/components/typing-indicator";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, ArrowLeft, MoreVertical } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format, isToday, isYesterday } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

function formatMsgTime(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, "h:mm a");
  if (isYesterday(d)) return "Yesterday " + format(d, "h:mm a");
  return format(d, "MMM d, h:mm a");
}

export default function ChatScreen() {
  const { id } = useParams<{ id: string }>();
  const contactId = parseInt(id || "0", 10);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  const { data: contact, isLoading: isContactLoading } = useGetContact(contactId);
  const { data: activity } = useGetContactActivity(contactId, { refetchInterval: 3000 });
  const { data: initialMessages, isLoading: isMessagesLoading } = useListMessages(contactId, { limit: 50 });
  const markRead = useMarkMessagesRead();
  
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback((smooth = false) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "instant" });
  }, []);

  // Load messages — API returns them oldest-first already
  useEffect(() => {
    if (initialMessages) {
      setMessages(initialMessages);
      
      // Mark unread messages as read and clear badges
      const hasUnread = initialMessages.some((m) => !m.isRead && m.sender === "ai");
      if (hasUnread) {
        markRead.mutate(
          { id: contactId, data: {} },
          {
            onSuccess: () => {
              queryClient.invalidateQueries({ queryKey: getListContactsQueryKey() });
              queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
            }
          }
        );
      }
    }
  }, [initialMessages, contactId]);

  // Always scroll to bottom when messages or streaming content changes
  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage, isTyping]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !contactId || isSending) return;

    const userMsg = input.trim();
    setInput("");
    setIsSending(true);
    
    const optimisticUserMsg = {
      id: Date.now(),
      contactId,
      sender: "user",
      content: userMsg,
      messageType: "text",
      isRead: true,
      createdAt: new Date().toISOString(),
    };
    
    setMessages((prev) => [...prev, optimisticUserMsg]);
    setIsTyping(true);
    scrollToBottom(true);

    try {
      const res = await fetch(`/api/contacts/${contactId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: userMsg, messageType: "text" }),
      });

      if (!res.ok) throw new Error("Failed to send message");
      
      // Simulate typing delay before streaming starts
      await new Promise((resolve) => setTimeout(resolve, 600 + Math.random() * 600));
      setIsTyping(false);
      setStreamingMessage("");

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      
      if (reader) {
        let fullAiMessage = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");
          
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const dataStr = line.slice(6);
              try {
                const data = JSON.parse(dataStr);
                if (data.content) {
                  fullAiMessage += data.content;
                  setStreamingMessage(fullAiMessage);
                }
              } catch { /* ignore */ }
            }
          }
        }
        
        if (fullAiMessage) {
          const finalAiMsg = {
            id: Date.now() + 1,
            contactId,
            sender: "ai",
            content: fullAiMessage,
            messageType: "text",
            isRead: true,
            createdAt: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, finalAiMsg]);
          setStreamingMessage("");
          queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey(contactId) });
          queryClient.invalidateQueries({ queryKey: getListContactsQueryKey() });
        }
      }
    } catch {
      setIsTyping(false);
      setStreamingMessage("");
    } finally {
      setIsSending(false);
    }
  };

  const activityLabel = activity?.activityState === "thinking"
    ? "typing..."
    : activity?.activityState || contact?.activityState || "online";

  return (
    <Layout showNav={false}>
      <div className="flex flex-col h-full bg-background">
        {/* Header */}
        <header className="px-4 py-3 bg-card/95 backdrop-blur-xl border-b border-border flex items-center justify-between z-10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => setLocation("/chats")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            
            {isContactLoading ? (
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-1">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-2 w-16" />
                </div>
              </div>
            ) : contact ? (
              <Link href={`/contacts/${contact.id}`} className="flex items-center gap-3">
                <ContactAvatar 
                  src={contact.avatarUrl} 
                  name={contact.name} 
                  activityState={activity?.activityState || contact.activityState} 
                  size="sm" 
                />
                <div>
                  <h2 className="font-semibold text-sm leading-tight">{contact.name}</h2>
                  <p className="text-[10px] text-muted-foreground capitalize">
                    {activityLabel}
                  </p>
                </div>
              </Link>
            ) : null}
          </div>
          
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
            <MoreVertical className="h-5 w-5 text-muted-foreground" />
          </Button>
        </header>

        {/* Messages — scrollable, fills remaining space */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto px-4 py-4 scrollbar-hide"
        >
          {isMessagesLoading ? (
            <div className="flex justify-center pt-8">
              <span className="text-xs text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">Loading...</span>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 min-h-full justify-end">
              <AnimatePresence initial={false}>
                {messages.map((msg, idx) => {
                  const isUser = msg.sender === "user";
                  const prevMsg = messages[idx - 1];
                  const showTime = !prevMsg || 
                    new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime() > 5 * 60 * 1000;
                  const isSameGroup = prevMsg && prevMsg.sender === msg.sender && !showTime;
                  
                  return (
                    <motion.div 
                      key={msg.id}
                      initial={{ opacity: 0, y: 8, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      className={`flex flex-col ${isUser ? "items-end" : "items-start"} ${isSameGroup ? "mt-0.5" : "mt-3"}`}
                    >
                      {showTime && (
                        <span className="text-[10px] text-muted-foreground self-center mb-2 mt-1 bg-muted/40 px-2.5 py-0.5 rounded-full backdrop-blur-sm">
                          {formatMsgTime(msg.createdAt)}
                        </span>
                      )}
                      <div 
                        className={`max-w-[80%] px-4 py-2.5 text-[15px] leading-snug break-words shadow-sm ${
                          isUser 
                            ? `bg-primary text-primary-foreground ${isSameGroup ? "rounded-2xl rounded-tr-md" : "rounded-2xl rounded-tr-sm"}`
                            : `bg-card border border-border text-card-foreground ${isSameGroup ? "rounded-2xl rounded-tl-md" : "rounded-2xl rounded-tl-sm"}`
                        }`}
                      >
                        {msg.content}
                      </div>
                      {isUser && idx === messages.length - 1 && (
                        <span className="text-[9px] text-muted-foreground/60 mt-0.5 mr-1">Delivered</span>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {/* Typing indicator */}
              {isTyping && (
                <motion.div 
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="flex items-start mt-3"
                >
                  <div className="bg-card border border-border rounded-2xl rounded-tl-sm shadow-sm py-3 px-4 flex items-center gap-1.5">
                    <TypingIndicator />
                  </div>
                </motion.div>
              )}

              {/* Streaming message */}
              {streamingMessage && !isTyping && (
                <motion.div 
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start mt-3"
                >
                  <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-tl-sm shadow-sm text-[15px] leading-snug bg-card border border-primary/20 text-card-foreground">
                    {streamingMessage}
                    <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-primary/70 animate-pulse align-middle rounded-sm" />
                  </div>
                </motion.div>
              )}

              {/* Anchor for scroll-to-bottom */}
              <div ref={messagesEndRef} className="h-2" />
            </div>
          )}
        </div>

        {/* Input bar */}
        <div className="px-3 py-3 bg-card/80 backdrop-blur-md border-t border-border flex-shrink-0">
          <form onSubmit={handleSend} className="flex items-end gap-2">
            <div className="flex-1 relative">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(e as any);
                  }
                }}
                placeholder="Message..."
                className="py-3 h-auto min-h-[44px] bg-background border-border rounded-2xl focus-visible:ring-primary/30 text-[15px] pr-14"
                disabled={isSending}
              />
              <Button 
                type="submit" 
                size="icon" 
                disabled={!input.trim() || isSending}
                className="absolute right-1.5 bottom-1.5 h-8 w-8 rounded-xl bg-primary text-primary-foreground disabled:opacity-40 transition-all"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
}
