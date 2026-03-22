import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Play, Pause, Download, RotateCcw } from "lucide-react";

const STEPS = 16;

const KITS = {
  "808": {
    Kick:   (ctx: AudioContext, t: number) => {
      const o = ctx.createOscillator(), g = ctx.createGain(), d = ctx.createDynamicsCompressor();
      o.connect(g); g.connect(d); d.connect(ctx.destination);
      o.frequency.setValueAtTime(160, t);
      o.frequency.exponentialRampToValueAtTime(0.01, t + 0.55);
      g.gain.setValueAtTime(1.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      o.start(t); o.stop(t + 0.6);
    },
    Snare:  (ctx: AudioContext, t: number) => {
      // Noise burst
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.22, ctx.sampleRate);
      const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const n = ctx.createBufferSource(), hpf = ctx.createBiquadFilter(), g = ctx.createGain();
      hpf.type = "highpass"; hpf.frequency.value = 1800; hpf.Q.value = 0.5;
      n.buffer = buf; n.connect(hpf); hpf.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      n.start(t); n.stop(t + 0.22);
      // Body tone
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.connect(og); og.connect(ctx.destination);
      o.frequency.setValueAtTime(200, t); o.frequency.exponentialRampToValueAtTime(120, t + 0.08);
      og.gain.setValueAtTime(0.6, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      o.start(t); o.stop(t + 0.12);
    },
    HiHat:  (ctx: AudioContext, t: number, open = false) => {
      const buf = ctx.createBuffer(2, ctx.sampleRate * 0.15, ctx.sampleRate);
      for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
      const n = ctx.createBufferSource(), hpf = ctx.createBiquadFilter(), g = ctx.createGain();
      hpf.type = "highpass"; hpf.frequency.value = 9000; hpf.Q.value = 0.8;
      n.buffer = buf; n.connect(hpf); hpf.connect(g); g.connect(ctx.destination);
      const decay = open ? 0.35 : 0.06;
      g.gain.setValueAtTime(0.55, t); g.gain.exponentialRampToValueAtTime(0.001, t + decay);
      n.start(t); n.stop(t + decay + 0.01);
    },
    Clap:   (ctx: AudioContext, t: number) => {
      [0, 0.008, 0.018].forEach(off => {
        const buf = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
        const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        const n = ctx.createBufferSource(), bpf = ctx.createBiquadFilter(), g = ctx.createGain();
        bpf.type = "bandpass"; bpf.frequency.value = 1400; bpf.Q.value = 0.6;
        n.buffer = buf; n.connect(bpf); bpf.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0.7, t + off); g.gain.exponentialRampToValueAtTime(0.001, t + off + 0.09);
        n.start(t + off); n.stop(t + off + 0.1);
      });
    },
    Tom:    (ctx: AudioContext, t: number) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.setValueAtTime(100, t); o.frequency.exponentialRampToValueAtTime(50, t + 0.32);
      g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      o.start(t); o.stop(t + 0.38);
    },
    Rim:    (ctx: AudioContext, t: number) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "square"; o.connect(g); g.connect(ctx.destination);
      o.frequency.setValueAtTime(400, t);
      g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      o.start(t); o.stop(t + 0.05);
    },
  },
  "Trap": {
    Kick:   (ctx: AudioContext, t: number) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.setValueAtTime(80, t); o.frequency.exponentialRampToValueAtTime(0.01, t + 0.7);
      g.gain.setValueAtTime(1.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
      o.start(t); o.stop(t + 0.75);
    },
    Snare:  (ctx: AudioContext, t: number) => {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
      const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const n = ctx.createBufferSource(), hpf = ctx.createBiquadFilter(), g = ctx.createGain();
      hpf.type = "highpass"; hpf.frequency.value = 3000;
      n.buffer = buf; n.connect(hpf); hpf.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.6, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      n.start(t); n.stop(t + 0.15);
    },
    HiHat:  (ctx: AudioContext, t: number, open = false) => {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
      const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const n = ctx.createBufferSource(), hpf = ctx.createBiquadFilter(), g = ctx.createGain();
      hpf.type = "highpass"; hpf.frequency.value = 12000;
      n.buffer = buf; n.connect(hpf); hpf.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.4, t); g.gain.exponentialRampToValueAtTime(0.001, t + (open ? 0.2 : 0.03));
      n.start(t); n.stop(t + (open ? 0.21 : 0.04));
    },
    Clap:   (ctx: AudioContext, t: number) => {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.25, ctx.sampleRate);
      const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
      const n = ctx.createBufferSource(), bpf = ctx.createBiquadFilter(), g = ctx.createGain(), rev = ctx.createConvolver();
      bpf.type = "bandpass"; bpf.frequency.value = 1200; bpf.Q.value = 0.5;
      const irLen = ctx.sampleRate * 0.5, irBuf = ctx.createBuffer(1, irLen, ctx.sampleRate);
      const ir = irBuf.getChannelData(0); for (let i = 0; i < irLen; i++) ir[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 3);
      rev.buffer = irBuf;
      n.buffer = buf; n.connect(bpf); bpf.connect(g); g.connect(rev); rev.connect(ctx.destination); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      n.start(t); n.stop(t + 0.26);
    },
    Tom:    (ctx: AudioContext, t: number) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.setValueAtTime(60, t); o.frequency.exponentialRampToValueAtTime(30, t + 0.4);
      g.gain.setValueAtTime(1.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      o.start(t); o.stop(t + 0.5);
    },
    Rim:    (ctx: AudioContext, t: number) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "square"; o.connect(g); g.connect(ctx.destination);
      o.frequency.setValueAtTime(300, t);
      g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
      o.start(t); o.stop(t + 0.03);
    },
  },
  "Lo-Fi": {
    Kick:   (ctx: AudioContext, t: number) => {
      const o = ctx.createOscillator(), g = ctx.createGain(), lpf = ctx.createBiquadFilter();
      lpf.type = "lowpass"; lpf.frequency.value = 300;
      o.connect(g); g.connect(lpf); lpf.connect(ctx.destination);
      o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.3);
      g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      o.start(t); o.stop(t + 0.4);
    },
    Snare:  (ctx: AudioContext, t: number) => {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
      const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const n = ctx.createBufferSource(), lpf = ctx.createBiquadFilter(), g = ctx.createGain();
      lpf.type = "lowpass"; lpf.frequency.value = 4000;
      n.buffer = buf; n.connect(lpf); lpf.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.45, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      n.start(t); n.stop(t + 0.2);
    },
    HiHat:  (ctx: AudioContext, t: number, open = false) => {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
      const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const n = ctx.createBufferSource(), bpf = ctx.createBiquadFilter(), g = ctx.createGain();
      bpf.type = "bandpass"; bpf.frequency.value = 6000; bpf.Q.value = 1.2;
      n.buffer = buf; n.connect(bpf); bpf.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + (open ? 0.25 : 0.07));
      n.start(t); n.stop(t + (open ? 0.26 : 0.08));
    },
    Clap:   (ctx: AudioContext, t: number) => {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.12, ctx.sampleRate);
      const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const n = ctx.createBufferSource(), lpf = ctx.createBiquadFilter(), g = ctx.createGain();
      lpf.type = "lowpass"; lpf.frequency.value = 2500;
      n.buffer = buf; n.connect(lpf); lpf.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.4, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      n.start(t); n.stop(t + 0.12);
    },
    Tom:    (ctx: AudioContext, t: number) => {
      const o = ctx.createOscillator(), g = ctx.createGain(), lpf = ctx.createBiquadFilter();
      lpf.type = "lowpass"; lpf.frequency.value = 200;
      o.connect(g); g.connect(lpf); lpf.connect(ctx.destination);
      o.frequency.setValueAtTime(80, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.28);
      g.gain.setValueAtTime(0.7, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      o.start(t); o.stop(t + 0.32);
    },
    Rim:    (ctx: AudioContext, t: number) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "triangle"; o.connect(g); g.connect(ctx.destination);
      o.frequency.setValueAtTime(250, t);
      g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      o.start(t); o.stop(t + 0.06);
    },
  },
} as const;

