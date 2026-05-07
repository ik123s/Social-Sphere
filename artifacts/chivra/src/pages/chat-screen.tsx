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
import { Send, ArrowLeft, MoreVertical, Mic, MicOff, Image as ImageIcon, X, Play, Pause } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format, isToday, isYesterday } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

function formatMsgTime(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, "h:mm a");
  if (isYesterday(d)) return "Yesterday " + format(d, "h:mm a");
  return format(d, "MMM d, h:mm a");
}

function formatDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// ── Voice Note Player ─────────────────────────────────────────────────────────
function VoiceNotePlayer({ src, isUser }: { src: string; isUser: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(src);
    audioRef.current = audio;
    audio.onloadedmetadata = () => setDuration(audio.duration);
    audio.ontimeupdate = () => setProgress(audio.currentTime / (audio.duration || 1));
    audio.onended = () => { setPlaying(false); setProgress(0); };
    return () => { audio.pause(); };
  }, [src]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.pause(); setPlaying(false); }
    else { audio.play(); setPlaying(true); }
  };

  return (
    <div className={`flex items-center gap-2 min-w-[160px] ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <button
        onClick={toggle}
        className={`h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
          isUser ? "bg-primary-foreground/20 hover:bg-primary-foreground/30" : "bg-primary/20 hover:bg-primary/30"
        }`}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
      </button>
      <div className="flex-1 space-y-1">
        <div className={`h-1 rounded-full overflow-hidden ${isUser ? "bg-primary-foreground/20" : "bg-primary/15"}`}>
          <div
            className={`h-full rounded-full transition-all ${isUser ? "bg-primary-foreground/70" : "bg-primary"}`}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <p className={`text-[10px] ${isUser ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
          {duration ? formatDuration(duration * 1000) : "0:00"}
        </p>
      </div>
      <Mic className={`h-3.5 w-3.5 flex-shrink-0 ${isUser ? "text-primary-foreground/50" : "text-muted-foreground"}`} />
    </div>
  );
}

