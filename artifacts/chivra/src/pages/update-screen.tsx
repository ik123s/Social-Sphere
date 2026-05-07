import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Download, CheckCircle2, Sparkles, ArrowRight, Shield, Zap, Star } from "lucide-react";
import { dismissUpdate, markVersionApplied, type UpdateState } from "@/lib/version";

interface Props {
  state: UpdateState;
  onComplete: () => void;
}

type Phase = "prompt" | "downloading" | "installing" | "complete";

const UPDATE_TYPE_BADGE: Record<string, { label: string; color: string }> = {
  patch: { label: "Patch",  color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  minor: { label: "Update", color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  major: { label: "Major",  color: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
};

const UPDATE_TYPE_ICON: Record<string, React.ReactNode> = {
  patch: <Zap className="h-3.5 w-3.5" />,
  minor: <Star className="h-3.5 w-3.5" />,
  major: <Shield className="h-3.5 w-3.5" />,
};

// Simulated download speed varies by update type
const DOWNLOAD_STEPS: Record<string, number[]> = {
  patch: [20, 45, 68, 85, 95, 100],
  minor: [8, 18, 30, 42, 55, 66, 76, 85, 92, 97, 100],
  major: [4, 9, 15, 22, 29, 37, 44, 51, 58, 65, 71, 77, 83, 88, 92, 95, 98, 100],
};

const INSTALL_STEPS: Record<string, number[]> = {
  patch: [30, 65, 90, 100],
  minor: [15, 35, 55, 72, 88, 100],
  major: [8, 18, 30, 44, 58, 70, 81, 90, 96, 100],
};

export default function UpdateScreen({ state, onComplete }: Props) {
  const { info, forced } = state;
  const badge = UPDATE_TYPE_BADGE[info.update_type] ?? UPDATE_TYPE_BADGE.minor!;
  const icon  = UPDATE_TYPE_ICON[info.update_type]  ?? UPDATE_TYPE_ICON.minor;

  const [phase, setPhase] = useState<Phase>("prompt");
  const [dlProgress,  setDlProgress]  = useState(0);
  const [instProgress, setInstProgress] = useState(0);
  const [instLabel, setInstLabel] = useState("Preparing...");

  // ── Download phase ────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "downloading") return;
    setDlProgress(0);
    const steps = DOWNLOAD_STEPS[info.update_type] ?? DOWNLOAD_STEPS.minor!;
    let i = 0;
    const tick = () => {
      setDlProgress(steps[i] ?? 100);
      i++;
      if (i < steps.length) {
        setTimeout(tick, 260 + Math.random() * 320);
      } else {
        setTimeout(() => setPhase("installing"), 700);
      }
    };
    setTimeout(tick, 300);
  }, [phase]);

  // ── Installing phase ──────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "installing") return;
    setInstProgress(0);
    const steps = INSTALL_STEPS[info.update_type] ?? INSTALL_STEPS.minor!;
    const labels = [
      "Unpacking files...",
      "Applying changes...",
      "Updating AI systems...",
      "Rebuilding interface...",
      "Finalising install...",
      "Done",
    ];
    let i = 0;
    const tick = () => {
      setInstProgress(steps[i] ?? 100);
      setInstLabel(labels[Math.min(i, labels.length - 1)] ?? "Installing...");
      i++;
      if (i < steps.length) {
        setTimeout(tick, 340 + Math.random() * 380);
      } else {
        setTimeout(() => setPhase("complete"), 900);
      }
    };
    setTimeout(tick, 400);
  }, [phase]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const handleUpdate = () => setPhase("downloading");

  const handleLater = () => {
    dismissUpdate(info.latest_version);
    onComplete();
  };

  const handleOpen = () => {
    markVersionApplied(info.latest_version_code);
    // Hard reload so the "new version" takes effect cleanly
    window.location.reload();
  };

  const clientVer = `${info.latest_version_code - 1}.x`;

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-background text-foreground max-w-md mx-auto border-x border-border relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-80 bg-primary/8 rounded-full blur-3xl pointer-events-none" />

      <AnimatePresence mode="wait">

        {/* ── STAGE 0: PROMPT ──────────────────────────────────────────────── */}
        {phase === "prompt" && (
          <motion.div key="prompt"
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }} transition={{ duration: 0.35, ease: "easeOut" }}
            className="flex flex-col items-center flex-1 px-7 pt-14 pb-8 gap-7 overflow-y-auto"
          >
            {/* App icon */}
            <div className="relative flex-shrink-0">
              <div className="absolute inset-0 bg-primary/25 rounded-3xl blur-2xl scale-125" />
              <div className="relative w-28 h-28 bg-gradient-to-br from-primary via-violet-600 to-violet-800 rounded-3xl flex items-center justify-center shadow-2xl border border-white/10">
                <span className="text-white font-serif italic text-6xl select-none">C</span>
              </div>
              {/* Update type badge */}
              <div className={`absolute -top-2.5 -right-2.5 flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold border ${badge.color}`}>
                {icon}
                {badge.label}
              </div>
            </div>

            {/* Headline */}
            <div className="text-center space-y-1.5">
              <h1 className="text-2xl font-bold tracking-tight">
                {forced ? "Update Required" : "Update Available"}
              </h1>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {info.update_description}
              </p>
              {/* Version arrow */}
              <div className="flex items-center justify-center gap-2 pt-1">
                <span className="text-xs text-muted-foreground/50 line-through font-mono">{clientVer}</span>
                <ArrowRight className="h-3 w-3 text-primary/60" />
                <span className="text-sm font-bold text-primary font-mono">{info.latest_version}</span>
              </div>
            </div>

            {/* What's new */}
            <div className="w-full bg-card border border-border rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="h-4 w-4 text-primary" />
                What's new in {info.latest_version}
              </div>
              <ul className="space-y-2.5">
                {info.changes.map((c, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + i * 0.06 }}
                    className="flex items-start gap-2.5 text-[13px] text-muted-foreground"
                  >
                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                    {c}
                  </motion.li>
                ))}
              </ul>
            </div>

            {/* Released at */}
            <p className="text-[11px] text-muted-foreground/50">
              Released {new Date(info.released_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </p>

            {/* Force banner */}
            {forced && (
              <div className="w-full bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-sm text-amber-400 text-center leading-relaxed">
                This is a required update. All features are locked until you install it.
              </div>
            )}

            {/* Actions */}
            <div className="w-full space-y-2 mt-auto flex-shrink-0">
              <Button onClick={handleUpdate} className="w-full h-14 rounded-2xl text-base font-semibold gap-2">
                <Download className="h-4 w-4" />
                Update Now
              </Button>
              {!forced && (
                <Button variant="ghost" onClick={handleLater}
                  className="w-full h-11 rounded-2xl text-muted-foreground text-sm hover:text-foreground"
                >
                  Later ({info.delay_limit_days}d grace period)
                </Button>
              )}
            </div>
          </motion.div>
        )}

        {/* ── STAGE 1: DOWNLOADING ─────────────────────────────────────────── */}
        {phase === "downloading" && (
          <motion.div key="downloading"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
            className="flex flex-col items-center justify-center flex-1 px-8 gap-10"
          >
            {/* Pulsing ring + spinning arc */}
            <div className="relative w-28 h-28">
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-primary/15"
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ repeat: Infinity, duration: 2.4 }}
              />
              <motion.div
                className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-primary"
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.0, ease: "linear" }}
              />
              <div className="absolute inset-3 bg-gradient-to-br from-primary to-violet-700 rounded-full flex items-center justify-center shadow-inner">
                <Download className="h-8 w-8 text-white" />
              </div>
            </div>

            <div className="w-full space-y-5 text-center">
              <div>
                <p className="text-xl font-semibold">Downloading update...</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Chivra {info.latest_version} &middot; {badge.label} release
                </p>
              </div>

              {/* Progress bar */}
              <div className="space-y-2">
                <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-violet-500 rounded-full"
                    initial={{ width: "0%" }}
                    animate={{ width: `${dlProgress}%` }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                  />
                  {/* Shimmer */}
                  <motion.div
                    className="absolute inset-y-0 w-16 bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-full"
                    animate={{ x: ["-100%", "600%"] }}
                    transition={{ repeat: Infinity, duration: 1.4, ease: "linear" }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground font-mono">
                  <span>Downloading...</span>
                  <span>{dlProgress}%</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── STAGE 2: INSTALLING ──────────────────────────────────────────── */}
        {phase === "installing" && (
          <motion.div key="installing"
            initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.35 }}
            className="flex flex-col items-center justify-center flex-1 px-8 gap-10"
          >
            {/* Rotating cog-like rings */}
            <div className="relative w-28 h-28">
              <motion.div
                className="absolute inset-0 rounded-full border-[3px] border-primary/20"
                animate={{ rotate: -360 }}
                transition={{ repeat: Infinity, duration: 3.5, ease: "linear" }}
              />
              <motion.div
                className="absolute inset-2 rounded-full border-[3px] border-transparent border-t-primary/60 border-r-primary/30"
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.8, ease: "linear" }}
              />
              <motion.div
                className="absolute inset-5 rounded-full border-[3px] border-transparent border-t-primary"
                animate={{ rotate: -360 }}
                transition={{ repeat: Infinity, duration: 1.1, ease: "linear" }}
              />
              <div className="absolute inset-6 bg-primary/10 rounded-full flex items-center justify-center">
                <div className="w-4 h-4 bg-primary rounded-full animate-pulse" />
              </div>
            </div>

            <div className="w-full space-y-5 text-center">
              <div>
                <p className="text-xl font-semibold">Installing version {info.latest_version}</p>
                <motion.p
                  key={instLabel}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm text-muted-foreground mt-1"
                >
                  {instLabel}
                </motion.p>
              </div>

              {/* Progress bar */}
              <div className="space-y-2">
                <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-violet-500 to-primary rounded-full"
                    initial={{ width: "0%" }}
                    animate={{ width: `${instProgress}%` }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground font-mono">
                  <span>Installing...</span>
                  <span>{instProgress}%</span>
                </div>
              </div>

              {/* Step list */}
              <div className="bg-card border border-border rounded-xl px-4 py-3 text-left space-y-2">
                {[
                  { label: "Download complete", done: true },
                  { label: "Applying changes", done: instProgress >= 50 },
                  { label: "Updating AI systems", done: instProgress >= 80 },
                  { label: "Finalising", done: instProgress >= 95 },
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-xs">
                    <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center flex-shrink-0 transition-all duration-500 ${
                      step.done ? "bg-primary border-primary" : "border-border"
                    }`}>
                      {step.done && <div className="w-1.5 h-1.5 bg-primary-foreground rounded-full" />}
                    </div>
                    <span className={step.done ? "text-foreground" : "text-muted-foreground/50"}>{step.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── STAGE 3: COMPLETE ────────────────────────────────────────────── */}
        {phase === "complete" && (
          <motion.div key="complete"
            initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 350, damping: 28 }}
            className="flex flex-col items-center justify-center flex-1 px-8 gap-8 text-center"
          >
            {/* Burst effect behind check */}
            <div className="relative">
              <motion.div
                className="absolute inset-0 rounded-full bg-primary/20"
                initial={{ scale: 0, opacity: 1 }}
                animate={{ scale: 2.8, opacity: 0 }}
                transition={{ duration: 0.9, ease: "easeOut" }}
              />
              <motion.div
                initial={{ scale: 0, rotate: -15 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 26, delay: 0.1 }}
              >
                <CheckCircle2 className="h-24 w-24 text-primary" />
              </motion.div>
            </div>

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
              <h2 className="text-2xl font-bold">Update Complete</h2>
              <p className="text-muted-foreground text-sm mt-2">
                Chivra {info.latest_version} installed successfully
              </p>
            </motion.div>

            {/* Version history mini card */}
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
              className="w-full bg-card border border-border rounded-2xl px-5 py-4 space-y-1.5 text-left"
            >
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Applied</p>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{info.latest_version}</span>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${badge.color}`}>{badge.label}</span>
              </div>
              <p className="text-xs text-muted-foreground">{info.update_description}</p>
            </motion.div>

            {/* Restarting button */}
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }}
              className="w-full space-y-2"
            >
              <RestartButton onRestart={handleOpen} />
            </motion.div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}

// Auto-counts down and then triggers restart
function RestartButton({ onRestart }: { onRestart: () => void }) {
  const [count, setCount] = useState(3);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setStarted(true), 800);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!started) return;
    if (count <= 0) { onRestart(); return; }
    const t = setTimeout(() => setCount(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [count, started, onRestart]);

  return (
    <div className="w-full space-y-2">
      <Button onClick={onRestart} className="w-full h-14 rounded-2xl text-base font-semibold gap-2">
        Restarting Application
        {started && count > 0 && (
          <span className="ml-1 w-6 h-6 rounded-full bg-primary-foreground/20 text-primary-foreground text-sm flex items-center justify-center font-bold">
            {count}
          </span>
        )}
      </Button>
      <p className="text-xs text-muted-foreground text-center">
        Your session will reload with the latest version
      </p>
    </div>
  );
}
