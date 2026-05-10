import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { getAccountCreatedAt } from "@/lib/vcn";

const DISMISSED_KEY = "chivra_review_dismissed";
const MIN_AGE_MS = 5 * 60 * 1000; // show after 5 minutes of use

export default function ReviewPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISSED_KEY);
    if (dismissed) return;

    const createdAt = getAccountCreatedAt();
    if (!createdAt) return;

    const age = Date.now() - createdAt;
    if (age >= MIN_AGE_MS) {
      setVisible(true);
      return;
    }

    // Not old enough yet — schedule check
    const remaining = MIN_AGE_MS - age;
    const timer = setTimeout(() => {
      if (!localStorage.getItem(DISMISSED_KEY)) {
        setVisible(true);
      }
    }, remaining);

    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm"
        >
          <div className="bg-card border border-border rounded-2xl px-4 py-3.5 shadow-2xl flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground leading-tight">
                Enjoying Chivra?
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                If you like it, leave a review — it helps a lot.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={dismiss}
                className="text-xs text-primary font-semibold px-3 py-1.5 bg-primary/10 rounded-xl hover:bg-primary/20 transition-colors"
              >
                Rate it
              </button>
              <button
                onClick={dismiss}
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
