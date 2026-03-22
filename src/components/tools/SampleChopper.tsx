import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Scissors, Download, Play, Square } from "lucide-react";

interface Slice { start: number; end: number; label: string; }

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numCh = buffer.numberOfChannels;
  const length = buffer.length * numCh * 2;
  const ab = new ArrayBuffer(44+length);
  const view = new DataView(ab);
  const sr = buffer.sampleRate;
  const ws = (o:number,s:string)=>{for(let i=0;i<s.length;i++)view.setUint8(o+i,s.charCodeAt(i));};
  ws(0,'RIFF');view.setUint32(4,36+length,true);ws(8,'WAVE');
  ws(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);
  view.setUint16(22,numCh,true);view.setUint32(24,sr,true);
  view.setUint32(28,sr*numCh*2,true);view.setUint16(32,numCh*2,true);
  view.setUint16(34,16,true);ws(36,'data');view.setUint32(40,length,true);
  let offset=44;
  for(let i=0;i<buffer.length;i++){
    for(let ch=0;ch<numCh;ch++){
      const s=Math.max(-1,Math.min(1,buffer.getChannelData(ch)[i]));
      view.setInt16(offset,s<0?s*0x8000:s*0x7FFF,true);offset+=2;
    }
  }
  return new Blob([ab],{type:'audio/wav'});
}

function detectTransients(buffer: AudioBuffer, sensitivity: number): number[] {
  const data = buffer.getChannelData(0);
  const sr = buffer.sampleRate;
  const winSize = Math.floor(sr * 0.01);
  const threshold = 0.1 + (1-sensitivity)*0.4;
  const points: number[] = [0];
  let lastEnergy = 0;
  for(let i=0;i<data.length-winSize;i+=winSize) {
    let energy = 0;
    for(let j=0;j<winSize;j++) energy += data[i+j]*data[i+j];
    energy /= winSize;
    if(energy > lastEnergy * (1+threshold) && energy > 0.001) {
      const t = i/sr;
      if(t - points[points.length-1] > 0.1) points.push(t);
    }
    lastEnergy = energy * 0.9 + lastEnergy * 0.1;
  }
  points.push(buffer.duration);
  return points;
}

