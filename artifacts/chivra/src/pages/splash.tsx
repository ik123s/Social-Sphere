import { useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";

export default function Splash() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const timer = setTimeout(() => {
      setLocation("/chats");
    }, 2500);
    return () => clearTimeout(timer);
  }, [setLocation]);

  return (
    <div className="flex flex-col items-center justify-center h-[100dvh] w-full bg-background overflow-hidden max-w-md mx-auto border-x border-border">
      <motion.div
        initial={{ opacity: 0, scale: 0.8, filter: "blur(10px)" }}
        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="flex flex-col items-center space-y-6"
      >
        <div className="relative w-24 h-24">
          <div className="absolute inset-0 bg-primary/30 rounded-full blur-xl animate-pulse" />
          <div className="absolute inset-0 bg-gradient-to-br from-primary to-accent rounded-3xl rotate-45 flex items-center justify-center shadow-2xl border border-white/10 backdrop-blur-md">
            <span className="-rotate-45 text-white font-serif italic text-4xl">C</span>
          </div>
        </div>
        <motion.h1 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="text-3xl font-light tracking-widest text-foreground drop-shadow-md"
        >
          CHIVRA
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 1 }}
          className="text-muted-foreground text-sm font-medium tracking-wider uppercase"
        >
          Your AI Social World
        </motion.p>
      </motion.div>
    </div>
  );
}