import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Music, Activity } from "lucide-react";

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

function detectKey(buffer: AudioBuffer): { key: string; scale: string; confidence: number } {
  const data = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  const chroma = new Array(12).fill(0);
  const frameSize = 4096;
  const hopSize = 2048;

  for (let i = 0; i + frameSize < data.length; i += hopSize) {
    for (let j = 0; j < frameSize; j++) {
      const freq = (j * sampleRate) / frameSize;
      if (freq < 80 || freq > 4000) continue;
      const midiNote = 12 * Math.log2(freq / 440) + 69;
      const chIdx = Math.round(midiNote) % 12;
      if (chIdx >= 0 && chIdx < 12) chroma[chIdx] += Math.abs(data[i + j]);
    }
  }

  // Krumhansl-Schmuckler key profiles
  const majorProfile = [6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88];
  const minorProfile = [6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17];

  let bestKey = 0, bestScale = 'Major', bestCorr = -Infinity;

  for (let root = 0; root < 12; root++) {
    const majorCorr = correlation(chroma, rotate(majorProfile, root));
    const minorCorr = correlation(chroma, rotate(minorProfile, root));
    if (majorCorr > bestCorr) { bestCorr = majorCorr; bestKey = root; bestScale = 'Major'; }
    if (minorCorr > bestCorr) { bestCorr = minorCorr; bestKey = root; bestScale = 'Minor'; }
  }

  return { key: NOTE_NAMES[bestKey], scale: bestScale, confidence: Math.min(99, Math.round(bestCorr * 100)) };
}

function rotate(arr: number[], n: number) {
  return [...arr.slice(n), ...arr.slice(0, n)];
}

function correlation(a: number[], b: number[]) {
  const meanA = a.reduce((s,v) => s+v, 0) / a.length;
  const meanB = b.reduce((s,v) => s+v, 0) / b.length;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) {
    num += (a[i]-meanA)*(b[i]-meanB);
    da += (a[i]-meanA)**2;
    db += (b[i]-meanB)**2;
  }
  return num / (Math.sqrt(da*db) || 1);
}

function detectBpm(buffer: AudioBuffer): { bpm: number; confidence: number } {
  const data = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;

  // Onset detection via energy difference
  const frameSize = 512;
  const energies: number[] = [];
  for (let i = 0; i + frameSize < data.length; i += frameSize) {
    let e = 0;
    for (let j = 0; j < frameSize; j++) e += data[i+j]**2;
    energies.push(e / frameSize);
  }

  // Find onset peaks
  const onsets: number[] = [];
  const threshold = energies.reduce((s,v)=>s+v,0)/energies.length * 1.5;
  for (let i = 2; i < energies.length - 2; i++) {
    if (energies[i] > threshold &&
        energies[i] > energies[i-1] &&
        energies[i] > energies[i+1] &&
        energies[i] > energies[i-2]) {
      onsets.push(i * frameSize / sampleRate);
    }
  }

  if (onsets.length < 4) return { bpm: 120, confidence: 30 };

  // Compute inter-onset intervals
  const iois: number[] = [];
  for (let i = 1; i < onsets.length; i++) iois.push(onsets[i] - onsets[i-1]);

  // Test BPM candidates 60-200
  let bestBpm = 120, bestScore = 0;
  for (let bpm = 60; bpm <= 200; bpm++) {
    const period = 60 / bpm;
    let score = 0;
    for (const ioi of iois) {
      const ratio = ioi / period;
      const nearest = Math.round(ratio);
      if (nearest > 0) score += Math.exp(-10 * (ratio - nearest)**2);
    }
    if (score > bestScore) { bestScore = score; bestBpm = bpm; }
  }

  return { bpm: bestBpm, confidence: Math.min(95, Math.round(bestScore / iois.length * 100)) };
}

const RELATED_KEYS: Record<string, string[]> = {
  'C Major': ['A Minor','F Major','G Major'],
  'A Minor': ['C Major','D Minor','E Minor'],
  'G Major': ['E Minor','C Major','D Major'],
  'D Major': ['B Minor','G Major','A Major'],
  'F Major': ['D Minor','C Major','Bb Major'],
  'E Minor': ['G Major','A Minor','B Minor'],
};

