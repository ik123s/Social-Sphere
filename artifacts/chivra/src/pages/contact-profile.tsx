import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { 
  useGetContact, 
  useGetContactActivity, 
  useGetRelationship,
  useUpdateRelationship,
  useGetMemory,
  useListContactStatus,
  getGetRelationshipQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { ContactAvatar } from "@/components/contact-avatar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MessageCircle, Heart, Star, Sparkles, Brain, Clock } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

const RELATIONSHIP_COLORS = {
  STRANGER: "bg-gray-500",
  FRIEND: "bg-blue-500",
  "BEST FRIEND": "bg-green-500",
  PARTNER: "bg-pink-500",
};

const RELATIONSHIP_LEVELS = ["STRANGER", "FRIEND", "BEST FRIEND", "PARTNER"];

export default function ContactProfile() {
  const { id } = useParams<{ id: string }>();
  const contactId = parseInt(id || "0", 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: contact, isLoading: isContactLoading } = useGetContact(contactId);
  const { data: activity } = useGetContactActivity(contactId);
  const { data: relationship, isLoading: isRelLoading } = useGetRelationship(contactId);
  const { data: memory, isLoading: isMemoryLoading } = useGetMemory(contactId);
  const { data: statuses, isLoading: isStatusesLoading } = useListContactStatus(contactId);
  
  const updateRelationship = useUpdateRelationship();

  const handleUpgradeRelationship = () => {
    if (!relationship) return;
    const currentIndex = RELATIONSHIP_LEVELS.indexOf(relationship.state);
    if (currentIndex < RELATIONSHIP_LEVELS.length - 1) {
      const nextLevel = RELATIONSHIP_LEVELS[currentIndex + 1];
      updateRelationship.mutate(
        { id: contactId, data: { state: nextLevel } },
        {
          onSuccess: (data) => {
            queryClient.setQueryData(getGetRelationshipQueryKey(contactId), data);
            toast({
              title: "Relationship Updated",
              description: `Your relationship with ${contact?.name} is now ${nextLevel}.`,
            });
          }
        }
      );
    }
  };

  if (isContactLoading) {
    return (
      <Layout showNav={false}>
        <div className="p-4 space-y-6">
          <Skeleton className="h-32 w-32 rounded-full mx-auto" />
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-24 w-full" />
        </div>
      </Layout>
    );
  }

  if (!contact) return <Layout showNav={false}><div className="p-4 text-center">Contact not found</div></Layout>;

  const currentState = relationship?.state || "STRANGER";
  const stateColor = RELATIONSHIP_COLORS[currentState as keyof typeof RELATIONSHIP_COLORS] || "bg-gray-500";

  return (
    <Layout showNav={false}>
      <div className="flex flex-col min-h-full bg-background relative overflow-x-hidden">
        {/* Header background with blurred avatar */}
        <div className="absolute top-0 left-0 right-0 h-64 overflow-hidden z-0 pointer-events-none opacity-30 dark:opacity-20">
          {contact.avatarUrl ? (
            <img src={contact.avatarUrl} className="w-full h-full object-cover blur-3xl scale-110" alt="" />
          ) : (
            <div className="w-full h-full bg-primary blur-3xl" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background" />
        </div>

        <header className="px-4 py-3 sticky top-0 z-10 flex items-center justify-between">
          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full bg-background/50 backdrop-blur-md" onClick={() => setLocation("/chats")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </header>

        <div className="flex-1 px-6 pb-8 z-10 relative mt-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center mb-8"
          >
            <ContactAvatar 
              src={contact.avatarUrl} 
              name={contact.name} 
              activityState={activity?.activityState || contact.activityState} 
              size="xl" 
              className="mb-4 shadow-xl ring-4 ring-background"
            />
            
            <h1 className="text-3xl font-bold tracking-tight mb-1">{contact.name}</h1>
            
            <div className="flex items-center gap-2 mb-4">
              <span className={`px-3 py-1 rounded-full text-xs font-bold text-white shadow-sm ${stateColor}`}>
                {currentState}
              </span>
              <span className="text-sm text-muted-foreground bg-muted/50 px-3 py-1 rounded-full flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {activity?.activityState || contact.activityState}
              </span>
            </div>

            <div className="flex gap-3 w-full max-w-xs mt-2">
              <Button 
                className="flex-1 rounded-2xl h-12 shadow-md"
                onClick={() => setLocation(`/chats/${contact.id}`)}
              >
                <MessageCircle className="mr-2 h-5 w-5" />
                Message
              </Button>
              {currentState !== "PARTNER" && (
                <Button 
                  variant="secondary" 
                  className="flex-1 rounded-2xl h-12 shadow-sm border border-border"
                  onClick={handleUpgradeRelationship}
                  disabled={updateRelationship.isPending}
                >
                  <Heart className="mr-2 h-5 w-5 text-pink-500" />
                  Connect
                </Button>
              )}
            </div>
          </motion.div>

          <div className="space-y-8">
            <section>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Personality
              </h2>
              <div className="bg-card border border-border rounded-3xl p-5 shadow-sm space-y-4">
                {contact.bio && (
                  <p className="text-sm text-card-foreground leading-relaxed italic border-l-2 border-primary/50 pl-3">
                    "{contact.bio}"
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <span className="bg-primary/10 text-primary px-3 py-1 rounded-lg text-xs font-medium border border-primary/20">
                    Tone: {contact.personalityTone}
                  </span>
                  <span className="bg-accent/10 text-accent px-3 py-1 rounded-lg text-xs font-medium border border-accent/20">
                    Style: {contact.languageStyle}
                  </span>
                  <span className="bg-secondary px-3 py-1 rounded-lg text-xs font-medium">
                    {contact.emotionalBehavior}
                  </span>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Brain className="w-5 h-5 text-primary" />
                Memory & Context
              </h2>
              <div className="bg-card border border-border rounded-3xl p-5 shadow-sm">
                {isMemoryLoading ? (
                  <div className="space-y-2"><Skeleton className="h-4 w-full"/><Skeleton className="h-4 w-2/3"/></div>
                ) : memory && memory.facts.length > 0 ? (
                  <ul className="space-y-2">
                    {memory.facts.map((fact, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <Star className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
                        <span className="text-card-foreground">{fact}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No significant memories yet. Chat more to build context.</p>
                )}
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-3">Recent Status</h2>
              <div className="space-y-4">
                {isStatusesLoading ? (
                  <div className="space-y-2"><Skeleton className="h-32 w-full rounded-2xl"/></div>
                ) : statuses && statuses.length > 0 ? (
                  statuses.map((status) => (
                    <div key={status.id} className="bg-card border border-border rounded-3xl p-4 shadow-sm">
                      <p className="text-sm mb-3">{status.content}</p>
                      {status.imageUrl && (
                        <div className="rounded-xl overflow-hidden mb-3 aspect-[4/3]">
                          <img src={status.imageUrl} className="w-full h-full object-cover" alt="Status" />
                        </div>
                      )}
                      <p className="text-[10px] text-muted-foreground text-right">
                        {formatDistanceToNow(new Date(status.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="bg-card border border-border rounded-3xl p-6 text-center shadow-sm">
                    <p className="text-sm text-muted-foreground">No recent updates.</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </Layout>
  );
}