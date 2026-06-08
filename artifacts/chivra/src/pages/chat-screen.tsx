import { useState, useRef, useEffect, useCallback, useMemo } from "react";
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
import { Button } from "@/components/ui/button";
import {
  Send, ArrowLeft, Phone, Video, Mic,
  Image as ImageIcon, X, Play, Pause, Reply, CheckCheck,
  MoreVertical, Search,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format, isToday, isYesterday } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import CallOverlay, { type CallContact, type CallType } from "@/components/call-overlay";
import { ContactShareCard } from "@/components/contact-share-card";

function formatMsgTime(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d))     return format(d, "h:mm a");
  if (isYesterday(d)) return "Yesterday " + format(d, "h:mm a");
  return format(d, "MMM d, h:mm a");
}

function formatLastSeen(state: string, lastSeenAt?: string | null): string {
  if (state === "thinking")  return "typing...";
  if (state === "recording") return "recording...";
  if (state === "online")    return "online";
  if (state === "idle")      return "idle";
  if (state === "sleeping")  return "sleeping";
  if (!lastSeenAt) return "last seen recently";
  const diffMs  = Date.now() - new Date(lastSeenAt).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 2)  return "last seen just now";
  if (diffMin < 60) return `last seen ${diffMin}m ago`;
  const diffH   = Math.floor(diffMin / 60);
  if (diffH < 24)   return `last seen ${diffH}h ago`;
  if (diffH < 48)   return "last seen yesterday";
  return "last seen a while ago";
}

function parseContactShare(content: string): { text: string; sharedContactId: number | null } {
  const match = content.match(/\[\[SHARE_CONTACT:(\d+)\]\]/);
  if (!match) return { text: content, sharedContactId: null };
  const text = content.replace(/\[\[SHARE_CONTACT:\d+\]\]/g, "").trim();
  return { text, sharedContactId: parseInt(match[1]!, 10) };
}

