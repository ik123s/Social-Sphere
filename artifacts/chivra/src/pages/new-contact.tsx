import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useCreateContact, getListContactsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles, Loader2, Image as ImageIcon, Search, UserPlus, Bot,
  Users, CheckCircle2, Hash, MessageCircle, Clock, Check, X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ContactAvatar } from "@/components/contact-avatar";
import { getStoredVcn, formatVcn } from "@/lib/vcn";
import { formatDistanceToNow } from "date-fns";

type Tab = "ai" | "vcn" | "id";

interface PendingRequest {
  id: number;
  fromVcn: string;
  toVcn: string;
  status: string;
  createdAt: string;
  senderInfo: { vcn: string; displayName: string; avatarUrl?: string; statusText?: string } | null;
}

export default function NewContact() {
  const [, setLocation] = useLocation();
  const { toast }        = useToast();
  const queryClient      = useQueryClient();
  const createContact    = useCreateContact();
  const [tab, setTab]    = useState<Tab>("ai");

  // ── AI contact form ────────────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    name: "",
    gender: "female",
    personalityTone: "warm",
    languageStyle: "casual",
    emotionalBehavior: "empathetic",
    bio: "",
    avatarUrl: "",
  });
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  // ── VCN search ─────────────────────────────────────────────────────────────
  const [vcnInput,        setVcnInput]        = useState("");
  const [searching,       setSearching]       = useState(false);
  const [foundUser,       setFoundUser]       = useState<{ vcn: string; displayName: string; avatarUrl?: string; statusText: string } | null>(null);
  const [searchError,     setSearchError]     = useState("");
  const [requestSent,     setRequestSent]     = useState(false);
  const [sendingRequest,  setSendingRequest]  = useState(false);

  // ── Pending requests I received ────────────────────────────────────────────
  const [pendingRequests,  setPendingRequests]  = useState<PendingRequest[]>([]);
  const [loadingPending,   setLoadingPending]   = useState(false);
  const [respondingTo,     setRespondingTo]     = useState<number | null>(null);

  // ── Find by ID ─────────────────────────────────────────────────────────────
  const [idInput,       setIdInput]       = useState("");
  const [findingId,     setFindingId]     = useState(false);
  const [foundContact,  setFoundContact]  = useState<{
    id: number; name: string; bio: string | null; avatarUrl: string | null;
    personalityTone: string; gender: string; activityState: string;
  } | null>(null);
  const [idError, setIdError] = useState("");

  // Fetch pending requests when on VCN tab
  useEffect(() => {
    if (tab !== "vcn") return;
    const vcn = getStoredVcn();
    if (!vcn) return;
    setLoadingPending(true);
    fetch("/api/connections/pending", { headers: { "X-User-Id": vcn } })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setPendingRequests(data); })
      .catch(() => {})
      .finally(() => setLoadingPending(false));
  }, [tab]);

  const handleGenerateImage = async () => {
    if (!formData.name) {
      toast({ title: "Name required", description: "Enter a name first.", variant: "destructive" });
      return;
    }
    setIsGeneratingImage(true);
    try {
      const prompt = `A highly detailed, cinematic portrait of a ${formData.gender} named ${formData.name}. Personality: ${formData.personalityTone}. Dark, moody, neon violet lighting. Studio photography.`;
      const res = await fetch("/api/openai/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, size: "512x512" }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setFormData(prev => ({ ...prev, avatarUrl: `data:image/png;base64,${data.b64_json}` }));
      toast({ title: "Avatar generated" });
    } catch {
      toast({ title: "Failed to generate image", variant: "destructive" });
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleCreateAI = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;
    createContact.mutate({ data: formData }, {
      onSuccess: (newContact) => {
        queryClient.invalidateQueries({ queryKey: getListContactsQueryKey() });
        toast({ title: "Contact created", description: `${newContact.name} has entered your world.` });
        setLocation(`/chats/${newContact.id}`);
      },
      onError: () => toast({ title: "Creation failed", variant: "destructive" }),
    });
  };

  const handleSearchVcn = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = vcnInput.replace(/[-\s]/g, "").toUpperCase().trim();
    if (raw.length < 6) {
      setSearchError("Enter a valid VCN (e.g. ABC-1234)");
      return;
    }
    setSearching(true);
    setFoundUser(null);
    setSearchError("");
    setRequestSent(false);
    try {
      const res = await fetch(`/api/users/vcn/${raw}`);
      if (!res.ok) {
        setSearchError("No user found with that VCN. Check and try again.");
        return;
      }
      const user = await res.json();
      const myVcn = getStoredVcn();
      if (user.vcn === myVcn) {
        setSearchError("That's your own VCN.");
        return;
      }
      setFoundUser(user);
    } catch {
      setSearchError("Something went wrong. Try again.");
    } finally {
      setSearching(false);
    }
  };

  const handleSendRequest = async () => {
    if (!foundUser) return;
    const myVcn = getStoredVcn();
    if (!myVcn) {
      toast({ title: "Your VCN not found", variant: "destructive" });
      return;
    }
    setSendingRequest(true);
    try {
      const res = await fetch("/api/connections/request", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": myVcn },
        body: JSON.stringify({ toVcn: foundUser.vcn }),
      });
      if (!res.ok) throw new Error();
      setRequestSent(true);
      toast({ title: "Connection request sent", description: `Waiting for ${foundUser.displayName} to accept.` });
    } catch {
      toast({ title: "Failed to send request", variant: "destructive" });
    } finally {
      setSendingRequest(false);
    }
  };

  const handleRespond = async (requestId: number, action: "accept" | "decline") => {
    const myVcn = getStoredVcn();
    if (!myVcn) return;
    setRespondingTo(requestId);
    try {
      const res = await fetch("/api/connections/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": myVcn },
        body: JSON.stringify({ requestId, action }),
      });
      if (!res.ok) throw new Error();
      setPendingRequests(prev => prev.filter(r => r.id !== requestId));
      toast({ title: action === "accept" ? "Connected!" : "Request declined" });
    } catch {
      toast({ title: "Failed. Try again.", variant: "destructive" });
    } finally {
      setRespondingTo(null);
    }
  };

  const handleFindById = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = idInput.trim().replace(/\D/g, "");
    if (!id) { setIdError("Enter a valid contact ID (numbers only)"); return; }
    setFindingId(true);
    setFoundContact(null);
    setIdError("");
    try {
      const res = await fetch(`/api/contacts/find/${id}`);
      if (!res.ok) { setIdError("No contact found with that ID."); return; }
      setFoundContact(await res.json());
    } catch {
      setIdError("Something went wrong. Try again.");
    } finally {
      setFindingId(false);
    }
  };

  const initials = (name: string) => name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <Layout>
      <div className="flex flex-col min-h-full pb-24">
        <header className="px-4 pt-12 pb-4 bg-background/95 backdrop-blur z-10 sticky top-0 border-b border-border">
          <h1 className="text-2xl font-bold tracking-tight">Add Contact</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Create AI, find by VCN, or add by contact ID</p>
        </header>

        {/* Tab switcher */}
        <div className="px-4 pt-4">
          <div className="flex gap-1 bg-muted/40 p-1 rounded-2xl border border-border">
            {(["ai", "id", "vcn"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  tab === t ? "bg-card text-foreground shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "ai"  && <><Bot className="h-3.5 w-3.5" />AI Contact</>}
                {t === "id"  && <><Hash className="h-3.5 w-3.5" />Find by ID</>}
                {t === "vcn" && (
                  <>
                    <Users className="h-3.5 w-3.5" />
                    VCN
                    {pendingRequests.length > 0 && (
                      <span className="bg-primary text-primary-foreground text-[9px] font-black h-4 min-w-[16px] px-0.5 flex items-center justify-center rounded-full">
                        {pendingRequests.length}
                      </span>
                    )}
                  </>
                )}
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {/* ── AI CONTACT TAB ────────────────────────────────────────────── */}
          {tab === "ai" && (
            <motion.div
              key="ai"
              initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2 }}
              className="px-4 pt-5 pb-6"
            >
              <form onSubmit={handleCreateAI} className="space-y-5">
                <div className="flex flex-col items-center gap-3">
                  <div className="relative w-28 h-28 rounded-full border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-muted/30">
                    {formData.avatarUrl ? (
                      <img src={formData.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-muted-foreground opacity-40" />
                    )}
                    {isGeneratingImage && (
                      <div className="absolute inset-0 bg-background/80 flex items-center justify-center backdrop-blur-sm">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      </div>
                    )}
                  </div>
                  <Button
                    type="button" variant="outline" size="sm"
                    className="rounded-full border-primary/40 text-primary hover:bg-primary hover:text-white transition-all"
                    onClick={handleGenerateImage}
                    disabled={isGeneratingImage || !formData.name}
                  >
                    <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                    Generate Avatar
                  </Button>
                </div>

                <div className="bg-card border border-border p-5 rounded-3xl shadow-sm space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-xs uppercase tracking-wider text-muted-foreground">Name</Label>
                    <Input
                      id="name" required
                      value={formData.name}
                      onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                      placeholder="e.g. Luna, Atlas, Marcus..."
                      className="rounded-xl bg-background border-border h-11"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Gender</Label>
                      <Select value={formData.gender} onValueChange={v => setFormData(p => ({ ...p, gender: v }))}>
                        <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="non-binary">Non-binary</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Tone</Label>
                      <Select value={formData.personalityTone} onValueChange={v => setFormData(p => ({ ...p, personalityTone: v }))}>
                        <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="warm">Warm</SelectItem>
                          <SelectItem value="playful">Playful</SelectItem>
                          <SelectItem value="romantic">Romantic</SelectItem>
                          <SelectItem value="street">Street</SelectItem>
                          <SelectItem value="mysterious">Mysterious</SelectItem>
                          <SelectItem value="calm">Calm</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="bio" className="text-xs uppercase tracking-wider text-muted-foreground">Backstory</Label>
                    <Textarea
                      id="bio"
                      value={formData.bio}
                      onChange={e => setFormData(p => ({ ...p, bio: e.target.value }))}
                      placeholder="Who are they? What do they care about?"
                      className="rounded-xl bg-background border-border resize-none h-20"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-13 rounded-2xl text-base font-semibold shadow-lg"
                  disabled={createContact.isPending || !formData.name}
                >
                  {createContact.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                    <><Sparkles className="w-4 h-4 mr-2" />Summon Contact</>
                  )}
                </Button>
              </form>
            </motion.div>
          )}

          {/* ── FIND BY ID TAB ────────────────────────────────────────────── */}
          {tab === "id" && (
            <motion.div
              key="id"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.2 }}
              className="px-4 pt-5 pb-6 space-y-5"
            >
              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Paste a contact ID shared with you in chat to start talking with them immediately.
                </p>
              </div>
              <form onSubmit={handleFindById} className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Contact ID</Label>
                  <div className="flex gap-2">
                    <Input
                      value={idInput}
                      onChange={e => { setIdInput(e.target.value); setIdError(""); setFoundContact(null); }}
                      placeholder="e.g. 3"
                      className="rounded-xl h-12 bg-background border-border font-mono tracking-widest text-base"
                      type="text" inputMode="numeric"
                    />
                    <Button type="submit" className="h-12 px-4 rounded-xl flex-shrink-0" disabled={findingId || !idInput.trim()}>
                      {findingId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                  </div>
                  {idError && <p className="text-xs text-destructive px-1">{idError}</p>}
                </div>
              </form>
              <AnimatePresence>
                {foundContact && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                    className="bg-card border border-border rounded-3xl p-5 space-y-4 shadow-sm"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-0.5 rounded-full bg-gradient-to-tr from-violet-500 to-pink-500">
                        <div className="p-0.5 rounded-full bg-card">
                          <ContactAvatar src={foundContact.avatarUrl} name={foundContact.name} activityState={foundContact.activityState} size="md" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-lg leading-tight">{foundContact.name}</p>
                        {foundContact.bio && <p className="text-sm text-muted-foreground leading-snug mt-0.5">{foundContact.bio}</p>}
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="text-[10px] text-primary/70 font-mono bg-primary/10 px-2 py-0.5 rounded-full">ID: {foundContact.id}</span>
                          <span className="text-[10px] text-muted-foreground capitalize">{foundContact.personalityTone}</span>
                        </div>
                      </div>
                    </div>
                    <Button className="w-full h-11 rounded-2xl font-semibold" onClick={() => setLocation(`/chats/${foundContact.id}`)}>
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Start Chatting
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* ── VCN TAB ───────────────────────────────────────────────────── */}
          {tab === "vcn" && (
            <motion.div
              key="vcn"
              initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.2 }}
              className="px-4 pt-5 pb-6 space-y-5"
            >
              {/* Pending requests I received */}
              {(loadingPending || pendingRequests.length > 0) && (
                <div className="space-y-3">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Connection Requests</p>
                  {loadingPending ? (
                    <div className="flex items-center gap-2 py-3 text-muted-foreground text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading requests...
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {pendingRequests.map(req => (
                        <motion.div
                          key={req.id}
                          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                          className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3"
                        >
                          <div className="p-0.5 rounded-full bg-gradient-to-tr from-violet-500 to-pink-500 flex-shrink-0">
                            <div className="p-0.5 rounded-full bg-card">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={req.senderInfo?.avatarUrl} />
                                <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                                  {(req.senderInfo?.displayName ?? "?")[0]?.toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm leading-tight">{req.senderInfo?.displayName ?? req.fromVcn}</p>
                            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{formatVcn(req.fromVcn)}</p>
                            <p className="text-[10px] text-muted-foreground/60 flex items-center gap-1 mt-0.5">
                              <Clock className="h-2.5 w-2.5" />
                              {formatDistanceToNow(new Date(req.createdAt), { addSuffix: true })}
                            </p>
                          </div>
                          <div className="flex gap-1.5 flex-shrink-0">
                            <button
                              onClick={() => handleRespond(req.id, "accept")}
                              disabled={respondingTo === req.id}
                              className="h-9 w-9 rounded-full bg-emerald-500/15 flex items-center justify-center active:bg-emerald-500/30 transition-all disabled:opacity-50"
                            >
                              {respondingTo === req.id ? <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" /> : <Check className="h-3.5 w-3.5 text-emerald-400" />}
                            </button>
                            <button
                              onClick={() => handleRespond(req.id, "decline")}
                              disabled={respondingTo === req.id}
                              className="h-9 w-9 rounded-full bg-destructive/10 flex items-center justify-center active:bg-destructive/20 transition-all disabled:opacity-50"
                            >
                              <X className="h-3.5 w-3.5 text-destructive" />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                  <div className="border-t border-border/40" />
                </div>
              )}

              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Enter someone's Virtual Chat Number (VCN) to send them a connection request. Their real phone number stays private.
                </p>
              </div>

              <form onSubmit={handleSearchVcn} className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Virtual Chat Number</Label>
                  <div className="flex gap-2">
                    <Input
                      value={vcnInput}
                      onChange={e => { setVcnInput(e.target.value); setSearchError(""); setFoundUser(null); setRequestSent(false); }}
                      placeholder="e.g. ABC-1234"
                      className="rounded-xl h-12 bg-background border-border font-mono tracking-widest text-base uppercase"
                      maxLength={9}
                    />
                    <Button type="submit" className="h-12 px-4 rounded-xl flex-shrink-0" disabled={searching || vcnInput.length < 3}>
                      {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                  </div>
                  {searchError && <p className="text-xs text-destructive px-1">{searchError}</p>}
                </div>
              </form>

              <AnimatePresence>
                {foundUser && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                    className="bg-card border border-border rounded-3xl p-5 space-y-4 shadow-sm"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-0.5 rounded-full bg-gradient-to-tr from-violet-500 to-pink-500">
                        <div className="p-0.5 rounded-full bg-card">
                          <Avatar className="h-14 w-14">
                            <AvatarImage src={foundUser.avatarUrl} />
                            <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">
                              {initials(foundUser.displayName)}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-lg leading-tight">{foundUser.displayName}</p>
                        <p className="text-xs text-muted-foreground">{foundUser.statusText}</p>
                        <p className="text-[10px] text-primary/70 font-mono mt-0.5">{formatVcn(foundUser.vcn)}</p>
                      </div>
                    </div>

                    {requestSent ? (
                      <div className="flex items-center justify-center gap-2.5 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/25">
                        <Clock className="h-4 w-4 text-amber-400" />
                        <div>
                          <p className="text-sm font-semibold text-amber-400">Request Sent</p>
                          <p className="text-xs text-muted-foreground">Waiting for {foundUser.displayName} to accept</p>
                        </div>
                      </div>
                    ) : (
                      <Button
                        onClick={handleSendRequest}
                        disabled={sendingRequest}
                        className="w-full h-11 rounded-2xl font-semibold"
                      >
                        {sendingRequest ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                          <><UserPlus className="h-4 w-4 mr-2" />Send Connection Request</>
                        )}
                      </Button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
}
