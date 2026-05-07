import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Download, CheckCircle2, Sparkles, ArrowRight, Shield, Zap, Star } from "lucide-react";
import { dismissUpdate, markVersionApplied, type UpdateState } from "@/lib/version";

interface Props {
  state: UpdateState;
  onComplete: () => void;
}

type Phase = "prompt" | "downloading" | "installing" | "complete";

// ── Badges ────────────────────────────────────────────────────────────────────
const BADGE: Record<string, { label: string; color: string }> = {
  patch: { label: "Patch",  color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  minor: { label: "Update", color: "bg-blue-500/15   text-blue-400   border-blue-500/30"      },
  major: { label: "Major",  color: "bg-amber-500/15  text-amber-400  border-amber-500/30"     },
};
const BADGE_ICON: Record<string, React.ReactNode> = {
  patch: <Zap    className="h-3.5 w-3.5" />,
  minor: <Star   className="h-3.5 w-3.5" />,
  major: <Shield className="h-3.5 w-3.5" />,
};

// ── Simulated file sizes (MB) ─────────────────────────────────────────────────
const FILE_SIZE_MB: Record<string, number> = { patch: 8.4, minor: 26.3, major: 61.7 };

// ── Download waypoints: [progressPct, holdMs] ─────────────────────────────────
// Each waypoint = jump to `progressPct` then wait `holdMs` before next step.
// patch ≈ 68 s  |  minor ≈ 78 s  |  major ≈ 102 s
const DL_STEPS: Record<string, Array<[number, number]>> = {
  patch: [
    [8, 4200], [18, 4800], [28, 5000], [37, 5200], [46, 4800],
    [55, 5000], [63, 5200], [70, 4800], [77, 5000], [83, 5200],
    [89, 4800], [94, 5000], [97, 4000], [99, 3500], [100, 2000],
  ],
  minor: [
    [5, 4500],  [12, 5000], [20, 5500], [28, 5000], [36, 5500],
    [44, 5000], [52, 5500], [59, 5000], [66, 5500], [73, 5000],
    [79, 5000], [85, 4500], [90, 4500], [94, 4000], [97, 3500],
    [99, 3000], [100, 2000],
  ],
  major: [
    [3, 5000],  [8, 6000],  [14, 6500], [20, 6000], [27, 6500],
    [34, 6000], [41, 6500], [48, 6000], [55, 6500], [62, 6000],
    [68, 5500], [74, 5500], [80, 5000], [85, 4500], [89, 4500],
    [93, 4000], [96, 3500], [98, 3000], [99, 2500], [100, 2000],
  ],
};

// ── Install waypoints: [progressPct, holdMs, label] ──────────────────────────
// patch ≈ 42 s  |  minor ≈ 50 s  |  major ≈ 63 s
const INST_STEPS: Record<string, Array<[number, number, string]>> = {
  patch: [
    [12, 4500, "Verifying download..."],
    [28, 5500, "Unpacking files..."],
    [46, 5500, "Applying changes..."],
    [63, 5500, "Updating interface..."],
    [79, 5500, "Finalising install..."],
    [92, 5500, "Running checks..."],
    [98, 4500, "Almost done..."],
    [100, 3000, "Complete"],
  ],
  minor: [
    [8,  5000, "Verifying download..."],
    [18, 5500, "Unpacking files..."],
    [30, 5500, "Applying changes..."],
    [44, 5500, "Updating AI systems..."],
    [58, 5500, "Rebuilding interface..."],
    [70, 5500, "Integrating features..."],
    [81, 5000, "Finalising install..."],
    [90, 4500, "Running checks..."],
    [96, 4000, "Almost done..."],
    [100, 3000, "Complete"],
  ],
  major: [
    [5,  5500, "Verifying download integrity..."],
    [12, 6000, "Unpacking files..."],
    [20, 6500, "Applying core changes..."],
    [30, 6500, "Updating AI systems..."],
    [41, 6000, "Rebuilding interface..."],
    [52, 6000, "Migrating data..."],
    [63, 5500, "Integrating new features..."],
    [73, 5500, "Optimising performance..."],
    [82, 5000, "Finalising install..."],
    [90, 4500, "Running system checks..."],
    [96, 4000, "Almost done..."],
    [100, 3000, "Complete"],
  ],
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtMb(mb: number) { return mb.toFixed(1) + " MB"; }
function fmtSpeed(mbps: number) {
  if (mbps < 1) return (mbps * 1000).toFixed(0) + " KB/s";
  return mbps.toFixed(1) + " MB/s";
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function UpdateScreen({ state, onComplete }: Props) {
  const { info, forced } = state;
  const badge    = BADGE[info.update_type]      ?? BADGE.minor!;
  const badgeIcon = BADGE_ICON[info.update_type] ?? BADGE_ICON.minor;
  const totalMb   = FILE_SIZE_MB[info.update_type] ?? 26.3;

  const [phase,       setPhase]       = useState<Phase>("prompt");
  const [dlProgress,  setDlProgress]  = useState(0);
  const [dlMbDone,    setDlMbDone]    = useState(0);
  const [dlSpeed,     setDlSpeed]     = useState(0);
  const [instProgress, setInstProgress] = useState(0);
  const [instLabel,   setInstLabel]   = useState("Verifying download...");
  const startTimeRef = useRef<number>(0);

  // ── Download phase ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "downloading") return;
    setDlProgress(0);
    setDlMbDone(0);
    setDlSpeed(0);
    startTimeRef.current = Date.now();

    const steps = DL_STEPS[info.update_type] ?? DL_STEPS.minor!;
    let i = 0;
    let tid: ReturnType<typeof setTimeout>;

    const tick = () => {
      const [pct, hold] = steps[i]!;
      setDlProgress(pct);

      const mbDone = (pct / 100) * totalMb;
      setDlMbDone(mbDone);

      const elapsed = (Date.now() - startTimeRef.current) / 1000; // seconds
      const speed = elapsed > 0 ? mbDone / elapsed : 0;
      // Add small random fluctuation ±0.2 MB/s for realism
      setDlSpeed(Math.max(0.1, speed + (Math.random() - 0.5) * 0.4));

      i++;
      if (i < steps.length) {
        tid = setTimeout(tick, hold);
      } else {
        tid = setTimeout(() => setPhase("installing"), 1200);
      }
    };

    tid = setTimeout(tick, 600);
    return () => clearTimeout(tid);
  }, [phase]);

  // ── Install phase ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "installing") return;
    setInstProgress(0);

    const steps = INST_STEPS[info.update_type] ?? INST_STEPS.minor!;
    let i = 0;
    let tid: ReturnType<typeof setTimeout>;

    const tick = () => {
      const [pct, hold, label] = steps[i]!;
      setInstProgress(pct);
      setInstLabel(label);
      i++;
      if (i < steps.length) {
        tid = setTimeout(tick, hold);
      } else {
        tid = setTimeout(() => setPhase("complete"), 1000);
      }
    };

    tid = setTimeout(tick, 800);
    return () => clearTimeout(tid);
  }, [phase]);

  // ── Actions ─────────────────────────────────────────────────────────────────
  const handleUpdate = () => setPhase("downloading");

  const handleLater = () => {
    dismissUpdate(info.latest_version);
    onComplete();
  };

  const handleOpen = () => {
    markVersionApplied(info.latest_version_code);
    window.location.reload();
  };

  const clientVer = `${info.latest_version_code - 1}.x`;

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-background text-foreground max-w-md mx-auto border-x border-border relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-80 bg-primary/8 rounded-full blur-3xl pointer-events-none" />

      <AnimatePresence mode="wait">

        {/* ── PROMPT ──────────────────────────────────────────────────────── */}
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
              <div className={`absolute -top-2.5 -right-2.5 flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold border ${badge.color}`}>
                {badgeIcon}{badge.label}
              </div>
            </div>

            <div className="text-center space-y-1.5">
              <h1 className="text-2xl font-bold tracking-tight">
                {forced ? "Update Required" : "Update Available"}
              </h1>
              <p className="text-muted-foreground text-sm leading-relaxed">{info.update_description}</p>
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
                  <motion.li key={i}
                    initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.08 + i * 0.06 }}
                    className="flex items-start gap-2.5 text-[13px] text-muted-foreground"
                  >
                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                    {c}
                  </motion.li>
                ))}
              </ul>
            </div>

            <p className="text-[11px] text-muted-foreground/50">
              Released {new Date(info.released_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </p>

            {forced && (
              <div className="w-full bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-sm text-amber-400 text-center leading-relaxed">
                This update is required. All features are locked until installed.
              </div>
            )}

            <div className="w-full space-y-2 mt-auto flex-shrink-0">
              <Button onClick={handleUpdate} className="w-full h-14 rounded-2xl text-base font-semibold gap-2">
                <Download className="h-4 w-4" />Update Now
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
            {/* Spinning arc */}
            <div className="relative w-28 h-28">
              <motion.div className="absolute inset-0 rounded-full border-2 border-primary/15"
                animate={{ scale: [1, 1.07, 1] }} transition={{ repeat: Infinity, duration: 2.8 }}
              />
              <motion.div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-primary"
                animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.0, ease: "linear" }}
              />
              <div className="absolute inset-3 bg-gradient-to-br from-primary to-violet-700 rounded-full flex items-center justify-center shadow-inner">
                <Download className="h-8 w-8 text-white" />
              </div>
            </div>

            <div className="w-full space-y-5 text-center">
              <div>
                <p className="text-xl font-semibold">Downloading update...</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Chivra {info.latest_version} &middot; {badge.label} release &middot; {fmtMb(totalMb)}
                </p>
              </div>

              {/* Progress bar */}
              <div className="space-y-2">
                <div className="relative h-2.5 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-violet-500 rounded-full"
                    animate={{ width: `${dlProgress}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  />
                  {/* Shimmer */}
                  <motion.div
                    className="absolute inset-y-0 w-20 bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-full"
                    animate={{ x: ["-100%", "600%"] }}
                    transition={{ repeat: Infinity, duration: 1.8, ease: "linear" }}
                  />
                </div>
                {/* Stats row */}
                <div className="flex justify-between text-xs text-muted-foreground font-mono">
                  <span>{fmtMb(dlMbDone)} / {fmtMb(totalMb)}</span>
                  <span>{dlProgress}%</span>
                  <span>{dlSpeed > 0 ? fmtSpeed(dlSpeed) : "—"}</span>
                </div>
              </div>

              {/* Info cards */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Version",  value: info.latest_version },
                  { label: "Size",     value: fmtMb(totalMb) },
                  { label: "Type",     value: badge.label },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-card border border-border rounded-xl py-2.5 px-1 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
                    <p className="text-sm font-semibold mt-0.5">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── STAGE 2: INSTALLING ──────────────────────────────────────────── */}
        {phase === "installing" && (
          <motion.div key="installing"
            initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.35 }}
            className="flex flex-col items-center justify-center flex-1 px-8 gap-8"
          >
            {/* Triple-ring animation */}
            <div className="relative w-28 h-28">
              <motion.div className="absolute inset-0 rounded-full border-[3px] border-primary/20"
                animate={{ rotate: -360 }} transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
              />
              <motion.div className="absolute inset-2 rounded-full border-[3px] border-transparent border-t-primary/60 border-r-primary/30"
                animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2.0, ease: "linear" }}
              />
              <motion.div className="absolute inset-5 rounded-full border-[3px] border-transparent border-t-primary"
                animate={{ rotate: -360 }} transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
              />
              <div className="absolute inset-7 bg-primary/10 rounded-full flex items-center justify-center">
                <motion.div className="w-4 h-4 bg-primary rounded-full"
                  animate={{ scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 1.0 }}
                />
              </div>
            </div>

            <div className="w-full space-y-5 text-center">
              <div>
                <p className="text-xl font-semibold">Installing version {info.latest_version}</p>
                <AnimatePresence mode="wait">
                  <motion.p key={instLabel}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3 }}
                    className="text-sm text-muted-foreground mt-1"
                  >
                    {instLabel}
                  </motion.p>
                </AnimatePresence>
              </div>

              {/* Progress bar */}
              <div className="space-y-2">
                <div className="relative h-2.5 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-violet-600 to-primary rounded-full"
                    animate={{ width: `${instProgress}%` }}
                    transition={{ duration: 0.9, ease: "easeOut" }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground font-mono">
                  <span>Installing...</span>
                  <span>{instProgress}%</span>
                </div>
              </div>

              {/* Step checklist */}
              <div className="bg-card border border-border rounded-xl px-4 py-3 text-left space-y-2.5">
                {[
                  { label: "Download complete",      done: true },
                  { label: "Unpacking files",        done: instProgress >= 20 },
                  { label: "Applying changes",       done: instProgress >= 45 },
                  { label: "Updating AI systems",    done: instProgress >= 65 },
                  { label: "Rebuilding interface",   done: instProgress >= 80 },
                  { label: "Finalising",             done: instProgress >= 95 },
                ].map((step, i) => (
                  <motion.div key={i}
                    animate={{ opacity: step.done ? 1 : 0.45 }}
                    className="flex items-center gap-2.5 text-xs"
                  >
                    <motion.div
                      animate={{ backgroundColor: step.done ? "rgb(139,92,246)" : "transparent" }}
                      transition={{ duration: 0.4 }}
                      className="w-4 h-4 rounded-full border border-border flex items-center justify-center flex-shrink-0"
                    >
                      {step.done && (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                          className="w-2 h-2 bg-primary-foreground rounded-full"
                        />
                      )}
                    </motion.div>
                    <span className={step.done ? "text-foreground font-medium" : "text-muted-foreground"}>
                      {step.label}
                    </span>
                    {step.done && (
                      <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="ml-auto text-[10px] text-emerald-500 font-semibold"
                      >
                        Done
                      </motion.span>
                    )}
                  </motion.div>
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
            <div className="relative">
              <motion.div className="absolute inset-0 rounded-full bg-primary/20"
                initial={{ scale: 0, opacity: 1 }} animate={{ scale: 3, opacity: 0 }}
                transition={{ duration: 1.0, ease: "easeOut" }}
              />
              <motion.div
                initial={{ scale: 0, rotate: -15 }} animate={{ scale: 1, rotate: 0 }}
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

            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }}
              className="w-full"
            >
              <RestartButton onRestart={handleOpen} />
            </motion.div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}

// ── Auto-countdown restart button ─────────────────────────────────────────────
function RestartButton({ onRestart }: { onRestart: () => void }) {
  const [count, setCount] = useState(5);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setActive(true), 1000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!active) return;
    if (count <= 0) { onRestart(); return; }
    const t = setTimeout(() => setCount(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [count, active, onRestart]);

  return (
    <div className="w-full space-y-2">
      <Button onClick={onRestart} className="w-full h-14 rounded-2xl text-base font-semibold relative overflow-hidden">
        {/* countdown fill */}
        {active && count > 0 && (
          <motion.div
            className="absolute inset-0 bg-primary-foreground/10 origin-left"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: (5 - count) / 5 }}
            transition={{ duration: 1, ease: "linear" }}
          />
        )}
        <span className="relative z-10 flex items-center gap-2">
          Restarting Application
          {active && count > 0 && (
            <span className="w-6 h-6 rounded-full bg-primary-foreground/20 text-sm flex items-center justify-center font-bold flex-shrink-0">
              {count}
            </span>
          )}
        </span>
      </Button>
      <p className="text-xs text-muted-foreground text-center">
        This update won't appear again — your app stays up to date
      </p>
    </div>
  );
}
