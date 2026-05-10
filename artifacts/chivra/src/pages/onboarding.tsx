import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { completeOnboarding } from "@/lib/onboarding";
import { initUser, setDisplayName, setStoredVcn, setStoredPhone } from "@/lib/vcn";
import { ChevronRight, Phone, Mail, User, Loader2, CheckCircle2, Shield, Smartphone } from "lucide-react";

const COUNTRY_CODES = [
  { code: "+1", name: "US" },
  { code: "+44", name: "UK" },
  { code: "+234", name: "NG" },
  { code: "+91", name: "IN" },
  { code: "+27", name: "ZA" },
  { code: "+49", name: "DE" },
  { code: "+33", name: "FR" },
  { code: "+55", name: "BR" },
  { code: "+86", name: "CN" },
  { code: "+81", name: "JP" },
];

const INIT_SCREENS = [
  { title: "Initializing your account...", sub: "Setting up your secure private space" },
  { title: "Connecting your AI contacts...", sub: "Generating unique contacts just for you" },
  { title: "Preparing your social space...", sub: "Almost there" },
];

// ── Link code entry (multi-device) ───────────────────────────────────────────
function LinkCodeEntry({ onSuccess }: { onSuccess: () => void }) {
  const [code, setCode]       = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [expanded, setExpanded] = useState(false);

  const handleVerify = async () => {
    const cleaned = code.trim().toUpperCase().replace(/\s/g, "");
    if (cleaned.length < 8) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/users/verify-link-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: cleaned }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Invalid or expired code");
        return;
      }
      const data = await res.json();
      if (data.user) {
        setStoredVcn(data.user.vcn);
        if (data.user.displayName) setDisplayName(data.user.displayName);
        completeOnboarding();
        onSuccess();
      }
    } catch {
      setError("Connection error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="w-full flex items-center justify-center gap-2 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <Smartphone className="h-4 w-4" />
        Link existing account with a code
      </button>
    );
  }

  return (
    <div className="space-y-3 bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <Smartphone className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold">Link Device</p>
        <button onClick={() => setExpanded(false)} className="ml-auto text-muted-foreground hover:text-foreground text-xs">Cancel</button>
      </div>
      <p className="text-xs text-muted-foreground">Enter the link code from your other device (found in Settings → Linked Devices).</p>
      <Input
        value={code}
        onChange={e => { setCode(e.target.value.toUpperCase()); setError(""); }}
        placeholder="XXXX-XXXX"
        className="font-mono tracking-widest text-center text-lg h-12 rounded-xl bg-muted/40 border-transparent"
        maxLength={9}
      />
      {error && <p className="text-xs text-destructive text-center">{error}</p>}
      <Button
        onClick={handleVerify}
        disabled={code.replace(/[-\s]/g, "").length < 8 || loading}
        className="w-full rounded-xl"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Link Account"}
      </Button>
    </div>
  );
}

interface OnboardingProps {
  onComplete: () => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [stage, setStage] = useState<"phone" | "terms" | "otp" | "email" | "profile" | "init">("phone");

