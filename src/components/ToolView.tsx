import { useRef, useState } from "react";
import { motion } from "framer-motion";
import type { Tool } from "@/pages/Index";
import DrumMachine from "@/components/tools/DrumMachine";
import AudioLab from "@/components/tools/AudioLab";
import BpmDetector from "@/components/tools/BpmDetector";
import SampleChopper from "@/components/tools/SampleChopper";
import StemSplitter from "@/components/tools/StemSplitter";
import AudioMastering from "@/components/tools/AudioMastering";
import NoiseGenerator from "@/components/tools/NoiseGenerator";
import VoiceRecorder from "@/components/tools/VoiceRecorder";
import AudioVisualizer from "@/components/tools/AudioVisualizer";

const TOOLS: Record<string, React.ComponentType> = {
  "drum-machine": DrumMachine, "audiolab": AudioLab, "bpm-detector": BpmDetector,
  "slicer": SampleChopper, "stem-splitter": StemSplitter, "mastering": AudioMastering,
  "noise-generator": NoiseGenerator, "voice-recorder": VoiceRecorder, "visualizer": AudioVisualizer,
};

const BG_IMAGES: Record<string, string> = {
  "drum-machine":    "https://images.unsplash.com/photo-1519892300165-cb5542fb47c7?w=1600&q=80&fit=crop",
  "audiolab":        "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=1600&q=80&fit=crop",
  "bpm-detector":    "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1600&q=80&fit=crop",
  "slicer":          "https://images.unsplash.com/photo-1563330232-57114bb0823c?w=1600&q=80&fit=crop",
  "stem-splitter":   "https://images.unsplash.com/photo-1619983081563-430f63602796?w=1600&q=80&fit=crop",
  "mastering":       "https://images.unsplash.com/photo-1598653222000-6b7b7a552625?w=1600&q=80&fit=crop",
  "noise-generator": "https://images.unsplash.com/photo-1571330735066-03aaa9429d89?w=1600&q=80&fit=crop",
  "voice-recorder":  "https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=1600&q=80&fit=crop",
  "visualizer":      "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1600&q=80&fit=crop",
};


// Workflow next-step suggestions
const NEXT_STEPS: Record<string, {label: string; reason: string; id: string; color: string}[]> = {
  "bpm-detector":   [{ label:"Split stems", reason:"Now that you know the key — isolate vocals or instruments", id:"stem-splitter", color:"#10B981" },
                     { label:"Edit in AudioLab", reason:"Trim, EQ and export the track", id:"audiolab", color:"#06B6D4" }],
  "stem-splitter":  [{ label:"Detect BPM & Key", reason:"Analyze the original track before remixing", id:"bpm-detector", color:"#3B82F6" },
                     { label:"Master the stems", reason:"Make them louder and release-ready", id:"mastering", color:"#EAB308" }],
  "audiolab":       [{ label:"Master it", reason:"Final loudness pass before publishing", id:"mastering", color:"#EAB308" },
                     { label:"Detect BPM & Key", reason:"Find the key for remixing or sampling", id:"bpm-detector", color:"#3B82F6" }],
  "drum-machine":   [{ label:"Master your beat", reason:"Glue it together and get it loud", id:"mastering", color:"#EAB308" },
                     { label:"Visualize it", reason:"Create a visual for your YouTube upload", id:"visualizer", color:"#A78BFA" }],
  "mastering":      [{ label:"Split stems", reason:"Need stems instead? Try the splitter", id:"stem-splitter", color:"#10B981" },
                     { label:"Visualize your track", reason:"Create artwork for the mastered version", id:"visualizer", color:"#A78BFA" }],
  "slicer":         [{ label:"Detect BPM & Key", reason:"Know the key of your sample", id:"bpm-detector", color:"#3B82F6" },
                     { label:"Edit in AudioLab", reason:"Further process your sliced sample", id:"audiolab", color:"#06B6D4" }],
  "voice-recorder": [{ label:"Edit in AudioLab", reason:"Clean up your recording with EQ and trim", id:"audiolab", color:"#06B6D4" },
                     { label:"Master it", reason:"Make your vocals punchy and broadcast-ready", id:"mastering", color:"#EAB308" }],
  "visualizer":     [{ label:"Edit in AudioLab", reason:"Process the audio before visualizing", id:"audiolab", color:"#06B6D4" },
                     { label:"Detect BPM", reason:"Find the tempo of what you're visualizing", id:"bpm-detector", color:"#3B82F6" }],
  "noise-generator":[{ label:"Edit in AudioLab", reason:"Layer your noise with other audio", id:"audiolab", color:"#06B6D4" }],
};

