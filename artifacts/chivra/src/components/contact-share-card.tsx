import { useGetContact } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { ContactAvatar } from "@/components/contact-avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageCircle, UserPlus, Hash } from "lucide-react";
import { motion } from "framer-motion";

interface Props {
  contactId: number;
  referredBy?: string;
}

export function ContactShareCard({ contactId, referredBy }: Props) {
  const { data: contact, isLoading } = useGetContact(contactId);
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="bg-card/60 border border-primary/20 rounded-2xl p-3.5 mt-1.5 max-w-[240px] space-y-3">
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
          <div className="space-y-1.5 flex-1">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-2.5 w-32" />
          </div>
        </div>
        <Skeleton className="h-8 w-full rounded-xl" />
      </div>
    );
  }

  if (!contact) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className="bg-gradient-to-br from-card via-card to-primary/5 border border-primary/25 rounded-2xl p-3.5 mt-1.5 max-w-[240px] shadow-md shadow-primary/10"
    >
      {/* Referred by tag */}
      {referredBy && (
        <p className="text-[9px] text-primary/60 uppercase tracking-wider font-semibold mb-2">
          Shared by {referredBy}
        </p>
      )}

      {/* Contact preview */}
      <div className="flex items-center gap-2.5 mb-3">
        <div className="p-0.5 rounded-full bg-gradient-to-tr from-violet-500 to-pink-500 flex-shrink-0">
          <div className="p-0.5 rounded-full bg-card">
            <ContactAvatar src={contact.avatarUrl} name={contact.name} size="sm" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-tight">{contact.name}</p>
          {contact.bio && (
            <p className="text-[11px] text-muted-foreground truncate leading-tight mt-0.5">{contact.bio}</p>
          )}
        </div>
      </div>

      {/* Contact ID badge */}
      <div className="flex items-center gap-1.5 text-[10px] text-primary/60 font-mono mb-3 bg-primary/5 rounded-xl px-2 py-1.5">
        <Hash className="h-3 w-3" />
        <span>ID: {contactId}</span>
        <span className="ml-auto capitalize text-muted-foreground/60">{contact.personalityTone}</span>
      </div>

      {/* Action button */}
      <Button
        size="sm"
        className="w-full h-8 rounded-xl text-xs font-semibold"
        onClick={() => setLocation(`/chats/${contactId}`)}
      >
        <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
        Start Chatting
      </Button>
    </motion.div>
  );
}
