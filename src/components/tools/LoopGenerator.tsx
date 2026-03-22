import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Square, Download, RefreshCw } from "lucide-react";

const MOODS = ['Chill','Dark','Hype','Dreamy','Aggressive','Uplifting'] as const;
const KEYS = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'] as const;
const SCALES: Record<string,number[]> = {
  Minor:      [0,2,3,5,7,8,10],
  Major:      [0,2,4,5,7,9,11],
  Pentatonic: [0,2,4,7,9],
  Dorian:     [0,2,3,5,7,9,10],
};
const KEY_OFFSETS: Record<string,number> = {C:60,'C#':61,D:62,'D#':63,E:64,F:65,'F#':66,G:67,'G#':68,A:69,'A#':70,B:71};

type Mood = typeof MOODS[number];

function noteFreq(midi: number) { return 440 * Math.pow(2, (midi - 69) / 12); }

// Build a reverb impulse response
function makeReverb(ctx: AudioContext | OfflineAudioContext, decay = 2.5) {
  const len = ctx.sampleRate * decay;
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
  }
  const c = ctx.createConvolver(); c.buffer = buf; return c;
}

function generateLoop(
  ctx: AudioContext | OfflineAudioContext,
  { bpm, key, scale, mood, bars }: { bpm: number; key: string; scale: string; mood: Mood; bars: number }
) {
  const master = ctx.createGain(); master.gain.value = 0.85;
  master.connect(ctx.destination);

  const rev = makeReverb(ctx, 2.0);
  const revGain = ctx.createGain(); revGain.gain.value = 0.22;
  rev.connect(revGain); revGain.connect(master);

  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18; comp.knee.value = 10;
  comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.15;
  comp.connect(master);

  const intervals = SCALES[scale] || SCALES.Minor;
  const baseNote = KEY_OFFSETS[key] || 60;
  const secPerBeat = 60 / bpm;
  const totalSec = bars * 4 * secPerBeat;

  const moodCfg: Record<Mood, {density:number,octave:number,noteLen:number,waveform:OscillatorType,filterFreq:number,arpSpeed:number}> = {
    Chill:      { density:0.45, octave:0, noteLen:0.55, waveform:"triangle", filterFreq:1200, arpSpeed:0.5 },
    Dark:       { density:0.4,  octave:-1,noteLen:0.7,  waveform:"sawtooth", filterFreq:600,  arpSpeed:0.5 },
    Hype:       { density:0.7,  octave:1, noteLen:0.18, waveform:"sawtooth", filterFreq:4000, arpSpeed:0.25 },
    Dreamy:     { density:0.35, octave:0, noteLen:0.9,  waveform:"sine",     filterFreq:800,  arpSpeed:0.75 },
    Aggressive: { density:0.75, octave:1, noteLen:0.12, waveform:"square",   filterFreq:5000, arpSpeed:0.125},
    Uplifting:  { density:0.55, octave:1, noteLen:0.3,  waveform:"triangle", filterFreq:3000, arpSpeed:0.25 },
  };
  const cfg = moodCfg[mood];

  // Main filter
  const lpf = ctx.createBiquadFilter(); lpf.type = "lowpass"; lpf.frequency.value = cfg.filterFreq; lpf.Q.value = 1.5;
  lpf.connect(comp);

  // ─── MELODY ───
  const stepSize = secPerBeat * cfg.arpSpeed;
  const totalSteps = Math.floor(totalSec / stepSize);
  let lastIdx = Math.floor(intervals.length / 2);

  for (let step = 0; step < totalSteps; step++) {
    if (Math.random() > cfg.density) continue;
    const t = step * stepSize;
    // Step motion — prefer small intervals
    const move = Math.round((Math.random() - 0.5) * 3);
    lastIdx = Math.max(0, Math.min(intervals.length - 1, lastIdx + move));
    const octaveShift = cfg.octave * 12;
    const midi = baseNote + intervals[lastIdx] + octaveShift + (Math.random() > 0.85 ? 12 : 0);
    const freq = noteFreq(midi);
    const noteLen = cfg.noteLen * (0.7 + Math.random() * 0.6);
    const vel = 0.25 + Math.random() * 0.35;

    const osc = ctx.createOscillator(); const og = ctx.createGain();
    osc.type = cfg.waveform; osc.frequency.value = freq;
    osc.connect(og); og.connect(lpf); og.connect(rev);
    og.gain.setValueAtTime(0, t);
    og.gain.linearRampToValueAtTime(vel, t + 0.012);
    og.gain.exponentialRampToValueAtTime(vel * 0.6, t + noteLen * 0.4);
    og.gain.exponentialRampToValueAtTime(0.0001, t + noteLen);
    osc.start(t); osc.stop(t + noteLen + 0.05);
  }

  // ─── BASS LINE ───
  const bassOctave = -2;
  const bassFilter = ctx.createBiquadFilter(); bassFilter.type = "lowpass"; bassFilter.frequency.value = 400; bassFilter.Q.value = 2;
  bassFilter.connect(comp);

  const bassGain = ctx.createGain(); bassGain.gain.value = 0.7; bassGain.connect(bassFilter);

  for (let beat = 0; beat < bars * 4; beat++) {
    const t = beat * secPerBeat;
    // Root note always
    const rootMidi = baseNote + bassOctave * 12;
    const subOsc = ctx.createOscillator(); const subG = ctx.createGain();
    subOsc.type = "sine"; subOsc.frequency.value = noteFreq(rootMidi);
    subOsc.connect(subG); subG.connect(bassGain);
    subG.gain.setValueAtTime(0.8, t); subG.gain.exponentialRampToValueAtTime(0.0001, t + secPerBeat * 0.85);
    subOsc.start(t); subOsc.stop(t + secPerBeat * 0.9);

    // Add 5th on beats 2 and 4
    if (beat % 2 === 1 && intervals.length >= 5) {
      const fifthMidi = baseNote + intervals[4] + bassOctave * 12;
      const fifthOsc = ctx.createOscillator(); const fifthG = ctx.createGain();
      fifthOsc.type = "triangle"; fifthOsc.frequency.value = noteFreq(fifthMidi);
      fifthOsc.connect(fifthG); fifthG.connect(bassGain);
      fifthG.gain.setValueAtTime(0.35, t + secPerBeat * 0.5);
      fifthG.gain.exponentialRampToValueAtTime(0.0001, t + secPerBeat * 0.9);
      fifthOsc.start(t + secPerBeat * 0.5); fifthOsc.stop(t + secPerBeat * 0.95);
    }
  }

  // ─── PAD / CHORDS (for slow moods) ───
  if (mood === 'Chill' || mood === 'Dreamy' || mood === 'Dark') {
    const padFilter = ctx.createBiquadFilter(); padFilter.type = "lowpass"; padFilter.frequency.value = 2000;
    padFilter.connect(rev);
    const padGain = ctx.createGain(); padGain.gain.value = 0.18; padGain.connect(padFilter);

    const chordLen = bars * 4 * secPerBeat / 4;
    for (let chord = 0; chord < 4; chord++) {
      const t = chord * chordLen;
      const rootIdx = [0, 2, 3, 4][chord % 4];
      [0, 2, 4].forEach((step, j) => {
        const noteIdx = (rootIdx + step) % intervals.length;
        const midi = baseNote + intervals[noteIdx] + (j === 2 ? 12 : 0);
        const osc = ctx.createOscillator(); const og = ctx.createGain();
        osc.type = "sine"; osc.frequency.value = noteFreq(midi);
        osc.connect(og); og.connect(padGain);
        og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(0.5, t + 0.3);
        og.gain.setValueAtTime(0.5, t + chordLen - 0.3); og.gain.linearRampToValueAtTime(0, t + chordLen);
        osc.start(t); osc.stop(t + chordLen + 0.05);
      });
    }
  }

  return totalSec;
}

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