export default function ToolView({ tool, onBack, onSelectTool }: { tool: Tool; onBack: () => void; onSelectTool?: (id: string) => void }) {
  const Component = TOOLS[tool.id];
  const Icon = tool.icon;
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: "#0F0F0F" }}
    >
      {/* ── HERO HEADER ── */}
      <div className="relative shrink-0" style={{ height: "220px" }}>
        {/* Photo bg */}
        <img
          src={BG_IMAGES[tool.id]}
          alt=""
          onLoad={() => setImgLoaded(true)}
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            opacity: imgLoaded ? 0.4 : 0,
            transition: "opacity 0.8s ease",
            filter: "saturate(1.2) brightness(0.7)",
          }}
        />
        {/* Color wash */}
        <div className="absolute inset-0"
          style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 55%)" }}
        />
        {/* Bottom gradient fade */}
        <div className="absolute inset-0"
          style={{ background: "linear-gradient(to bottom, rgba(15,15,15,0.1) 0%, rgba(15,15,15,0.5) 60%, #0F0F0F 100%)" }}
        />
        {/* Left accent bar */}
        <div className="absolute left-0 top-0 bottom-0 w-1"
          style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0.4), transparent)" }}
        />

        {/* Content */}
        <div className="relative z-10 h-full flex flex-col justify-between px-10 py-6">
          {/* Back */}
          <motion.button onClick={onBack}
            whileHover={{ x: -3 }} whileTap={{ scale: 0.96 }}
            className="self-start flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
            style={{ color: "rgba(255,255,255,0.45)", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
          >← All tools</motion.button>

          {/* Tool info */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-end justify-between"
          >
            <div className="flex items-center gap-5">
              {/* Icon with glow */}
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                style={{
                  background: `${tool.color}18`,
                  border: `1px solid ${tool.color}40`,
                  boxShadow: "0 0 20px rgba(255,255,255,0.06)",
                }}
              >
                <Icon className="w-7 h-7" style={{ color: tool.color }} />
              </div>
              <div>
                <div className="text-[9px] font-black tracking-[0.2em] uppercase mb-1.5" style={{ color: tool.color }}>
                  {tool.tagline}
                </div>
                <h1 className="font-display font-black text-white leading-none"
                  style={{ fontSize: "clamp(24px,3.5vw,42px)", letterSpacing: "-0.055em", color: "#FFFFFF" }}
                >{tool.label}</h1>
              </div>
            </div>
            {/* Description — right side, white */}
            <p className="hidden lg:block text-sm font-light text-right max-w-xs"
              style={{ color: "rgba(255,255,255,0.6)", lineHeight: 1.65 }}
            >{tool.description}</p>
          </motion.div>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <motion.div
        className="flex-1 overflow-y-auto"
        style={{ padding: "36px 40px 40px" }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
      >
        {/* Subtle top separator with tool color */}
        <div className="mb-8 h-px" style={{ background: `linear-gradient(90deg, ${tool.color}40, transparent)` }} />
        {Component
          ? <Component />
          : <p className="text-white/30 text-center mt-16">Tool not found</p>
        }

        {/* Next step suggestions */}
        {NEXT_STEPS[tool.id] && (
          <div className="mt-10 pt-6" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
            <p className="text-[10px] font-black tracking-[0.18em] uppercase mb-3" style={{ color: "rgba(255,255,255,0.25)" }}>
              What to do next
            </p>
            <div className="flex gap-3 flex-wrap">
              {NEXT_STEPS[tool.id].map((step, i) => (
                <motion.button key={i}
                  onClick={() => onSelectTool ? onSelectTool(step.id) : onBack()}
                  whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }}
                  className="flex flex-col items-start px-4 py-3 rounded-xl text-left"
                  style={{ background: "rgba(40,40,40,0.8)", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  <span className="text-sm font-bold mb-0.5" style={{ color: "rgba(255,255,255,0.75)" }}>{step.label} →</span>
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{step.reason}</span>
                </motion.button>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
