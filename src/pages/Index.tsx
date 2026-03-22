import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Drum, Radio, Activity, Scissors, Layers, Wind, Zap, Mic, Eye } from "lucide-react";
import TopNav from "@/components/TopNav";
import HomePage from "@/components/HomePage";
import ToolView from "@/components/ToolView";
import SmartRouter from "@/components/SmartRouter";

export type ToolId = "drum-machine"|"audiolab"|"bpm-detector"|"slicer"|"stem-splitter"|"mastering"|"noise-generator"|"voice-recorder"|"visualizer";

export interface Tool {
  id: ToolId;
  label: string;
  tagline: string;
  description: string;
  icon: React.ElementType;
  tag?: string;
  color: string;
  gradient: string;
  image: string;
  category: "producer"|"creator"|"more";
  slug: string;
}

export const tools: Tool[] = [
  { id:"bpm-detector", label:"BPM & Key Detector", tagline:"Know your track instantly.",
    description:"Upload any song. Detects BPM, musical key and scale. Essential for every producer.",
    icon:Activity, tag:"🔥 Popular", color:"#888888", category:"producer",
    gradient:"linear-gradient(135deg,#0a0e2e,#0f1640,#050810)", image:"/images/slicer.png", slug:"bpm-detector" },
  { id:"stem-splitter", label:"Stem Splitter", tagline:"Separate any track.",
    description:"AI separates any song into vocals, drums, bass and instruments. Download each stem.",
    icon:Layers, tag:"🔥 Viral", color:"#888888", category:"producer",
    gradient:"linear-gradient(135deg,#001a0e,#003020,#000e08)", image:"/images/unmix.png", slug:"stem-splitter" },
  { id:"audiolab", label:"AudioLab", tagline:"Trim. Mix. Convert. Export.",
    description:"Convert video to audio, trim clips, add reverb & EQ, compress, normalize. Export WAV, WebM or OGG.",
    icon:Radio, tag:"New", color:"#888888", category:"creator",
    gradient:"linear-gradient(135deg,#020e14,#041a24,#010810)", image:"/images/audiolab.png", slug:"audiolab" },
  { id:"drum-machine", label:"Drum Machine", tagline:"Build your beats.",
    description:"16-step sequencer with 808, Trap and Lo-Fi kits. Swing control. Export as WAV.",
    icon:Drum, color:"#888888", category:"producer",
    gradient:"linear-gradient(135deg,#0a0e2e,#0f1640,#050810)", image:"/images/drum.png", slug:"drum-machine" },
  { id:"mastering", label:"Basic Mastering", tagline:"Quick loudness fix.",
    description:"EQ, compression and limiting chain. A quick loudness boost — not a professional session, but a real improvement.",
    icon:Zap, tag:"Pro", color:"#888888", category:"producer",
    gradient:"linear-gradient(135deg,#1a1400,#2e2400,#0e0e00)", image:"/images/audiolab.png", slug:"mastering" },
  { id:"slicer", label:"Slicer", tagline:"Chop any audio.",
    description:"Sample chopper. Drop any audio, auto-detect every hit and slice into individual samples.",
    icon:Scissors, color:"#888888", category:"producer",
    gradient:"linear-gradient(135deg,#1a0e00,#2e1a00,#0e0800)", image:"/images/slicer.png", slug:"slicer" },
  { id:"voice-recorder", label:"Voice Recorder", tagline:"Record anything.",
    description:"Record from mic with echo cancellation. Live waveform, volume meter. Export WAV.",
    icon:Mic, color:"#888888", category:"creator",
    gradient:"linear-gradient(135deg,#1a0000,#2e0000,#0e0000)", image:"/images/drum.png", slug:"voice-recorder" },
  { id:"visualizer", label:"Audio Visualizer", tagline:"See your sound.",
    description:"Upload audio and watch it come alive. Custom image background. 5 visual styles.",
    icon:Eye, color:"#888888", category:"creator",
    gradient:"linear-gradient(135deg,#0e0520,#180a3a,#050210)", image:"/images/unmix.png", slug:"visualizer" },
  { id:"noise-generator", label:"Noise Generator", tagline:"Generate & download.",
    description:"Generate white, pink or brown noise. Play in browser or download as WAV for music production.",
    icon:Wind, color:"#888888", category:"more",
    gradient:"linear-gradient(135deg,#0e0520,#180a3a,#050210)", image:"/images/midi.png", slug:"noise-generator" },
];

const slugToId: Record<string, ToolId> = Object.fromEntries(tools.map(t => [t.slug, t.id]));
const idToSlug: Record<string, string> = Object.fromEntries(tools.map(t => [t.id, t.slug]));

function getRouteFromPath(): { type: "home"|"tool"|"router"; toolId?: ToolId } {
  const path = window.location.pathname.replace(/^\//, "");
  if (!path) return { type: "home" };
  if (path === "upload") return { type: "router" };
  const toolId = slugToId[path];
  if (toolId) return { type: "tool", toolId };
  return { type: "home" };
}

const Index = () => {
  const [route, setRoute] = useState(getRouteFromPath);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [betaBanner, setBetaBanner] = useState(true);

  const goHome = () => { setRoute({ type: "home" }); window.history.pushState({}, "", "/"); document.title = "Sonarc — The ultimate audio toolkit"; };
  const goRouter = (file?: File) => { setPendingFile(file || null); setRoute({ type: "router" }); window.history.pushState({}, "", "/upload"); document.title = "Sonarc — Choose a tool"; };
  const goTool = (id: ToolId) => { setRoute({ type: "tool", toolId: id }); window.history.pushState({}, "", `/${idToSlug[id]}`); document.title = `${tools.find(t => t.id === id)?.label} — Sonarc`; };

  const handleSelectTool = (id: ToolId, _file?: File) => goTool(id);

  useEffect(() => {
    const handler = () => setRoute(getRouteFromPath());
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  const activeTool = route.type === "tool" ? route.toolId || null : null;

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: "#0F0F0F" }}>
      <AnimatePresence>
        {betaBanner && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="relative flex items-center justify-center px-4 py-2 shrink-0 text-xs"
            style={{ background: "rgba(25,25,25,0.95)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}
          >
            <span className="font-semibold" style={{color:"rgba(255,255,255,0.7)"}}>🎙️ Sonarc is in beta —</span>
            <span className="ml-1.5" style={{ color: "rgba(255,255,255,0.35)" }}>all tools free while we build. Enjoy!</span>
            <button onClick={() => setBetaBanner(false)} className="absolute right-4 text-lg leading-none hover:opacity-60 transition-opacity" style={{ color: "rgba(255,255,255,0.3)" }}>×</button>
          </motion.div>
        )}
      </AnimatePresence>

      <TopNav activeTool={activeTool} onSelectTool={goTool} onHome={goHome} showRouter={route.type === "router"} isHome={route.type === "home"} />

      <main className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {route.type === "home" && <HomePage key="home" tools={tools} onSelectTool={goTool} onUpload={goRouter} />}
          {route.type === "router" && <SmartRouter key="router" tools={tools} onSelectTool={handleSelectTool} initialFile={pendingFile} />}
          {route.type === "tool" && route.toolId && <ToolView key={route.toolId} tool={tools.find(t => t.id === route.toolId)!} onBack={goHome} onSelectTool={goTool} />}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default Index;
