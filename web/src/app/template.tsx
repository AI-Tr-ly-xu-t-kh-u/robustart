"use client";
import { motion } from "motion/react";
import type { ReactNode } from "react";

/** Template được dựng lại mỗi lần đổi trang nên mỗi trang đều vào bằng một nhịp mờ dần mượt. */
export default function Template({ children }: { children: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
}
