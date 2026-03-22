import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Download, Play, Square, RefreshCw, Zap } from "lucide-react";

type Preset = 'balanced'|'loud'|'warm'|'bright'|'podcast'|'club';
type State = 'idle'|'loading'|'ready'|'processing'|'done'|'playing';

const PRESETS: {id:Preset;name:string;desc:string;icon:string;settings:{eq_low:number;eq_mid:number;eq_high:number;compression:number;limiting:number;stereo:number}}[] = [
  { id:'balanced', name:'Balanced', desc:'Natural, transparent mastering for any genre', icon:'⚖️',
    settings:{eq_low:1,eq_mid:0,eq_high:0.5,compression:0.5,limiting:0.7,stereo:1} },
  { id:'loud', name:'Loud & Punchy', desc:'Maximum loudness. Radio-ready commercial sound', icon:'🔊',
    settings:{eq_low:2,eq_mid:0.5,eq_high:1,compression:0.85,limiting:0.95,stereo:1.2} },
  { id:'warm', name:'Warm', desc:'Analog warmth. Great for hip-hop, soul, R&B', icon:'🎸',
    settings:{eq_low:2.5,eq_mid:0,eq_high:-1,compression:0.6,limiting:0.75,stereo:0.9} },
  { id:'bright', name:'Bright & Airy', desc:'Open high end. Perfect for pop and electronic', icon:'✨',
    settings:{eq_low:-0.5,eq_mid:0,eq_high:2.5,compression:0.55,limiting:0.8,stereo:1.3} },
  { id:'podcast', name:'Podcast / Voice', desc:'Clear vocals, reduced noise, broadcast ready', icon:'🎙️',
    settings:{eq_low:-2,eq_mid:1.5,eq_high:1,compression:0.75,limiting:0.85,stereo:0.5} },
  { id:'club', name:'Club / EDM', desc:'Deep bass, wide stereo, club-ready loudness', icon:'🎛️',
    settings:{eq_low:3,eq_mid:-0.5,eq_high:1.5,compression:0.8,limiting:0.92,stereo:1.5} },
];

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numCh=buffer.numberOfChannels,len=buffer.length*numCh*2;
  const ab=new ArrayBuffer(44+len);const view=new DataView(ab);const sr=buffer.sampleRate;
  const ws=(o:number,s:string)=>{for(let i=0;i<s.length;i++)view.setUint8(o+i,s.charCodeAt(i));};
  ws(0,'RIFF');view.setUint32(4,36+len,true);ws(8,'WAVE');ws(12,'fmt ');
  view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,numCh,true);
  view.setUint32(24,sr,true);view.setUint32(28,sr*numCh*2,true);view.setUint16(32,numCh*2,true);
  view.setUint16(34,16,true);ws(36,'data');view.setUint32(40,len,true);
  let offset=44;
  for(let i=0;i<buffer.length;i++)for(let ch=0;ch<numCh;ch++){
    const s=Math.max(-1,Math.min(1,buffer.getChannelData(ch)[i]));
    view.setInt16(offset,s<0?s*0x8000:s*0x7FFF,true);offset+=2;
  }
  return new Blob([ab],{type:'audio/wav'});
}

async function masterAudio(buffer: AudioBuffer, preset: Preset): Promise<AudioBuffer> {
  const s = PRESETS.find(p=>p.id===preset)!.settings;
  const sr = buffer.sampleRate;
  const ctx = new OfflineAudioContext(2, buffer.length, sr);

  const src = ctx.createBufferSource(); src.buffer = buffer;

  // EQ chain
  const lowShelf = ctx.createBiquadFilter(); lowShelf.type='lowshelf'; lowShelf.frequency.value=200; lowShelf.gain.value=s.eq_low;
  const midPeak = ctx.createBiquadFilter(); midPeak.type='peaking'; midPeak.frequency.value=1000; midPeak.Q.value=1; midPeak.gain.value=s.eq_mid;
  const highShelf = ctx.createBiquadFilter(); highShelf.type='highshelf'; highShelf.frequency.value=8000; highShelf.gain.value=s.eq_high;

  // Compressor
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -24 + (1-s.compression)*10;
  comp.knee.value = 6;
  comp.ratio.value = 2 + s.compression * 8;
  comp.attack.value = 0.003;
  comp.release.value = 0.1 + (1-s.compression)*0.3;

  // Limiter (brickwall)
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -1 - (1-s.limiting)*3;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.05;

  // Output gain
  const outGain = ctx.createGain(); outGain.gain.value = 0.8 + s.limiting*0.15;

  // Stereo width (simple mid-side)
  const merger = ctx.createChannelMerger(2);
  const splitter = ctx.createChannelSplitter(2);

  src.connect(lowShelf);
  lowShelf.connect(midPeak);
  midPeak.connect(highShelf);
  highShelf.connect(comp);
  comp.connect(limiter);
  limiter.connect(outGain);
  outGain.connect(ctx.destination);

  src.start(0);
  return ctx.startRendering();
}

