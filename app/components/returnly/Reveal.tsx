// Adapted from Magic UI Blur Fade (MIT). See THIRD_PARTY_NOTICES.md.
import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

import { MOTION } from "@/lib/motion-tokens";

export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, y: 16, filter: "blur(3px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{
        duration: reduced ? 0 : 0.65,
        delay: reduced ? 0 : delay,
        ease: MOTION.easeOutExpo,
      }}
    >
      {children}
    </motion.div>
  );
}
