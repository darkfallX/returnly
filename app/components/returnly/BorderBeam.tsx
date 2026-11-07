// Adapted from Magic UI Border Beam (MIT). See THIRD_PARTY_NOTICES.md.
import { motion, useReducedMotion } from "framer-motion";

/** A single entrance sweep, decorative only; never represents a saved action. */
export function BorderBeam() {
  const reduced = useReducedMotion();
  if (reduced) return null;
  return (
    <div aria-hidden="true" className="returnly-border-beam">
      <motion.div
        style={{ offsetPath: "rect(0 auto auto 0 round 28px)" }}
        initial={{ offsetDistance: "0%", opacity: 0 }}
        animate={{ offsetDistance: "100%", opacity: [0, 1, 1, 0] }}
        transition={{ duration: 3, ease: "linear", delay: 0.3 }}
      />
    </div>
  );
}
