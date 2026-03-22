import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Square, Download, RefreshCw, Music } from "lucide-react";

const SCALES: Record<string,number[]> = {
  Minor:      [0,2,3,5,7,8,10],
  Major:      [0,2,4,5,7,9,11],
  Dorian:     [0,2,3,5,7,9,10],
  Phrygian:   [0,1,3,5,7,8,10],
  Pentatonic: [0,2,4,7,9],
  Lydian:     [0,2,4,6,7,9,11],
};
const KEYS = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const KEY_OFFSETS: Record<string,number> = {C:60,'C#':61,D:62,'D#':63,E:64,F:65,'F#':66,G:67,'G#':68,A:69,'A#':70,B:71};
const STYLES = ['Melody','Chord Progression','Arpeggio','Bass Line','Full Pattern'] as const;
const VIBES = ['Emotional','Dark','Upbeat','Cinematic','Minimal','Chaotic'] as const;
type Style = typeof STYLES[number];
type Vibe = typeof VIBES[number];

interface Note { note: number; start: number; duration: number; velocity: number; }

function noteFreq(midi: number) { return 440 * Math.pow(2, (midi - 69) / 12); }

function makeReverb(ctx: AudioContext, decay = 2) {
  const len = ctx.sampleRate * decay, buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random()*2-1) * Math.pow(1-i/len, 2);
  }
  const c = ctx.createConvolver(); c.buffer = buf; return c;
}

function generateNotes(style: Style, vibe: Vibe, key: string, scale: string, bars: number, bpm: number): Note[] {
  const intervals = SCALES[scale] || SCALES.Minor;
  const base = KEY_OFFSETS[key] || 60;
  const totalBeats = bars * 4;
  const notes: Note[] = [];
  const densities: Record<Vibe,number> = { Emotional:0.5, Dark:0.4, Upbeat:0.7, Cinematic:0.35, Minimal:0.25, Chaotic:0.9 };
  const density = densities[vibe];

  if (style === 'Chord Progression') {
    const progressions: Record<Vibe,number[]> = {
      Emotional: [0,5,3,4], Dark: [0,3,5,7], Upbeat: [0,4,5,3],
      Cinematic: [0,5,3,7], Minimal: [0,5], Chaotic: [0,2,4,6],
    };
    const roots = progressions[vibe];
    const chordDur = 4;
    for (let b = 0; b < totalBeats; b += chordDur) {
      const root = roots[Math.floor(b / chordDur) % roots.length];
      [0,2,4].forEach((step,j) => {
        const noteIdx = (root + step) % intervals.length;
        const midi = base + intervals[noteIdx] + (j === 2 ? 12 : 0);
        notes.push({ note: midi, start: b, duration: chordDur - 0.1, velocity: 72 + Math.floor(Math.random()*18) });
      });
    }
  } else if (style === 'Arpeggio') {
    const stepLen = vibe === 'Upbeat' ? 0.25 : vibe === 'Chaotic' ? 0.125 : 0.5;
    let step = 0;
    for (let b = 0; b < totalBeats; b += stepLen) {
      const idx = step % intervals.length;
      const octShift = Math.floor(step / intervals.length) % 3 * 12;
      const midi = base + intervals[idx] + octShift;
      notes.push({ note: midi, start: b, duration: stepLen * 0.8, velocity: 70 + Math.floor(Math.random()*30) });
      step++;
    }
  } else if (style === 'Bass Line') {
    for (let b = 0; b < totalBeats; b += 0.5) {
      if (Math.random() > density) continue;
      const idx = Math.floor(Math.random() * Math.min(3, intervals.length));
      notes.push({ note: base - 12 + intervals[idx], start: b, duration: 0.4, velocity: 85 + Math.floor(Math.random()*15) });
    }
  } else if (style === 'Full Pattern') {
    // Melody
    let lastIdx = Math.floor(intervals.length/2);
    for (let b = 0; b < totalBeats; b += 0.25) {
      if (Math.random() < density) {
        const move = Math.round((Math.random()-0.5)*2);
        lastIdx = Math.max(0,Math.min(intervals.length-1,lastIdx+move));
        notes.push({ note: base+intervals[lastIdx]+(Math.random()>0.8?12:0), start:b, duration:0.18+Math.random()*0.25, velocity:65+Math.floor(Math.random()*30) });
      }
    }
    // Bass
    for (let b = 0; b < totalBeats; b++) {
      notes.push({ note: base-12+intervals[0], start:b, duration:0.85, velocity:90 });
      if (b%2===0 && intervals.length>4) notes.push({ note:base-12+intervals[4], start:b+0.5, duration:0.4, velocity:75 });
    }
  } else {
    // Melody
    let lastIdx = Math.floor(intervals.length/2);
    for (let b = 0; b < totalBeats; b += 0.25) {
      if (Math.random() > density) continue;
      const move = Math.round((Math.random()-0.5)*3);
      lastIdx = Math.max(0,Math.min(intervals.length-1,lastIdx+move));
      const octShift = vibe==='Dark'?-12:vibe==='Upbeat'?12:0;
      const dur = vibe==='Emotional'?(0.5+Math.random()*0.6):0.18+Math.random()*0.22;
      notes.push({ note:base+intervals[lastIdx]+octShift, start:b, duration:dur, velocity:62+Math.floor(Math.random()*38) });
    }
  }
  return notes;
}

