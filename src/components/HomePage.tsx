import { useRef, useState, useEffect, useCallback } from "react";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import type { Tool, ToolId } from "@/pages/Index";
import { SonarcLogoCentered } from "@/components/SonarcLogo";
import { Upload } from "lucide-react";
import { TextShimmer } from "@/components/ui/TextShimmer";
import DisplayCards from "@/components/ui/DisplayCards";
import { ContainerScroll } from "@/components/ui/ContainerScroll";
import FeedbackForm from "@/components/FeedbackForm";
import { Layers, Mic, Music } from "lucide-react";

// ── Tool images ──
const TOOL_IMAGES: Record<string, string> = {
  "bpm-detector":   "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&q=80&fit=crop",
  "stem-splitter":  "https://images.unsplash.com/photo-1619983081563-430f63602796?w=800&q=80&fit=crop",
  "audiolab":       "https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=800&q=80&fit=crop",
  "drum-machine":   "https://images.unsplash.com/photo-1519892300165-cb5542fb47c7?w=800&q=80&fit=crop",
  "mastering":      "https://images.unsplash.com/photo-1598653222000-6b7b7a552625?w=800&q=80&fit=crop",
  "slicer":         "https://images.unsplash.com/photo-1563330232-57114bb0823c?w=800&q=80&fit=crop",
  "voice-recorder": "https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=800&q=80&fit=crop",
  "visualizer":     "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&q=80&fit=crop",
  "noise-generator":"https://images.unsplash.com/photo-1571330735066-03aaa9429d89?w=800&q=80&fit=crop",
};


// ── Animated heading — words stagger in on scroll ──
const AnimatedHeading = ({ white, grey, size = "clamp(28px,4.5vw,56px)" }: { white: string; grey?: string; size?: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold: 0.3 });
    obs.observe(el); return () => obs.disconnect();
  }, []);
  const whiteWords = white.split(" ");
  const greyWords = grey ? grey.split(" ") : [];
  const allWords = [...whiteWords.map(w => ({ w, grey: false })), ...greyWords.map(w => ({ w, grey: true }))];
  return (
    <div ref={ref} style={{ lineHeight: 1 }}>
      <div className="flex flex-wrap gap-x-[0.22em]">
        {allWords.map(({ w, grey }, i) => (
          <motion.span key={i}
            initial={{ opacity: 0, y: 40, rotateX: -20 }}
            animate={inView ? { opacity: 1, y: 0, rotateX: 0 } : {}}
            transition={{ delay: i * 0.08, duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
            className="font-display font-black inline-block"
            style={{ fontSize: size, letterSpacing: "-0.055em", color: grey ? "#555555" : "#FFFFFF" }}
          >{w}</motion.span>
        ))}
      </div>
    </div>
  );
};

// ── CountUp number animation ──
const CountUp = ({ target, duration = 1.5, suffix = "" }: { target: number; duration?: number; suffix?: string }) => {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setStarted(true); }, { threshold: 0.5 });
    obs.observe(el); return () => obs.disconnect();
  }, []);
  useEffect(() => {
    if (!started) return;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / (duration * 1000), 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(ease * target));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [started, target, duration]);
  return <span ref={ref}>{count}{suffix}</span>;
};

// ── Cursor glow — subtle white ──
const CursorGlow = () => {
  const [pos, setPos] = useState({ x: -300, y: -300 });
  useEffect(() => {
    const move = (e: MouseEvent) => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", move);
    return () => window.removeEventListener("mousemove", move);
  }, []);
  return (
    <motion.div className="pointer-events-none fixed z-0"
      animate={{ x: pos.x - 200, y: pos.y - 200 }}
      transition={{ type: "spring", stiffness: 100, damping: 25, mass: 0.5 }}
      style={{ width: 400, height: 400, background: "radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 70%)", borderRadius: "50%", top: 0, left: 0 }}
    />
  );
};

// ── Scroll zoom on any image ──
const ScrollZoomImage = ({ src, height, alt = "" }: { src: string; height: number; alt?: string }) => {
  const outerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      if (!imgRef.current || !outerRef.current) return;
      const rect = outerRef.current.getBoundingClientRect();
      const progress = Math.max(0, Math.min(1, 1 - rect.bottom / (window.innerHeight + rect.height)));
      imgRef.current.style.transform = `scale(${1 + progress * 0.14})`;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div ref={outerRef} style={{ height, overflow: "hidden", position: "relative", width: "100%" }}>
      <img ref={imgRef} src={src} alt={alt} onLoad={() => setLoaded(true)}
        style={{ width: "100%", height: "110%", objectFit: "cover", display: "block",
          transform: "scale(1)", transformOrigin: "center center",
          opacity: loaded ? 1 : 0, transition: "opacity 0.8s ease",
          filter: "brightness(0.45) saturate(1.1)" }}
      />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom,rgba(15,15,15,0.1) 0%,rgba(15,15,15,0.7) 100%)" }} />
    </div>
  );
};