const SampleChopper = () => {
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [slices, setSlices] = useState<Slice[]>([]);
  const [fileName, setFileName] = useState('');
  const [sensitivity, setSensitivity] = useState(0.6);
  const [playingIdx, setPlayingIdx] = useState<number|null>(null);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const getCtx = () => {
    if(!ctxRef.current) ctxRef.current = new AudioContext();
    if(ctxRef.current.state==='suspended') ctxRef.current.resume();
    return ctxRef.current;
  };

  const handleFile = useCallback(async (file: File) => {
    setLoading(true);
    setFileName(file.name);
    const arrayBuffer = await file.arrayBuffer();
    const ctx = getCtx();
    try {
      const buf = await ctx.decodeAudioData(arrayBuffer);
      setAudioBuffer(buf);
      // Generate waveform
      const data = buf.getChannelData(0);
      const points: number[] = [];
      const step = Math.floor(data.length/120);
      for(let i=0;i<120;i++) {
        let max=0;
        for(let j=0;j<step;j++) max=Math.max(max,Math.abs(data[i*step+j]||0));
        points.push(max);
      }
      setWaveformData(points);
      // Auto-chop
      chop(buf, sensitivity);
    } catch(e) {
      console.error(e);
    }
    setLoading(false);
  }, [sensitivity]);

  const chop = (buf: AudioBuffer, sens: number) => {
    const points = detectTransients(buf, sens);
    const newSlices: Slice[] = [];
    for(let i=0;i<points.length-1;i++) {
      if(points[i+1]-points[i] > 0.05) {
        newSlices.push({ start:points[i], end:points[i+1], label:`Sample ${i+1}` });
      }
    }
    setSlices(newSlices.slice(0,32));
  };

  const rechop = () => { if(audioBuffer) chop(audioBuffer, sensitivity); };

  const playSlice = (idx: number) => {
    if(!audioBuffer) return;
    if(sourceRef.current) { sourceRef.current.stop(); sourceRef.current=null; }
    if(playingIdx===idx) { setPlayingIdx(null); return; }
    const ctx = getCtx();
    const slice = slices[idx];
    const sliceLen = Math.floor((slice.end - slice.start) * audioBuffer.sampleRate);
    const sliceStart = Math.floor(slice.start * audioBuffer.sampleRate);
    const sliceBuf = ctx.createBuffer(audioBuffer.numberOfChannels, sliceLen, audioBuffer.sampleRate);
    for(let ch=0;ch<audioBuffer.numberOfChannels;ch++) {
      sliceBuf.getChannelData(ch).set(audioBuffer.getChannelData(ch).slice(sliceStart, sliceStart+sliceLen));
    }
    const src = ctx.createBufferSource();
    src.buffer = sliceBuf;
    src.connect(ctx.destination);
    src.start();
    src.onended = () => setPlayingIdx(null);
    sourceRef.current = src;
    setPlayingIdx(idx);
  };

  const downloadSlice = (idx: number) => {
    if(!audioBuffer) return;
    const slice = slices[idx];
    const sr = audioBuffer.sampleRate;
    const start = Math.floor(slice.start * sr);
    const end = Math.floor(slice.end * sr);
    const len = end - start;
    const sliceBuf = new AudioBuffer({ length:len, numberOfChannels:audioBuffer.numberOfChannels, sampleRate:sr });
    for(let ch=0;ch<audioBuffer.numberOfChannels;ch++) {
      sliceBuf.getChannelData(ch).set(audioBuffer.getChannelData(ch).slice(start, end));
    }
    const blob = audioBufferToWav(sliceBuf);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href=url; a.download=`sonarc-sample-${idx+1}.wav`; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAll = () => { slices.forEach((_,i) => setTimeout(()=>downloadSlice(i), i*100)); };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if(file && file.type.startsWith('audio/')) handleFile(file);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Upload */}
      <motion.div
        onDrop={onDrop}
        onDragOver={e=>e.preventDefault()}
        onClick={()=>document.getElementById('audio-upload')?.click()}
        className="card-cinematic p-10 flex flex-col items-center justify-center gap-3 cursor-pointer border-dashed"
        style={{ borderColor:'rgba(245,158,11,0.3)', background:'rgba(245,158,11,0.03)' }}
        whileHover={{ borderColor:'rgba(245,158,11,0.5)', background:'rgba(245,158,11,0.06)' }}
        whileTap={{ scale:0.99 }}
      >
        <input id="audio-upload" type="file" accept="audio/*" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)handleFile(f);}} />
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{background:'rgba(245,158,11,0.12)',border:'1px solid rgba(245,158,11,0.3)'}}>
          {loading ? <motion.div animate={{rotate:360}} transition={{duration:1,repeat:Infinity,ease:'linear'}}><Scissors className="w-6 h-6" style={{color:'#F59E0B'}} /></motion.div>
            : <Upload className="w-6 h-6" style={{color:'#F59E0B'}} />}
        </div>
        <div className="text-center">
          <p className="font-display text-base font-bold text-foreground">{fileName || 'Drop audio here'}</p>
          <p className="text-xs text-muted-foreground mt-1">{fileName ? `${slices.length} slices detected` : 'WAV, MP3, FLAC — up to 50MB'}</p>
        </div>
      </motion.div>

      {/* Waveform */}
      <AnimatePresence>
        {waveformData.length>0 && (
          <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} className="card-cinematic p-4">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Waveform</p>
            <div className="h-16 flex items-center gap-[2px]">
              {waveformData.map((v,i)=>(
                <div key={i} className="flex-1 rounded-full transition-all"
                  style={{ height:`${Math.max(4,v*100)}%`, background:`rgba(245,158,11,${0.3+v*0.7})` }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings */}
      {audioBuffer && (
        <div className="card-cinematic p-4 flex items-center gap-6">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Sensitivity</label>
              <span className="mono text-xs font-bold">{Math.round(sensitivity*100)}%</span>
            </div>
            <input type="range" min={0.1} max={0.99} step={0.01} value={sensitivity} onChange={e=>setSensitivity(+e.target.value)} className="w-full" />
          </div>
          <motion.button whileHover={{scale:1.04}} whileTap={{scale:0.96}}
            onClick={rechop}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold"
            style={{background:'rgba(245,158,11,0.12)',border:'1px solid rgba(245,158,11,0.3)',color:'#F59E0B'}}
          >
            <Scissors className="w-3.5 h-3.5" />Re-chop
          </motion.button>
          {slices.length>0 && (
            <motion.button whileHover={{scale:1.04}} whileTap={{scale:0.96}}
              onClick={downloadAll}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg btn-ghost text-xs font-semibold"
            >
              <Download className="w-3.5 h-3.5" />All ({slices.length})
            </motion.button>
          )}
        </div>
      )}

      {/* Slices grid */}
      <AnimatePresence>
        {slices.length > 0 && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} className="grid grid-cols-4 gap-2">
            {slices.map((slice,i)=>(
              <motion.div
                key={i}
                initial={{opacity:0,scale:0.9}}
                animate={{opacity:1,scale:1}}
                transition={{delay:i*0.03}}
                className="card-cinematic p-3 flex flex-col gap-2"
                style={playingIdx===i?{borderColor:'rgba(245,158,11,0.5)',background:'rgba(245,158,11,0.06)'}:{}}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-muted-foreground">#{i+1}</span>
                  <span className="mono text-[9px] text-muted-foreground">{(slice.end-slice.start).toFixed(2)}s</span>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={()=>playSlice(i)}
                    className="flex-1 h-7 rounded-md flex items-center justify-center transition-all"
                    style={{background:playingIdx===i?'rgba(245,158,11,0.2)':'rgba(255,255,255,0.04)',border:playingIdx===i?'1px solid rgba(245,158,11,0.4)':'1px solid rgba(255,255,255,0.06)'}}
                  >
                    {playingIdx===i ? <Square className="w-2.5 h-2.5" style={{color:'#F59E0B'}} /> : <Play className="w-2.5 h-2.5" style={{color:'rgba(255,255,255,0.5)'}} />}
                  </button>
                  <button onClick={()=>downloadSlice(i)}
                    className="h-7 w-7 rounded-md flex items-center justify-center"
                    style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.06)'}}
                  >
                    <Download className="w-2.5 h-2.5" style={{color:'rgba(255,255,255,0.4)'}} />
                  </button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {!audioBuffer && <p className="text-[11px] text-muted-foreground text-center">Upload any audio file. Sonarc detects hits and slices it into samples automatically.</p>}
    </div>
  );
};

export default SampleChopper;
