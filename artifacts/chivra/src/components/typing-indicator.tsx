import { motion } from "framer-motion";

export function TypingIndicator() {
  const dotVariants = {
    initial: { y: 0, opacity: 0.5 },
    animate: { y: -4, opacity: 1 },
  };

  const transition = {
    duration: 0.5,
    repeat: Infinity,
    repeatType: "reverse" as const,
    ease: "easeInOut",
  };

  return (
    <div className="flex items-center space-x-1.5 h-6 px-2">
      <motion.div
        className="w-1.5 h-1.5 bg-primary/60 rounded-full"
        variants={dotVariants}
        initial="initial"
        animate="animate"
        transition={{ ...transition, delay: 0 }}
      />
      <motion.div
        className="w-1.5 h-1.5 bg-primary/80 rounded-full"
        variants={dotVariants}
        initial="initial"
        animate="animate"
        transition={{ ...transition, delay: 0.15 }}
      />
      <motion.div
        className="w-1.5 h-1.5 bg-primary rounded-full"
        variants={dotVariants}
        initial="initial"
        animate="animate"
        transition={{ ...transition, delay: 0.3 }}
      />
    </div>
  );
}