// ── Hero waveform ──
const HeroWave = () => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!; const ctx = c.getContext("2d")!;
    let raf: number, t = 0;
    const resize = () => { c.width = c.offsetWidth; c.height = c.offsetHeight; };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(c);
    const draw = () => {
      const W = c.width, H = c.height;
      ctx.clearRect(0, 0, W, H); t += 0.006;
      [[H*.30,0.008,1,0.25,1.5],[H*.20,0.013,1.5,0.15,1],[H*.38,0.006,0.65,0.1,2]].forEach(([amp,freq,speed,a,thick],i) => {
        ctx.beginPath();
        for (let x = 0; x <= W; x += 3) {
          const y = H/2 + Math.sin(x*(freq as number)+t*(speed as number)+i*0.9)*(amp as number);
          x===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
        }
        const wg = ctx.createLinearGradient(0,0,W,0);
        wg.addColorStop(0,`rgba(124,58,237,${a})`); wg.addColorStop(0.5,`rgba(59,130,246,${(a as number)*0.8})`); wg.addColorStop(1,`rgba(6,182,212,${(a as number)*0.6})`);
        ctx.strokeStyle=wg; ctx.lineWidth=(thick as number); ctx.stroke();
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.4 }}/>;
};

// ── Tool card — full grey theme ──
const ToolCard = ({ tool, index, onSelect }: { tool: Tool; index: number; onSelect: (id: ToolId) => void }) => {
  const ref = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const Icon = tool.icon;
  const img = TOOL_IMAGES[tool.id] || tool.image;

  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold: 0.12 });
    obs.observe(el); return () => obs.disconnect();
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current; if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = (e.clientY - rect.top) / rect.height - 0.5;
    const y = (e.clientX - rect.left) / rect.width - 0.5;
    setTilt({ x: x * -12, y: y * 12 });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTilt({ x: 0, y: 0 });
    setHovered(false);
  }, []);

  return (
    <motion.div ref={ref}
      initial={{ opacity: 0, y: 36 }} animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay: (index % 3) * 0.09, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div ref={cardRef}
        onClick={() => onSelect(tool.id)}
        onMouseEnter={() => setHovered(true)}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        animate={{ rotateX: tilt.x, rotateY: tilt.y, y: hovered ? -8 : 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        whileTap={{ scale: 0.98 }}
        className="relative rounded-2xl overflow-hidden cursor-pointer"
        style={{
          background: "rgba(255,255,255,0.04)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: `1px solid ${hovered ? `${tool.color}45` : "rgba(255,255,255,0.1)"}`,
          boxShadow: hovered
            ? `0 24px 48px rgba(0,0,0,0.5), 0 0 0 1px ${tool.color}25, inset 0 1px 0 rgba(255,255,255,0.08)`
            : "0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)",
          transformStyle: "preserve-3d",
          transition: "border-color 0.25s, box-shadow 0.25s",
        }}
      >
        {/* Subtle color tint overlay */}
        <div className="absolute inset-0 pointer-events-none rounded-2xl" style={{
          background: `radial-gradient(ellipse at 50% 0%, ${tool.color}12 0%, transparent 65%)`,
          opacity: hovered ? 1 : 0.5,
          transition: "opacity 0.3s",
        }}/>

        <div className="h-44 relative overflow-hidden">
          <motion.img src={img} alt={tool.label} className="w-full h-full object-cover"
            animate={{ scale: hovered ? 1.08 : 1.0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            style={{ filter: "brightness(0.5) saturate(1.1)" }}
          />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom,transparent 25%,rgba(10,10,10,0.85) 100%)" }}/>
          {tool.tag && (
            <div className="absolute top-3 left-3 text-[9px] font-black px-2.5 py-1 rounded-full"
              style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.2)", backdropFilter: "blur(8px)" }}
            >{tool.tag}</div>
          )}
          <div className="absolute bottom-3 left-4 w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: `${tool.color}22`, border: `1px solid ${tool.color}40`, backdropFilter: "blur(8px)" }}
          ><Icon className="w-4 h-4" style={{ color: tool.color }}/></div>
        </div>

        <div className="p-5 relative">
          <div className="text-[9px] font-black tracking-[0.18em] uppercase mb-1.5" style={{ color: `${tool.color}CC` }}>{tool.tagline}</div>
          <h3 className="font-display font-black mb-2.5" style={{ fontSize: "17px", letterSpacing: "-0.04em", color: "#FFFFFF" }}>{tool.label}</h3>
          <p className="text-sm leading-relaxed mb-4" style={{ color: "rgba(255,255,255,0.6)", lineHeight: "1.65", fontSize: "13px" }}>{tool.description}</p>
          <motion.div animate={{ x: hovered ? 4 : 0, opacity: hovered ? 1 : 0.35 }} transition={{ duration: 0.18 }}
            className="flex items-center gap-1.5 text-xs font-bold" style={{ color: tool.color }}
          >Open tool →</motion.div>
        </div>

        {/* Gradient top border */}
        <motion.div className="absolute top-0 left-0 right-0 h-[1.5px] pointer-events-none"
          animate={{ opacity: hovered ? 1 : 0.3 }}
          style={{ background: `linear-gradient(90deg, transparent, ${tool.color}80, transparent)` }}
        />
      </motion.div>
    </motion.div>
  );
};

// ── Hero upload box ──
const HeroUploadBox = ({ onUpload, onSelectTool }: { onUpload: (file?: File) => void; onSelectTool: (id: ToolId) => void }) => {
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.6 }}>
      {/* Label above */}
      <div className="mb-4">
        <p className="font-display font-black text-white" style={{ fontSize: "clamp(20px,2.5vw,32px)", letterSpacing: "-0.04em", lineHeight: 1.2 }}>Upload your file</p>
        <p className="font-display font-black" style={{ fontSize: "clamp(20px,2.5vw,32px)", letterSpacing: "-0.04em", lineHeight: 1.2, color: "#666666" }}>let us do the rest.</p>
      </div>
      <motion.div
        onClick={() => fileRef.current?.click()}
        onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) onUpload(f); }}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        whileHover={{ borderColor: "rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.05)" }}
        className="cursor-pointer rounded-2xl flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-5 px-5 sm:px-7 py-5 transition-all"
        style={{
          background: dragging ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)",
          border: `1.5px dashed ${dragging ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.15)"}`,
        }}
      >
        <input ref={fileRef} type="file" accept="audio/*,video/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); }}
        />
        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}
        ><Upload className="w-5 h-5" style={{ color: "rgba(255,255,255,0.6)" }}/></div>
        <div className="flex-1">
          <p className="font-bold text-white mb-0.5" style={{ fontSize: "15px" }}>
            {dragging ? "Drop it — let us do the rest." : "Drop your file here or click to browse"}
          </p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>MP3 · WAV · FLAC · AAC · OGG · MP4 · MOV</p>
        </div>
        <div className="hidden sm:flex gap-1.5 shrink-0">
          {["MP3","WAV","FLAC","MP4"].map(f => (
            <span key={f} className="text-[9px] font-black px-2 py-1 rounded-lg"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.08)" }}
            >{f}</span>
          ))}
        </div>
      </motion.div>
      <div className="flex items-center gap-2 mt-3 flex-wrap w-full">
        <span className="text-[10px] font-semibold" style={{ color: "rgba(255,255,255,0.22)" }}>Or jump to:</span>
        {[
          { label: "Detect BPM & Key", id: "bpm-detector" as ToolId },
          { label: "Split stems", id: "stem-splitter" as ToolId },
          { label: "Edit audio", id: "audiolab" as ToolId },
          { label: "Build a beat", id: "drum-machine" as ToolId },
        ].map(a => (
          <motion.button key={a.id} onClick={() => onSelectTool(a.id)}
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
            className="text-[10px] font-bold px-2.5 py-1 rounded-lg"
            style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}
          >{a.label} →</motion.button>
        ))}
      </div>
    </motion.div>
  );
};

