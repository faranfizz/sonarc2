import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Square, Download, Play, Pause, Trash2, RefreshCw } from "lucide-react";

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

export default function VoiceRecorder() {
  const [state, setState] = useState<'idle'|'recording'|'done'|'playing'>('idle');
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState('');
  const [volume, setVolume] = useState(0);
  const [waveData, setWaveData] = useState<number[]>([]);

  const mediaRecRef = useRef<MediaRecorder|null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement|null>(null);
  const blobRef = useRef<Blob|null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const startTimeRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode|null>(null);
  const rafRef = useRef<number>(0);
  const streamRef = useRef<MediaStream|null>(null);

  const drawLive = useCallback(() => {
    const analyser = analyserRef.current; const c = canvasRef.current;
    if (!analyser || !c) return;
    const ctx = c.getContext('2d')!;
    const W = c.width, H = c.height;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(data);
    ctx.clearRect(0,0,W,H);
    ctx.strokeStyle = '#EF4444'; ctx.lineWidth = 2;
    ctx.beginPath();
    const step = W / data.length;
    for (let i = 0; i < data.length; i++) {
      const y = (data[i]/128)*H/2;
      i===0 ? ctx.moveTo(0,y) : ctx.lineTo(i*step,y);
    }
    ctx.stroke();
    // Volume meter
    let sum = 0; for (let i=0;i<data.length;i++) sum += Math.abs(data[i]-128);
    setVolume(sum/data.length/128);
    rafRef.current = requestAnimationFrame(drawLive);
  }, []);

  const startRecording = useCallback(async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      const actx = new AudioContext();
      const src = actx.createMediaStreamSource(stream);
      const analyser = actx.createAnalyser(); analyser.fftSize = 512;
      src.connect(analyser); analyserRef.current = analyser;
      drawLive();

      chunksRef.current = [];
      const mr = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg' });
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        cancelAnimationFrame(rafRef.current);
        blobRef.current = new Blob(chunksRef.current, { type: mr.mimeType });
        const url = URL.createObjectURL(blobRef.current);
        audioRef.current = new Audio(url);
        audioRef.current.onended = () => setState('done');
        setState('done');
      };
      mr.start(100);
      mediaRecRef.current = mr;
      startTimeRef.current = Date.now();
      setState('recording');
      timerRef.current = setInterval(() => setDuration(Math.floor((Date.now()-startTimeRef.current)/1000)), 100);
    } catch (e: any) {
      setError(e.message?.includes('Permission') ? 'Microphone permission denied. Please allow access.' : 'Could not access microphone.');
    }
  }, [drawLive]);

  const stopRecording = useCallback(() => {
    mediaRecRef.current?.stop();
    streamRef.current?.getTracks().forEach(t=>t.stop());
    if (timerRef.current) clearInterval(timerRef.current);
    setVolume(0);
  }, []);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (state==='playing') { audioRef.current.pause(); setState('done'); }
    else { audioRef.current.play(); setState('playing'); }
  }, [state]);

  const download = useCallback(() => {
    if (!blobRef.current) return;
    const url = URL.createObjectURL(blobRef.current);
    const a = document.createElement('a'); a.href=url;
    a.download=`sonarc-recording-${new Date().toISOString().slice(0,10)}.wav`; a.click();
    URL.revokeObjectURL(url);
  }, []);

  const reset = useCallback(() => {
    audioRef.current?.pause(); audioRef.current=null; blobRef.current=null;
    setDuration(0); setState('idle');
  }, []);

  useEffect(() => () => { if(timerRef.current)clearInterval(timerRef.current); cancelAnimationFrame(rafRef.current); }, []);

  const fmt = (s:number) => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;

  return (
    <div className="max-w-xl mx-auto space-y-5">
      {/* Live waveform */}
      <div className="rounded-xl overflow-hidden relative" style={{background:"rgba(0,0,0,0.4)",border:"1px solid rgba(255,255,255,0.07)",height:"80px"}}>
        <canvas ref={canvasRef} width={600} height={80} className="w-full h-full"/>
        {state!=='recording' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-xs" style={{color:"rgba(255,255,255,0.2)"}}>
              {state==='idle' ? 'Ready to record' : state==='done'||state==='playing' ? 'Recording complete' : ''}
            </p>
          </div>
        )}
      </div>

      {error && <div className="p-4 rounded-xl text-sm" style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",color:"#FCA5A5"}}>{error}</div>}

      {/* Timer */}
      <div className="text-center">
        <div className="font-display font-black text-white" style={{fontSize:"56px",letterSpacing:"-0.06em",lineHeight:1,
          color: state==='recording' ? '#EF4444' : 'rgba(255,255,255,0.6)'}}
        >{fmt(duration)}</div>
        {state==='recording' && (
          <motion.div className="flex items-center justify-center gap-2 mt-2">
            <motion.div className="w-2 h-2 rounded-full bg-red-500"
              animate={{opacity:[1,0,1]}} transition={{duration:1,repeat:Infinity}}
            />
            <span className="text-xs font-bold text-red-400">RECORDING</span>
          </motion.div>
        )}
      </div>

      {/* Volume meter */}
      {state==='recording' && (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest mb-1.5 text-center" style={{color:"rgba(255,255,255,0.25)"}}>Input level</div>
          <div className="h-2 rounded-full overflow-hidden" style={{background:"rgba(255,255,255,0.06)"}}>
            <motion.div className="h-full rounded-full" style={{background: volume > 0.7 ? '#EF4444' : volume > 0.4 ? '#EAB308' : '#22C55E', width:`${volume*100}%`}}/>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-3 justify-center">
        {state==='idle' && (
          <motion.button whileHover={{scale:1.05,boxShadow:"0 0 32px rgba(239,68,68,0.5)"}} whileTap={{scale:.96}}
            onClick={startRecording}
            className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{background:"rgba(239,68,68,0.15)",border:"2px solid rgba(239,68,68,0.4)"}}
          ><Mic className="w-8 h-8 text-red-400"/></motion.button>
        )}
        {state==='recording' && (
          <motion.button whileHover={{scale:1.05}} whileTap={{scale:.96}}
            onClick={stopRecording}
            className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{background:"rgba(239,68,68,0.25)",border:"2px solid #EF4444",boxShadow:"0 0 24px rgba(239,68,68,0.4)"}}
          ><Square className="w-8 h-8 text-red-400"/></motion.button>
        )}
        {(state==='done'||state==='playing') && (
          <>
            <motion.button whileHover={{scale:1.04}} whileTap={{scale:.97}}
              onClick={togglePlay}
              className="h-12 px-6 rounded-xl flex items-center gap-2 font-bold text-sm"
              style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",color:"rgba(255,255,255,0.7)"}}
            >{state==='playing'?<><Pause className="w-4 h-4"/>Pause</>:<><Play className="w-4 h-4"/>Play</>}</motion.button>
            <motion.button whileHover={{scale:1.04}} whileTap={{scale:.97}} onClick={download}
              className="h-12 px-6 rounded-xl flex items-center gap-2 font-bold text-sm"
              style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.25)",color:"#F87171"}}
            ><Download className="w-4 h-4"/>Download WAV</motion.button>
            <motion.button whileHover={{scale:1.04}} whileTap={{scale:.97}} onClick={reset}
              className="h-12 px-4 rounded-xl flex items-center gap-2 font-bold text-sm"
              style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",color:"rgba(255,255,255,0.3)"}}
            ><RefreshCw className="w-4 h-4"/>New</motion.button>
          </>
        )}
      </div>

      <div className="p-3 rounded-xl flex items-center gap-2.5" style={{background:"rgba(234,179,8,0.07)",border:"1px solid rgba(234,179,8,0.2)"}}>
        <span className="text-lg shrink-0">🎧</span>
        <p className="text-xs" style={{color:"rgba(255,255,255,0.55)"}}>
          <span className="font-bold" style={{color:"#FCD34D"}}>Use headphones or an external mic</span> for best quality. Built-in laptop mics may pick up background noise and fan sounds. Echo cancellation is enabled but headphones prevent feedback.
        </p>
      </div>
    </div>
  );
}
