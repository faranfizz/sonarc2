import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Play, Square, Download, Volume2, Scissors, Music, RefreshCw } from "lucide-react";

type Effect = { reverb: number; bass: number; treble: number; volume: number; fadeIn: number; fadeOut: number; };
type State = "idle" | "loading" | "ready" | "playing" | "exporting";

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numCh = buffer.numberOfChannels, len = buffer.length * numCh * 2;
  const ab = new ArrayBuffer(44 + len); const view = new DataView(ab); const sr = buffer.sampleRate;
  const ws = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  ws(0,'RIFF'); view.setUint32(4,36+len,true); ws(8,'WAVE'); ws(12,'fmt ');
  view.setUint32(16,16,true); view.setUint16(20,1,true); view.setUint16(22,numCh,true);
  view.setUint32(24,sr,true); view.setUint32(28,sr*numCh*2,true); view.setUint16(32,numCh*2,true);
  view.setUint16(34,16,true); ws(36,'data'); view.setUint32(40,len,true);
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) for (let ch = 0; ch < numCh; ch++) {
    const s = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true); offset += 2;
  }
  return new Blob([ab], { type: 'audio/wav' });
}

function makeReverb(ctx: BaseAudioContext, amount: number) {
  if (amount === 0) return null;
  const decay = 0.5 + amount * 3.5;
  const len = Math.ceil(ctx.sampleRate * decay);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
  }
  const c = ctx.createConvolver(); c.buffer = buf; return c;
}

async function processAudio(
  sourceBuffer: AudioBuffer,
  trim: [number, number],
  effects: Effect
): Promise<AudioBuffer> {
  const sr = sourceBuffer.sampleRate;
  const startSample = Math.floor(trim[0] * sr);
  const endSample = Math.floor(trim[1] * sr);
  const trimLen = endSample - startSample;

  const ctx = new OfflineAudioContext(sourceBuffer.numberOfChannels, trimLen, sr);

  // Create trimmed buffer
  const trimBuf = ctx.createBuffer(sourceBuffer.numberOfChannels, trimLen, sr);
  for (let ch = 0; ch < sourceBuffer.numberOfChannels; ch++) {
    trimBuf.getChannelData(ch).set(sourceBuffer.getChannelData(ch).subarray(startSample, endSample));
  }

  const src = ctx.createBufferSource(); src.buffer = trimBuf;

  // Volume
  const vol = ctx.createGain(); vol.gain.value = effects.volume;

  // Bass boost/cut (low shelf)
  const bass = ctx.createBiquadFilter(); bass.type = "lowshelf"; bass.frequency.value = 250;
  bass.gain.value = (effects.bass - 0.5) * 20; // -10 to +10 dB

  // Treble boost/cut (high shelf)
  const treble = ctx.createBiquadFilter(); treble.type = "highshelf"; treble.frequency.value = 4000;
  treble.gain.value = (effects.treble - 0.5) * 20;

  // Compressor to prevent clipping
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18; comp.knee.value = 6; comp.ratio.value = 3;

  // Reverb
  const rev = makeReverb(ctx, effects.reverb);
  const revGain = ctx.createGain(); revGain.gain.value = effects.reverb * 0.4;

  // Chain: src → vol → bass → treble → comp → destination
  src.connect(vol); vol.connect(bass); bass.connect(treble); treble.connect(comp); comp.connect(ctx.destination);

  // Reverb send
  if (rev) { treble.connect(rev); rev.connect(revGain); revGain.connect(ctx.destination); }

  // Fade in
  if (effects.fadeIn > 0) {
    //const fadeInSamples = effects.fadeIn * sr;
    comp.gain?.setValueAtTime(0, 0); // not a gain node, use vol
    vol.gain.setValueAtTime(0, 0);
    vol.gain.linearRampToValueAtTime(effects.volume, effects.fadeIn);
  }

  // Fade out
  if (effects.fadeOut > 0) {
    const fadeOutStart = trimLen / sr - effects.fadeOut;
    if (fadeOutStart > 0) {
      vol.gain.setValueAtTime(effects.volume, fadeOutStart);
      vol.gain.linearRampToValueAtTime(0, trimLen / sr);
    }
  }

  src.start(0);
  return ctx.startRendering();
}