// ── Waveform voice player ─────────────────────────────────────────────────────
function VoiceNotePlayer({ src, isUser }: { src: string; isUser: boolean }) {
  const [playing, setPlaying]   = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const bars = useMemo(() => {
    const hash = src.slice(-40).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    return Array.from({ length: 30 }, (_, i) => {
      const seed = (hash * (i + 1) * 7919) % 100;
      return 15 + (seed % 72);
    });
  }, [src]);

  useEffect(() => {
    const audio = new Audio(src);
    audioRef.current = audio;
    audio.onloadedmetadata = () => setDuration(audio.duration);
    audio.ontimeupdate    = () => setProgress(audio.currentTime / (audio.duration || 1));
    audio.onended         = () => { setPlaying(false); setProgress(0); };
    return () => { audio.pause(); };
  }, [src]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.pause(); setPlaying(false); }
    else         { audio.play();  setPlaying(true);  }
  };

  const fmtDur = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return (
    <div className={`flex items-center gap-2.5 min-w-[180px] max-w-[240px] ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <button
        onClick={toggle}
        className={`h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all active:scale-95 ${
          isUser ? "bg-primary-foreground/20 hover:bg-primary-foreground/30" : "bg-primary/20 hover:bg-primary/30"
        }`}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
      </button>

      <div className="flex items-center gap-[2px] flex-1 h-8 overflow-hidden">
        {bars.map((h, i) => {
          const played = i / bars.length < progress;
          return (
            <div
              key={i}
              className={`rounded-full flex-shrink-0 transition-colors duration-75 ${
                isUser
                  ? played ? "bg-primary-foreground/80" : "bg-primary-foreground/25"
                  : played ? "bg-primary"               : "bg-primary/25"
              }`}
              style={{ width: 2.5, height: `${h}%`, minHeight: 3 }}
            />
          );
        })}
      </div>

      <span className={`text-[10px] font-mono flex-shrink-0 ${isUser ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
        {duration ? fmtDur(duration) : "0:00"}
      </span>
    </div>
  );
}

// ── Swipeable message wrapper ─────────────────────────────────────────────────
function SwipeableMessage({ children, onSwipeRight }: { children: React.ReactNode; onSwipeRight: () => void }) {
  const [dx, setDx]       = useState(0);
  const startXRef         = useRef(0);
  const isDraggingRef     = useRef(false);

  return (
    <div
      onTouchStart={(e) => {
        startXRef.current     = e.touches[0]!.clientX;
        isDraggingRef.current = true;
      }}
      onTouchMove={(e) => {
        if (!isDraggingRef.current) return;
        const diff = e.touches[0]!.clientX - startXRef.current;
        if (diff > 0 && diff <= 80) setDx(diff);
      }}
      onTouchEnd={() => {
        isDraggingRef.current = false;
        if (dx > 52) onSwipeRight();
        setDx(0);
      }}
      className="relative"
      style={{ transform: `translateX(${dx}px)`, transition: dx === 0 ? "transform 0.2s ease-out" : "none" }}
    >
      {dx > 20 && (
        <div className="absolute -left-8 top-1/2 -translate-y-1/2 text-primary opacity-80">
          <Reply className="h-4 w-4" />
        </div>
      )}
      {children}
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────
interface Msg {
  id: number;
  contactId: number;
  sender: string;
  content: string;
  messageType: string;
  isRead: boolean;
  createdAt: string;
  replyTo?: { sender: string; content: string } | null;
}

function MessageBubble({ msg, isSameGroup, isLast }: { msg: Msg; isSameGroup: boolean; isLast: boolean }) {
  const isUser = msg.sender === "user";

  const bubbleCls = `max-w-[82%] shadow-sm ${
    isUser
      ? `bg-primary text-primary-foreground ${isSameGroup ? "rounded-2xl rounded-tr-md" : "rounded-2xl rounded-tr-sm"}`
      : `bg-card border border-border/80 text-card-foreground ${isSameGroup ? "rounded-2xl rounded-tl-md" : "rounded-2xl rounded-tl-sm"}`
  }`;

  const replyBg  = isUser ? "bg-primary-foreground/15" : "bg-muted/60";
  const replyBar = isUser ? "bg-primary-foreground/60" : "bg-primary";

  return (
    <div className={`flex flex-col ${isUser ? "items-end" : "items-start"} gap-0.5`}>
      {msg.replyTo && (
        <div className={`${bubbleCls} px-3 pt-2 pb-1 mb-0.5 opacity-80`}>
          <div className={`flex gap-2 ${replyBg} rounded-xl p-2 mb-1`}>
            <div className={`w-0.5 rounded-full flex-shrink-0 ${replyBar}`} />
            <p className="text-[11px] truncate opacity-80">
              {msg.replyTo.sender === "user" ? "You" : msg.replyTo.content.slice(0, 60)}
            </p>
          </div>
        </div>
      )}

      {msg.messageType === "image" ? (
        <div className={`${bubbleCls} overflow-hidden`}>
          <img src={msg.content} alt="Shared" className="max-w-full rounded-2xl object-cover" style={{ maxHeight: 280 }} />
        </div>
      ) : msg.messageType === "audio" ? (
        <div className={`${bubbleCls} px-3 py-2.5`}>
          <VoiceNotePlayer src={msg.content} isUser={isUser} />
        </div>
      ) : (
        <div className={`${bubbleCls} px-4 py-2.5 text-[15px] leading-relaxed break-words`}>
          {msg.content}
        </div>
      )}

      {isUser && isLast && msg.messageType === "text" && (
        <div className="flex items-center gap-1 mr-1">
          <CheckCheck className="h-3 w-3 text-primary/60" />
          <span className="text-[9px] text-muted-foreground/50">Delivered</span>
        </div>
      )}
    </div>
  );
}

// ── Mic permission modal ──────────────────────────────────────────────────────
function MicPermissionModal({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="w-full bg-card rounded-t-3xl p-6 pb-10 border-t border-border space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center"><div className="w-10 h-1 bg-muted rounded-full" /></div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-primary/15 flex items-center justify-center">
            <Mic className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm">Microphone Access Required</p>
            <p className="text-xs text-muted-foreground">Allow microphone to send voice notes</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          To send voice notes, Chivra needs access to your microphone. Please allow microphone permission in your browser settings, then try again.
        </p>
        <Button className="w-full rounded-2xl" onClick={onClose}>Got it</Button>
      </motion.div>
    </motion.div>
  );
}

// Strip [[SEND_IMAGE:...]] tokens from display text
const SEND_IMAGE_DISPLAY_RE = /\[\[SEND_IMAGE:[^\]]*\]?\]?/g;
function stripSendImageToken(text: string) {
  return text.replace(SEND_IMAGE_DISPLAY_RE, "").trim();
}

// ── Chat screen ───────────────────────────────────────────────────────────────
export default function ChatScreen() {
  const { id }      = useParams<{ id: string }>();
  const contactId   = parseInt(id || "0", 10);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast }   = useToast();

  const { data: contact, isLoading: isContactLoading } = useGetContact(contactId);
  const { data: activity }   = useGetContactActivity(contactId, { query: { refetchInterval: 3000 } as any });
  const { data: initialMessages, isLoading: isMessagesLoading } = useListMessages(contactId, { limit: 50 }, {});
  const markRead             = useMarkMessagesRead();

  const [messages,         setMessages]         = useState<Msg[]>([]);
  const [input,            setInput]            = useState("");
  const [isTyping,         setIsTyping]         = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [isSending,        setIsSending]        = useState(false);
  const [replyTo,          setReplyTo]          = useState<{ sender: string; content: string } | null>(null);
  const [showMicModal,     setShowMicModal]     = useState(false);

  // Image
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voice recording
  const [isRecording,    setIsRecording]    = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef   = useRef<Blob[]>([]);
  const recordTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  // Call state
  const [callState, setCallState] = useState<{ callType: CallType } | null>(null);

  // Chat menu + search
  const [showMenu,     setShowMenu]     = useState(false);
  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery,  setSearchQuery]  = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef    = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback((smooth = false) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "instant" });
  }, []);

  // Filtered messages for search
  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return messages;
    const q = searchQuery.toLowerCase();
    return messages.filter(m => m.messageType === "text" && m.content.toLowerCase().includes(q));
  }, [messages, searchQuery]);

  useEffect(() => {
    if (initialMessages) {
      setMessages(initialMessages as Msg[]);
      const hasUnread = initialMessages.some(m => !m.isRead && m.sender === "ai");
      if (hasUnread) {
        markRead.mutate({ id: contactId }, {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListContactsQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          }
        });
      }
    }
  }, [initialMessages, contactId]);

  useEffect(() => { scrollToBottom(); }, [messages, streamingMessage, isTyping]);

  // Paste image from clipboard
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      if (isRecording) return;
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
  }, [isRecording]);

  // Auto-grow textarea helper
  const autoGrow = (el: HTMLTextAreaElement) => {
    el.style.height = "44px";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  // ── Send message ────────────────────────────────────────────────────────────
  const sendMessage = async (content: string, messageType: "text" | "image" | "audio" = "text") => {
    if (!content || !contactId || isSending) return;
    setIsSending(true);

    const optimistic: Msg = {
      id: Date.now(),
      contactId,
      sender: "user",
      content,
      messageType,
      isRead: true,
      createdAt: new Date().toISOString(),
      replyTo: replyTo,
    };
    setMessages(prev => [...prev, optimistic]);
    setReplyTo(null);
    setImagePreview(null);
    scrollToBottom(true);

    if (messageType !== "text") {
      try {
        await fetch(`/api/contacts/${contactId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, messageType }),
        });
        queryClient.invalidateQueries({ queryKey: getListContactsQueryKey() });
      } catch { /* ignore */ }
      setIsSending(false);
      return;
    }

    setIsTyping(true);
    try {
      const res = await fetch(`/api/contacts/${contactId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, messageType: "text" }),
      });
      if (!res.ok) throw new Error();
      await new Promise(r => setTimeout(r, 500 + Math.random() * 800));
      setIsTyping(false);
      setStreamingMessage("");

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (reader) {
        let fullAiMessage = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          for (const line of decoder.decode(value).split("\n")) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.content) {
                  fullAiMessage += data.content;
                  setStreamingMessage(stripSendImageToken(fullAiMessage));
                }
              } catch { /* ignore */ }
            }
          }
        }
        if (fullAiMessage) {
          const displayMsg = stripSendImageToken(fullAiMessage);
          setMessages(prev => [...prev, {
            id: Date.now() + 1, contactId, sender: "ai", content: displayMsg || fullAiMessage,
            messageType: "text", isRead: true, createdAt: new Date().toISOString(),
          }]);
          setStreamingMessage("");
          queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey(contactId) });
          queryClient.invalidateQueries({ queryKey: getListContactsQueryKey() });
          // Re-fetch after delay to pick up any AI-generated image (image gen takes ~10s)
          setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey(contactId) });
          }, 13000);
        }
      }
    } catch {
      setIsTyping(false);
      setStreamingMessage("");
    } finally {
      setIsSending(false);
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (imagePreview) { sendMessage(imagePreview, "image"); return; }
    if (!input.trim()) return;
    const msg = input.trim();
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "44px";
    sendMessage(msg, "text");
  };

  // ── Image picker ────────────────────────────────────────────────────────────
  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Voice recording ─────────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob   = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onload = (ev) => sendMessage(ev.target?.result as string, "audio");
        reader.readAsDataURL(blob);
        if (recordTimerRef.current) clearInterval(recordTimerRef.current);
        setRecordDuration(0);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordDuration(0);
      recordTimerRef.current = setInterval(() => setRecordDuration(d => d + 1), 1000);
    } catch {
      setShowMicModal(true);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream?.getTracks().forEach(t => t.stop());
    }
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    setIsRecording(false);
    setRecordDuration(0);
    audioChunksRef.current = [];
  };

  const currentState   = activity?.activityState || contact?.activityState || "online";
  const activityLabel  = formatLastSeen(currentState, activity?.lastSeenAt);
  const isOfflineState = currentState === "offline" || currentState === "sleeping" || currentState === "idle";

  const callContact: CallContact | null = contact
    ? { id: contact.id, name: contact.name, avatarUrl: contact.avatarUrl }
    : null;

  return (
    <Layout showNav={false}>
      <div className="flex flex-col h-full bg-background relative">

        {/* ── Call overlay ─────────────────────────────────────────────────── */}
        <AnimatePresence>
          {callState && callContact && (
            <CallOverlay
              contact={callContact}
              callType={callState.callType}
              onEnd={() => setCallState(null)}
            />
          )}
        </AnimatePresence>

        {/* ── Mic permission modal ─────────────────────────────────────────── */}
        <AnimatePresence>
          {showMicModal && <MicPermissionModal onClose={() => setShowMicModal(false)} />}
        </AnimatePresence>

        {/* ── Click-away to close menu ─────────────────────────────────────── */}
        {showMenu && (
          <div className="absolute inset-0 z-40" onClick={() => setShowMenu(false)} />
        )}

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <header className="px-3 py-2.5 bg-card/95 backdrop-blur-xl border-b border-border flex flex-col z-10 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full flex-shrink-0" onClick={() => setLocation("/chats")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              {isContactLoading ? (
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-1"><Skeleton className="h-3 w-24" /><Skeleton className="h-2 w-16" /></div>
                </div>
              ) : contact ? (
                <Link href={`/contacts/${contact.id}`} className="flex items-center gap-2.5 min-w-0">
                  <ContactAvatar src={contact.avatarUrl} name={contact.name} activityState={activity?.activityState || contact.activityState} size="sm" />
                  <div className="min-w-0">
                    <h2 className="font-semibold text-sm leading-tight truncate">{contact.name}</h2>
                    <motion.p
                      key={activityLabel}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className={`text-[10px] ${
                        activityLabel === "typing..."
                          ? "text-primary font-medium"
                          : isOfflineState
                            ? "text-muted-foreground/60"
                            : "text-muted-foreground"
                      }`}
                    >
                      {activityLabel}
                    </motion.p>
                  </div>
                </Link>
              ) : null}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost" size="icon"
                className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
                onClick={() => setCallState({ callType: "voice" })}
              >
                <Phone className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost" size="icon"
                className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
                onClick={() => setCallState({ callType: "video" })}
              >
                <Video className="h-4 w-4" />
              </Button>

              {/* 3-dot menu */}
              <div className="relative z-50">
                <Button
                  variant="ghost" size="icon"
                  className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
                  onClick={() => setShowMenu(v => !v)}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
                <AnimatePresence>
                  {showMenu && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -4 }}
                      transition={{ duration: 0.12 }}
                      className="absolute right-0 top-10 w-52 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
                    >
                      {[
                        {
                          label: "View contact",
                          action: () => { setLocation(`/contacts/${contact?.id}`); setShowMenu(false); },
                        },
                        {
                          label: searchActive ? "Close search" : "Search messages",
                          action: () => { setSearchActive(v => !v); if (searchActive) setSearchQuery(""); setShowMenu(false); },
                        },
                        {
                          label: "Clear chat",
                          action: () => {
                            setMessages([]);
                            setShowMenu(false);
                            toast({ title: "Chat cleared" });
                          },
                        },
                      ].map(item => (
                        <button
                          key={item.label}
                          onClick={item.action}
                          className="w-full text-left px-4 py-3 text-sm hover:bg-muted/50 transition-colors border-b border-border/30 last:border-0"
                        >
                          {item.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Search bar */}
          <AnimatePresence>
            {searchActive && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-2 pt-2.5">
                  <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <input
                    autoFocus
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search in conversation..."
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
                  />
                  {searchQuery && (
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">
                      {filteredMessages.length} result{filteredMessages.length !== 1 ? "s" : ""}
                    </span>
                  )}
                  <button onClick={() => { setSearchActive(false); setSearchQuery(""); }} className="flex-shrink-0">
                    <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </header>

        {/* ── Messages ────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-3 py-3 scrollbar-hide">
          {isMessagesLoading ? (
            <div className="flex justify-center pt-8">
              <span className="text-xs text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">Loading...</span>
            </div>
          ) : (
            <div className="flex flex-col gap-1 min-h-full justify-end">
              {searchActive && searchQuery && filteredMessages.length === 0 && (
                <div className="flex justify-center py-8">
                  <span className="text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">No messages found</span>
                </div>
              )}
              <AnimatePresence initial={false}>
                {filteredMessages.map((msg, idx) => {
                  const isUser    = msg.sender === "user";
                  const prevMsg   = filteredMessages[idx - 1];
                  const showTime  = !prevMsg || new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime() > 5 * 60 * 1000;
                  const isSameGroup = !!(prevMsg && prevMsg.sender === msg.sender && !showTime);
                  const isLastUser = isUser && filteredMessages.slice(idx + 1).every(m => m.sender !== "user");

                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 32 }}
                      className={`flex flex-col ${isUser ? "items-end" : "items-start"} ${isSameGroup ? "mt-0.5" : "mt-3"}`}
                    >
                      {showTime && (
                        <span className="text-[10px] text-muted-foreground self-center mb-1.5 mt-1 bg-muted/40 px-2.5 py-0.5 rounded-full">
                          {formatMsgTime(msg.createdAt)}
                        </span>
                      )}
                      <SwipeableMessage onSwipeRight={() => setReplyTo({ sender: msg.sender, content: msg.content })}>
                        {(() => {
                          const isAi = msg.sender === "ai" && msg.messageType === "text";
                          const parsed = isAi ? parseContactShare(msg.content) : null;
                          const displayMsg = parsed && parsed.sharedContactId
                            ? { ...msg, content: parsed.text }
                            : msg;
                          return (
                            <div className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
                              {displayMsg.content && (
                                <MessageBubble msg={displayMsg} isSameGroup={isSameGroup} isLast={isLastUser} />
                              )}
                              {parsed?.sharedContactId && (
                                <ContactShareCard
                                  contactId={parsed.sharedContactId}
                                  referredBy={contact?.name}
                                />
                              )}
                            </div>
                          );
                        })()}
                      </SwipeableMessage>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {/* Typing indicator */}
              {isTyping && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="flex items-start mt-3"
                >
                  <div className="bg-card border border-border rounded-2xl rounded-tl-sm shadow-sm py-3 px-4">
                    <TypingIndicator />
                  </div>
                </motion.div>
              )}

              {/* Streaming */}
              {streamingMessage && !isTyping && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-start mt-3">
                  <div className="max-w-[82%] px-4 py-2.5 rounded-2xl rounded-tl-sm shadow-sm text-[15px] leading-relaxed bg-card border border-primary/20 text-card-foreground">
                    {streamingMessage}
                    <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-primary/70 animate-pulse align-middle rounded-sm" />
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} className="h-2" />
            </div>
          )}
        </div>

        {/* ── Input area ──────────────────────────────────────────────────── */}
        <div className="px-3 py-2.5 bg-card/90 backdrop-blur-md border-t border-border flex-shrink-0 space-y-2">

          {/* Reply preview */}
          <AnimatePresence>
            {replyTo && (
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 bg-muted/50 rounded-xl px-3 py-2"
              >
                <div className="w-0.5 h-8 bg-primary rounded-full flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-primary font-medium">{replyTo.sender === "user" ? "You" : contact?.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{replyTo.content.slice(0, 80)}</p>
                </div>
                <button onClick={() => setReplyTo(null)} className="text-muted-foreground hover:text-foreground flex-shrink-0">
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Image preview */}
          <AnimatePresence>
            {imagePreview && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="relative w-fit">
                <img src={imagePreview} alt="Preview" className="h-24 rounded-xl object-cover border border-border shadow-sm" />
                <button onClick={() => setImagePreview(null)} className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5 shadow">
                  <X className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Recording UI */}
          <AnimatePresence>
            {isRecording && (
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                className="flex items-center gap-3 bg-destructive/10 border border-destructive/30 rounded-2xl px-4 py-3"
              >
                <div className="flex items-center gap-2 flex-1">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 0.8 }}
                    className="w-2.5 h-2.5 rounded-full bg-destructive"
                  />
                  <span className="text-sm font-mono font-semibold text-destructive">
                    {String(Math.floor(recordDuration / 60)).padStart(2, "0")}:{String(recordDuration % 60).padStart(2, "0")}
                  </span>
                  <span className="text-xs text-muted-foreground">Recording</span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={cancelRecording} className="h-8 text-xs text-muted-foreground">Cancel</Button>
                  <Button size="sm" onClick={stopRecording} className="h-8 px-4 rounded-xl text-xs font-semibold bg-destructive hover:bg-destructive/90">Send</Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input bar */}
          {!isRecording && (
            <form onSubmit={handleSend} className="flex items-end gap-2">
              <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleImagePick} />

              {/* Attach */}
              <Button type="button" variant="ghost" size="icon"
                className="h-10 w-10 rounded-full flex-shrink-0 text-muted-foreground hover:text-foreground mb-0.5"
                onClick={() => fileInputRef.current?.click()} disabled={isSending}
              >
                <ImageIcon className="h-5 w-5" />
              </Button>

              {/* Multiline auto-grow textarea */}
              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  value={input}
                  rows={1}
                  disabled={isSending}
                  placeholder={imagePreview ? "Add a caption..." : "Message..."}
                  onChange={e => {
                    setInput(e.target.value);
                    autoGrow(e.currentTarget);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (imagePreview || input.trim()) handleSend(e as any);
                    }
                  }}
                  className="w-full min-h-[44px] max-h-[120px] resize-none py-2.5 pl-3.5 pr-12 bg-muted/40 border border-transparent focus:outline-none focus:ring-1 focus:ring-primary/30 rounded-2xl text-[15px] leading-relaxed overflow-y-auto placeholder:text-muted-foreground/60"
                  style={{ height: "44px" }}
                />
                {(input.trim() || imagePreview) ? (
                  <Button type="submit" size="icon" disabled={isSending}
                    className="absolute right-1.5 bottom-[5px] h-8 w-8 rounded-xl bg-primary flex-shrink-0"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <Button type="button" size="icon" onClick={startRecording}
                    className="absolute right-1.5 bottom-[5px] h-8 w-8 rounded-xl bg-transparent text-muted-foreground hover:text-primary hover:bg-primary/10"
                  >
                    <Mic className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </Layout>
  );
}