export default function BpmDetector() {
  const [state, setState] = useState<'idle'|'loading'|'done'>('idle');
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState<{bpm:number;key:string;scale:string;bpmConf:number;keyConf:number}|null>(null);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const analyze = useCallback(async (file: File) => {
    setState('loading');
    setError('');
    setFileName(file.name);
    try {
      const ab = await file.arrayBuffer();
      const ctx = new AudioContext();
      const buffer = await ctx.decodeAudioData(ab);
      ctx.close();
      const { bpm, confidence: bpmConf } = detectBpm(buffer);
      const { key, scale, confidence: keyConf } = detectKey(buffer);
      setResult({ bpm, key, scale, bpmConf, keyConf });
      setState('done');
    } catch {
      setError('Could not analyze file. Try MP3, WAV, AAC or FLAC.');
      setState('idle');
    }
  }, []);

  const relatedKeys = result ? (RELATED_KEYS[`${result.key} ${result.scale}`] || []) : [];

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Upload */}
      {state === 'idle' && (
        <motion.div initial={{opacity:0,y:16}} animate={{opacity:1,y:0}}
          onClick={() => fileRef.current?.click()}
          onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f)analyze(f);}}
          onDragOver={e=>e.preventDefault()}
          className="cursor-pointer p-12 rounded-2xl flex flex-col items-center gap-4 text-center"
          style={{background:"rgba(59,130,246,0.04)",border:"2px dashed rgba(59,130,246,0.2)"}}
          whileHover={{borderColor:"rgba(59,130,246,0.45)",background:"rgba(59,130,246,0.07)"}}
        >
          <input ref={fileRef} type="file" accept="audio/*" className="hidden"
            onChange={e=>{const f=e.target.files?.[0];if(f)analyze(f);}}
          />
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{background:"rgba(59,130,246,0.1)",border:"1px solid rgba(59,130,246,0.25)"}}
          >
            <Activity className="w-7 h-7 text-blue-400"/>
          </div>
          <div>
            <p className="font-display font-black text-white text-lg" style={{letterSpacing:"-0.03em"}}>Drop your track here</p>
            <p className="text-sm mt-1" style={{color:"rgba(255,255,255,0.35)"}}>MP3 · WAV · AAC · FLAC · OGG</p>
          </div>
          <div className="flex gap-8 mt-2">
            {[{icon:"🎵",text:"BPM Detection"},{icon:"🎹",text:"Key Detection"},{icon:"⚡",text:"Instant results"}].map((f,i)=>(
              <div key={i} className="text-center">
                <div className="text-lg mb-1">{f.icon}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wider" style={{color:"rgba(255,255,255,0.3)"}}>{f.text}</div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Loading */}
      {state === 'loading' && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <motion.div className="w-12 h-12 rounded-full border-2 border-t-transparent"
            style={{borderColor:"rgba(59,130,246,0.3)",borderTopColor:"#3B82F6"}}
            animate={{rotate:360}} transition={{duration:1,repeat:Infinity,ease:"linear"}}
          />
          <p className="text-sm" style={{color:"rgba(255,255,255,0.4)"}}>Analyzing {fileName}...</p>
          <div className="flex gap-1">
            {[0,1,2,3,4,5,6,7].map(i=>(
              <motion.div key={i} className="w-1 rounded-full bg-blue-400"
                animate={{height:[4,20,4]}}
                transition={{duration:0.8,repeat:Infinity,delay:i*0.1,ease:"easeInOut"}}
              />
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl text-sm" style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",color:"#FCA5A5"}}>{error}</div>
      )}

      {/* Results */}
      <AnimatePresence>
        {state === 'done' && result && (
          <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Music className="w-4 h-4 text-blue-400"/>
                <p className="text-sm font-medium text-white truncate max-w-[280px]">{fileName}</p>
              </div>
              <button onClick={()=>{setState('idle');setResult(null);}}
                className="text-xs px-3 py-1.5 rounded-lg"
                style={{color:"rgba(255,255,255,0.3)",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)"}}
              >Analyze another</button>
            </div>

            {/* Big results */}
            <div className="grid grid-cols-2 gap-4">
              <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} transition={{delay:0.1}}
                className="p-8 rounded-2xl text-center"
                style={{background:"rgba(59,130,246,0.08)",border:"1px solid rgba(59,130,246,0.2)"}}
              >
                <div className="text-[10px] font-black tracking-[0.2em] uppercase mb-3" style={{color:"rgba(59,130,246,0.7)"}}>BPM</div>
                <div className="font-display font-black text-white mb-2"
                  style={{fontSize:"80px",letterSpacing:"-0.06em",lineHeight:1,color:"#FFFFFF"}}
                >{result.bpm}</div>
                <div className="text-xs" style={{color:"rgba(255,255,255,0.3)"}}>
                  {result.bpm < 80 ? "Slow / Ballad" : result.bpm < 100 ? "Mid-tempo" : result.bpm < 130 ? "Upbeat" : result.bpm < 160 ? "Fast / Dance" : "Very fast"}
                </div>
                <div className="mt-3 h-1 rounded-full overflow-hidden" style={{background:"rgba(255,255,255,0.08)"}}>
                  <motion.div className="h-full rounded-full" style={{background:"#3B82F6"}}
                    initial={{width:0}} animate={{width:`${result.bpmConf}%`}} transition={{delay:0.3,duration:0.8}}
                  />
                </div>
                <div className="text-[10px] mt-1" style={{color:"rgba(255,255,255,0.2)"}}>{result.bpmConf}% confidence</div>
              </motion.div>

              <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} transition={{delay:0.15}}
                className="p-8 rounded-2xl text-center"
                style={{background:"rgba(139,92,246,0.08)",border:"1px solid rgba(139,92,246,0.2)"}}
              >
                <div className="text-[10px] font-black tracking-[0.2em] uppercase mb-3" style={{color:"rgba(139,92,246,0.7)"}}>Key</div>
                <div className="font-display font-black text-white mb-1"
                  style={{fontSize:"60px",letterSpacing:"-0.05em",lineHeight:1,color:"#FFFFFF"}}
                >{result.key}</div>
                <div className="font-bold text-xl mb-2" style={{color:"rgba(139,92,246,0.8)"}}>{result.scale}</div>
                <div className="mt-3 h-1 rounded-full overflow-hidden" style={{background:"rgba(255,255,255,0.08)"}}>
                  <motion.div className="h-full rounded-full" style={{background:"#8B5CF6"}}
                    initial={{width:0}} animate={{width:`${result.keyConf}%`}} transition={{delay:0.35,duration:0.8}}
                  />
                </div>
                <div className="text-[10px] mt-1" style={{color:"rgba(255,255,255,0.2)"}}>{result.keyConf}% confidence</div>
              </motion.div>
            </div>

            {/* Related info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-5 rounded-xl" style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)"}}>
                <div className="text-[10px] font-black tracking-[0.15em] uppercase mb-3" style={{color:"rgba(255,255,255,0.3)"}}>Good for</div>
                <div className="space-y-1.5">
                  {(result.scale === 'Minor'
                    ? ['Dark beats','Hip-hop','Trap','Emotional pop']
                    : ['Happy pop','EDM','Uplifting house','Dance']
                  ).map((g,i)=>(
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full" style={{background:"rgba(255,255,255,0.3)"}}/>
                      <span className="text-sm" style={{color:"rgba(255,255,255,0.5)"}}>{g}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-5 rounded-xl" style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)"}}>
                <div className="text-[10px] font-black tracking-[0.15em] uppercase mb-3" style={{color:"rgba(255,255,255,0.3)"}}>Relative keys</div>
                <div className="space-y-1.5">
                  {(relatedKeys.length ? relatedKeys : [`${result.key} ${result.scale === 'Major' ? 'Minor' : 'Major'}`,'Pentatonic']).map((k,i)=>(
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full bg-purple-400"/>
                      <span className="text-sm" style={{color:"rgba(255,255,255,0.5)"}}>{k}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <p className="text-[11px] text-center" style={{color:"rgba(255,255,255,0.2)"}}>
              Results are estimates based on audio analysis · Accuracy varies by track complexity
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
