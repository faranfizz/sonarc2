import { motion, AnimatePresence } from "framer-motion";
import type { ToolId } from "@/pages/Index";
import { SonarcLogoHorizontal } from "@/components/SonarcLogo";

interface Props {
  activeTool: ToolId | null;
  onSelectTool: (id: ToolId) => void;
  onHome: () => void;
  showRouter?: boolean;
  isHome?: boolean;
}

const LABELS: Record<ToolId, string> = {
  "drum-machine":"Drum Machine","audiolab":"AudioLab","bpm-detector":"BPM & Key Detector",
  "slicer":"Slicer","stem-splitter":"Stem Splitter","mastering":"Basic Mastering",
  "noise-generator":"Noise Generator","voice-recorder":"Voice Recorder","visualizer":"Audio Visualizer",
};

export default function TopNav({ activeTool, onHome, showRouter, isHome }: Props) {
  return (
    <header
      className="h-14 flex items-center justify-between px-8 shrink-0 relative z-50 transition-all duration-300"
      style={{
        background: isHome ? "transparent" : "rgba(15,15,15,0.95)",
        borderBottom: isHome ? "none" : "1px solid rgba(255,255,255,0.07)",
        backdropFilter: isHome ? "none" : "blur(20px)",
      }}
    >
      <SonarcLogoHorizontal onClick={onHome} />

      {/* Only show center + right on non-home pages */}
      <AnimatePresence>
        {!isHome && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute left-1/2 -translate-x-1/2"
          >
            <AnimatePresence mode="wait">
              {showRouter ? (
                <motion.span key="router" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                  className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.4)" }}
                >Choose a tool</motion.span>
              ) : activeTool ? (
                <motion.span key={activeTool} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                  className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.4)" }}
                >{LABELS[activeTool]}</motion.span>
              ) : null}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-3">
        <AnimatePresence>
          {!isHome && (activeTool || showRouter) && (
            <motion.button key="back" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}
              onClick={onHome} whileHover={{ x: -2 }} whileTap={{ scale: .96 }}
              className="text-xs font-medium px-3 py-1.5 rounded-lg"
              style={{ color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
            >← All tools</motion.button>
          )}
        </AnimatePresence>
        {!isHome && (
          <motion.button
            whileHover={{ scale: 1.02, background: "rgba(70,70,70,0.95)" }}
            whileTap={{ scale: .96 }}
            className="px-5 py-2 rounded-lg text-xs font-bold text-white"
            style={{ background: "rgba(50,50,50,0.95)", border: "1px solid rgba(255,255,255,0.12)" }}
          >Get started</motion.button>
        )}
      </div>
    </header>
  );
}