// Draw waveform on canvas
function drawWaveform(canvas: HTMLCanvasElement, buffer: AudioBuffer, trim: [number, number], color: string) {
  const ctx = canvas.getContext("2d")!;
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const data = buffer.getChannelData(0);
  const step = Math.floor(data.length / W);
  const trimStart = trim[0] / buffer.duration;
  const trimEnd = trim[1] / buffer.duration;

  for (let x = 0; x < W; x++) {
    const inTrim = x / W >= trimStart && x / W <= trimEnd;
    let max = 0;
    for (let j = 0; j < step; j++) max = Math.max(max, Math.abs(data[x * step + j] || 0));
    const barH = max * H * 0.45;
    ctx.fillStyle = inTrim ? color : "rgba(255,255,255,0.12)";
    ctx.fillRect(x, H / 2 - barH, 1, barH * 2);
  }

  // Trim handles
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.fillRect(trimStart * W - 1, 0, 2, H);
  ctx.fillRect(trimEnd * W - 1, 0, 2, H);
}

const ACCENT = "#06B6D4";

const Slider = ({ label, value, onChange, min = 0, max = 1, step = 0.01, display }: {
  label: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number; display?: (v: number) => string;
}) => (
  <div>
    <div className="flex items-center justify-between mb-1">
      <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>{label}</label>
      <span className="font-mono text-xs font-bold" style={{ color: "rgba(255,255,255,0.6)" }}>{display ? display(value) : Math.round(value * 100) + "%"}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value}
      onChange={e => onChange(+e.target.value)} className="w-full"
    />
  </div>
);

