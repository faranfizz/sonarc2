import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Square, Download, RefreshCw } from "lucide-react";

type NoiseType = 'white'|'pink'|'brown'|'binaural_alpha'|'binaural_theta'|'binaural_delta'|'432hz'|'528hz';

const NOISES: {id:NoiseType;name:string;desc:string;color:string;freq?:string}[] = [
  { id:'white',    name:'White Noise',    desc:'All frequencies equally. Great for focus and masking distractions.', color:'#94A3B8' },
  { id:'pink',     name:'Pink Noise',     desc:'Balanced, natural sound. Best for deep sleep.', color:'#F472B6' },
  { id:'brown',    name:'Brown Noise',    desc:'Deep rumble. Popular for ADHD focus and relaxation.', color:'#D97706' },
  { id:'binaural_alpha', name:'Alpha Waves', desc:'8-14 Hz. Relaxed focus and creative flow state.', color:'#818CF8', freq:'10 Hz' },
  { id:'binaural_theta', name:'Theta Waves', desc:'4-8 Hz. Deep meditation and REM sleep.', color:'#A78BFA', freq:'6 Hz' },
  { id:'binaural_delta', name:'Delta Waves', desc:'0.5-4 Hz. Deep dreamless sleep recovery.', color:'#6366F1', freq:'2 Hz' },
  { id:'432hz',    name:'432 Hz Tone',    desc:'Natural resonance frequency. Calming and grounding.', color:'#34D399', freq:'432 Hz' },
  { id:'528hz',    name:'528 Hz Tone',    desc:'Solfeggio frequency. Known as the "miracle tone".', color:'#22D3EE', freq:'528 Hz' },
];

