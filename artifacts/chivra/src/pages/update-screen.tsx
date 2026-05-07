import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Loader2, Download, CheckCircle2, Sparkles, ArrowRight } from "lucide-react";
import { dismissUpdate, type VersionInfo } from "@/lib/version";

interface UpdateScreenProps {
  info: VersionInfo;
  forced: boolean;
  onLater: () => void;
}

type Phase = "prompt" | "downloading" | "done";

export default function UpdateScreen({ info, forced, onLater }: UpdateScreenProps) {
  const [phase, setPhase] = useState<Phase>("prompt");
  const [progress, setProgress] = useState(0);

  // Simulated download progress
  useEffect(() => {
    if (phase !== "downloading") return;
    setProgress(0);
    const steps = [8, 22, 35, 47, 61, 73, 84, 92, 98, 100];
    let i = 0;
    const tick = () => {
      setProgress(steps[i] ?? 100);
      i += 1;
      if (i < steps.length) {
        setTimeout(tick, 300 + Math.random() * 350);
      } else {
        setTimeout(() => setPhase("done"), 600);
      }
    };
    setTimeout(tick, 400);
  }, [phase]);

  const handleUpdate = () => setPhase("downloading");

  const handleLater = () => {
    dismissUpdate();
    onLater();
  };

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-background text-foreground max-w-md mx-auto border-x border-border relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      <AnimatePresence mode="wait">
        {/* ── PROMPT ─────────────────────────────────────────────────────────── */}
        {phase === "prompt" && (
          <motion.div key="prompt" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.4 }}
            className="flex flex-col items-center justify-center flex-1 px-8 text-center gap-8"
          >
            {/* App icon */}
            <div className="relative">
              <div className="absolute inset-0 bg-primary/30 rounded-3xl blur-2xl scale-110" />
              <div className="relative w-24 h-24 bg-gradient-to-br from-primary to-violet-700 rounded-3xl rotate-3 flex items-center justify-center shadow-2xl border border-white/10">
                <span className="-rotate-3 text-white font-serif italic text-5xl">C</span>
              </div>
              {/* Badge */}
              <div className="absolute -top-2 -right-2 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg">
                NEW
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight">Update Available</h1>
              <p className="text-muted-foreground text-sm">
                Chivra {info.latestVersion} is ready to install
              </p>
              <div className="flex items-center justify-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground/60 line-through">{info.currentVersion}</span>
                <ArrowRight className="h-3 w-3 text-primary" />
                <span className="text-xs font-semibold text-primary">{info.latestVersion}</span>
              </div>
            </div>

            {/* What's new */}
            <div className="w-full bg-card border border-border rounded-2xl p-4 text-left space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Sparkles className="h-4 w-4 text-primary" />
                What's new
              </div>
              <ul className="space-y-2">
                {info.updateNotes.map((note, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                    {note}
                  </li>
                ))}
              </ul>
            </div>

            {/* Force update warning */}
            {forced && (
              <div className="w-full bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-sm text-amber-400 text-center">
                This update is now required to continue using Chivra.
              </div>
            )}

            {/* Actions */}
            <div className="w-full space-y-3">
              <Button onClick={handleUpdate} className="w-full h-13 rounded-2xl text-base font-semibold">
                <Download className="h-4 w-4 mr-2" />
                Update Now
              </Button>
              {!forced && (
                <Button variant="ghost" onClick={handleLater} className="w-full h-11 rounded-2xl text-muted-foreground">
                  Later
                </Button>
              )}
            </div>
          </motion.div>
        )}

        {/* ── DOWNLOADING ────────────────────────────────────────────────────── */}
        {phase === "downloading" && (
          <motion.div key="downloading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
            className="flex flex-col items-center justify-center flex-1 px-8 gap-10"
          >
            {/* Spinning logo */}
            <div className="relative w-24 h-24">
              <div className="absolute inset-0 rounded-full border-2 border-primary/15" />
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary"
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.1, ease: "linear" }}
              />
              <div className="absolute inset-3 bg-gradient-to-br from-primary to-violet-700 rounded-full flex items-center justify-center">
                <span className="text-white font-serif italic text-3xl">C</span>
              </div>
            </div>

            <div className="w-full space-y-4 text-center">
              <div>
                <p className="text-lg font-semibold">Downloading update...</p>
                <p className="text-sm text-muted-foreground mt-1">Chivra {info.latestVersion}</p>
              </div>

              {/* Progress bar */}
              <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="absolute inset-y-0 left-0 bg-primary rounded-full"
                  initial={{ width: "0%" }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                />
              </div>
              <p className="text-xs text-muted-foreground font-mono">{progress}%</p>
            </div>
          </motion.div>
        )}

        {/* ── DONE ───────────────────────────────────────────────────────────── */}
        {phase === "done" && (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="flex flex-col items-center justify-center flex-1 px-8 gap-6 text-center"
          >
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, delay: 0.1 }}>
              <CheckCircle2 className="h-20 w-20 text-primary" />
            </motion.div>
            <div>
              <h2 className="text-2xl font-bold">You're up to date</h2>
              <p className="text-muted-foreground text-sm mt-2">Chivra {info.latestVersion} installed successfully</p>
            </div>
            <Button onClick={onLater} className="w-full h-13 rounded-2xl text-base font-semibold mt-4">
              Open Chivra
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