const AudioLab = () => {
  const [state, setState] = useState<State>("idle");
  const [fileName, setFileName] = useState("");
  const [duration, setDuration] = useState(0);
  const [trim, setTrim] = useState<[number, number]>([0, 1]);
  const [effects, setEffects] = useState<Effect>({ reverb: 0, bass: 0.5, treble: 0.5, volume: 1, fadeIn: 0, fadeOut: 0 });
  const [error, setError] = useState("");

  const bufferRef = useRef<AudioBuffer | null>(null);
  const playCtxRef = useRef<AudioContext | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const redrawWaveform = useCallback(() => {
    if (canvasRef.current && bufferRef.current) {
      drawWaveform(canvasRef.current, bufferRef.current, [trim[0] * bufferRef.current.duration, trim[1] * bufferRef.current.duration], ACCENT);
    }
  }, [trim]);

  useEffect(() => { redrawWaveform(); }, [redrawWaveform]);

  const loadFile = async (file: File) => {
    setState("loading");
    setError("");
    setFileName(file.name);

    try {
      // For video files, create a video element and capture audio
      // For audio files, decode directly
      const arrayBuffer = await file.arrayBuffer();
      const ctx = new AudioContext();

      let audioBuffer: AudioBuffer;

      if (file.type.startsWith("video/")) {
        // Use MediaElement approach for video → audio extraction
        const blob = new Blob([arrayBuffer], { type: file.type });
        const url = URL.createObjectURL(blob);
        const video = document.createElement("video");
        video.src = url;
        video.muted = false;

        await new Promise<void>((resolve, reject) => {
          video.onloadedmetadata = () => resolve();
          video.onerror = () => reject(new Error("Could not load video"));
          setTimeout(() => reject(new Error("Video load timeout")), 10000);
        });

        // Render video audio to buffer
        const dur = video.duration;
        const offCtx = new OfflineAudioContext(2, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
        const src = offCtx.createMediaElementSource ? null : null;

        // Fallback: decode the container as audio
        try {
          audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
        } catch {
          // Try to read audio track via video
          setError("Video format not supported directly. Try converting to MP4 first, or extract audio with another tool.");
          setState("idle");
          URL.revokeObjectURL(url);
          ctx.close();
          return;
        }
        URL.revokeObjectURL(url);
      } else {
        audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      }

      bufferRef.current = audioBuffer;
      const dur = audioBuffer.duration;
      setDuration(dur);
      setTrim([0, dur]);
      setState("ready");
      ctx.close();

      // Draw waveform after state update
      setTimeout(() => {
        if (canvasRef.current) drawWaveform(canvasRef.current, audioBuffer, [0, dur], ACCENT);
      }, 100);
    } catch (e) {
      setError("Could not read file. Supported: MP3, WAV, AAC, OGG, FLAC, and most MP4 videos.");
      setState("idle");
    }
  };

  const handleFile = (file: File) => { if (file) loadFile(file); };

  const stopPlayback = () => {
    playCtxRef.current?.close(); playCtxRef.current = null; setState("ready");
  };

  const preview = async () => {
    if (!bufferRef.current) return;
    if (state === "playing") { stopPlayback(); return; }

    const processed = await processAudio(bufferRef.current, trim, effects);
    const ctx = new AudioContext(); playCtxRef.current = ctx;
    const src = ctx.createBufferSource(); src.buffer = processed;
    src.connect(ctx.destination); src.start();
    setState("playing");
    src.onended = () => { setState("ready"); playCtxRef.current = null; };
  };

  const exportWav = async () => {
    if (!bufferRef.current) return;
    setState("exporting");
    const processed = await processAudio(bufferRef.current, trim, effects);
    const blob = audioBufferToWav(processed);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const base = fileName.replace(/\.[^.]+$/, "");
    a.href = url; a.download = `sonarc-${base}-edited.wav`; a.click();
    URL.revokeObjectURL(url);
    setState("ready");
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return (
    <div className="max-w-3xl mx-auto space-y-5">

      {/* Upload zone */}
      {state === "idle" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          onClick={() => fileInputRef.current?.click()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          onDragOver={e => e.preventDefault()}
          className="cursor-pointer p-12 rounded-2xl flex flex-col items-center gap-4 text-center transition-all"
          style={{ background: "rgba(6,182,212,0.04)", border: "2px dashed rgba(6,182,212,0.25)" }}
          whileHover={{ borderColor: "rgba(6,182,212,0.5)", background: "rgba(6,182,212,0.07)" }}
        >
          <input ref={fileInputRef} type="file" accept="audio/*,video/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(6,182,212,0.12)", border: "1px solid rgba(6,182,212,0.3)" }}
          >
            <Upload className="w-7 h-7" style={{ color: ACCENT }} />
          </div>
          <div>
            <p className="font-display font-black text-white text-lg" style={{ letterSpacing: "-0.03em" }}>Drop your audio or video</p>
            <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>MP3 · WAV · AAC · FLAC · OGG · MP4 · MOV</p>
          </div>
          <div className="flex gap-6 mt-2">
            {[{ icon: "🎬", text: "Video → Audio" }, { icon: "✂️", text: "Trim clips" }, { icon: "🎛️", text: "Add reverb & EQ" }, { icon: "📥", text: "Export WAV" }].map((f, i) => (
              <div key={i} className="text-center">
                <div className="text-lg mb-1">{f.icon}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.3)" }}>{f.text}</div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Loading */}
      {state === "loading" && (
        <div className="flex items-center justify-center py-16 gap-3">
          <motion.div className="w-6 h-6 border-2 rounded-full border-t-transparent"
            style={{ borderColor: ACCENT, borderTopColor: "transparent" }}
            animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
          <span className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>Loading {fileName}...</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 rounded-xl text-sm" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#FCA5A5" }}>
          {error}
        </div>
      )}

      {/* Editor */}
      <AnimatePresence>
        {(state === "ready" || state === "playing" || state === "exporting") && bufferRef.current && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

            {/* File info + controls */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(6,182,212,0.12)", border: "1px solid rgba(6,182,212,0.25)" }}>
                  <Music className="w-4 h-4" style={{ color: ACCENT }} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white truncate max-w-[200px]">{fileName}</p>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{fmt(duration)} · {Math.round(bufferRef.current.sampleRate / 1000)}kHz</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setState("idle"); bufferRef.current = null; setError(""); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)" }}
                >← New file</button>
                <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                  onClick={preview}
                  className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold"
                  style={state === "playing"
                    ? { background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "#F87171" }
                    : { background: "rgba(6,182,212,0.12)", border: "1px solid rgba(6,182,212,0.3)", color: ACCENT }}
                >
                  {state === "playing" ? <><Square className="w-3.5 h-3.5" />Stop</> : <><Play className="w-3.5 h-3.5" />Preview</>}
                </motion.button>
                <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                  onClick={exportWav} disabled={state === "exporting"}
                  className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold"
                  style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" }}
                >
                  {state === "exporting"
                    ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Exporting...</>
                    : <><Download className="w-3.5 h-3.5" />Export WAV</>}
                </motion.button>
              </div>
            </div>

            {/* Waveform */}
            <div className="rounded-xl overflow-hidden relative" style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <canvas ref={canvasRef} width={800} height={100} className="w-full" style={{ height: "80px" }} />
              <div className="absolute bottom-1 left-2 right-2 flex justify-between text-[9px] font-mono" style={{ color: "rgba(255,255,255,0.2)" }}>
                <span>{fmt(trim[0])}</span>
                <span className="text-center" style={{ color: ACCENT }}>{fmt(trim[1] - trim[0])} selected</span>
                <span>{fmt(trim[1])}</span>
              </div>
            </div>

            {/* Trim */}
            <div className="p-4 rounded-xl space-y-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-center gap-2 mb-1">
                <Scissors className="w-3.5 h-3.5" style={{ color: ACCENT }} />
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>Trim</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Slider label="Start" value={trim[0]} min={0} max={duration} step={0.01}
                  display={v => fmt(v)}
                  onChange={v => { if (v < trim[1] - 0.1) setTrim([v, trim[1]]); }}
                />
                <Slider label="End" value={trim[1]} min={0} max={duration} step={0.01}
                  display={v => fmt(v)}
                  onChange={v => { if (v > trim[0] + 0.1) setTrim([trim[0], v]); }}
                />
              </div>
            </div>

            {/* Effects */}
            <div className="p-4 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-center gap-2 mb-4">
                <Volume2 className="w-3.5 h-3.5" style={{ color: ACCENT }} />
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>Effects</span>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <Slider label="Volume" value={effects.volume} min={0} max={2} step={0.01}
                  display={v => Math.round(v * 100) + "%"}
                  onChange={v => setEffects(e => ({ ...e, volume: v }))}
                />
                <Slider label="Reverb" value={effects.reverb}
                  display={v => Math.round(v * 100) + "%"}
                  onChange={v => setEffects(e => ({ ...e, reverb: v }))}
                />
                <Slider label="Bass" value={effects.bass}
                  display={v => v === 0.5 ? "0dB" : `${Math.round((v - 0.5) * 20)}dB`}
                  onChange={v => setEffects(e => ({ ...e, bass: v }))}
                />
                <Slider label="Treble" value={effects.treble}
                  display={v => v === 0.5 ? "0dB" : `${Math.round((v - 0.5) * 20)}dB`}
                  onChange={v => setEffects(e => ({ ...e, treble: v }))}
                />
                <Slider label="Fade In" value={effects.fadeIn} min={0} max={Math.min(5, duration / 2)} step={0.1}
                  display={v => v === 0 ? "Off" : v.toFixed(1) + "s"}
                  onChange={v => setEffects(e => ({ ...e, fadeIn: v }))}
                />
                <Slider label="Fade Out" value={effects.fadeOut} min={0} max={Math.min(5, duration / 2)} step={0.1}
                  display={v => v === 0 ? "Off" : v.toFixed(1) + "s"}
                  onChange={v => setEffects(e => ({ ...e, fadeOut: v }))}
                />
              </div>
            </div>

            <p className="text-[11px] text-center" style={{ color: "rgba(255,255,255,0.2)" }}>
              Preview applies all effects in real time · Export saves as high-quality WAV
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AudioLab;