function createNoiseNode(ctx: AudioContext, type: NoiseType): { node: AudioNode; oscs?: OscillatorNode[] } {
  if (type === '432hz' || type === '528hz') {
    const freq = type === '432hz' ? 432 : 528;
    const oscs: OscillatorNode[] = [];
    const gain = ctx.createGain(); gain.gain.value = 0.35;
    [1, 2, 3].forEach((h) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = freq * h;
      g.gain.value = 1 / (h * 1.8);
      o.connect(g); g.connect(gain); o.start();
      oscs.push(o);
    });
    return { node: gain, oscs };
  }

  if (type === 'binaural_alpha' || type === 'binaural_theta' || type === 'binaural_delta') {
    const beatFreq = type === 'binaural_alpha' ? 10 : type === 'binaural_theta' ? 6 : 2;
    const baseFreq = 200;
    const merger = ctx.createChannelMerger(2);
    const oscs: OscillatorNode[] = [];
    const masterGain = ctx.createGain(); masterGain.gain.value = 0.35;
    merger.connect(masterGain);

    const oL = ctx.createOscillator(); const gL = ctx.createGain();
    oL.frequency.value = baseFreq; oL.type = 'sine'; gL.gain.value = 1;
    oL.connect(gL); gL.connect(merger, 0, 0); oL.start(); oscs.push(oL);

    const oR = ctx.createOscillator(); const gR = ctx.createGain();
    oR.frequency.value = baseFreq + beatFreq; oR.type = 'sine'; gR.gain.value = 1;
    oR.connect(gR); gR.connect(merger, 0, 1); oR.start(); oscs.push(oR);

    // Add subtle pink noise underneath
    const bufSize = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0;
    for (let i = 0; i < bufSize; i++) {
      const w = Math.random()*2-1;
      b0=0.99886*b0+w*0.0555179; b1=0.99332*b1+w*0.0750759;
      b2=0.96900*b2+w*0.1538520; b3=0.86650*b3+w*0.3104856;
      b4=0.55000*b4+w*0.5329522; b5=-0.7616*b5-w*0.0168980;
      d[i] = (b0+b1+b2+b3+b4+b5+w*0.5362) * 0.02;
    }
    const ns = ctx.createBufferSource(); ns.buffer = buf; ns.loop = true;
    const ng = ctx.createGain(); ng.gain.value = 0.12;
    ns.connect(ng); ng.connect(masterGain); ns.start();

    return { node: masterGain, oscs };
  }

  // White / Pink / Brown
  const bufSize = ctx.sampleRate * 4;
  const buf = ctx.createBuffer(2, bufSize, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    if (type === 'white') {
      for (let i = 0; i < bufSize; i++) d[i] = Math.random()*2-1;
    } else if (type === 'pink') {
      let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0;
      for (let i = 0; i < bufSize; i++) {
        const w = Math.random()*2-1;
        b0=0.99886*b0+w*0.0555179; b1=0.99332*b1+w*0.0750759;
        b2=0.96900*b2+w*0.1538520; b3=0.86650*b3+w*0.3104856;
        b4=0.55000*b4+w*0.5329522; b5=-0.7616*b5-w*0.0168980;
        d[i] = (b0+b1+b2+b3+b4+b5+w*0.5362)*0.11;
      }
    } else {
      let last = 0;
      for (let i = 0; i < bufSize; i++) {
        const w = Math.random()*2-1;
        last = (last+0.02*w)/1.02;
        d[i] = Math.max(-1, Math.min(1, last*3.5));
      }
    }
  }
  const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; src.start();
  return { node: src };
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numCh=1, len=buffer.length*numCh*2;
  const ab=new ArrayBuffer(44+len); const view=new DataView(ab); const sr=buffer.sampleRate;
  const ws=(o:number,s:string)=>{for(let i=0;i<s.length;i++)view.setUint8(o+i,s.charCodeAt(i));};
  ws(0,'RIFF');view.setUint32(4,36+len,true);ws(8,'WAVE');ws(12,'fmt ');
  view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);
  view.setUint32(24,sr,true);view.setUint32(28,sr*2,true);view.setUint16(32,2,true);
  view.setUint16(34,16,true);ws(36,'data');view.setUint32(40,len,true);
  let offset=44;
  for (let i=0;i<buffer.length;i++) {
    const s=Math.max(-1,Math.min(1,buffer.getChannelData(0)[i]));
    view.setInt16(offset,s<0?s*0x8000:s*0x7FFF,true); offset+=2;
  }
  return new Blob([ab],{type:'audio/wav'});
}