// Play notes using Web Audio with a good piano-like sound
function playNotesAudio(ctx: AudioContext, notes: Note[], bpm: number, onEnd: () => void) {
  const secPerBeat = 60 / bpm;
  const master = ctx.createGain(); master.gain.value = 0.75; master.connect(ctx.destination);
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.knee.value = 8; comp.ratio.value = 3;
  comp.attack.value = 0.002; comp.release.value = 0.1; comp.connect(master);
  const rev = makeReverb(ctx, 1.8);
  const revG = ctx.createGain(); revG.gain.value = 0.18; rev.connect(revG); revG.connect(master);

  const now = ctx.currentTime + 0.05;
  let maxEnd = 0;

  notes.forEach(n => {
    const t = now + n.start * secPerBeat;
    const dur = n.duration * secPerBeat;
    const vel = n.velocity / 127;
    const freq = noteFreq(n.note);
    if (t + dur > maxEnd) maxEnd = t + dur;

    // Piano-like: fundamental + harmonics + fast attack + sustain + release
    const osc1 = ctx.createOscillator(); const osc2 = ctx.createOscillator(); const osc3 = ctx.createOscillator();
    const envGain = ctx.createGain();
    osc1.type = "sine"; osc1.frequency.value = freq;
    osc2.type = "triangle"; osc2.frequency.value = freq * 2; // octave harmonic
    osc3.type = "sine"; osc3.frequency.value = freq * 3; // 5th harmonic

    const g1 = ctx.createGain(); g1.gain.value = 0.7;
    const g2 = ctx.createGain(); g2.gain.value = 0.2;
    const g3 = ctx.createGain(); g3.gain.value = 0.08;

    osc1.connect(g1); osc2.connect(g2); osc3.connect(g3);
    g1.connect(envGain); g2.connect(envGain); g3.connect(envGain);
    envGain.connect(comp); envGain.connect(rev);

    // Envelope: fast attack, slight decay, sustain, release
    envGain.gain.setValueAtTime(0, t);
    envGain.gain.linearRampToValueAtTime(vel, t + 0.008);
    envGain.gain.exponentialRampToValueAtTime(vel * 0.65, t + 0.05);
    envGain.gain.setValueAtTime(vel * 0.65, t + dur - 0.04);
    envGain.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.15);

    [osc1,osc2,osc3].forEach(o => { o.start(t); o.stop(t + dur + 0.2); });
  });

  setTimeout(onEnd, (maxEnd - ctx.currentTime + 0.3) * 1000);
}

// Write MIDI file
function writeMidi(notes: Note[], bpm: number): Blob {
  const tpb = 480;
  const toTicks = (beats: number) => Math.round(beats * tpb);
  const events: {tick:number,data:number[]}[] = [];
  const tempo = Math.round(60000000 / bpm);
  events.push({tick:0,data:[0xFF,0x51,0x03,(tempo>>16)&0xFF,(tempo>>8)&0xFF,tempo&0xFF]});
  events.push({tick:0,data:[0xFF,0x58,0x04,4,2,24,8]});
  notes.forEach(n => {
    events.push({tick:toTicks(n.start),data:[0x90,Math.max(0,Math.min(127,n.note)),n.velocity]});
    events.push({tick:toTicks(n.start+n.duration),data:[0x80,Math.max(0,Math.min(127,n.note)),0]});
  });
  events.sort((a,b)=>a.tick-b.tick);
  let lastTick = 0;
  const trackData: number[] = [];
  events.forEach(ev => {
    let delta = ev.tick - lastTick; lastTick = ev.tick;
    const vl: number[] = []; let d = delta;
    vl.unshift(d&0x7F); d>>=7;
    while(d>0){vl.unshift((d&0x7F)|0x80);d>>=7;}
    vl.forEach(b=>trackData.push(b)); ev.data.forEach(b=>trackData.push(b));
  });
  trackData.push(0x00,0xFF,0x2F,0x00);
  const header=[0x4D,0x54,0x68,0x64,0,0,0,6,0,0,0,1,(tpb>>8)&0xFF,tpb&0xFF];
  const tl=trackData.length;
  const th=[0x4D,0x54,0x72,0x6B,(tl>>24)&0xFF,(tl>>16)&0xFF,(tl>>8)&0xFF,tl&0xFF];
  return new Blob([new Uint8Array([...header,...th,...trackData])],{type:'audio/midi'});
}

