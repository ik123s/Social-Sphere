import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface ContactAvatarProps {
  src?: string | null;
  name: string;
  activityState?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function ContactAvatar({ src, name, activityState, size = "md", className }: ContactAvatarProps) {
  const sizeClasses = {
    sm: "h-8 w-8 text-xs",
    md: "h-12 w-12 text-sm",
    lg: "h-16 w-16 text-lg",
    xl: "h-24 w-24 text-xl",
  };

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className={cn("relative inline-block", className)}>
      <Avatar className={cn(sizeClasses[size], "border border-border/50 shadow-sm")}>
        <AvatarImage src={src || undefined} alt={name} className="object-cover" />
        <AvatarFallback className="bg-muted text-muted-foreground font-medium">{initials}</AvatarFallback>
      </Avatar>

      {activityState && (
        <ActivityBadge state={activityState} size={size} />
      )}
    </div>
  );
}

function ActivityBadge({ state, size }: { state: string; size: string }) {
  const badgeClasses = {
    online: "bg-green-500",
    away: "bg-yellow-500",
    thinking: "bg-primary animate-pulse",
    busy: "bg-destructive",
  };

  const badgeSizes = {
    sm: "h-2 w-2 right-0 bottom-0",
    md: "h-3 w-3 right-0 bottom-0 border-2",
    lg: "h-4 w-4 right-1 bottom-1 border-2",
    xl: "h-5 w-5 right-1 bottom-1 border-[3px]",
  };

  const colorClass = badgeClasses[state.toLowerCase() as keyof typeof badgeClasses] || "bg-muted";
  const sizeClass = badgeSizes[size as keyof typeof badgeSizes];

  return (
    <span
      className={cn(
        "absolute rounded-full border-background",
        colorClass,
        sizeClass
      )}
    />
  );
}