export default function NoiseGenerator() {
  const [active, setActive] = useState<NoiseType|null>(null);
  const [volume, setVolume] = useState(0.6);
  const [downloadDuration, setDownloadDuration] = useState(30);
  const [downloading, setDownloading] = useState(false);

  const ctxRef = useRef<AudioContext|null>(null);
  const gainRef = useRef<GainNode|null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode|null>(null);
  const rafRef = useRef<number>(0);
  const activeRef = useRef<NoiseType|null>(null);
  activeRef.current = active;

  // Draw visualizer — uses ref not state
  const draw = useCallback(() => {
    const c = canvasRef.current; const analyser = analyserRef.current;
    if (!c || !analyser) return;
    const ctx = c.getContext('2d')!;
    const W = c.width, H = c.height;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    ctx.clearRect(0,0,W,H);
    const current = activeRef.current;
    const noise = NOISES.find(n=>n.id===current);
    const barW = W / data.length * 2.5;
    for (let i = 0; i < data.length; i++) {
      const h = (data[i]/255)*H*0.85;
      ctx.fillStyle = noise?.color || '#818CF8';
      ctx.globalAlpha = 0.75;
      ctx.fillRect(i*barW, H-h, barW-1, h);
    }
    ctx.globalAlpha = 1;
    rafRef.current = requestAnimationFrame(draw);
  }, []);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    ctxRef.current?.close(); ctxRef.current = null;
    analyserRef.current = null;
    setActive(null);
  }, []);

  const play = useCallback((type: NoiseType) => {
    if (activeRef.current === type) { stop(); return; }
    // Stop current
    cancelAnimationFrame(rafRef.current);
    ctxRef.current?.close(); ctxRef.current = null;

    const ctx = new AudioContext();
    ctxRef.current = ctx;
    const gain = ctx.createGain(); gain.gain.value = volume; gainRef.current = gain;
    const analyser = ctx.createAnalyser(); analyser.fftSize = 256; analyserRef.current = analyser;

    const { node } = createNoiseNode(ctx, type);
    node.connect(gain); gain.connect(analyser); analyser.connect(ctx.destination);

    setActive(type);
    // Start draw loop after a tick so activeRef is updated
    setTimeout(() => draw(), 50);
  }, [volume, stop, draw]);

  useEffect(() => {
    if (gainRef.current) gainRef.current.gain.value = volume;
  }, [volume]);

  useEffect(() => () => { cancelAnimationFrame(rafRef.current); ctxRef.current?.close(); }, []);

  const downloadNoise = async () => {
    if (!active) return;
    setDownloading(true);
    const sr = 44100, len = sr * downloadDuration;
    const offCtx = new OfflineAudioContext(1, len, sr);
    const gain = offCtx.createGain(); gain.gain.value = volume; gain.connect(offCtx.destination);
    const buf = offCtx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    if (active === 'white') {
      for (let i=0;i<len;i++) d[i]=Math.random()*2-1;
    } else if (active === 'pink') {
      let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0;
      for (let i=0;i<len;i++){const w=Math.random()*2-1;b0=0.99886*b0+w*0.0555179;b1=0.99332*b1+w*0.0750759;b2=0.96900*b2+w*0.1538520;b3=0.86650*b3+w*0.3104856;b4=0.55000*b4+w*0.5329522;b5=-0.7616*b5-w*0.0168980;d[i]=(b0+b1+b2+b3+b4+b5+w*0.5362)*0.11;}
    } else if (active === 'brown') {
      let last=0;
      for(let i=0;i<len;i++){const w=Math.random()*2-1;last=(last+0.02*w)/1.02;d[i]=Math.max(-1,Math.min(1,last*3.5));}
    } else {
      // For tones/binaural just render white as fallback
      for (let i=0;i<len;i++) d[i]=(Math.random()*2-1)*0.3;
    }
    const src = offCtx.createBufferSource(); src.buffer=buf; src.connect(gain); src.start();
    const rendered = await offCtx.startRendering();
    const blob = audioBufferToWav(rendered);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=`sonarc-${active}-${downloadDuration}s.wav`; a.click();
    URL.revokeObjectURL(url); setDownloading(false);
  };

  const activeNoise = NOISES.find(n=>n.id===active);

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Visualizer */}
      <div className="rounded-xl overflow-hidden relative" style={{height:"70px",background:"rgba(0,0,0,0.4)",border:"1px solid rgba(255,255,255,0.07)"}}>
        <canvas ref={canvasRef} width={700} height={70} className="w-full h-full"/>
        {!active && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-xs" style={{color:"rgba(255,255,255,0.2)"}}>Select a sound below to preview</p>
          </div>
        )}
      </div>

      {/* Sound buttons */}
      <div className="grid grid-cols-2 gap-3">
        {NOISES.map(n => (
          <motion.button key={n.id} onClick={() => play(n.id)}
            whileHover={{scale:1.02}} whileTap={{scale:.97}}
            className="p-4 rounded-xl text-left relative overflow-hidden transition-all"
            style={{
              background: active===n.id ? `${n.color}14` : "rgba(255,255,255,0.03)",
              border: `1px solid ${active===n.id ? n.color+'40' : 'rgba(255,255,255,0.08)'}`,
            }}
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-bold text-sm text-white mb-0.5">{n.name}</p>
                {n.freq && <p className="text-[10px] font-bold" style={{color:n.color}}>{n.freq}</p>}
              </div>
              <div className="w-2.5 h-2.5 rounded-full mt-0.5 shrink-0"
                style={{background:active===n.id?n.color:'rgba(255,255,255,0.15)',boxShadow:active===n.id?`0 0 8px ${n.color}`:''}}
              />
            </div>
            <p className="text-xs" style={{color:"rgba(255,255,255,0.45)",lineHeight:1.5}}>{n.desc}</p>
            {active===n.id && (
              <motion.div className="absolute bottom-0 left-0 right-0 h-[2px]"
                style={{background:`linear-gradient(90deg,transparent,${n.color},transparent)`}}
                animate={{opacity:[0.5,1,0.5]}} transition={{duration:1.8,repeat:Infinity}}
              />
            )}
          </motion.button>
        ))}
      </div>

      {/* Volume */}
      <div className="p-4 rounded-xl" style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)"}}>
        <div className="flex justify-between mb-2">
          <label className="text-[10px] font-black uppercase tracking-widest" style={{color:"rgba(255,255,255,0.35)"}}>Volume</label>
          <span className="font-mono text-xs text-white">{Math.round(volume*100)}%</span>
        </div>
        <input type="range" min={0} max={1} step={0.01} value={volume} onChange={e=>setVolume(+e.target.value)} className="w-full"/>
      </div>

      {/* Download */}
      <div className="p-5 rounded-xl" style={{background:"rgba(139,92,246,0.06)",border:"1px solid rgba(139,92,246,0.18)"}}>
        <p className="text-[10px] font-black tracking-[0.18em] uppercase mb-2" style={{color:"rgba(139,92,246,0.7)"}}>Download as WAV</p>
        <p className="text-xs mb-4" style={{color:"rgba(255,255,255,0.45)"}}>Export a noise file to use in your DAW, video, or music project.</p>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1.5">
            {[10,30,60,300].map(s=>(
              <button key={s} onClick={()=>setDownloadDuration(s)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                style={downloadDuration===s
                  ?{background:"rgba(139,92,246,0.2)",color:"#A78BFA",border:"1px solid rgba(139,92,246,0.4)"}
                  :{background:"rgba(255,255,255,0.04)",color:"rgba(255,255,255,0.4)",border:"1px solid rgba(255,255,255,0.08)"}}
              >{s<60?`${s}s`:`${s/60}min`}</button>
            ))}
          </div>
          <motion.button whileHover={{scale:1.03}} whileTap={{scale:.97}}
            onClick={downloadNoise} disabled={!active||downloading}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold"
            style={{
              background:active?"rgba(139,92,246,0.2)":"rgba(255,255,255,0.04)",
              border:`1px solid ${active?"rgba(139,92,246,0.4)":"rgba(255,255,255,0.08)"}`,
              color:active?"#A78BFA":"rgba(255,255,255,0.2)",
              opacity:!active?0.5:1,
            }}
          >
            {downloading?<><RefreshCw className="w-4 h-4 animate-spin"/>Generating...</>:<><Download className="w-4 h-4"/>Download WAV</>}
          </motion.button>
        </div>
        {!active&&<p className="text-[10px] mt-2" style={{color:"rgba(255,255,255,0.25)"}}>Select a sound above first, then download.</p>}
      </div>

      {active && (
        <motion.button initial={{opacity:0}} animate={{opacity:1}} onClick={stop}
          whileHover={{scale:1.02}} whileTap={{scale:.97}}
          className="w-full py-3 rounded-xl flex items-center justify-center gap-2 font-bold text-sm"
          style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",color:"#F87171"}}
        ><Square className="w-4 h-4"/>Stop {activeNoise?.name}</motion.button>
      )}

      <p className="text-[11px] text-center" style={{color:"rgba(255,255,255,0.2)"}}>
        Use headphones for binaural beats · Works best in a quiet environment
      </p>
    </div>
  );
}
