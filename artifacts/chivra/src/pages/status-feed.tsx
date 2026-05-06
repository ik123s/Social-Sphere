import { useListContactStatus } from "@workspace/api-client-react";
import { useGetDashboardSummary, useGetStatusFeed } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { ContactAvatar } from "@/components/contact-avatar";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";

export default function StatusFeed() {
  const { data: feed, isLoading } = useGetStatusFeed();

  return (
    <Layout>
      <div className="flex flex-col min-h-full pb-20">
        <header className="px-4 pt-12 pb-4 bg-background/95 backdrop-blur z-10 sticky top-0 border-b border-border shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight">Status</h1>
        </header>

        <div className="px-4 py-4 space-y-6">
          {isLoading ? (
            Array(3).fill(0).map((_, i) => (
              <div key={i} className="space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-1">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-2 w-16" />
                  </div>
                </div>
                <Skeleton className="h-40 w-full rounded-2xl" />
              </div>
            ))
          ) : feed?.length === 0 ? (
            <div className="text-center text-muted-foreground mt-20">
              <p>No recent status updates.</p>
            </div>
          ) : (
            feed?.map((post, i) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-card border border-border rounded-3xl p-4 shadow-sm"
              >
                <div className="flex items-center gap-3 mb-4">
                  <ContactAvatar src={post.contactAvatarUrl} name={post.contactName} size="sm" />
                  <div>
                    <h3 className="font-semibold text-sm">{post.contactName}</h3>
                    <p className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
                
                {post.imageUrl && (
                  <div className="mb-4 rounded-xl overflow-hidden shadow-inner aspect-[4/5] bg-muted relative">
                    <img 
                      src={post.imageUrl} 
                      alt="Status update" 
                      className="object-cover w-full h-full"
                      loading="lazy"
                    />
                  </div>
                )}
                
                <p className="text-sm leading-relaxed text-card-foreground">
                  {post.content}
                </p>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}