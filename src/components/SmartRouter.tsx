import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Tool, ToolId } from "@/pages/Index";
import { Upload, ChevronRight, CheckCircle, Search, X } from "lucide-react";

interface SmartRouterProps {
  tools: Tool[];
  onSelectTool: (id: ToolId, file: File) => void;
  initialFile?: File | null;
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(s: number) {
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

// Which tools work with which file types
function getCompatibleTools(file: File, tools: Tool[]): { tool: Tool; reason: string; highlight?: boolean }[] {
  const isAudio = file.type.startsWith("audio/") || /\.(mp3|wav|flac|aac|ogg|m4a)$/i.test(file.name);
  const isVideo = file.type.startsWith("video/") || /\.(mp4|mov|avi|mkv|webm)$/i.test(file.name);

  const compatibility: Record<string, { works: boolean; reason: string; highlight?: boolean }> = {
    "audiolab":      { works: isAudio || isVideo, reason: isVideo ? "Convert video to audio + edit" : "Trim, EQ, reverb, export", highlight: true },
    "bpm-detector":  { works: isAudio,             reason: "Detect BPM and musical key",              highlight: true },
    "stem-splitter": { works: isAudio,             reason: "Separate vocals, drums, bass, instruments", highlight: true },
    "mastering":     { works: isAudio,             reason: "EQ, compression, limiting" },
    "slicer":        { works: isAudio,             reason: "Auto-chop into samples" },
    "visualizer":    { works: isAudio,             reason: "Animated frequency visualization" },
    "drum-machine":  { works: false,               reason: "No file needed — create from scratch" },
    "voice-recorder":{ works: false,               reason: "No file needed — record new audio" },
    "noise-generator":{ works: false,              reason: "No file needed — generate noise" },
  };

  return tools
    .filter(t => compatibility[t.id]?.works)
    .map(t => ({ tool: t, reason: compatibility[t.id]?.reason || "", highlight: compatibility[t.id]?.highlight }))
    .sort((a, b) => (b.highlight ? 1 : 0) - (a.highlight ? 1 : 0));
}

// Mini waveform visualizer
const WaveformPreview = ({ file }: { file: File }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [duration, setDuration] = useState<number | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const ctx = new AudioContext();
    file.arrayBuffer().then(ab => {
      ctx.decodeAudioData(ab).then(buffer => {
        setDuration(buffer.duration);
        const canvas = canvasRef.current;
        if (!canvas) return;
        const c = canvas.getContext("2d")!;
        const W = canvas.width, H = canvas.height;
        const data = buffer.getChannelData(0);
        const step = Math.floor(data.length / W);
        c.clearRect(0, 0, W, H);
        const grad = c.createLinearGradient(0, 0, W, 0);
        grad.addColorStop(0, "#7C3AED"); grad.addColorStop(0.5, "#3B82F6"); grad.addColorStop(1, "#06B6D4");
        c.strokeStyle = grad; c.lineWidth = 1.5;
        for (let x = 0; x < W; x++) {
          let max = 0;
          for (let j = 0; j < step; j++) max = Math.max(max, Math.abs(data[x * step + j] || 0));
          const h = max * H * 0.45;
          c.beginPath(); c.moveTo(x, H / 2 - h); c.lineTo(x, H / 2 + h); c.stroke();
        }
        ctx.close();
      }).catch(() => ctx.close());
    });
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="flex flex-col gap-2">
      <canvas ref={canvasRef} width={700} height={70}
        className="w-full rounded-xl"
        style={{ height: "56px", background: "rgba(0,0,0,0.3)", display: "block" }}
      />
      {duration !== null && (
        <div className="flex items-center justify-between text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
          <span>{formatDuration(0)}</span>
          <span className="font-mono font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>{formatDuration(duration)}</span>
          <span>{formatDuration(duration)}</span>
        </div>
      )}
    </div>
  );
};

export default function SmartRouter({ tools, onSelectTool, initialFile }: SmartRouterProps) {
  const [file, setFile] = useState<File | null>(initialFile || null);
  const [dragging, setDragging] = useState(false);
  const [search, setSearch] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const compatible = file ? getCompatibleTools(file, tools).filter(({tool}) => 
    search === '' || tool.label.toLowerCase().includes(search.toLowerCase()) || tool.description.toLowerCase().includes(search.toLowerCase())
  ) : [];

  const handleFile = useCallback((f: File) => setFile(f), []);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 overflow-y-auto"
      style={{ background: "#0F0F0F" }}
    >
      <div className="max-w-3xl mx-auto px-6 py-12">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-10">
          <h1 className="font-display font-black text-white mb-2"
            style={{ fontSize: "clamp(28px,4vw,48px)", letterSpacing: "-0.055em" }}
          >
            What do you want to do<br/>
            <span style={{ background: "linear-gradient(135deg,#A78BFA,#22D3EE)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              with your file?
            </span>
          </h1>
          <p className="text-sm font-light" style={{ color: "rgba(255,255,255,0.35)" }}>
            Drop any audio or video file — we'll show you every tool that works with it.
          </p>
        </motion.div>

        {/* Upload zone */}
        <AnimatePresence mode="wait">
          {!file ? (
            <motion.div key="upload"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
              onClick={() => fileRef.current?.click()}
              onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              className="cursor-pointer rounded-2xl flex flex-col items-center justify-center gap-5 text-center py-16 px-8 transition-all"
              style={{
                background: dragging ? "rgba(124,58,237,0.1)" : "rgba(255,255,255,0.025)",
                border: `2px dashed ${dragging ? "rgba(124,58,237,0.6)" : "rgba(255,255,255,0.12)"}`,
                boxShadow: dragging ? "0 0 40px rgba(124,58,237,0.2)" : "none",
              }}
              whileHover={{ borderColor: "rgba(124,58,237,0.4)", background: "rgba(124,58,237,0.06)" }}
            >
              <input ref={fileRef} type="file" accept="audio/*,video/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
              <motion.div
                className="w-20 h-20 rounded-2xl flex items-center justify-center"
                style={{ background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.25)" }}
                animate={{ scale: dragging ? 1.1 : 1 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <Upload className="w-9 h-9 text-purple-400" />
              </motion.div>
              <div>
                <p className="font-display font-black text-white text-xl mb-1" style={{ letterSpacing: "-0.04em" }}>
                  {dragging ? "Drop it!" : "Drop your file here"}
                </p>
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
                  or click to browse · MP3, WAV, FLAC, AAC, OGG, MP4, MOV
                </p>
              </div>
              {/* Format icons row */}
              <div className="flex items-center gap-3 flex-wrap justify-center">
                {["MP3","WAV","FLAC","AAC","OGG","MP4","MOV"].map(f => (
                  <span key={f} className="text-[10px] font-black px-2.5 py-1 rounded-lg"
                    style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.08)" }}
                  >{f}</span>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div key="file-loaded"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl p-6 mb-6"
              style={{ background: "rgba(124,58,237,0.07)", border: "1px solid rgba(124,58,237,0.2)" }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)" }}
                  >
                    <CheckCircle className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="font-bold text-white text-sm truncate max-w-[260px]">{file.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                      {formatSize(file.size)} · {file.type || "audio file"}
                    </p>
                  </div>
                </div>
                <button onClick={() => setFile(null)}
                  className="text-xs px-3 py-1.5 rounded-lg transition-colors hover:text-white"
                  style={{ color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
                >Change file</button>
              </div>
              {/* Waveform */}
              {(file.type.startsWith("audio/") || /\.(mp3|wav|flac|aac|ogg|m4a)$/i.test(file.name)) && (
                <WaveformPreview file={file} />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Compatible tools */}
        <AnimatePresence>
          {file && compatible.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display font-black text-white text-lg" style={{ letterSpacing: "-0.04em" }}>
                  Choose a tool
                </h2>
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                  {compatible.length} tools available
                </span>
              </div>
              {/* Search filter */}
              <div className="relative mb-4">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{color:"rgba(255,255,255,0.3)"}}/>
                <input
                  type="text"
                  placeholder="Search tools... (e.g. 'BPM', 'vocals', 'trim')"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl text-sm text-white placeholder:text-white/30 outline-none"
                  style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)"}}
                />
                {search && (
                  <button onClick={()=>setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                    <X className="w-3.5 h-3.5" style={{color:"rgba(255,255,255,0.3)"}}/>
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {compatible.map(({ tool, reason, highlight }, i) => {
                  const Icon = tool.icon;
                  return (
                    <motion.button key={tool.id}
                      initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06 }}
                      onClick={() => onSelectTool(tool.id, file)}
                      whileHover={{ x: 4, scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      className="w-full flex items-center justify-between p-4 rounded-2xl text-left group transition-all"
                      style={{
                        background: highlight ? `${tool.color}0D` : "rgba(255,255,255,0.025)",
                        border: `1px solid ${highlight ? tool.color + "28" : "rgba(255,255,255,0.07)"}`,
                        boxShadow: highlight ? `0 0 0 0 ${tool.color}00` : "none",
                      }}
                      onMouseEnter={e => { if (highlight) (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 24px ${tool.color}20`; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: `${tool.color}18`, border: `1px solid ${tool.color}30` }}
                        >
                          <Icon className="w-4 h-4" style={{ color: tool.color }} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-display font-black text-white text-sm" style={{ letterSpacing: "-0.03em" }}>
                              {tool.label}
                            </span>
                            {highlight && (
                              <span className="text-[9px] font-black px-2 py-0.5 rounded-full"
                                style={{ background: `${tool.color}20`, color: tool.color, border: `1px solid ${tool.color}30` }}
                              >Recommended</span>
                            )}
                          </div>
                          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>{reason}</p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        style={{ color: tool.color }}
                      />
                    </motion.button>
                  );
                })}
              </div>

              {/* Tools that don't need files */}
              <div className="mt-8 pt-6" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.2)" }}>
                  Tools that don't need a file
                </p>
                <div className="flex gap-2 flex-wrap">
                  {tools.filter(t => ["drum-machine","voice-recorder","noise-generator"].includes(t.id)).map(t => {
                    const Icon = t.icon;
                    return (
                      <button key={t.id} onClick={() => onSelectTool(t.id, file)}
                        className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-80"
                        style={{ background: `${t.color}10`, color: t.color, border: `1px solid ${t.color}25` }}
                      >
                        <Icon className="w-3.5 h-3.5" />{t.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