// ── Message Bubble ────────────────────────────────────────────────────────────
function MessageBubble({ msg, isSameGroup }: { msg: any; isSameGroup: boolean }) {
  const isUser = msg.sender === "user";

  const bubble = `max-w-[82%] shadow-sm ${
    isUser
      ? `bg-primary text-primary-foreground ${isSameGroup ? "rounded-2xl rounded-tr-md" : "rounded-2xl rounded-tr-sm"}`
      : `bg-card border border-border text-card-foreground ${isSameGroup ? "rounded-2xl rounded-tl-md" : "rounded-2xl rounded-tl-sm"}`
  }`;

  if (msg.messageType === "image") {
    return (
      <div className={`${bubble} overflow-hidden`}>
        <img src={msg.content} alt="Shared image" className="max-w-full rounded-2xl object-cover" style={{ maxHeight: 280 }} />
      </div>
    );
  }

  if (msg.messageType === "audio") {
    return (
      <div className={`${bubble} px-3 py-2.5`}>
        <VoiceNotePlayer src={msg.content} isUser={isUser} />
      </div>
    );
  }

  return (
    <div className={`${bubble} px-4 py-2.5 text-[15px] leading-snug break-words`}>
      {msg.content}
    </div>
  );
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

  // Image attachment
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voice recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback((smooth = false) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "instant" });
  }, []);

  useEffect(() => {
    if (initialMessages) {
      setMessages(initialMessages);
      const hasUnread = initialMessages.some((m) => !m.isRead && m.sender === "ai");
      if (hasUnread) {
        markRead.mutate({ id: contactId, data: {} }, {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListContactsQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          }
        });
      }
    }
  }, [initialMessages, contactId]);

  useEffect(() => { scrollToBottom(); }, [messages, streamingMessage, isTyping]);

  // ── Send text or image ───────────────────────────────────────────────────
  const sendMessage = async (content: string, messageType: "text" | "image" | "audio" = "text") => {
    if (!content || !contactId || isSending) return;
    setIsSending(true);

    const optimistic = {
      id: Date.now(),
      contactId,
      sender: "user",
      content,
      messageType,
      isRead: true,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    scrollToBottom(true);
    setImagePreview(null);

    if (messageType !== "text") {
      // For non-text messages, just save and don't stream AI response
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

    // Text: stream AI response
    setIsTyping(true);
    try {
      const res = await fetch(`/api/contacts/${contactId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, messageType: "text" }),
      });
      if (!res.ok) throw new Error();
      await new Promise(r => setTimeout(r, 600 + Math.random() * 600));
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
                if (data.content) { fullAiMessage += data.content; setStreamingMessage(fullAiMessage); }
              } catch { /* ignore */ }
            }
          }
        }
        if (fullAiMessage) {
          setMessages(prev => [...prev, {
            id: Date.now() + 1, contactId, sender: "ai", content: fullAiMessage,
            messageType: "text", isRead: true, createdAt: new Date().toISOString(),
          }]);
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

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (imagePreview) { sendMessage(imagePreview, "image"); return; }
    if (!input.trim()) return;
    const msg = input.trim();
    setInput("");
    sendMessage(msg, "text");
  };

  // ── Image picker ─────────────────────────────────────────────────────────
  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Voice recording ──────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
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
      alert("Microphone access denied. Please allow microphone permissions.");
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
                <div className="space-y-1"><Skeleton className="h-3 w-24" /><Skeleton className="h-2 w-16" /></div>
              </div>
            ) : contact ? (
              <Link href={`/contacts/${contact.id}`} className="flex items-center gap-3">
                <ContactAvatar src={contact.avatarUrl} name={contact.name} activityState={activity?.activityState || contact.activityState} size="sm" />
                <div>
                  <h2 className="font-semibold text-sm leading-tight">{contact.name}</h2>
                  <p className="text-[10px] text-muted-foreground capitalize">{activityLabel}</p>
                </div>
              </Link>
            ) : null}
          </div>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
            <MoreVertical className="h-5 w-5 text-muted-foreground" />
          </Button>
        </header>

        {/* Messages */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 py-4 scrollbar-hide">
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
                  const showTime = !prevMsg || new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime() > 5 * 60 * 1000;
                  const isSameGroup = !!(prevMsg && prevMsg.sender === msg.sender && !showTime);
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 8, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      className={`flex flex-col ${isUser ? "items-end" : "items-start"} ${isSameGroup ? "mt-0.5" : "mt-3"}`}
                    >
                      {showTime && (
                        <span className="text-[10px] text-muted-foreground self-center mb-2 mt-1 bg-muted/40 px-2.5 py-0.5 rounded-full">
                          {formatMsgTime(msg.createdAt)}
                        </span>
                      )}
                      <MessageBubble msg={msg} isSameGroup={isSameGroup} />
                      {isUser && idx === messages.length - 1 && msg.messageType === "text" && (
                        <span className="text-[9px] text-muted-foreground/50 mt-0.5 mr-1">Delivered</span>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {isTyping && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-start mt-3">
                  <div className="bg-card border border-border rounded-2xl rounded-tl-sm shadow-sm py-3 px-4">
                    <TypingIndicator />
                  </div>
                </motion.div>
              )}

              {streamingMessage && !isTyping && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-start mt-3">
                  <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-tl-sm shadow-sm text-[15px] leading-snug bg-card border border-primary/20 text-card-foreground">
                    {streamingMessage}
                    <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-primary/70 animate-pulse align-middle rounded-sm" />
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} className="h-2" />
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="px-3 py-3 bg-card/80 backdrop-blur-md border-t border-border flex-shrink-0 space-y-2">
          {/* Image preview */}
          <AnimatePresence>
            {imagePreview && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                className="relative w-fit"
              >
                <img src={imagePreview} alt="Preview" className="h-24 rounded-xl object-cover border border-border shadow-sm" />
                <button onClick={() => setImagePreview(null)}
                  className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5 shadow"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Recording UI */}
          <AnimatePresence>
            {isRecording && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                className="flex items-center gap-3 bg-destructive/10 border border-destructive/30 rounded-2xl px-4 py-3"
              >
                <div className="flex items-center gap-2 flex-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-destructive animate-pulse" />
                  <span className="text-sm font-mono font-semibold text-destructive">
                    {String(Math.floor(recordDuration / 60)).padStart(2, "0")}:{String(recordDuration % 60).padStart(2, "0")}
                  </span>
                  <span className="text-xs text-muted-foreground">Recording...</span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={cancelRecording} className="h-8 text-xs text-muted-foreground">
                    Cancel
                  </Button>
                  <Button size="sm" onClick={stopRecording} className="h-8 px-4 rounded-xl text-xs font-semibold bg-destructive hover:bg-destructive/90">
                    Send
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input bar */}
          {!isRecording && (
            <form onSubmit={handleSend} className="flex items-end gap-2">
              {/* Hidden file input */}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImagePick} />

              {/* Image button */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-full flex-shrink-0 text-muted-foreground hover:text-foreground"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSending}
              >
                <ImageIcon className="h-5 w-5" />
              </Button>

              {/* Text input */}
              <div className="flex-1 relative">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !imagePreview) {
                      e.preventDefault();
                      handleSend(e as any);
                    }
                  }}
                  placeholder={imagePreview ? "Add a caption..." : "Message..."}
                  className="py-3 h-auto min-h-[44px] bg-background border-border rounded-2xl focus-visible:ring-primary/30 text-[15px] pr-14"
                  disabled={isSending}
                />
                {(input.trim() || imagePreview) ? (
                  <Button
                    type="submit"
                    size="icon"
                    disabled={isSending}
                    className="absolute right-1.5 bottom-1.5 h-8 w-8 rounded-xl bg-primary text-primary-foreground disabled:opacity-40"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="icon"
                    onClick={startRecording}
                    className="absolute right-1.5 bottom-1.5 h-8 w-8 rounded-xl bg-muted text-muted-foreground hover:bg-primary/20 hover:text-primary"
                  >
                    <Mic className="h-3.5 w-3.5" />
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