type KitName = keyof typeof KITS;
type TrackName = keyof typeof KITS["808"];

const TRACKS: TrackName[] = ["Kick", "Snare", "HiHat", "Clap", "Tom", "Rim"];
const TRACK_COLORS: Record<TrackName, string> = {
  Kick: "#3B82F6", Snare: "#8B5CF6", HiHat: "#06B6D4",
  Clap: "#F59E0B", Tom: "#EC4899", Rim: "#10B981",
};

const DEFAULT_PATTERNS: Record<KitName, boolean[][]> = {
  "808": [
    [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0].map(Boolean),
    [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0].map(Boolean),
    [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0].map(Boolean),
    [0,0,0,0, 1,0,0,0, 0,0,0,0, 0,0,1,0].map(Boolean),
    [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0].map(Boolean),
    [0,0,1,0, 0,0,0,0, 0,0,1,0, 0,0,0,0].map(Boolean),
  ],
  "Trap": [
    [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0].map(Boolean),
    [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0].map(Boolean),
    [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1].map(Boolean),
    [0,0,0,0, 1,0,0,0, 0,0,0,0, 0,0,0,0].map(Boolean),
    [0,0,0,0, 0,0,0,0, 0,0,0,0, 1,0,0,0].map(Boolean),
    [0,0,0,0, 0,1,0,0, 0,0,0,0, 0,1,0,0].map(Boolean),
  ],
  "Lo-Fi": [
    [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,0].map(Boolean),
    [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0].map(Boolean),
    [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0].map(Boolean),
    [0,0,0,0, 1,0,0,0, 0,0,0,0, 0,0,0,0].map(Boolean),
    [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0].map(Boolean),
    [0,1,0,0, 0,0,0,1, 0,0,0,0, 0,1,0,0].map(Boolean),
  ],
};

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


