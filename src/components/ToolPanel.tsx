import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Tool, ToolId } from "@/pages/Index";
import DrumMachine from "@/components/tools/DrumMachine";
import LoopGenerator from "@/components/tools/LoopGenerator";
import MidiGenerator from "@/components/tools/MidiGenerator";
import SampleChopper from "@/components/tools/SampleChopper";
import StemSplitter from "@/components/tools/StemSplitter";
import SynthTool from "@/components/tools/SynthTool";

interface ToolPanelProps {
  activeTool: ToolId | null;
  tools: Tool[];
  onSelectTool: (id: ToolId) => void;
}

const toolComponents: Record<ToolId, React.ComponentType> = {
  drumachine: DrumMachine,
  loopgen: LoopGenerator,
  midigen: MidiGenerator,
  chopper: SampleChopper,
  splitter: StemSplitter,
  synth: SynthTool,
};

// Animated canvas background for home
const CinematicBg = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let animId: number;
    let t = 0;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const particles: { x: number; y: number; vx: number; vy: number; r: number; a: number }[] = [];
    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 1.5 + 0.5,
        a: Math.random(),
      });
    }

    const draw = () => {
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      t += 0.005;

      // Aurora waves
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        for (let x = 0; x <= W; x += 3) {
          const y = H * (0.3 + i * 0.15) + Math.sin(x * 0.004 + t + i * 1.2) * 60 + Math.sin(x * 0.008 + t * 1.3) * 30;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
        const alpha = 0.025 - i * 0.005;
        ctx.fillStyle = i % 2 === 0 ? `rgba(59,130,246,${alpha})` : `rgba(6,182,212,${alpha})`;
        ctx.fill();
      }

      // Particles + connections
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(59,130,246,${0.3 + p.a * 0.4})`; ctx.fill();
      });
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x, dy = particles[i].y - particles[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 80) {
            ctx.beginPath(); ctx.moveTo(particles[i].x, particles[i].y); ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(59,130,246,${0.08 * (1 - d / 80)})`; ctx.lineWidth = 0.8; ctx.stroke();
          }
        }
      }
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ opacity: 0.6 }} />;
};