  // Phone stage
  const [countryCode, setCountryCode] = useState("+1");
  const [phone, setPhone] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [demoOtp, setDemoOtp] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);

  // OTP stage
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [verifying, setVerifying] = useState(false);
  const [otpError, setOtpError] = useState("");

  // Email stage
  const [email, setEmail] = useState("");

  // Profile stage
  const [name, setName] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);

  // Init stage
  const [initScreen, setInitScreen] = useState(0);
  const [initDone, setInitDone] = useState(false);

  // Full phone (with country code) for account linking
  const fullPhone = countryCode + phone;

  // --- Phone → Terms ---
  const handleSendOtp = async () => {
    if (phone.length < 6 || !termsAccepted) return;
    setSendingOtp(true);
    try {
      const res = await fetch("/api/users/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fullPhone }),
      });
      const data = await res.json();
      setDemoOtp(data.otp ?? "");
      setStage("otp");
    } catch {
      setDemoOtp("000000");
      setStage("otp");
    } finally {
      setSendingOtp(false);
    }
  };

  // --- OTP ---
  const handleOtpChange = (idx: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...otpDigits];
    next[idx] = val.slice(-1);
    setOtpDigits(next);
    setOtpError("");
    if (val && idx < 5) otpRefs.current[idx + 1]?.focus();
  };

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otpDigits[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    }
  };

  const handleVerifyOtp = async () => {
    const code = otpDigits.join("");
    if (code.length < 6) return;
    setVerifying(true);
    setOtpError("");
    try {
      const res = await fetch("/api/users/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fullPhone, otp: code }),
      });
      if (!res.ok) {
        setOtpError("Incorrect code. Try again.");
        setOtpDigits(["", "", "", "", "", ""]);
        otpRefs.current[0]?.focus();
        return;
      }
      const data = await res.json();

      // Returning user — restore their account and go straight to app
      if (data.isReturningUser && data.user) {
        setStoredVcn(data.user.vcn);
        setStoredPhone(fullPhone);
        if (data.user.displayName) setDisplayName(data.user.displayName);
        completeOnboarding();
        onComplete();
        return;
      }

      // New user — continue with email/profile setup
      setStage("email");
    } catch {
      setStage("email");
    } finally {
      setVerifying(false);
    }
  };

  // --- Init ---
  useEffect(() => {
    if (stage !== "init") return;
    let i = 0;
    const tick = () => {
      i += 1;
      if (i < INIT_SCREENS.length) {
        setInitScreen(i);
        setTimeout(tick, 1600);
      } else {
        setInitDone(true);
        setTimeout(() => {
          completeOnboarding();
          onComplete();
        }, 900);
      }
    };
    setTimeout(tick, 1600);

    // Kick off starter contact generation in background (non-blocking)
    const vcn = localStorage.getItem("chivra_vcn");
    if (vcn) {
      fetch("/api/users/initialize-contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": vcn },
        body: JSON.stringify({}),
      }).catch(() => {});
    }
  }, [stage]);

  const handleProfileDone = async () => {
    if (!name.trim()) return;
    setProfileLoading(true);
    setDisplayName(name.trim());
    try {
      await initUser(fullPhone);
    } catch { /* non-blocking */ }
    setProfileLoading(false);
    setStage("init");
  };

  const slideVariants = {
    initial: { opacity: 0, x: 40 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -40 },
  };

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-background text-foreground overflow-hidden max-w-md mx-auto relative border-x border-border">
      {/* Logo area */}
      <div className="flex-shrink-0 flex flex-col items-center pt-14 pb-8 relative">
        <div className="relative w-16 h-16 mb-4">
          <div className="absolute inset-0 bg-primary/25 rounded-2xl blur-xl" />
          <div className="absolute inset-0 bg-gradient-to-br from-primary to-violet-700 rounded-2xl rotate-45 flex items-center justify-center shadow-xl border border-white/10">
            <span className="-rotate-45 text-white font-serif italic text-2xl">C</span>
          </div>
        </div>
        <h1 className="text-xl font-light tracking-widest text-foreground">CHIVRA</h1>
        <p className="text-xs text-muted-foreground mt-1 tracking-wide">Your AI Social World</p>
      </div>

      {/* Stage content */}
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">

          {/* STAGE 1: PHONE */}
          {stage === "phone" && (
            <motion.div key="phone" variants={slideVariants} initial="initial" animate="animate" exit="exit"
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              className="absolute inset-0 flex flex-col px-6 pt-2"
            >
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-1">Enter your number</h2>
                <p className="text-muted-foreground text-sm">Your phone number is your account — you can log in from any device.</p>
              </div>

              <div className="space-y-4">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Country Code</Label>
                <div className="flex gap-2">
                  <select
                    value={countryCode}
                    onChange={e => setCountryCode(e.target.value)}
                    className="bg-card border border-border rounded-xl px-3 h-13 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 flex-shrink-0"
                  >
                    {COUNTRY_CODES.map(c => (
                      <option key={c.code} value={c.code}>{c.name} {c.code}</option>
                    ))}
                  </select>
                  <Input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value.replace(/\D/g, ""))}
                    placeholder="8012345678"
                    className="flex-1 h-13 rounded-xl bg-card border-border text-lg font-mono tracking-wider"
                    maxLength={12}
                  />
                </div>

                {/* Terms checkbox */}
                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className="relative mt-0.5 flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={e => setTermsAccepted(e.target.checked)}
                      className="sr-only"
                    />
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                      termsAccepted ? "bg-primary border-primary" : "border-border bg-card"
                    }`}>
                      {termsAccepted && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground leading-relaxed">
                    I agree to Chivra's{" "}
                    <button
                      type="button"
                      onClick={() => setStage("terms")}
                      className="text-primary underline underline-offset-2"
                    >
                      Terms of Service and Platform Rules
                    </button>
                    . I will not use this platform to harass, abuse, or harm others.
                  </span>
                </label>

                <Button
                  onClick={handleSendOtp}
                  disabled={phone.length < 6 || sendingOtp || !termsAccepted}
                  className="w-full h-13 rounded-2xl text-base font-semibold mt-2"
                >
                  {sendingOtp ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                    <><Phone className="h-4 w-4 mr-2" />Send Verification Code</>
                  )}
                </Button>

                {/* Device link code option */}
                <div className="relative my-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border/40" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-background px-3 text-[11px] text-muted-foreground/60 uppercase tracking-wider">or</span>
                  </div>
                </div>
                <LinkCodeEntry onSuccess={onComplete} />
              </div>
            </motion.div>
          )}

          {/* STAGE: TERMS */}
          {stage === "terms" && (
            <motion.div key="terms" variants={slideVariants} initial="initial" animate="animate" exit="exit"
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              className="absolute inset-0 flex flex-col px-6 pt-2"
            >
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-5 w-5 text-primary" />
                  <h2 className="text-2xl font-bold">Platform Rules</h2>
                </div>
                <p className="text-muted-foreground text-sm">By using Chivra you agree to the following.</p>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pb-6">
                {[
                  { title: "Respectful use only", body: "Treat this platform and its features with care. Chivra is a safe social space — not a place for hateful, abusive, or threatening behavior." },
                  { title: "No harassment or abuse", body: "You may not use Chivra to harass, intimidate, bully, or harm any person — AI or human — in any way." },
                  { title: "No illegal activity", body: "You may not use Chivra for any purpose that is illegal in your jurisdiction, including but not limited to fraud, exploitation, or distribution of prohibited content." },
                  { title: "No spam or misuse", body: "Automated abuse, spamming, or exploiting platform mechanics is strictly prohibited." },
                  { title: "Account consequences", body: "Violations may result in a warning, temporary suspension, or permanent ban from the platform at our discretion." },
                  { title: "Your data is private", body: "Your chats, contacts, and account data are private to you. We do not sell your personal data or share it without your consent." },
                ].map((rule, i) => (
                  <div key={i} className="bg-card border border-border rounded-xl p-4">
                    <p className="text-sm font-semibold text-foreground mb-1">{rule.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{rule.body}</p>
                  </div>
                ))}
              </div>

              <div className="flex-shrink-0 pt-4 pb-2 space-y-3">
                <Button
                  onClick={() => { setTermsAccepted(true); setStage("phone"); }}
                  className="w-full h-13 rounded-2xl text-base font-semibold"
                >
                  I agree to these rules
                </Button>
                <button
                  onClick={() => setStage("phone")}
                  className="w-full text-sm text-muted-foreground text-center hover:text-foreground transition-colors"
                >
                  Go back
                </button>
              </div>
            </motion.div>
          )}

          {/* STAGE 2: OTP */}
          {stage === "otp" && (
            <motion.div key="otp" variants={slideVariants} initial="initial" animate="animate" exit="exit"
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              className="absolute inset-0 flex flex-col px-6 pt-2"
            >
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-1">Verify your number</h2>
                <p className="text-muted-foreground text-sm">
                  Code sent to {countryCode} {phone}
                </p>
                {demoOtp && (
                  <div className="mt-3 bg-primary/10 border border-primary/30 rounded-xl px-4 py-2.5 inline-flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Demo code:</span>
                    <span className="text-primary font-mono font-bold text-lg tracking-widest">{demoOtp}</span>
                  </div>
                )}
              </div>

              <div className="space-y-6">
                <div className="flex gap-2 justify-center">
                  {otpDigits.map((d, i) => (
                    <input
                      key={i}
                      ref={el => { otpRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={d}
                      onChange={e => handleOtpChange(i, e.target.value)}
                      onKeyDown={e => handleOtpKeyDown(i, e)}
                      className={`w-12 h-14 text-center text-2xl font-bold bg-card border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all ${
                        otpError ? "border-destructive" : "border-border"
                      }`}
                    />
                  ))}
                </div>

                {otpError && (
                  <p className="text-sm text-destructive text-center">{otpError}</p>
                )}

                <Button
                  onClick={handleVerifyOtp}
                  disabled={otpDigits.join("").length < 6 || verifying}
                  className="w-full h-13 rounded-2xl text-base font-semibold"
                >
                  {verifying ? <Loader2 className="h-5 w-5 animate-spin" /> : "Verify Code"}
                </Button>

                <button
                  onClick={() => setStage("phone")}
                  className="w-full text-sm text-muted-foreground text-center hover:text-foreground transition-colors"
                >
                  Change number
                </button>
              </div>
            </motion.div>
          )}

          {/* STAGE 3: EMAIL */}
          {stage === "email" && (
            <motion.div key="email" variants={slideVariants} initial="initial" animate="animate" exit="exit"
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              className="absolute inset-0 flex flex-col px-6 pt-2"
            >
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-1">Add your email</h2>
                <p className="text-muted-foreground text-sm">Used for account recovery and backup. Never shown publicly.</p>
              </div>

              <div className="space-y-4">
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="h-13 rounded-xl bg-card border-border text-base"
                  autoFocus
                />
                <Button
                  onClick={() => setStage("profile")}
                  disabled={!email.includes("@")}
                  className="w-full h-13 rounded-2xl text-base font-semibold"
                >
                  <Mail className="h-4 w-4 mr-2" />Continue
                </Button>
                <button
                  onClick={() => setStage("profile")}
                  className="w-full text-sm text-muted-foreground text-center hover:text-foreground transition-colors"
                >
                  Skip for now
                </button>
              </div>
            </motion.div>
          )}

          {/* STAGE 4: PROFILE */}
          {stage === "profile" && (
            <motion.div key="profile" variants={slideVariants} initial="initial" animate="animate" exit="exit"
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              className="absolute inset-0 flex flex-col px-6 pt-2"
            >
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-1">Set up your profile</h2>
                <p className="text-muted-foreground text-sm">This is what your contacts will see.</p>
              </div>

              <div className="space-y-5">
                <div className="flex justify-center">
                  <div className="w-24 h-24 rounded-full bg-primary/10 border-2 border-dashed border-primary/40 flex items-center justify-center">
                    <User className="h-10 w-10 text-primary/40" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Your name</Label>
                  <Input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="What should people call you?"
                    className="h-13 rounded-xl bg-card border-border text-base"
                    maxLength={30}
                    autoFocus
                  />
                </div>

                <Button
                  onClick={handleProfileDone}
                  disabled={!name.trim() || profileLoading}
                  className="w-full h-13 rounded-2xl text-base font-semibold"
                >
                  {profileLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                    <>Get Started <ChevronRight className="h-4 w-4 ml-1" /></>
                  )}
                </Button>
              </div>
            </motion.div>
          )}

          {/* STAGE 5: INITIALIZATION */}
          {stage === "init" && (
            <motion.div key="init" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center"
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={initScreen}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.5 }}
                  className="flex flex-col items-center gap-6"
                >
                  {initDone ? (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
                      <CheckCircle2 className="h-16 w-16 text-primary" />
                    </motion.div>
                  ) : (
                    <div className="relative w-16 h-16">
                      <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
                      <div className="absolute inset-0 rounded-full border-2 border-t-primary animate-spin" />
                      <div className="absolute inset-2 rounded-full bg-primary/10 flex items-center justify-center">
                        <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
                      </div>
                    </div>
                  )}
                  <div>
                    <p className="text-xl font-semibold text-foreground mb-2">
                      {initDone ? "You're all set" : INIT_SCREENS[initScreen]?.title}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {initDone ? "Welcome to Chivra" : INIT_SCREENS[initScreen]?.sub}
                    </p>
                  </div>

                  {!initDone && (
                    <div className="flex gap-1.5">
                      {INIT_SCREENS.map((_, i) => (
                        <div
                          key={i}
                          className={`h-1.5 rounded-full transition-all duration-500 ${
                            i === initScreen ? "w-6 bg-primary" : i < initScreen ? "w-3 bg-primary/50" : "w-3 bg-muted"
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