const MidiGenerator = () => {
  const [key, setKey] = useState('C');
  const [scale, setScale] = useState('Minor');
  const [style, setStyle] = useState<Style>('Melody');
  const [vibe, setVibe] = useState<Vibe>('Emotional');
  const [bpm, setBpm] = useState(90);
  const [bars, setBars] = useState(4);
  const [notes, setNotes] = useState<Note[]>([]);
  const [generated, setGenerated] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [generating, setGenerating] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);

  const generate = useCallback(() => {
    setGenerating(true);
    setTimeout(() => {
      const n = generateNotes(style, vibe, key, scale, bars, bpm);
      setNotes(n); setGenerated(true); setGenerating(false);
    }, 100);
  }, [style, vibe, key, scale, bars, bpm]);

  const preview = useCallback(() => {
    if (playing) { ctxRef.current?.close(); ctxRef.current = null; setPlaying(false); return; }
    if (!notes.length) { generate(); return; }
    const ctx = new AudioContext(); ctxRef.current = ctx;
    setPlaying(true);
    playNotesAudio(ctx, notes, () => { setPlaying(false); ctxRef.current = null; });
  }, [playing, notes, generate]);

  const download = useCallback(() => {
    const n = notes.length ? notes : generateNotes(style, vibe, key, scale, bars, bpm);
    const blob = writeMidi(n, bpm);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `sonarc-${style.toLowerCase().replace(' ','-')}-${key}-${bpm}bpm.mid`; a.click();
    URL.revokeObjectURL(url);
  }, [notes, style, vibe, key, scale, bars, bpm]);

  const totalBeats = bars * 4;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Style */}
      <div>
        <label className="text-[10px] font-bold uppercase tracking-widest mb-3 block" style={{color:"rgba(255,255,255,0.3)"}}>Pattern Style</label>
        <div className="flex gap-2 flex-wrap">
          {STYLES.map(s => (
            <button key={s} onClick={() => { setStyle(s); setGenerated(false); }}
              className="px-4 py-2 rounded-xl text-sm font-bold transition-all"
              style={style===s
                ? {background:"rgba(139,92,246,0.15)",color:"#A78BFA",border:"1px solid rgba(139,92,246,0.35)"}
                : {background:"rgba(255,255,255,0.04)",color:"rgba(255,255,255,0.4)",border:"1px solid rgba(255,255,255,0.08)"}}
            >{s}</button>
          ))}
        </div>
      </div>

      {/* Vibe */}
      <div>
        <label className="text-[10px] font-bold uppercase tracking-widest mb-3 block" style={{color:"rgba(255,255,255,0.3)"}}>Vibe</label>
        <div className="flex gap-2 flex-wrap">
          {VIBES.map(v => (
            <button key={v} onClick={() => { setVibe(v); setGenerated(false); }}
              className="px-4 py-2 rounded-xl text-sm font-bold transition-all"
              style={vibe===v
                ? {background:"rgba(139,92,246,0.15)",color:"#A78BFA",border:"1px solid rgba(139,92,246,0.35)"}
                : {background:"rgba(255,255,255,0.04)",color:"rgba(255,255,255,0.4)",border:"1px solid rgba(255,255,255,0.08)"}}
            >{v}</button>
          ))}
        </div>
      </div>

      {/* Key + Scale + BPM + Bars */}
      <div className="p-4 rounded-xl grid grid-cols-2 gap-5" style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)"}}>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest mb-2 block" style={{color:"rgba(255,255,255,0.3)"}}>Key</label>
          <div className="flex gap-1 flex-wrap">
            {KEYS.map(k => (
              <button key={k} onClick={() => { setKey(k); setGenerated(false); }}
                className="w-9 h-8 rounded-lg text-xs font-bold transition-all"
                style={key===k
                  ? {background:"rgba(139,92,246,0.15)",color:"#A78BFA",border:"1px solid rgba(139,92,246,0.35)"}
                  : {background:"rgba(255,255,255,0.04)",color:"rgba(255,255,255,0.35)",border:"1px solid rgba(255,255,255,0.07)"}}
              >{k}</button>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest mb-1.5 block" style={{color:"rgba(255,255,255,0.3)"}}>Scale</label>
            <select value={scale} onChange={e=>{setScale(e.target.value);setGenerated(false);}}
              className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
              style={{ background: "rgb(20,20,35)", border: "1px solid rgba(255,255,255,0.1)", color: "white" }}
            >{Object.keys(SCALES).map(s=><option key={s} value={s}>{s}</option>)}</select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest mb-1.5 block" style={{color:"rgba(255,255,255,0.3)"}}>Bars</label>
            <div className="flex gap-1.5">
              {[2,4,8,16].map(b=>(
                <button key={b} onClick={()=>{setBars(b);setGenerated(false);}}
                  className="flex-1 h-8 rounded-lg text-xs font-bold transition-all"
                  style={bars===b
                    ? {background:"rgba(139,92,246,0.15)",color:"#A78BFA",border:"1px solid rgba(139,92,246,0.35)"}
                    : {background:"rgba(255,255,255,0.04)",color:"rgba(255,255,255,0.4)",border:"1px solid rgba(255,255,255,0.08)"}}
                >{b}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="flex justify-between mb-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest" style={{color:"rgba(255,255,255,0.3)"}}>BPM</label>
              <span className="font-mono text-xs font-bold text-white">{bpm}</span>
            </div>
            <input type="range" min={60} max={200} value={bpm} onChange={e=>{setBpm(+e.target.value);setGenerated(false);}} className="w-full"/>
          </div>
        </div>
      </div>

      {/* Piano roll preview */}
      <AnimatePresence>
        {generated && notes.length > 0 && (
          <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}
            className="p-4 rounded-xl" style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)"}}
          >
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-bold uppercase tracking-widest" style={{color:"rgba(255,255,255,0.3)"}}>Piano Roll Preview</label>
              <span className="text-[10px]" style={{color:"rgba(255,255,255,0.3)"}}>{notes.length} notes · {bars} bars</span>
            </div>
            <div className="h-20 relative rounded-lg overflow-hidden" style={{background:"rgba(0,0,0,0.3)"}}>
              {notes.slice(0,120).map((n,i)=>{
                const x=(n.start/totalBeats)*100;
                const w=Math.max(0.4,(n.duration/totalBeats)*100);
                const y=100-((n.note-48)/36)*100;
                return <div key={i} className="absolute rounded-sm"
                  style={{left:`${x}%`,width:`${w}%`,top:`${Math.max(0,Math.min(88,y))}%`,height:"10%",background:`rgba(139,92,246,${n.velocity/127*0.8+0.2})`}}
                />;
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* What MIDI Generator actually does */}
      {!generated && (
        <div className="p-4 rounded-xl text-sm" style={{background:"rgba(139,92,246,0.05)",border:"1px solid rgba(139,92,246,0.15)",color:"rgba(255,255,255,0.4)"}}>
          <div className="flex items-center gap-2 mb-2"><Music className="w-4 h-4 text-purple-400"/><span className="font-semibold text-purple-300">What does this do?</span></div>
          Generates musical patterns (melodies, chords, bass lines) you can drop directly into FL Studio, Ableton, Logic or GarageBand as a .mid file. Hit generate, preview how it sounds, then download.
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-3">
        <motion.button whileHover={{scale:1.02}} whileTap={{scale:.97}}
          onClick={generate} disabled={generating}
          className="flex-1 h-12 rounded-xl flex items-center justify-center gap-2 font-bold text-sm"
          style={{background:"rgba(139,92,246,0.15)",border:"1px solid rgba(139,92,246,0.3)",color:"#A78BFA"}}
        >
          <AnimatePresence mode="wait">
            {generating
              ? <motion.div key="g" initial={{opacity:0}} animate={{opacity:1}}><RefreshCw className="w-4 h-4 animate-spin"/></motion.div>
              : <motion.div key="ng" initial={{opacity:0}} animate={{opacity:1}} className="flex items-center gap-2"><RefreshCw className="w-4 h-4"/>Generate Pattern</motion.div>
            }
          </AnimatePresence>
        </motion.button>

        <motion.button whileHover={{scale:1.02}} whileTap={{scale:.97}}
          onClick={preview} disabled={!generated}
          className="h-12 px-5 rounded-xl flex items-center gap-2 font-bold text-sm transition-all"
          style={{
            background: playing ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.05)",
            border: playing ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(255,255,255,0.1)",
            color: playing ? "#F87171" : generated ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.2)",
            opacity: !generated ? 0.4 : 1,
          }}
        >
          {playing ? <><Square className="w-4 h-4"/>Stop</> : <><Play className="w-4 h-4"/>Hear it</>}
        </motion.button>

        <motion.button whileHover={{scale:1.02}} whileTap={{scale:.97}}
          onClick={download} disabled={!generated}
          className="h-12 px-5 rounded-xl flex items-center gap-2 font-semibold text-sm"
          style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",color:generated?"rgba(255,255,255,0.6)":"rgba(255,255,255,0.2)",opacity:!generated?0.4:1}}
        ><Download className="w-4 h-4"/>MIDI</motion.button>
      </div>
      <p className="text-[11px] text-center" style={{color:"rgba(255,255,255,0.2)"}}>
        Import .mid into any DAW — FL Studio, Ableton, Logic, GarageBand
      </p>
    </div>
  );
};

export default MidiGenerator;
