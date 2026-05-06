import { useState, useRef, useEffect } from "react";
import { useLocation, useParams, Link } from "wouter";
import { 
  useGetContact, 
  useGetContactActivity, 
  useListMessages, 
  useMarkMessagesRead,
  getListMessagesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { ContactAvatar } from "@/components/contact-avatar";
import { TypingIndicator } from "@/components/typing-indicator";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, ArrowLeft, MoreVertical, Mic } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

export default function ChatScreen() {
  const { id } = useParams<{ id: string }>();
  const contactId = parseInt(id || "0", 10);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  const { data: contact, isLoading: isContactLoading } = useGetContact(contactId);
  const { data: activity } = useGetContactActivity(contactId);
  const { data: initialMessages, isLoading: isMessagesLoading } = useListMessages(contactId, { limit: 50 });
  const markRead = useMarkMessagesRead();
  
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialMessages) {
      setMessages(initialMessages.slice().reverse());
      
      const unreadIds = initialMessages
        .filter((m) => !m.isRead && m.sender === "ai")
        .map((m) => m.id);
        
      if (unreadIds.length > 0) {
        markRead.mutate({ data: { messageIds: unreadIds } });
      }
    }
  }, [initialMessages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingMessage, isTyping]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !contactId) return;

    const userMsg = input.trim();
    setInput("");
    
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

    try {
      const res = await fetch(`/api/contacts/${contactId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: userMsg, messageType: "text" }),
      });

      if (!res.ok) throw new Error("Failed to send message");
      
      // Delay before showing streaming to simulate typing
      await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 500));
      
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
              if (dataStr === "[DONE]") break;
              try {
                const data = JSON.parse(dataStr);
                if (data.content) {
                  fullAiMessage += data.content;
                  setStreamingMessage(fullAiMessage);
                }
              } catch (err) {}
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
        }
      }
    } catch (error) {
      setIsTyping(false);
      setStreamingMessage("");
    }
  };

  return (
    <Layout showNav={false}>
      <div className="flex flex-col h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed bg-background/95">
        <header className="px-4 py-3 bg-card/90 backdrop-blur-xl border-b border-border shadow-sm flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setLocation("/chats")}>
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
              <Link href={`/contacts/${contact.id}`} className="flex items-center gap-3 cursor-pointer">
                <ContactAvatar 
                  src={contact.avatarUrl} 
                  name={contact.name} 
                  activityState={activity?.activityState || contact.activityState} 
                  size="sm" 
                />
                <div>
                  <h2 className="font-semibold text-sm leading-tight">{contact.name}</h2>
                  <p className="text-[10px] text-muted-foreground capitalize flex items-center gap-1">
                    {activity?.activityState === "thinking" ? "thinking..." : activity?.activityState || contact.activityState}
                  </p>
                </div>
              </Link>
            ) : null}
          </div>
          
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
            <MoreVertical className="h-5 w-5 text-muted-foreground" />
          </Button>
        </header>

        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-6 space-y-4 scrollbar-hide"
        >
          {isMessagesLoading ? (
            <div className="flex justify-center">
              <span className="text-xs text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">Loading history...</span>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {messages.map((msg, idx) => {
                const isUser = msg.sender === "user";
                const showTime = idx === 0 || new Date(msg.createdAt).getTime() - new Date(messages[idx-1].createdAt).getTime() > 1000 * 60 * 5;
                
                return (
                  <motion.div 
                    key={msg.id}
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                  >
                    {showTime && (
                      <span className="text-[10px] text-muted-foreground mb-3 mt-1 self-center bg-card/40 px-2 py-0.5 rounded-full backdrop-blur-sm">
                        {format(new Date(msg.createdAt), "MMM d, h:mm a")}
                      </span>
                    )}
                    <div 
                      className={`max-w-[85%] px-4 py-2.5 rounded-2xl shadow-sm text-[15px] leading-snug break-words ${
                        isUser 
                          ? "bg-primary text-primary-foreground rounded-tr-sm" 
                          : "bg-card border border-border text-card-foreground rounded-tl-sm"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </motion.div>
                );
              })}
              
              {isTyping && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start"
                >
                  <div className="bg-card border border-border rounded-2xl rounded-tl-sm shadow-sm py-2 px-1 w-16 flex items-center justify-center">
                    <TypingIndicator />
                  </div>
                </motion.div>
              )}
              
              {streamingMessage && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start"
                >
                  <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-tl-sm shadow-sm text-[15px] leading-snug bg-card border border-primary/30 text-card-foreground">
                    {streamingMessage}
                    <span className="inline-block w-1.5 h-4 ml-1 bg-primary/60 animate-pulse align-middle" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>

        <div className="px-3 py-3 bg-background/80 backdrop-blur-md border-t border-border pb-safe">
          <form onSubmit={handleSend} className="flex items-end gap-2">
            <Button type="button" variant="secondary" size="icon" className="h-10 w-10 rounded-full flex-shrink-0 self-end mb-0.5">
              <Mic className="h-5 w-5" />
            </Button>
            <div className="flex-1 relative">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Message..."
                className="pr-12 py-3 h-auto min-h-[44px] max-h-32 bg-card border-border rounded-2xl focus-visible:ring-primary/30 text-[15px]"
              />
              <Button 
                type="submit" 
                size="icon" 
                disabled={!input.trim()}
                className="absolute right-1 bottom-1 h-9 w-9 rounded-xl bg-primary text-primary-foreground disabled:opacity-50 transition-all"
              >
                <Send className="h-4 w-4 ml-0.5" />
              </Button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
}