import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, PhoneOff, Video, Mic, MicOff, Volume2, VolumeX, Camera, CameraOff } from "lucide-react";
import { ContactAvatar } from "@/components/contact-avatar";

export interface CallContact {
  id: number;
  name: string;
  avatarUrl?: string | null;
}

export type CallType = "voice" | "video";
type CallPhase = "outgoing" | "active" | "no-answer" | "ended";

interface Props {
  contact: CallContact;
  callType: CallType;
  onEnd: () => void;
}

export default function CallOverlay({ contact, callType, onEnd }: Props) {
  const [phase, setPhase] = useState<CallPhase>("outgoing");
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(callType === "video");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Simulate AI answering after 3–8 seconds
  useEffect(() => {
    const answerDelay = 3000 + Math.random() * 5000;
    const noAnswerChance = Math.random() < 0.15; // 15% chance no answer

    const tid = setTimeout(() => {
      if (noAnswerChance) {
        setPhase("no-answer");
        setTimeout(onEnd, 3000);
      } else {
        setPhase("active");
      }
    }, answerDelay);

    return () => clearTimeout(tid);
  }, []);

  // Duration timer
  useEffect(() => {
    if (phase !== "active") return;
    timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const handleHangUp = () => {
    setPhase("ended");
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeout(onEnd, 1200);
  };

  const statusText = {
    outgoing:  callType === "voice" ? "Ringing..." : "Starting video call...",
    active:    formatDuration(duration),
    "no-answer": "No answer",
    ended:     "Call ended",
  }[phase];

  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="fixed inset-0 z-50 flex flex-col"
      style={{ maxWidth: "448px", margin: "0 auto" }}
    >
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-900 via-zinc-950 to-black" />

      {/* Video call background (AI "camera") */}
      {callType === "video" && phase === "active" && (
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center">
          <div className="opacity-20 scale-150">
            <ContactAvatar src={contact.avatarUrl} name={contact.name} size="xl" />
          </div>
        </div>
      )}

      {/* Ripple rings (outgoing) */}
      {phase === "outgoing" && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {[1, 2, 3].map(i => (
            <motion.div
              key={i}
              className="absolute rounded-full border border-white/10"
              initial={{ width: 120, height: 120, opacity: 0.6 }}
              animate={{ width: 120 + i * 80, height: 120 + i * 80, opacity: 0 }}
              transition={{ duration: 2, delay: i * 0.5, repeat: Infinity, ease: "easeOut" }}
            />
          ))}
        </div>
      )}

      <div className="relative flex flex-col flex-1 px-6 pt-16 pb-12 items-center justify-between z-10">
        {/* Top: call type label */}
        <div className="flex items-center gap-2 text-white/60 text-sm">
          {callType === "video" ? <Video className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
          <span>{callType === "video" ? "Video call" : "Voice call"}</span>
        </div>

        {/* Center: contact info */}
        <div className="flex flex-col items-center gap-6">
          <motion.div
            animate={phase === "outgoing" ? { scale: [1, 1.04, 1] } : { scale: 1 }}
            transition={{ repeat: phase === "outgoing" ? Infinity : 0, duration: 1.8 }}
          >
            <div className="p-1 rounded-full bg-gradient-to-tr from-violet-500 to-pink-500 shadow-2xl shadow-primary/40">
              <div className="p-1 rounded-full bg-zinc-900">
                <ContactAvatar src={contact.avatarUrl} name={contact.name} size="xl" />
              </div>
            </div>
          </motion.div>

          <div className="text-center">
            <h2 className="text-3xl font-bold text-white tracking-tight">{contact.name}</h2>
            <AnimatePresence mode="wait">
              <motion.p
                key={statusText}
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                className={`mt-2 text-base font-mono ${phase === "active" ? "text-emerald-400" : "text-white/50"}`}
              >
                {statusText}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>

        {/* Bottom: controls */}
        <div className="w-full space-y-6">
          {/* Active controls row */}
          {phase === "active" && (
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-center gap-6"
            >
              <CallControlButton
                icon={muted ? MicOff : Mic}
                label={muted ? "Unmute" : "Mute"}
                active={muted}
                onClick={() => setMuted(m => !m)}
              />
              <CallControlButton
                icon={speakerOn ? Volume2 : VolumeX}
                label="Speaker"
                active={!speakerOn}
                onClick={() => setSpeakerOn(s => !s)}
              />
              {callType === "video" && (
                <CallControlButton
                  icon={cameraOn ? Camera : CameraOff}
                  label="Camera"
                  active={!cameraOn}
                  onClick={() => setCameraOn(c => !c)}
                />
              )}
            </motion.div>
          )}

          {/* Hang up button */}
          {(phase === "outgoing" || phase === "active") && (
            <div className="flex justify-center">
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={handleHangUp}
                className="flex flex-col items-center gap-2"
              >
                <div className="h-16 w-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-xl shadow-red-500/30 transition-colors">
                  <PhoneOff className="h-6 w-6 text-white" />
                </div>
                <span className="text-white/50 text-xs">End</span>
              </motion.button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function CallControlButton({
  icon: Icon, label, active, onClick,
}: { icon: any; label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2">
      <div className={`h-14 w-14 rounded-full flex items-center justify-center transition-colors ${
        active ? "bg-white/20 text-white" : "bg-white/10 text-white/70 hover:bg-white/15"
      }`}>
        <Icon className="h-5 w-5" />
      </div>
      <span className="text-white/40 text-[10px]">{label}</span>
    </button>
  );
}