// Generate a musically plausible random pattern for a given kit
function generateRandomPattern(kit: KitName): boolean[][] {
  const patterns: boolean[][] = [];
  // Kick - typically on beats 1, 3 with variations
  const kickOptions = [
    [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],
    [1,0,0,0,0,0,1,0,1,0,0,0,0,0,1,0],
    [1,0,0,1,0,0,1,0,1,0,0,0,1,0,0,0],
    [1,0,0,0,1,0,0,0,0,0,1,0,0,0,1,0],
  ];
  const snareOptions = [
    [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
    [0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0],
    [0,0,0,0,1,0,0,1,0,0,0,0,1,0,0,0],
  ];
  const hihatOptions: Record<KitName, number[][]> = {
    "808": [[1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0],[1,1,0,1,1,0,1,1,0,1,1,0,1,1,0,1]],
    "Trap": [[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,0,1,1,1,0,1,1,1,0,1,1,1,0,1,1]],
    "Lo-Fi": [[0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0],[0,0,1,0,0,1,0,0,0,0,1,0,0,0,0,1]],
  };
  const r = (arr: number[][][]) => arr[Math.floor(Math.random()*arr.length)].map(Boolean);
  const rGlobal = (arr: number[][]) => arr[Math.floor(Math.random()*arr.length)].map(Boolean);
  patterns.push(rGlobal(kickOptions));  // Kick
  patterns.push(rGlobal(snareOptions)); // Snare
  patterns.push(r(hihatOptions[kit]));  // HiHat
  // Clap - sparse random
  patterns.push(Array.from({length:16}, (_,i) => Math.random() < (kit==="Trap"?0.15:0.08) || i===4 || i===12));
  // Tom
  patterns.push(Array.from({length:16}, (_,i) => Math.random() < 0.06 && i%4===0));
  // Rim
  patterns.push(Array.from({length:16}, (_,i) => Math.random() < 0.1));
  return patterns;
}

const DrumMachine = () => {
  const [kit, setKit] = useState<KitName>(() => {
    try { return (localStorage.getItem("sonarc-drum-kit") as KitName) || "808"; } catch { return "808"; }
  });
  const [grid, setGrid] = useState<boolean[][]>(() => {
    try {
      const saved = localStorage.getItem("sonarc-drum-grid");
      const savedKit = localStorage.getItem("sonarc-drum-kit") as KitName | null;
      if (saved && savedKit) return JSON.parse(saved);
    } catch {}
    return DEFAULT_PATTERNS["808"].map(r => [...r]);
  });
  const [playing, setPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [bpm, setBpm] = useState(90);
  const [swing, setSwing] = useState(0);

  const ctxRef = useRef<AudioContext | null>(null);
  const schedulerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextTimeRef = useRef(0);
  const stepRef = useRef(0);
  const gridRef = useRef(grid);
  const kitRef = useRef(kit);
  gridRef.current = grid;
  kitRef.current = kit;

  // Persist to localStorage
  useEffect(() => {
    try { localStorage.setItem("sonarc-drum-grid", JSON.stringify(grid)); } catch {}
  }, [grid]);
  useEffect(() => {
    try { localStorage.setItem("sonarc-drum-kit", kit); } catch {}
  }, [kit]);

  // Switch kit — load default pattern for that kit
  const switchKit = (k: KitName) => {
    setKit(k);
    setGrid(DEFAULT_PATTERNS[k].map(r => [...r]));
    setPlaying(false);
    setCurrentStep(-1);
  };

  const getCtx = () => {
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    if (ctxRef.current.state === 'suspended') ctxRef.current.resume();
    return ctxRef.current;
  };

  const triggerTrack = useCallback((ctx: AudioContext, trackIdx: number, time: number) => {
    const k = kitRef.current;
    const fn = KITS[k][TRACKS[trackIdx]];
    if (trackIdx === 2) (fn as Function)(ctx, time, false);
    else (fn as Function)(ctx, time);
  }, []);

  const scheduler = useCallback(() => {
    const ctx = getCtx();
    const secPerStep = (60 / bpm) / 4;
    while (nextTimeRef.current < ctx.currentTime + 0.12) {
      const s = stepRef.current % STEPS;
      const swingOffset = (s % 2 === 1) ? (swing / 100) * secPerStep * 0.5 : 0;
      gridRef.current.forEach((track, ti) => {
        if (track[s]) triggerTrack(ctx, ti, nextTimeRef.current + swingOffset);
      });
      setCurrentStep(s);
      nextTimeRef.current += secPerStep;
      stepRef.current++;
    }
  }, [bpm, swing, triggerTrack]);

  useEffect(() => {
    if (playing) {
      const ctx = getCtx();
      nextTimeRef.current = ctx.currentTime + 0.05;
      stepRef.current = 0;
      schedulerRef.current = setInterval(scheduler, 25);
    } else {
      if (schedulerRef.current) clearInterval(schedulerRef.current);
      setCurrentStep(-1);
    }
    return () => { if (schedulerRef.current) clearInterval(schedulerRef.current); };
  }, [playing, scheduler]);

  const toggle = (ti: number, si: number) => {
    setGrid(g => { const n = g.map(r => [...r]); n[ti][si] = !n[ti][si]; return n; });
  };

  const randomizeGrid = () => {
    const newGrid = generateRandomPattern(kit);
    setGrid(newGrid);
    setPlaying(false);
    try { localStorage.setItem("sonarc-drum-grid", JSON.stringify(newGrid)); } catch {}
  };

  const exportWav = async () => {
    const secPerStep = (60 / bpm) / 4;
    const total = STEPS * secPerStep + 0.6;
    const ctx = new OfflineAudioContext(2, Math.ceil(44100 * total), 44100);
    for (let s = 0; s < STEPS; s++) {
      const t = s * secPerStep;
      grid.forEach((track, ti) => {
        if (track[s]) {
          const fn = KITS[kit][TRACKS[ti]];
          (fn as Function)(ctx as any, t);
        }
      });
    }
    const rendered = await ctx.startRendering();
    const blob = audioBufferToWav(rendered);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `sonarc-${kit.toLowerCase()}-beat.wav`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Top controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <motion.button whileHover={{scale:1.05}} whileTap={{scale:.95}}
            onClick={() => setPlaying(!playing)}
            className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-white"
            style={{background: playing ? "#EF4444" : "#3B82F6", boxShadow: playing ? "0 0 16px rgba(239,68,68,0.5)" : "0 0 16px rgba(59,130,246,0.5)"}}
          >
            {playing ? <Pause className="w-4 h-4"/> : <Play className="w-4 h-4 ml-0.5"/>}
          </motion.button>
          <motion.button whileHover={{scale:1.05}} whileTap={{scale:.95}}
            onClick={randomizeGrid}
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)"}}
          ><RotateCcw className="w-3.5 h-3.5 text-white/50"/></motion.button>
          <motion.button whileHover={{scale:1.05}} whileTap={{scale:.95}}
            onClick={exportWav}
            className="flex items-center gap-2 px-4 h-9 rounded-xl text-xs font-semibold"
            style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.6)"}}
          ><Download className="w-3.5 h-3.5"/>Export WAV</motion.button>
        </div>

        {/* Kit selector */}
        <div className="flex gap-1.5">
          {(["808","Trap","Lo-Fi"] as KitName[]).map(k => (
            <button key={k} onClick={() => switchKit(k)}
              className="px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-200"
              style={kit === k
                ? {background:"rgba(59,130,246,0.2)",color:"#60A5FA",border:"1px solid rgba(59,130,246,0.4)"}
                : {background:"rgba(255,255,255,0.04)",color:"rgba(255,255,255,0.4)",border:"1px solid rgba(255,255,255,0.08)"}}
            >{k}</button>
          ))}
        </div>
      </div>

      {/* BPM + Swing */}
      <div className="grid grid-cols-2 gap-4 p-4 rounded-xl" style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)"}}>
        <div>
          <div className="flex justify-between mb-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">BPM</label>
            <span className="font-mono text-sm font-bold text-white">{bpm}</span>
          </div>
          <input type="range" min={60} max={180} value={bpm} onChange={e => setBpm(+e.target.value)} className="w-full"/>
        </div>
        <div>
          <div className="flex justify-between mb-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Swing</label>
            <span className="font-mono text-sm font-bold text-white">{swing}%</span>
          </div>
          <input type="range" min={0} max={50} value={swing} onChange={e => setSwing(+e.target.value)} className="w-full"/>
        </div>
      </div>

      {/* Sequencer */}
      <div className="p-4 rounded-xl space-y-2.5" style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)"}}>
        {/* Beat numbers */}
        <div className="flex items-center gap-[3px] ml-[72px]">
          {Array.from({length:STEPS},(_,i) => (
            <div key={i} className="flex-1 text-center text-[9px] font-mono"
              style={{color: currentStep===i && playing ? "#3B82F6" : i%4===0 ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.1)"}}
            >{i%4===0 ? i/4+1 : ""}</div>
          ))}
        </div>

        {TRACKS.map((track, ti) => (
          <div key={track} className="flex items-center gap-2">
            <div className="w-[64px] shrink-0 flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full shrink-0" style={{background:TRACK_COLORS[track]}}/>
              <span className="text-[11px] font-semibold truncate" style={{color:"rgba(255,255,255,0.5)"}}>{track}</span>
            </div>
            <div className="flex-1 flex gap-[3px]">
              {Array.from({length:STEPS},(_,si) => {
                const active = grid[ti]?.[si] ?? false;
                const isCurrent = currentStep === si && playing;
                return (
                  <motion.button key={si} whileTap={{scale:.88}}
                    onClick={() => toggle(ti, si)}
                    className="flex-1 h-8 rounded-[5px] transition-all duration-75"
                    style={{
                      background: active
                        ? (isCurrent ? TRACK_COLORS[track] : TRACK_COLORS[track] + "88")
                        : (isCurrent ? "rgba(255,255,255,0.15)" : si%4===0 ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.04)"),
                      border: `1px solid ${active ? TRACK_COLORS[track] + (isCurrent?"":"55") : "rgba(255,255,255,0.06)"}`,
                      boxShadow: active && isCurrent ? `0 0 12px ${TRACK_COLORS[track]}70` : "none",
                    }}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-center" style={{color:"rgba(255,255,255,0.2)"}}>
        Kit: <span style={{color:"rgba(255,255,255,0.5)"}}>{kit}</span> · Click pads to toggle · Export downloads your beat as WAV
      </p>
    </div>
  );
};

export default DrumMachine;