const ToolHome = ({ tools, onSelectTool }: { tools: Tool[]; onSelectTool: (id: ToolId) => void }) => (
  <div className="flex-1 overflow-y-auto relative">
    <CinematicBg />

    <div className="relative z-10 p-10 max-w-5xl mx-auto">
      {/* Hero text */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="mb-16 pt-4"
      >
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full"
          style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-blue-400" style={{ boxShadow: '0 0 6px rgba(59,130,246,0.8)' }} />
          <span className="text-[11px] font-bold tracking-widest uppercase text-blue-400">Professional Music Tools</span>
        </motion.div>

        <h1 className="font-display text-7xl font-black text-white leading-none mb-6"
          style={{ letterSpacing: '-0.05em' }}
        >
          <motion.span
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="block"
          >Make music.</motion.span>
          <motion.span
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="block"
            style={{ background: 'linear-gradient(135deg, #60A5FA 0%, #06B6D4 50%, #8B5CF6 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
          >Without limits.</motion.span>
        </h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45 }}
          className="text-lg max-w-xl leading-relaxed"
          style={{ color: 'rgba(255,255,255,0.4)' }}
        >
          Six professional-grade tools. No plugins, no downloads, no DAW required. Works right in your browser.
        </motion.p>
      </motion.div>

      {/* Tool cards */}
      <div className="grid grid-cols-3 gap-4">
        {tools.map((tool, i) => {
          const Icon = tool.icon;
          return (
            <motion.button
              key={tool.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.07, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => onSelectTool(tool.id)}
              whileHover={{ y: -6, scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              className="text-left p-6 rounded-2xl relative overflow-hidden group"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = `${tool.color}0A`;
                (e.currentTarget as HTMLElement).style.borderColor = `${tool.color}35`;
                (e.currentTarget as HTMLElement).style.boxShadow = `0 20px 60px -10px ${tool.color}25, 0 0 0 1px ${tool.color}20`;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)';
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)';
                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
              }}
            >
              {/* Corner glow */}
              <div className="absolute top-0 right-0 w-24 h-24 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{ background: `radial-gradient(ellipse at top right, ${tool.color}20, transparent)` }}
              />

              {/* Icon */}
              <motion.div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5"
                style={{ background: `${tool.color}15`, border: `1px solid ${tool.color}25` }}
                whileHover={{ scale: 1.1, boxShadow: `0 0 24px ${tool.color}50` }}
              >
                <Icon className="w-5 h-5" style={{ color: tool.color }} />
              </motion.div>

              {/* Tag */}
              {tool.tag && (
                <span className="absolute top-5 right-5 text-[9px] font-black px-2 py-0.5 rounded-full"
                  style={{
                    background: tool.tag === 'New' ? 'rgba(16,185,129,0.15)' : `${tool.color}18`,
                    color: tool.tag === 'New' ? '#10B981' : tool.color,
                    border: `1px solid ${tool.tag === 'New' ? 'rgba(16,185,129,0.3)' : tool.color + '35'}`,
                  }}
                >{tool.tag}</span>
              )}

              <h3 className="font-display text-lg font-black text-white mb-1.5" style={{ letterSpacing: '-0.03em' }}>
                {tool.label}
              </h3>
              <p className="text-xs leading-relaxed mb-4" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {tool.description}
              </p>

              <div className="flex items-center gap-1 text-xs font-bold opacity-0 group-hover:opacity-100 transition-all duration-200 translate-y-1 group-hover:translate-y-0"
                style={{ color: tool.color }}
              >
                Open tool
                <motion.span animate={{ x: [0, 4, 0] }} transition={{ duration: 1.2, repeat: Infinity }}>→</motion.span>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Bottom stats */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="mt-12 flex items-center gap-8"
      >
        {[
          { label: 'Tools', value: '6' },
          { label: 'No login required', value: '✓' },
          { label: 'Royalty free', value: '✓' },
          { label: 'Works in browser', value: '✓' },
        ].map((stat, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="font-display text-xl font-black text-white" style={{ letterSpacing: '-0.04em' }}>{stat.value}</span>
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{stat.label}</span>
          </div>
        ))}
      </motion.div>
    </div>
  </div>
);

const panelVariants = {
  initial: { opacity: 0, x: 50, scale: 0.99 },
  animate: { opacity: 1, x: 0, scale: 1, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const } },
  exit: { opacity: 0, x: -30, scale: 0.99, transition: { duration: 0.22, ease: "easeIn" as const } },
};

const ToolPanel = ({ activeTool, tools, onSelectTool }: ToolPanelProps) => {
  if (!activeTool) {
    return (
      <motion.div key="home" variants={panelVariants} initial="initial" animate="animate" exit="exit" className="flex-1 flex flex-col overflow-hidden">
        <ToolHome tools={tools} onSelectTool={onSelectTool} />
      </motion.div>
    );
  }

  const tool = tools.find(t => t.id === activeTool);
  const Component = toolComponents[activeTool];

  return (
    <motion.div key={activeTool} variants={panelVariants} initial="initial" animate="animate" exit="exit" className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-8 shrink-0 relative"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(12px)' }}
      >
        {/* Header glow */}
        {tool && <div className="absolute inset-0 pointer-events-none" style={{ background: `linear-gradient(90deg, ${tool.color}08 0%, transparent 40%)` }} />}

        <motion.div className="flex items-center gap-3 relative z-10" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          {tool && (
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: `${tool.color}18`, border: `1px solid ${tool.color}30`, boxShadow: `0 0 16px ${tool.color}25` }}
            >
              <tool.icon className="w-4 h-4" style={{ color: tool.color }} />
            </div>
          )}
          <div>
            <h1 className="font-display text-base font-black text-white leading-none" style={{ letterSpacing: '-0.04em' }}>{tool?.label}</h1>
            <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{tool?.description}</p>
          </div>
        </motion.div>

        <motion.button
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
          onClick={() => onSelectTool(null as any)}
          whileHover={{ x: -3 }}
          className="text-xs font-semibold flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all relative z-10"
          style={{ color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.7)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)'; }}
        >
          ← All tools
        </motion.button>
      </header>

      {/* Tool content */}
      <motion.div
        className="flex-1 overflow-y-auto p-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      >
        <Component />
      </motion.div>
    </motion.div>
  );
};

export default ToolPanel;