const LoopGenerator = () => {
  const [mood, setMood] = useState<Mood>('Chill');
  const [key, setKey] = useState<typeof KEYS[number]>('A');
  const [scale, setScale] = useState('Minor');
  const [bpm, setBpm] = useState(90);
  const [bars, setBars] = useState(4);
  const [playing, setPlaying] = useState(false);
  const [generating, setGenerating] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);

  const stop = useCallback(() => {
    ctxRef.current?.close(); ctxRef.current = null; setPlaying(false);
  }, []);

  const preview = useCallback(() => {
    if (playing) { stop(); return; }
    const ctx = new AudioContext(); ctxRef.current = ctx;
    generateLoop(ctx, { bpm, key, scale, mood, bars });
    setPlaying(true);
    setTimeout(() => { if (ctxRef.current === ctx) stop(); }, (bars * 4 * (60 / bpm) + 0.5) * 1000);
  }, [playing, stop, bpm, key, scale, mood, bars]);

  const download = useCallback(async () => {
    setGenerating(true);
    const totalSec = bars * 4 * (60 / bpm) + 0.6;
    const ctx = new OfflineAudioContext(2, Math.ceil(44100 * totalSec), 44100);
    generateLoop(ctx, { bpm, key, scale, mood, bars });
    const buf = await ctx.startRendering();
    const blob = audioBufferToWav(buf);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `sonarc-${mood.toLowerCase()}-${key}-${bpm}bpm.wav`; a.click();
    URL.revokeObjectURL(url); setGenerating(false);
  }, [bpm, key, scale, mood, bars]);

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Mood */}
      <div>
        <label className="text-[10px] font-bold uppercase tracking-widest mb-3 block" style={{color:"rgba(255,255,255,0.3)"}}>Mood</label>
        <div className="flex gap-2 flex-wrap">
          {MOODS.map(m => (
            <motion.button key={m} whileHover={{scale:1.04}} whileTap={{scale:.96}}
              onClick={() => setMood(m)}
              className="px-4 py-2 rounded-xl text-sm font-bold transition-all"
              style={mood===m
                ? {background:"rgba(6,182,212,0.15)",color:"#22D3EE",border:"1px solid rgba(6,182,212,0.35)"}
                : {background:"rgba(255,255,255,0.04)",color:"rgba(255,255,255,0.4)",border:"1px solid rgba(255,255,255,0.08)"}}
            >{m}</motion.button>
          ))}
        </div>
      </div>

      {/* Key + Scale + Bars */}
      <div className="p-4 rounded-xl grid grid-cols-2 gap-5" style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)"}}>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest mb-2 block" style={{color:"rgba(255,255,255,0.3)"}}>Key</label>
          <div className="flex gap-1 flex-wrap">
            {KEYS.map(k => (
              <button key={k} onClick={() => setKey(k)}
                className="w-9 h-8 rounded-lg text-xs font-bold transition-all"
                style={key===k
                  ? {background:"rgba(6,182,212,0.15)",color:"#22D3EE",border:"1px solid rgba(6,182,212,0.35)"}
                  : {background:"rgba(255,255,255,0.04)",color:"rgba(255,255,255,0.35)",border:"1px solid rgba(255,255,255,0.07)"}}
              >{k}</button>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest mb-2 block" style={{color:"rgba(255,255,255,0.3)"}}>Scale</label>
            <select value={scale} onChange={e=>setScale(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
              style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)"}}
            >
              {Object.keys(SCALES).map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest mb-2 block" style={{color:"rgba(255,255,255,0.3)"}}>Bars</label>
            <div className="flex gap-1.5">
              {[2,4,8].map(b=>(
                <button key={b} onClick={()=>setBars(b)}
                  className="flex-1 h-9 rounded-lg text-xs font-bold transition-all"
                  style={bars===b
                    ? {background:"rgba(6,182,212,0.15)",color:"#22D3EE",border:"1px solid rgba(6,182,212,0.35)"}
                    : {background:"rgba(255,255,255,0.04)",color:"rgba(255,255,255,0.4)",border:"1px solid rgba(255,255,255,0.08)"}}
                >{b}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* BPM */}
      <div className="p-4 rounded-xl" style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)"}}>
        <div className="flex justify-between mb-2">
          <label className="text-[10px] font-bold uppercase tracking-widest" style={{color:"rgba(255,255,255,0.3)"}}>BPM</label>
          <span className="font-mono text-sm font-bold text-white">{bpm}</span>
        </div>
        <input type="range" min={60} max={160} value={bpm} onChange={e=>setBpm(+e.target.value)} className="w-full"/>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <motion.button whileHover={{scale:1.03}} whileTap={{scale:.97}}
          onClick={preview}
          className="flex-1 h-12 rounded-xl flex items-center justify-center gap-2 font-bold text-white"
          style={{background: playing ? "rgba(239,68,68,0.2)" : "rgba(6,182,212,0.15)", border: playing ? "1px solid rgba(239,68,68,0.4)" : "1px solid rgba(6,182,212,0.35)", color: playing ? "#F87171" : "#22D3EE"}}
        >
          {playing ? <><Square className="w-4 h-4"/>Stop</> : <><Play className="w-4 h-4"/>Preview Loop</>}
        </motion.button>
        <motion.button whileHover={{scale:1.03}} whileTap={{scale:.97}}
          onClick={download} disabled={generating}
          className="h-12 px-6 rounded-xl flex items-center gap-2 font-semibold text-sm"
          style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.6)"}}
        >
          <AnimatePresence mode="wait">
            {generating
              ? <motion.div key="spin" initial={{opacity:0}} animate={{opacity:1}}><RefreshCw className="w-4 h-4 animate-spin"/></motion.div>
              : <motion.div key="dl" initial={{opacity:0}} animate={{opacity:1}} className="flex items-center gap-2"><Download className="w-4 h-4"/>Download WAV</motion.div>
            }
          </AnimatePresence>
        </motion.button>
      </div>
      <p className="text-[11px] text-center" style={{color:"rgba(255,255,255,0.2)"}}>
        {bars} bar loop · {key} {scale} · {bpm} BPM · Royalty free
      </p>
    </div>
  );
};

export default LoopGenerator;
