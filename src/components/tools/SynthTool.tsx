import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";

// NOTE: Run `npm install tone` in the project first

const WHITE_NOTES = ['C','D','E','F','G','A','B'];
const BLACK_NOTES: Record<string,{note:string,pos:number}> = {
  'C#': {note:'C#',pos:1}, 'D#': {note:'D#',pos:2},
  'F#': {note:'F#',pos:4}, 'G#': {note:'G#',pos:5}, 'A#': {note:'A#',pos:6},
};
const KEY_MAP: Record<string,string> = {
  'a':'C','w':'C#','s':'D','e':'D#','d':'E','f':'F',
  't':'F#','g':'G','y':'G#','h':'A','u':'A#','j':'B','k':'C',
};

const WAVEFORMS = ['sine','triangle','sawtooth','square'] as const;
type Waveform = typeof WAVEFORMS[number];
type ToneModule = typeof import('tone');

const SynthTool = () => {
  const [octave, setOctave] = useState(4);
  const [waveform, setWaveform] = useState<Waveform>('triangle');
  const [attack, setAttack] = useState(0.01);
  const [decay, setDecay] = useState(0.1);
  const [sustain, setSustain] = useState(0.7);
  const [release, setRelease] = useState(0.4);
  const [reverb, setReverb] = useState(0.3);
  const [filter, setFilter] = useState(8000);
  const [detune, setDetune] = useState(0);
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());
  const [toneLoaded, setToneLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const toneRef = useRef<ToneModule | null>(null);
  const synthRef = useRef<any>(null);
  const reverbRef = useRef<any>(null);
  const filterRef = useRef<any>(null);

  // Load Tone.js dynamically
  useEffect(() => {
    import('tone').then(Tone => {
      toneRef.current = Tone;
      setToneLoaded(true);
    }).catch(() => setLoadError(true));
    return () => { synthRef.current?.dispose(); reverbRef.current?.dispose(); filterRef.current?.dispose(); };
  }, []);

  // Rebuild synth when params change
  useEffect(() => {
    if(!toneRef.current || !toneLoaded) return;
    const Tone = toneRef.current;
    synthRef.current?.dispose();
    reverbRef.current?.dispose();
    filterRef.current?.dispose();

    const rev = new Tone.Reverb({ decay: 2, wet: reverb }).toDestination();
    const filt = new Tone.Filter(filter, 'lowpass').connect(rev);
    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: waveform, detune },
      envelope: { attack, decay, sustain, release },
      volume: -6,
    }).connect(filt);

    synthRef.current = synth;
    reverbRef.current = rev;
    filterRef.current = filt;
  }, [toneLoaded, waveform, attack, decay, sustain, release, reverb, filter, detune]);

  const noteOn = useCallback((note: string, octaveOffset = 0) => {
    if(!synthRef.current) return;
    const fullNote = `${note}${octave + octaveOffset}`;
    synthRef.current.triggerAttack(fullNote);
    setPressedKeys(k => new Set(k).add(fullNote));
  }, [octave]);

  const noteOff = useCallback((note: string, octaveOffset = 0) => {
    if(!synthRef.current) return;
    const fullNote = `${note}${octave + octaveOffset}`;
    synthRef.current.triggerRelease(fullNote);
    setPressedKeys(k => { const n = new Set(k); n.delete(fullNote); return n; });
  }, [octave]);

  // Keyboard input
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if(e.repeat) return;
      const note = KEY_MAP[e.key.toLowerCase()];
      if(note) noteOn(note, e.key==='k'?1:0);
      if(e.key==='z') setOctave(o=>Math.max(1,o-1));
      if(e.key==='x') setOctave(o=>Math.min(7,o+1));
    };
    const up = (e: KeyboardEvent) => {
      const note = KEY_MAP[e.key.toLowerCase()];
      if(note) noteOff(note, e.key==='k'?1:0);
    };
    window.addEventListener('keydown',down);
    window.addEventListener('keyup',up);
    return ()=>{ window.removeEventListener('keydown',down); window.removeEventListener('keyup',up); };
  }, [noteOn, noteOff]);

  const _whiteKeyWidth = 100/7; // percentage

  if(loadError) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card-cinematic p-8 text-center">
          <p className="font-display text-xl font-bold text-foreground mb-2">Install Tone.js first</p>
          <p className="text-muted-foreground text-sm mb-4">Run this in your project terminal:</p>
          <code className="mono text-sm bg-secondary px-4 py-2 rounded-lg text-primary block">npm install tone</code>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Waveform */}
      <div className="flex items-center gap-4">
        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest shrink-0">Waveform</label>
        <div className="flex gap-2">
          {WAVEFORMS.map(w=>(
            <motion.button key={w} whileHover={{scale:1.04}} whileTap={{scale:0.95}}
              onClick={()=>setWaveform(w)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all capitalize ${waveform===w?'bg-pink-500/20 text-pink-400 border border-pink-500/40':'btn-ghost text-muted-foreground'}`}
            >{w}</motion.button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={()=>setOctave(o=>Math.max(1,o-1))} className="w-8 h-8 rounded-lg btn-ghost text-lg font-bold">−</button>
          <span className="mono text-sm font-bold text-foreground w-12 text-center">Oct {octave}</span>
          <button onClick={()=>setOctave(o=>Math.min(7,o+1))} className="w-8 h-8 rounded-lg btn-ghost text-lg font-bold">+</button>
        </div>
      </div>

      {/* ADSR + FX */}
      <div className="card-cinematic p-4 grid grid-cols-3 gap-4">
        {/* ADSR */}
        <div className="col-span-2 grid grid-cols-2 gap-3">
          {[
            {label:'Attack', val:attack, set:setAttack, min:0.001, max:2, step:0.001},
            {label:'Decay',  val:decay,  set:setDecay,  min:0.01,  max:2, step:0.01},
            {label:'Sustain',val:sustain,set:setSustain, min:0,     max:1, step:0.01},
            {label:'Release',val:release,set:setRelease, min:0.01,  max:4, step:0.01},
          ].map(p=>(
            <div key={p.label}>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{p.label}</label>
                <span className="mono text-[10px] text-foreground">{p.val.toFixed(2)}</span>
              </div>
              <input type="range" min={p.min} max={p.max} step={p.step} value={p.val} onChange={e=>p.set(+e.target.value)} className="w-full" />
            </div>
          ))}
        </div>
        {/* FX */}
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Reverb</label>
              <span className="mono text-[10px] text-foreground">{Math.round(reverb*100)}%</span>
            </div>
            <input type="range" min={0} max={1} step={0.01} value={reverb} onChange={e=>setReverb(+e.target.value)} className="w-full" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Filter</label>
              <span className="mono text-[10px] text-foreground">{filter}Hz</span>
            </div>
            <input type="range" min={200} max={20000} step={100} value={filter} onChange={e=>setFilter(+e.target.value)} className="w-full" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Detune</label>
              <span className="mono text-[10px] text-foreground">{detune}¢</span>
            </div>
            <input type="range" min={-50} max={50} step={1} value={detune} onChange={e=>setDetune(+e.target.value)} className="w-full" />
          </div>
        </div>
      </div>

      {/* Keyboard */}
      <div className="card-cinematic p-4">
        {!toneLoaded && (
          <div className="h-40 flex items-center justify-center">
            <motion.div className="w-6 h-6 border-2 border-pink-400 border-t-transparent rounded-full" animate={{rotate:360}} transition={{duration:1,repeat:Infinity,ease:'linear'}} />
          </div>
        )}
        {toneLoaded && (
          <div className="relative h-44 select-none">
            {/* White keys */}
            <div className="flex h-full gap-[2px]">
              {WHITE_NOTES.map((note,i)=>{
                const fullNote = `${note}${octave}`;
                const isPressed = pressedKeys.has(fullNote);
                return (
                  <motion.div
                    key={note}
                    className="flex-1 rounded-b-lg flex items-end justify-center pb-2 cursor-pointer relative"
                    style={{
                      background: isPressed ? 'rgba(236,72,153,0.3)' : 'rgba(255,255,255,0.88)',
                      border: `1px solid ${isPressed ? '#EC4899' : 'rgba(0,0,0,0.15)'}`,
                      boxShadow: isPressed ? '0 0 20px rgba(236,72,153,0.4)' : '0 4px 8px rgba(0,0,0,0.3)',
                    }}
                    onMouseDown={()=>noteOn(note)}
                    onMouseUp={()=>noteOff(note)}
                    onMouseLeave={()=>noteOff(note)}
                    onTouchStart={e=>{e.preventDefault();noteOn(note);}}
                    onTouchEnd={e=>{e.preventDefault();noteOff(note);}}
                    whileTap={{scaleY:0.97}}
                  >
                    <span className="text-[10px] font-bold" style={{color:isPressed?'#EC4899':'rgba(0,0,0,0.3)'}}>{note}{octave}</span>
                  </motion.div>
                );
              })}
            </div>

            {/* Black keys */}
            <div className="absolute top-0 left-0 right-0 h-[58%] pointer-events-none">
              <div className="relative h-full flex">
                {WHITE_NOTES.map((note,i)=>{
                  const bk = Object.values(BLACK_NOTES).find(b=>b.pos===i+1);
                  if(!bk) return <div key={note} className="flex-1" />;
                  const fullNote = `${bk.note}${octave}`;
                  const isPressed = pressedKeys.has(fullNote);
                  return (
                    <div key={note} className="flex-1 relative flex justify-end pr-0" style={{zIndex:1}}>
                      <motion.div
                        className="absolute cursor-pointer rounded-b-md flex items-end justify-center pb-1.5"
                        style={{
                          width:'60%', height:'100%',
                          right:'-30%',
                          background: isPressed ? '#EC4899' : 'hsl(240 25% 8%)',
                          border: `1px solid ${isPressed ? '#EC4899' : 'rgba(255,255,255,0.1)'}`,
                          boxShadow: isPressed ? '0 0 16px rgba(236,72,153,0.6)' : '0 4px 8px rgba(0,0,0,0.5)',
                          pointerEvents: 'all',
                          zIndex: 2,
                        }}
                        onMouseDown={e=>{e.stopPropagation();noteOn(bk.note);}}
                        onMouseUp={e=>{e.stopPropagation();noteOff(bk.note);}}
                        onMouseLeave={()=>noteOff(bk.note)}
                        onTouchStart={e=>{e.preventDefault();e.stopPropagation();noteOn(bk.note);}}
                        onTouchEnd={e=>{e.preventDefault();e.stopPropagation();noteOff(bk.note);}}
                        whileTap={{scaleY:0.96}}
                      >
                        <span className="text-[8px] font-bold" style={{color:isPressed?'white':'rgba(255,255,255,0.2)'}}>{bk.note}</span>
                      </motion.div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground text-center">
        Click keys or use keyboard: A–J for notes, W/E/T/Y/U for black keys, Z/X to change octave.
      </p>
    </div>
  );
};

export default SynthTool;
