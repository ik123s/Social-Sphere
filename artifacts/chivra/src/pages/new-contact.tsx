import { useState } from "react";
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
import { Sparkles, Loader2, Image as ImageIcon } from "lucide-react";
import { motion } from "framer-motion";

export default function NewContact() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createContact = useCreateContact();
  
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

  const handleGenerateImage = async () => {
    if (!formData.name) {
      toast({ title: "Name required", description: "Please enter a name first to guide the appearance.", variant: "destructive" });
      return;
    }
    
    setIsGeneratingImage(true);
    try {
      const prompt = `A highly detailed, cinematic portrait of a ${formData.gender} named ${formData.name}. Personality: ${formData.personalityTone}. Atmosphere: dark, moody, neon purple and violet lighting, intimate. Studio photography, 85mm lens, sharp focus.`;
      
      const res = await fetch("/api/openai/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, size: "512x512" }),
      });
      
      if (!res.ok) throw new Error("Image generation failed");
      const data = await res.json();
      
      setFormData(prev => ({ ...prev, avatarUrl: `data:image/png;base64,${data.b64_json}` }));
      toast({ title: "Avatar generated!" });
    } catch (error) {
      toast({ title: "Failed to generate image", variant: "destructive" });
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;
    
    createContact.mutate({ data: formData }, {
      onSuccess: (newContact) => {
        queryClient.invalidateQueries({ queryKey: getListContactsQueryKey() });
        toast({ title: "Contact Created", description: `${newContact.name} has entered your world.` });
        setLocation(`/chats/${newContact.id}`);
      },
      onError: () => {
        toast({ title: "Creation failed", variant: "destructive" });
      }
    });
  };

  return (
    <Layout>
      <div className="flex flex-col min-h-full pb-20 px-4 pt-12">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Create Connection</h1>
          <p className="text-muted-foreground text-sm mt-1">Summon a new AI personality into your world.</p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-6">
          <motion.div 
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="flex flex-col items-center justify-center space-y-4"
          >
            <div className="relative w-32 h-32 rounded-full border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-muted/30">
              {formData.avatarUrl ? (
                <img src={formData.avatarUrl} alt="Avatar preview" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className="w-8 h-8 text-muted-foreground opacity-50" />
              )}
              {isGeneratingImage && (
                <div className="absolute inset-0 bg-background/80 flex items-center justify-center backdrop-blur-sm">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              )}
            </div>
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              className="rounded-full border-primary/50 text-primary hover:bg-primary hover:text-white"
              onClick={handleGenerateImage}
              disabled={isGeneratingImage || !formData.name}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Avatar
            </Button>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="space-y-4 bg-card border border-border p-5 rounded-3xl shadow-sm">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-xs uppercase tracking-wider text-muted-foreground">Name</Label>
              <Input 
                id="name" 
                required 
                value={formData.name} 
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))} 
                placeholder="e.g. Luna, Atlas..."
                className="rounded-xl bg-background border-border h-12"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Gender</Label>
                <Select value={formData.gender} onValueChange={v => setFormData(prev => ({ ...prev, gender: v }))}>
                  <SelectTrigger className="rounded-xl h-12"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="non-binary">Non-binary</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Tone</Label>
                <Select value={formData.personalityTone} onValueChange={v => setFormData(prev => ({ ...prev, personalityTone: v }))}>
                  <SelectTrigger className="rounded-xl h-12"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="warm">Warm</SelectItem>
                    <SelectItem value="playful">Playful</SelectItem>
                    <SelectItem value="romantic">Romantic</SelectItem>
                    <SelectItem value="street">Street</SelectItem>
                    <SelectItem value="formal">Formal</SelectItem>
                    <SelectItem value="calm">Calm</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio" className="text-xs uppercase tracking-wider text-muted-foreground">Backstory / Bio</Label>
              <Textarea 
                id="bio" 
                value={formData.bio} 
                onChange={e => setFormData(prev => ({ ...prev, bio: e.target.value }))} 
                placeholder="Who are they? What do they care about?"
                className="rounded-xl bg-background border-border resize-none h-24"
              />
            </div>
          </motion.div>

          <Button 
            type="submit" 
            className="w-full h-14 rounded-2xl text-lg font-semibold shadow-lg bg-primary hover:bg-primary/90 text-white"
            disabled={createContact.isPending || !formData.name}
          >
            {createContact.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Summon Contact"}
          </Button>
        </form>
      </div>
    </Layout>
  );
}