export default function HomePage({ tools, onSelectTool, onUpload }: {
  tools: Tool[]; onSelectTool: (id: ToolId) => void; onUpload: (file?: File) => void;
}) {
  const pageRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, container: pageRef, offset: ["start start", "end start"] });
  const heroImgScale = useTransform(scrollYProgress, [0, 1], [1, 1.2]);
  const heroTextY = useTransform(scrollYProgress, [0, 1], [0, -80]);
  const heroOp = useTransform(scrollYProgress, [0, 0.75], [1, 0]);

  const producerTools = tools.filter(t => t.category === "producer");
  const creatorTools  = tools.filter(t => t.category === "creator");
  const moreTools     = tools.filter(t => t.category === "more");

  // Hero text stagger animation words
  const line1Words = ["A", "Mini", "DAW"];
  const line2Words = ["in", "your", "browser."];

  return (
    <motion.div ref={pageRef} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }} className="absolute inset-0 overflow-y-auto overflow-x-hidden"
      style={{ background: "#0A0A0A" }}
    >
      <CursorGlow />

      {/* ══ HERO ══ */}
      <section ref={heroRef} className="relative h-screen overflow-hidden flex items-end pb-24">
        <motion.div className="absolute inset-0" style={{ scale: heroImgScale, transformOrigin: "center center" }}>
          <img src="/images/hero.png" alt="" className="w-full h-full object-cover"
            style={{ filter: "brightness(0.35) saturate(1.1)" }}
          />
        </motion.div>
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 40% 55%,transparent 15%,rgba(10,10,10,0.8) 100%)" }}/>
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom,rgba(10,10,10,0.05) 0%,transparent 15%,rgba(10,10,10,0.97) 100%)" }}/>
        <div className="absolute bottom-0 left-0 right-0" style={{ height: "180px" }}><HeroWave /></div>

        <motion.div style={{ y: heroTextY, opacity: heroOp }} className="relative z-10 w-full px-6 md:px-10 lg:px-16">
          {/* Badge */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="flex items-center gap-2 mb-8"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-white" style={{ opacity: 0.5 }}/>
            <TextShimmer className="text-[11px] font-bold tracking-[0.18em] uppercase" duration={4}>
              Free during beta · 9 tools · No account needed
            </TextShimmer>
          </motion.div>

          {/* Headline — OPTION C: words animate in on load + parallax on scroll */}
          <div className="mb-6" style={{ lineHeight: 1 }}>
            {/* Line 1 — white */}
            <div className="flex items-baseline gap-[0.22em] flex-wrap" style={{wordSpacing:"0.1em"}}>
              {line1Words.map((word, i) => (
                <motion.span key={i}
                  initial={{ opacity: 0, y: 60, rotateX: -15 }}
                  animate={{ opacity: 1, y: 0, rotateX: 0 }}
                  transition={{ delay: 0.2 + i * 0.12, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                  className="font-display font-black text-white inline-block"
                  style={{ fontSize: "clamp(36px,8vw,120px)", letterSpacing: "-0.065em" }}
                >{word}</motion.span>
              ))}
            </div>
            {/* Line 2 — grey */}
            <div className="flex items-baseline gap-[0.22em] flex-wrap">
              {line2Words.map((word, i) => (
                <motion.span key={i}
                  initial={{ opacity: 0, y: 60, rotateX: -15 }}
                  animate={{ opacity: 1, y: 0, rotateX: 0 }}
                  transition={{ delay: 0.56 + i * 0.12, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                  className="font-display font-black inline-block"
                  style={{ fontSize: "clamp(38px,8vw,120px)", letterSpacing: "-0.065em", color: "#555555" }}
                >{word}</motion.span>
              ))}
            </div>
          </div>

          {/* Subtext */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.0, duration: 0.6 }} className="mb-10">
            <p className="text-xl font-semibold" style={{ color: "#FFFFFF", lineHeight: 1.6 }}>No installs. No subscriptions. No Catch.</p>
            <p className="text-xl font-light" style={{ color: "#555555", lineHeight: 1.6 }}>Just open and get to work.</p>
          </motion.div>

          {/* CTA */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1, duration: 0.6 }}>
            <motion.button onClick={() => onSelectTool("bpm-detector")}
              whileHover={{ scale: 1.04, boxShadow: "0 0 28px rgba(124,58,237,0.45)" }} whileTap={{ scale: 0.97 }}
              className="px-8 py-3.5 rounded-xl text-sm font-bold text-white"
              style={{ background: "linear-gradient(135deg,#7C3AED,#06B6D4)", boxShadow: "0 0 16px rgba(124,58,237,0.3)" }}
            >Start creating →</motion.button>
          </motion.div>
        </motion.div>
      </section>

      {/* ══ UPLOAD SECTION ══ */}
      <section className="px-5 md:px-10 lg:px-16 py-12 md:py-16 max-w-[1400px] mx-auto">
        <HeroUploadBox onUpload={onUpload} onSelectTool={onSelectTool}/>
      </section>

      {/* ══ BPM DEMO ══ */}
      <section className="px-5 md:px-10 lg:px-16 py-12 md:py-16 max-w-[1400px] mx-auto">
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-12">
          <div className="text-[10px] font-black tracking-[0.22em] uppercase mb-4" style={{ color: "rgba(167,139,250,0.5)" }}>Instant analysis</div>
<AnimatedHeading white="Drop a track." grey="Know everything instantly." size="clamp(26px,5vw,60px)"/>
        </motion.div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
          {[
            { label: "BPM", value: "128", sub: "Fast / Dance · 4/4 time", conf: 88, detail: ["Dark beats","Hip-hop","Trap","Emotional pop"], type: "bpm" },
            { label: "Key", value: "A", sub: "Minor", conf: 91, detail: ["Dark beats","Hip-hop","Trap","Emotional pop"], type: "key" },
          ].map((item, idx) => (
            <motion.div key={idx} initial={{ opacity: 0, x: idx === 0 ? -24 : 24 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}
              className="rounded-2xl p-8" style={{ background: "#181818", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <div className="text-[10px] font-black tracking-[0.2em] uppercase mb-4" style={{ color: "rgba(255,255,255,0.3)" }}>{item.label}</div>
              {item.type === "bpm" ? (<div className="font-display font-black text-white mb-2" style={{ fontSize: "96px", letterSpacing: "-0.07em", lineHeight: 1 }}><CountUp target={128} duration={1.8}/></div>) : (<div className="font-display font-black text-white mb-2" style={{ fontSize: "72px", letterSpacing: "-0.07em", lineHeight: 1 }}>A</div>)}
              <div className="text-sm font-semibold mb-4" style={{ color: "rgba(255,255,255,0.4)" }}>{item.sub}</div>
              <div className="h-1.5 rounded-full overflow-hidden mb-1" style={{ background: "rgba(255,255,255,0.08)" }}>
                <motion.div className="h-full rounded-full bg-white" initial={{ width: 0 }} whileInView={{ width: `${item.conf}%` }} viewport={{ once: true }} transition={{ delay: 0.3, duration: 1, ease: [0.16, 1, 0.3, 1] }}/>
              </div>
              <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>{item.conf}% confidence</div>
            </motion.div>
          ))}
        </div>
        <motion.button initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          onClick={() => onSelectTool("bpm-detector")}
          whileHover={{ scale: 1.02, background: "rgba(60,60,60,0.95)" }} whileTap={{ scale: 0.97 }}
          className="px-8 py-3.5 rounded-xl text-sm font-bold text-white"
          style={{ background: "rgba(40,40,40,0.95)", border: "1px solid rgba(255,255,255,0.12)" }}
        >Analyze your track →</motion.button>
      </section>

      {/* ══ STEMS ══ */}
      <section className="px-5 md:px-10 lg:px-16 py-12 md:py-16 max-w-[1400px] mx-auto">
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-14">
          <div className="text-[10px] font-black tracking-[0.22em] uppercase mb-4" style={{ color: "rgba(167,139,250,0.5)" }}>Stem splitting</div>
<AnimatedHeading white="One track in." grey="Four stems out." size="clamp(26px,5vw,60px)"/>
        </motion.div>
        <div className="flex flex-col lg:flex-row items-start gap-10">
          <div className="shrink-0 w-full lg:w-[360px]" style={{ height: "220px", position: "relative" }}>
            <DisplayCards cards={[
              { icon: <Layers className="w-4 h-4" style={{ color: "rgba(255,255,255,0.7)" }}/>, title: "Vocals", description: "Lead & backing vocals isolated", sub: "Download as WAV", color: "#888888" },
              { icon: <Music className="w-4 h-4" style={{ color: "rgba(255,255,255,0.7)" }}/>, title: "Drums", description: "Full drum kit separated", sub: "Download as WAV", color: "#666666" },
              { icon: <Mic className="w-4 h-4" style={{ color: "rgba(255,255,255,0.7)" }}/>, title: "Bass", description: "Bass line clean & isolated", sub: "Download as WAV", color: "#555555" },
            ]}/>
          </div>
          <div className="flex-1 pt-4">
            <div className="space-y-4 mb-8">
              {[
                { label: "Upload any song", desc: "MP3, WAV, FLAC — any format works" },
                { label: "AI splits in seconds", desc: "Powered by AI separation model" },
                { label: "4 stems, all downloadable", desc: "Vocals · Drums · Bass · Instruments" },
              ].map((s, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                  className="flex items-start gap-3"
                >
                  <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}
                  ><div className="w-1.5 h-1.5 rounded-full bg-white" style={{ opacity: 0.7 }}/></div>
                  <div>
                    <div className="font-bold text-sm text-white mb-0.5">{s.label}</div>
                    <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{s.desc}</div>
                  </div>
                </motion.div>
              ))}
            </div>
            <motion.button initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              onClick={() => onSelectTool("stem-splitter")}
              whileHover={{ scale: 1.02, background: "rgba(60,60,60,0.95)" }} whileTap={{ scale: 0.97 }}
              className="px-8 py-3.5 rounded-xl text-sm font-bold text-white"
              style={{ background: "rgba(40,40,40,0.95)", border: "1px solid rgba(255,255,255,0.12)" }}
            >Split your track →</motion.button>
          </div>
        </div>
      </section>

      {/* ══ FULL BLEED — AudioLab ══ */}
      <section className="relative">
        <ScrollZoomImage src="https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=1400&q=80&fit=crop" height={400}/>
        <div className="absolute inset-0 flex items-end p-6 md:p-14">
          <motion.div initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}>
            <div className="text-[10px] font-black tracking-[0.2em] uppercase mb-3" style={{ color: "rgba(255,255,255,0.35)" }}>AudioLab</div>
            <h2 className="font-display font-black text-white leading-none mb-4"
              style={{ fontSize: "clamp(28px,4.5vw,60px)", letterSpacing: "-0.055em", maxWidth: "540px" }}
            >Trim. Mix. Convert. Export.</h2>
            <motion.button onClick={() => onSelectTool("audiolab")}
              whileHover={{ scale: 1.03, background: "rgba(60,60,60,0.95)" }} whileTap={{ scale: 0.97 }}
              className="px-7 py-3 rounded-xl text-sm font-bold text-white"
              style={{ background: "rgba(40,40,40,0.85)", border: "1px solid rgba(255,255,255,0.2)", backdropFilter: "blur(12px)" }}
            >Open AudioLab →</motion.button>
          </motion.div>
        </div>
      </section>

      {/* ══ PRODUCER TOOLS ══ */}
      <section id="tools" className="px-5 md:px-10 lg:px-16 py-14 md:py-20 max-w-[1400px] mx-auto">
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-8 md:mb-12 flex flex-col md:flex-row md:items-end md:justify-between gap-4 md:gap-6">
          <div>
            <div className="text-[10px] font-black tracking-[0.22em] uppercase mb-3" style={{ color: "rgba(167,139,250,0.5)" }}>For Producers</div>
  <AnimatedHeading white="Build, chop &" grey="master your tracks." size="clamp(24px,4.5vw,56px)"/>
          </div>
          <p className="text-sm font-light max-w-xs" style={{ color: "rgba(255,255,255,0.4)", lineHeight: 1.8 }}>
            Drum sequencer, sample chopper, professional mastering — all in your browser.
          </p>
        </motion.div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {producerTools.map((tool, i) => <ToolCard key={tool.id} tool={tool} index={i} onSelect={onSelectTool}/>)}
        </div>
      </section>

      {/* ══ FULL BLEED 2 ══ */}
      <section className="relative">
        <ScrollZoomImage src="https://images.unsplash.com/photo-1619983081563-430f63602796?w=1400&q=80&fit=crop" height={360}/>
        <div className="absolute inset-0 flex items-end p-6 md:p-14">
          <motion.div initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}>
            <div className="text-[10px] font-black tracking-[0.2em] uppercase mb-3" style={{ color: "rgba(255,255,255,0.35)" }}>Stem Splitter</div>
            <h2 className="font-display font-black text-white leading-none mb-4"
              style={{ fontSize: "clamp(28px,4.5vw,60px)", letterSpacing: "-0.055em" }}
            >Separate any track into stems.</h2>
            <motion.button onClick={() => onSelectTool("stem-splitter")}
              whileHover={{ scale: 1.03, background: "rgba(60,60,60,0.95)" }} whileTap={{ scale: 0.97 }}
              className="px-7 py-3 rounded-xl text-sm font-bold text-white"
              style={{ background: "rgba(40,40,40,0.85)", border: "1px solid rgba(255,255,255,0.2)", backdropFilter: "blur(12px)" }}
            >Split your track →</motion.button>
          </motion.div>
        </div>
      </section>

      {/* ══ CREATOR TOOLS ══ */}
      <section id="creators" className="px-5 md:px-10 lg:px-16 py-14 md:py-20 max-w-[1400px] mx-auto">
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-8 md:mb-12 flex flex-col md:flex-row md:items-end md:justify-between gap-4 md:gap-6">
          <div>
            <div className="text-[10px] font-black tracking-[0.22em] uppercase mb-3" style={{ color: "rgba(167,139,250,0.5)" }}>For Creators</div>
  <AnimatedHeading white="Edit, record &" grey="visualize your audio." size="clamp(24px,4.5vw,56px)"/>
          </div>
          <p className="text-sm font-light max-w-xs" style={{ color: "rgba(255,255,255,0.4)", lineHeight: 1.8 }}>
            Convert video, record voice, create visualizations for YouTube and Instagram.
          </p>
        </motion.div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {creatorTools.map((tool, i) => <ToolCard key={tool.id} tool={tool} index={i} onSelect={onSelectTool}/>)}
        </div>
      </section>

      {/* ══ MORE TOOLS ══ */}
      {moreTools.length > 0 && (
        <section className="px-5 md:px-10 lg:px-16 pb-10 md:pb-16 max-w-[1400px] mx-auto">
          <div className="text-[10px] font-black tracking-[0.22em] uppercase mb-6" style={{ color: "rgba(255,255,255,0.2)" }}>More tools</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {moreTools.map((tool, i) => <ToolCard key={tool.id} tool={tool} index={i} onSelect={onSelectTool}/>)}
          </div>
        </section>
      )}

      {/* ══ RAW TO READY ══ */}
      <section className="px-5 md:px-10 lg:px-16 py-14 md:py-20 max-w-[1400px] mx-auto">
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-14">
  <AnimatedHeading white="Raw to Ready." grey="In seconds." size="clamp(26px,5vw,60px)"/>
        </motion.div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}
            className="rounded-2xl overflow-hidden" style={{ background: "#181818", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="p-5 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
              <div className="text-[9px] font-black tracking-widest uppercase mb-3" style={{ color: "rgba(255,255,255,0.25)" }}>Audio Mastering</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
                  <div className="text-[9px] font-bold mb-2" style={{ color: "rgba(255,255,255,0.3)" }}>RAW MIX</div>
                  <div className="flex items-center gap-[2px] h-8">
                    {[0.2,0.4,0.3,0.6,0.4,0.5,0.3,0.4,0.5,0.3,0.4,0.6,0.2,0.3,0.4,0.5].map((h,i) => (
                      <div key={i} className="flex-1 rounded-full bg-white/20" style={{ height: `${h*100}%` }}/>
                    ))}
                  </div>
                  <div className="text-[9px] mt-1.5 font-mono" style={{ color: "rgba(255,255,255,0.2)" }}>-18 LUFS</div>
                </div>
                <div className="p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}>
                  <div className="text-[9px] font-bold mb-2 text-white">MASTERED</div>
                  <div className="flex items-center gap-[2px] h-8">
                    {[0.7,0.85,0.75,0.95,0.8,0.9,0.75,0.88,0.92,0.78,0.85,0.95,0.7,0.82,0.88,0.92].map((h,i) => (
                      <div key={i} className="flex-1 rounded-full bg-white" style={{ height: `${h*100}%` }}/>
                    ))}
                  </div>
                  <div className="text-[9px] mt-1.5 font-mono font-bold text-white">-9 LUFS</div>
                </div>
              </div>
            </div>
            <div className="p-4 flex items-center justify-between">
              <span className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.4)" }}>Louder. Punchier. Release-ready.</span>
              <motion.button onClick={() => onSelectTool("mastering")}
                whileHover={{ scale: 1.04, background: "rgba(60,60,60,0.95)" }} whileTap={{ scale: 0.97 }}
                className="text-xs font-bold px-3.5 py-1.5 rounded-lg text-white"
                style={{ background: "rgba(40,40,40,0.9)", border: "1px solid rgba(255,255,255,0.15)" }}
              >Try Mastering →</motion.button>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}
            className="rounded-2xl overflow-hidden" style={{ background: "#181818", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="p-5 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
              <div className="text-[9px] font-black tracking-widest uppercase mb-3" style={{ color: "rgba(255,255,255,0.25)" }}>Stem Splitting</div>
              <div className="mb-3 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
                <div className="text-[9px] font-bold mb-2" style={{ color: "rgba(255,255,255,0.3)" }}>FULL TRACK</div>
                <div className="flex items-center gap-[2px] h-6">
                  {Array.from({length:32},(_,i) => (
                    <div key={i} className="flex-1 rounded-full bg-white/25" style={{ height: `${(0.3+Math.sin(i*0.7)*0.4+0.3)*60}%` }}/>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[{label:"Vocals"},{label:"Drums"},{label:"Bass"},{label:"Instruments"}].map((s,i) => (
                  <div key={i} className="p-2 rounded-lg" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                    <div className="text-[9px] font-bold mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>{s.label}</div>
                    <div className="flex items-center gap-[1px] h-4">
                      {Array.from({length:16},(_,j) => (
                        <motion.div key={j} className="flex-1 rounded-full bg-white"
                          animate={{ scaleY: [0.2+Math.random()*0.8, 0.1+Math.random()*0.9, 0.2+Math.random()*0.8] }}
                          transition={{ duration: 0.7+Math.random()*0.4, repeat: Infinity, repeatType: "reverse", delay: j*0.04 }}
                          style={{ opacity: 0.5 }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 flex items-center justify-between">
              <span className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.4)" }}>Vocals isolated. Use anywhere.</span>
              <motion.button onClick={() => onSelectTool("stem-splitter")}
                whileHover={{ scale: 1.04, background: "rgba(60,60,60,0.95)" }} whileTap={{ scale: 0.97 }}
                className="text-xs font-bold px-3.5 py-1.5 rounded-lg text-white"
                style={{ background: "rgba(40,40,40,0.9)", border: "1px solid rgba(255,255,255,0.15)" }}
              >Split your track →</motion.button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ══ CONTAINER SCROLL ══ */}
      <section className="px-5 md:px-10 lg:px-16 py-12 md:py-16 max-w-[1400px] mx-auto">
        <ContainerScroll
          containerRef={pageRef}
          titleComponent={
            <div className="mb-8 text-center">
              <h2 className="font-display font-black text-white leading-none" style={{ fontSize: "clamp(28px,4vw,52px)", letterSpacing: "-0.055em" }}>
                See Sonarc in action.
              </h2>
              <p className="text-sm font-light mt-3" style={{ color: "rgba(255,255,255,0.35)" }}>Drop a file. Pick a tool. Get results.</p>
            </div>
          }
        >
          <div className="relative overflow-hidden" style={{ height: "320px" }}>
            <img src="https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=1400&q=80&fit=crop" alt=""
              className="w-full h-full object-cover" style={{ filter: "brightness(0.35) saturate(0.8)" }}
            />
            <div className="absolute inset-0" style={{ background: "linear-gradient(135deg,rgba(10,10,10,0.7),rgba(10,10,10,0.4))" }}/>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="font-display font-black text-white mb-3" style={{ fontSize: "clamp(20px,3vw,36px)", letterSpacing: "-0.04em" }}>
                  <span style={{ color: "#FFFFFF" }}>SON</span><span style={{background:"linear-gradient(135deg,#A78BFA,#22D3EE)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>ARC</span>
                </div>
                <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.4)" }}>The ultimate audio toolkit for creators</p>
                <motion.button onClick={() => onSelectTool("bpm-detector")}
                  whileHover={{ scale: 1.05, background: "rgba(60,60,60,0.95)" }} whileTap={{ scale: 0.97 }}
                  className="px-8 py-3 rounded-xl text-sm font-bold text-white"
                  style={{ background: "rgba(45,45,45,0.95)", border: "1px solid rgba(255,255,255,0.18)" }}
                >Open a tool →</motion.button>
              </div>
            </div>
          </div>
        </ContainerScroll>
      </section>

      {/* ══ FEEDBACK ══ */}
      <section className="feedback-section px-10 lg:px-16 py-20 max-w-[1400px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          <motion.div initial={{ opacity: 0, x: -24 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-white"/>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"/>
              </span>
              <span className="text-[11px] font-bold tracking-[0.15em] uppercase" style={{ color: "rgba(255,255,255,0.6)" }}>Beta — Still building</span>
            </div>
<div className="mb-5"><AnimatedHeading white="We're still building." grey="Your feedback shapes us." size="clamp(28px,4vw,52px)"/></div>
            <p className="text-base font-light leading-relaxed mb-6" style={{ color: "rgba(255,255,255,0.45)" }}>
              Every suggestion, bug report or idea goes directly to our team.
            </p>
            <div className="space-y-3">
              {["We read every submission","Feature requests get built first","Bug reports fixed within days"].map((s,i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-white" style={{ opacity: 0.4 }}/>
                  <span className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>{s}</span>
                </div>
              ))}
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 24 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}>
            <FeedbackForm/>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-10 lg:px-16 py-8" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between flex-wrap gap-4">
          <span className="font-display font-black text-lg" style={{ letterSpacing: "-0.06em" }}>
            <span style={{ color: "#FFFFFF" }}>SON</span><span style={{background:"linear-gradient(135deg,#A78BFA,#22D3EE)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>ARC</span>
          </span>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.12)" }}>© 2025 Sonarc · Free audio tools for everyone</p>
          <div className="flex items-center gap-4 flex-wrap">
            {[
              { label: "Contact", href: "mailto:sonarc@feedback.com" },
              { label: "Privacy Policy", href: "/privacy" },
              { label: "Terms of Use", href: "/terms" },
              { label: "Feedback", href: "#feedback" },
            ].map(l => (
              <a key={l.label} href={l.href}
                className="text-xs transition-colors hover:text-white"
                style={{ color: "rgba(255,255,255,0.28)" }}
                onClick={l.href === "#feedback" ? (e) => { e.preventDefault(); document.querySelector(".feedback-section")?.scrollIntoView({ behavior: "smooth" }); } : undefined}
              >{l.label}</a>
            ))}
          </div>
        </div>
      </footer>
    </motion.div>
  );
}
