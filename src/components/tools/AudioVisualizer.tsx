import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Upload, Play, Square, Download } from "lucide-react";

type VizStyle = 'bars'|'wave'|'circle'|'spectrum'|'particles';

const STYLES: {id:VizStyle;name:string;icon:string}[] = [
  { id:'bars', name:'Frequency Bars', icon:'📊' },
  { id:'wave', name:'Waveform', icon:'〰️' },
  { id:'circle', name:'Radial', icon:'⭕' },
  { id:'spectrum', name:'Spectrum', icon:'🌈' },
  { id:'particles', name:'Particles', icon:'✨' },
];

const COLOR_THEMES = [
  { name:'Purple Cyan', from:'#7C3AED', to:'#06B6D4' },
  { name:'Fire', from:'#EF4444', to:'#F59E0B' },
  { name:'Ocean', from:'#06B6D4', to:'#3B82F6' },
  { name:'Neon', from:'#10B981', to:'#A78BFA' },
  { name:'Mono White', from:'#FFFFFF', to:'#94A3B8' },
];

export default function AudioVisualizer() {
  const [state, setState] = useState<'idle'|'loading'|'ready'|'playing'>('idle');
  const [fileName, setFileName] = useState('');
  const [style, setStyle] = useState<VizStyle>('bars');
  const [theme, setTheme] = useState(0);
  const [error, setError] = useState('');
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [bgType, setBgType] = useState<'none'|'color'|'image'>('none');
  const bgInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const ctxRef = useRef<AudioContext|null>(null);
  const analyserRef = useRef<AnalyserNode|null>(null);
  const sourceRef = useRef<AudioBufferSourceNode|null>(null);
  const bufferRef = useRef<AudioBuffer|null>(null);
  const rafRef = useRef<number>(0);
  const particlesRef = useRef<{x:number;y:number;vx:number;vy:number;life:number}[]>([]);
  const bgRef = useRef<string|null>(null);
  bgRef.current = bgImage;
  const styleRef = useRef(style);
  const themeRef = useRef(theme);
  styleRef.current = style; themeRef.current = theme;

  const draw = useCallback(() => {
    const c = canvasRef.current; const analyser = analyserRef.current;
    if (!c || !analyser) return;
    const ctx = c.getContext('2d')!;
    const W = c.width, H = c.height;
    const t = COLOR_THEMES[themeRef.current];

    const freqData = new Uint8Array(analyser.frequencyBinCount);
    const timeData = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(freqData);
    analyser.getByteTimeDomainData(timeData);

    // Fade instead of clear for trails
    if (bgRef.current) {
      const img = new Image();
      img.src = bgRef.current;
      if (img.complete) { ctx.drawImage(img, 0, 0, W, H); }
    }
    ctx.fillStyle = bgRef.current ? 'rgba(0,0,0,0.35)' : 'rgba(15,15,15,0.25)';
    ctx.fillRect(0,0,W,H);

    if (styleRef.current === 'bars') {
      const barW = W / freqData.length * 2.8;
      for (let i = 0; i < freqData.length; i++) {
        const v = freqData[i]/255;
        const h = v * H * 0.85;
        const grad = ctx.createLinearGradient(0,H,0,H-h);
        grad.addColorStop(0, t.from); grad.addColorStop(1, t.to);
        ctx.fillStyle = grad;
        ctx.fillRect(i*barW, H-h, barW-1.5, h);
      }
    } else if (styleRef.current === 'wave') {
      ctx.clearRect(0,0,W,H);
      ctx.beginPath(); ctx.lineWidth = 3;
      const grad = ctx.createLinearGradient(0,0,W,0);
      grad.addColorStop(0,t.from); grad.addColorStop(1,t.to);
      ctx.strokeStyle = grad;
      for (let i=0;i<timeData.length;i++) {
        const x = (i/timeData.length)*W;
        const y = (timeData[i]/128)*H/2;
        i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
      }
      ctx.stroke();
      // Mirror
      ctx.globalAlpha=0.3; ctx.beginPath();
      for(let i=0;i<timeData.length;i++){ctx.lineTo((i/timeData.length)*W,H-(timeData[i]/128)*H/2);}
      ctx.stroke(); ctx.globalAlpha=1;
    } else if (styleRef.current === 'circle') {
      ctx.clearRect(0,0,W,H);
      const cx=W/2,cy=H/2,r=Math.min(W,H)*0.25;
      const slices = freqData.length;
      for (let i=0;i<slices;i++) {
        const v = freqData[i]/255;
        const angle = (i/slices)*Math.PI*2 - Math.PI/2;
        const len = r + v*r*1.2;
        const x1=cx+Math.cos(angle)*r, y1=cy+Math.sin(angle)*r;
        const x2=cx+Math.cos(angle)*len, y2=cy+Math.sin(angle)*len;
        const prog = i/slices;
        const r1=parseInt(t.from.slice(1,3),16),g1=parseInt(t.from.slice(3,5),16),b1=parseInt(t.from.slice(5,7),16);
        const r2=parseInt(t.to.slice(1,3),16),g2=parseInt(t.to.slice(3,5),16),b2=parseInt(t.to.slice(5,7),16);
        const rc=Math.round(r1+(r2-r1)*prog),gc=Math.round(g1+(g2-g1)*prog),bc=Math.round(b1+(b2-b1)*prog);
        ctx.strokeStyle=`rgba(${rc},${gc},${bc},${0.4+v*0.6})`;
        ctx.lineWidth=1.5+v*3;
        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
      }
      // Inner circle
      ctx.beginPath(); ctx.arc(cx,cy,r-2,0,Math.PI*2);
      ctx.strokeStyle=t.from+'40'; ctx.lineWidth=1; ctx.stroke();
    } else if (styleRef.current === 'spectrum') {
      ctx.clearRect(0,0,W,H);
      for (let i=0;i<freqData.length;i++) {
        const v=freqData[i]/255;
        const x=(i/freqData.length)*W;
        const hue=(i/freqData.length)*300;
        ctx.fillStyle=`hsla(${hue},80%,${40+v*40}%,${0.3+v*0.7})`;
        ctx.fillRect(x,H*(1-v),W/freqData.length,H*v);
      }
    } else if (styleRef.current === 'particles') {
      ctx.fillStyle='rgba(15,15,15,0.15)'; ctx.fillRect(0,0,W,H);
      const avg = freqData.reduce((s,v)=>s+v,0)/freqData.length/255;
      if (Math.random() < avg*3) {
        for (let i=0;i<3;i++) particlesRef.current.push({
          x:W/2+(Math.random()-0.5)*100, y:H/2+(Math.random()-0.5)*100,
          vx:(Math.random()-0.5)*avg*8, vy:(Math.random()-0.5)*avg*8-avg*4,
          life:1,
        });
      }
      particlesRef.current = particlesRef.current.filter(p=>p.life>0.01);
      particlesRef.current.forEach(p=>{
        p.x+=p.vx; p.y+=p.vy; p.vy+=0.05; p.life*=0.96;
        const prog=1-p.life;
        const r1=parseInt(t.from.slice(1,3),16),g1=parseInt(t.from.slice(3,5),16),b1=parseInt(t.from.slice(5,7),16);
        const r2=parseInt(t.to.slice(1,3),16),g2=parseInt(t.to.slice(3,5),16),b2=parseInt(t.to.slice(5,7),16);
        const rc=Math.round(r1+(r2-r1)*prog),gc=Math.round(g1+(g2-g1)*prog),bc=Math.round(b1+(b2-b1)*prog);
        ctx.beginPath(); ctx.arc(p.x,p.y,3+p.life*4,0,Math.PI*2);
        ctx.fillStyle=`rgba(${rc},${gc},${bc},${p.life*0.9})`; ctx.fill();
      });
    }
    rafRef.current = requestAnimationFrame(draw);
  }, []);

  const loadFile = async (file: File) => {
    setState('loading'); setError(''); setFileName(file.name);
    try {
      const ab = await file.arrayBuffer();
      const ctx = new AudioContext(); ctxRef.current = ctx;
      bufferRef.current = await ctx.decodeAudioData(ab);
      setState('ready');
    } catch { setError('Could not read audio file.'); setState('idle'); }
  };

  const play = useCallback(() => {
    if (!bufferRef.current || !ctxRef.current) return;
    if (state==='playing') {
      sourceRef.current?.stop(); cancelAnimationFrame(rafRef.current);
      setState('ready'); return;
    }
    const analyser = ctxRef.current.createAnalyser();
    analyser.fftSize = 256; analyserRef.current = analyser;
    const src = ctxRef.current.createBufferSource();
    src.buffer = bufferRef.current; sourceRef.current = src;
    src.connect(analyser); analyser.connect(ctxRef.current.destination);
    src.start(); setState('playing');
    src.onended = () => { setState('ready'); cancelAnimationFrame(rafRef.current); };
    draw();
  }, [state, draw]);

  const downloadFrame = useCallback(() => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `sonarc-viz-${Date.now()}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  }, []);

  useEffect(() => () => { cancelAnimationFrame(rafRef.current); sourceRef.current?.stop(); ctxRef.current?.close(); }, []);

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Canvas */}
      <div className="rounded-2xl overflow-hidden" style={{background:"#0A0A0A",border:"1px solid rgba(255,255,255,0.08)"}}>
        <canvas ref={canvasRef} width={700} height={320} className="w-full"
          style={{height:"240px",display:"block"}}
        />
      </div>

      {/* Upload + controls row */}
      <div className="flex items-center gap-3 flex-wrap">
        <motion.button
          onClick={()=>fileRef.current?.click()}
          whileHover={{scale:1.03}} whileTap={{scale:.97}}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
          style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.6)"}}
        ><Upload className="w-4 h-4"/>{fileName || "Upload audio"}</motion.button>
        <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)loadFile(f);}}/>

        {(state==='ready'||state==='playing') && <>
          <motion.button whileHover={{scale:1.04}} whileTap={{scale:.97}} onClick={play}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold"
            style={{background:state==='playing'?"rgba(239,68,68,0.12)":"rgba(139,92,246,0.12)",border:`1px solid ${state==='playing'?"rgba(239,68,68,0.3)":"rgba(139,92,246,0.3)"}`,color:state==='playing'?"#F87171":"#A78BFA"}}
          >{state==='playing'?<><Square className="w-4 h-4"/>Stop</>:<><Play className="w-4 h-4"/>Play + Visualize</>}</motion.button>
          <motion.button whileHover={{scale:1.04}} whileTap={{scale:.97}} onClick={downloadFrame}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
            style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",color:"rgba(255,255,255,0.4)"}}
          ><Download className="w-3.5 h-3.5"/>Save frame</motion.button>
        </>}
      </div>

      {error && <div className="p-3 rounded-xl text-sm" style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",color:"#FCA5A5"}}>{error}</div>}

      {/* Background */}
      <div>
        <div className="text-[10px] font-black tracking-[0.18em] uppercase mb-2.5" style={{color:"rgba(255,255,255,0.3)"}}>Background</div>
        <div className="flex gap-2 flex-wrap items-center">
          <button onClick={()=>{setBgType('none');setBgImage(null);}}
            className="px-3.5 py-2 rounded-xl text-xs font-bold transition-all"
            style={bgType==='none'?{background:"rgba(139,92,246,0.15)",color:"#A78BFA",border:"1px solid rgba(139,92,246,0.35)"}:{background:"rgba(255,255,255,0.04)",color:"rgba(255,255,255,0.4)",border:"1px solid rgba(255,255,255,0.07)"}}
          >⬛ Dark</button>
          <button onClick={()=>bgInputRef.current?.click()}
            className="px-3.5 py-2 rounded-xl text-xs font-bold transition-all"
            style={bgType==='image'?{background:"rgba(139,92,246,0.15)",color:"#A78BFA",border:"1px solid rgba(139,92,246,0.35)"}:{background:"rgba(255,255,255,0.04)",color:"rgba(255,255,255,0.4)",border:"1px solid rgba(255,255,255,0.07)"}}
          >🖼️ Upload image</button>
          <input ref={bgInputRef} type="file" accept="image/*" className="hidden"
            onChange={e=>{
              const f=e.target.files?.[0];
              if(f){const url=URL.createObjectURL(f);setBgImage(url);setBgType('image');}
            }}
          />
          {bgImage && <span className="text-xs" style={{color:"rgba(255,255,255,0.35)"}}>✓ Custom background loaded</span>}
        </div>
        <p className="text-[10px] mt-2" style={{color:"rgba(255,255,255,0.25)"}}>
          Add your album art or any image as background — then screen record the visualization for YouTube/Instagram content.
        </p>
      </div>

      {/* Style picker */}
      <div>
        <div className="text-[10px] font-black tracking-[0.18em] uppercase mb-2.5" style={{color:"rgba(255,255,255,0.3)"}}>Visualization style</div>
        <div className="flex gap-2 flex-wrap">
          {STYLES.map(s=>(
            <button key={s.id} onClick={()=>setStyle(s.id)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all"
              style={{background:style===s.id?"rgba(139,92,246,0.15)":"rgba(255,255,255,0.04)",color:style===s.id?"#A78BFA":"rgba(255,255,255,0.4)",border:`1px solid ${style===s.id?"rgba(139,92,246,0.35)":"rgba(255,255,255,0.07)"}`}}
            >{s.icon} {s.name}</button>
          ))}
        </div>
      </div>

      {/* Color theme */}
      <div>
        <div className="text-[10px] font-black tracking-[0.18em] uppercase mb-2.5" style={{color:"rgba(255,255,255,0.3)"}}>Color theme</div>
        <div className="flex gap-2">
          {COLOR_THEMES.map((t,i)=>(
            <button key={i} onClick={()=>setTheme(i)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
              style={{background:theme===i?"rgba(255,255,255,0.08)":"rgba(255,255,255,0.03)",border:`1px solid ${theme===i?"rgba(255,255,255,0.2)":"rgba(255,255,255,0.07)"}`,color:theme===i?"white":"rgba(255,255,255,0.4)"}}
            >
              <div className="w-3 h-3 rounded-full" style={{background:`linear-gradient(135deg,${t.from},${t.to})`}}/>
              {t.name}
            </button>
          ))}
        </div>
      </div>

      <p className="text-[11px] text-center" style={{color:"rgba(255,255,255,0.2)"}}>
        Upload any audio → visualize in real time → screenshot or record your screen for content
      </p>
    </div>
  );
}