export default function AudioMastering() {
  const [state, setState] = useState<State>('idle');
  const [fileName, setFileName] = useState('');
  const [preset, setPreset] = useState<Preset>('balanced');
  const [error, setError] = useState('');
  const bufferRef = useRef<AudioBuffer|null>(null);
  const masteredRef = useRef<AudioBuffer|null>(null);
  const playCtxRef = useRef<AudioContext|null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadFile = async (file: File) => {
    setState('loading'); setError(''); setFileName(file.name);
    try {
      const ab = await file.arrayBuffer();
      const ctx = new AudioContext();
      bufferRef.current = await ctx.decodeAudioData(ab);
      ctx.close(); setState('ready');
    } catch { setError('Could not read file. Try MP3, WAV or FLAC.'); setState('idle'); }
  };

  const master = useCallback(async () => {
    if (!bufferRef.current) return;
    setState('processing');
    try {
      masteredRef.current = await masterAudio(bufferRef.current, preset);
      setState('done');
    } catch { setError('Mastering failed.'); setState('ready'); }
  }, [preset]);

  const preview = useCallback(() => {
    if (!masteredRef.current) return;
    if (state === 'playing') { playCtxRef.current?.close(); playCtxRef.current=null; setState('done'); return; }
    const ctx = new AudioContext(); playCtxRef.current = ctx;
    const src = ctx.createBufferSource(); src.buffer = masteredRef.current; src.connect(ctx.destination); src.start();
    setState('playing'); src.onended = ()=>{ setState('done'); playCtxRef.current=null; };
  }, [state]);

  const download = useCallback(() => {
    if (!masteredRef.current) return;
    const blob = audioBufferToWav(masteredRef.current);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url;
    a.download=`sonarc-mastered-${preset}.wav`; a.click(); URL.revokeObjectURL(url);
  }, [preset]);

  const fmt = (s:number) => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Upload */}
      {state==='idle' && (
        <motion.div initial={{opacity:0,y:16}} animate={{opacity:1,y:0}}
          onClick={()=>fileRef.current?.click()}
          onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f)loadFile(f);}}
          onDragOver={e=>e.preventDefault()}
          className="cursor-pointer p-12 rounded-2xl flex flex-col items-center gap-4 text-center"
          style={{background:"rgba(234,179,8,0.04)",border:"2px dashed rgba(234,179,8,0.2)"}}
          whileHover={{borderColor:"rgba(234,179,8,0.4)",background:"rgba(234,179,8,0.07)"}}
        >
          <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)loadFile(f);}}/>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{background:"rgba(234,179,8,0.1)",border:"1px solid rgba(234,179,8,0.25)"}}
          ><Zap className="w-7 h-7 text-yellow-400"/></div>
          <div>
            <p className="font-display font-black text-white text-lg" style={{letterSpacing:"-0.03em"}}>Drop your mix here</p>
            <p className="text-sm mt-1" style={{color:"rgba(255,255,255,0.35)"}}>MP3 · WAV · FLAC · AAC</p>
          </div>
          <p className="text-xs max-w-sm" style={{color:"rgba(255,255,255,0.3)"}}>
            Professional mastering chain — EQ, compression, limiting, stereo enhancement. Distrokid charges $20/track for this.
          </p>
        </motion.div>
      )}

      {state==='loading' && (
        <div className="flex items-center justify-center py-12 gap-3">
          <motion.div className="w-6 h-6 rounded-full border-2 border-t-transparent" style={{borderColor:"rgba(234,179,8,0.3)",borderTopColor:"#EAB308"}} animate={{rotate:360}} transition={{duration:1,repeat:Infinity,ease:"linear"}}/>
          <span className="text-sm" style={{color:"rgba(255,255,255,0.4)"}}>Loading {fileName}...</span>
        </div>
      )}

      {error && <div className="p-4 rounded-xl text-sm" style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",color:"#FCA5A5"}}>{error}</div>}

      <AnimatePresence>
        {(state==='ready'||state==='processing'||state==='done'||state==='playing') && (
          <motion.div initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} className="space-y-4">
            {/* File + reset */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Zap className="w-4 h-4 text-yellow-400"/>
                <p className="text-sm font-medium text-white truncate max-w-[260px]">{fileName}</p>
                {bufferRef.current && <span className="text-xs" style={{color:"rgba(255,255,255,0.3)"}}>{fmt(bufferRef.current.duration)}</span>}
              </div>
              <button onClick={()=>{setState('idle');bufferRef.current=null;masteredRef.current=null;}}
                className="text-xs px-3 py-1.5 rounded-lg"
                style={{color:"rgba(255,255,255,0.3)",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)"}}
              >← New file</button>
            </div>

            {/* Presets */}
            <div>
              <div className="text-[10px] font-black tracking-[0.18em] uppercase mb-3" style={{color:"rgba(255,255,255,0.3)"}}>Mastering preset</div>
              <div className="grid grid-cols-3 gap-2">
                {PRESETS.map(p=>(
                  <button key={p.id} onClick={()=>{setPreset(p.id);masteredRef.current=null;if(state==='done'||state==='playing'){playCtxRef.current?.close();setState('ready');}}}
                    className="p-3 rounded-xl text-left transition-all"
                    style={{
                      background:preset===p.id?"rgba(234,179,8,0.12)":"rgba(255,255,255,0.03)",
                      border:`1px solid ${preset===p.id?"rgba(234,179,8,0.35)":"rgba(255,255,255,0.07)"}`,
                    }}
                  >
                    <div className="text-lg mb-1">{p.icon}</div>
                    <div className="text-xs font-bold text-white mb-0.5">{p.name}</div>
                    <div className="text-[10px]" style={{color:"rgba(255,255,255,0.3)",lineHeight:1.5}}>{p.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <motion.button whileHover={{scale:1.02}} whileTap={{scale:.97}}
                onClick={master} disabled={state==='processing'}
                className="flex-1 h-12 rounded-xl flex items-center justify-center gap-2 font-bold text-sm"
                style={{background:"rgba(234,179,8,0.12)",border:"1px solid rgba(234,179,8,0.3)",color:"#FCD34D"}}
              >
                {state==='processing'
                  ? <><RefreshCw className="w-4 h-4 animate-spin"/>Mastering...</>
                  : <><Zap className="w-4 h-4"/>Master this track</>}
              </motion.button>

              {(state==='done'||state==='playing') && <>
                <motion.button whileHover={{scale:1.02}} whileTap={{scale:.97}} onClick={preview}
                  className="h-12 px-5 rounded-xl flex items-center gap-2 font-bold text-sm"
                  style={{background:state==='playing'?"rgba(239,68,68,0.12)":"rgba(255,255,255,0.05)",border:`1px solid ${state==='playing'?"rgba(239,68,68,0.3)":"rgba(255,255,255,0.1)"}`,color:state==='playing'?"#F87171":"rgba(255,255,255,0.6)"}}
                >{state==='playing'?<><Square className="w-4 h-4"/>Stop</>:<><Play className="w-4 h-4"/>Preview</>}</motion.button>
                <motion.button whileHover={{scale:1.02}} whileTap={{scale:.97}} onClick={download}
                  className="h-12 px-5 rounded-xl flex items-center gap-2 font-bold text-sm"
                  style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.6)"}}
                ><Download className="w-4 h-4"/>Download WAV</motion.button>
              </>}
            </div>

            {state==='done'&&<motion.div initial={{opacity:0,scale:.95}} animate={{opacity:1,scale:1}} className="p-4 rounded-xl text-center" style={{background:"rgba(234,179,8,0.06)",border:"1px solid rgba(234,179,8,0.2)"}}>
              <p className="font-bold text-sm" style={{color:"#FCD34D"}}>✓ Mastering complete — {PRESETS.find(p=>p.id===preset)?.name} preset applied</p>
              <p className="text-xs mt-1" style={{color:"rgba(255,255,255,0.35)"}}>EQ · Compression · Limiting · Stereo enhancement</p>
            </motion.div>}

            <p className="text-[11px] text-center" style={{color:"rgba(255,255,255,0.2)"}}>
              Mastering enhances your mix — it cannot fix a bad recording
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
