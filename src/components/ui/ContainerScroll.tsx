import { useRef } from "react";
import { useScroll, useTransform, motion } from "framer-motion";

interface ContainerScrollProps {
  titleComponent: React.ReactNode;
  children: React.ReactNode;
  containerRef?: React.RefObject<HTMLDivElement>;
}

export function ContainerScroll({ titleComponent, children, containerRef }: ContainerScrollProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    container: containerRef,
    offset: ["start end", "end start"],
  });

  const rotate = useTransform(scrollYProgress, [0, 0.5], [18, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.5], [0.92, 1]);
  const translateY = useTransform(scrollYProgress, [0, 0.5], [60, 0]);
  const opacity = useTransform(scrollYProgress, [0, 0.3], [0.3, 1]);

  return (
    <div ref={ref} className="flex flex-col items-center justify-center relative">
      {/* Title */}
      <motion.div style={{ translateY }} className="text-center mb-8 z-10 relative">
        {titleComponent}
      </motion.div>

      {/* 3D card */}
      <motion.div
        style={{
          rotateX: rotate,
          scale,
          opacity,
          transformPerspective: "1200px",
          boxShadow: "0 0 0 1px rgba(255,255,255,0.08), 0 40px 80px rgba(0,0,0,0.6), 0 0 80px rgba(124,58,237,0.15)",
        }}
        className="w-full max-w-4xl rounded-2xl overflow-hidden"
        initial={{ rotateX: 18, scale: 0.92 }}
      >
        <div className="w-full rounded-2xl overflow-hidden"
          style={{ background: "#181818", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          {children}
        </div>
      </motion.div>
    </div>
  );
}
