
import React, { useEffect, useState, useRef } from 'react';
import { ShieldCheck, BrainCircuit, ScanLine, Terminal, XCircle, AlertTriangle } from 'lucide-react';

interface AnalysisViewProps {
  fileName: string;
  fileUrl?: string; 
  fileType?: string;
  onCancel?: () => void; // New prop
}

const ESTIMATION_LOGS = [
  "Initializing Gemini 3 Pro Vision Model...",
  "Secure handshake established with Google Cloud...",
  "Decoded file binary stream (MIME: application/pdf)...",
  "OCR Layer: Extracting text from Title Blocks...",
  "Vector Analysis: Identifying grid lines (Axis A-F)...",
  "Structural Pass: Detecting Foundations, Cols, Beams, Slabs...",
  "Rebar Pass: Extracting Bar Bending Schedule (BBS)...",
  "Arch Pass: Measuring Walls, Flooring, Ceiling, Cladding...",
  "MEP Pass: Counting Electrical Points (Sockets, Lights)...",
  "Cross-referencing Plan areas with Section heights...",
  "Applying local standard waste factors (Concrete: 5%)...",
  "Validating logic against SMM7 / CESMM4 standards...",
  "Finalizing BOQ structure and formatting JSON..."
];

const SCHEDULING_LOGS = [
  "Initializing Senior Planner Agent (40Y Exp)...",
  "Analyzing Project Scope & Constraints...",
  "Detecting Civil Works: River Diversion & Gabions...",
  "Establishing Work Breakdown Structure (WBS)...",
  "Calculating Earthwork Volumes for Duration...",
  "Linking Logic: Setting Start-to-Start (SS) & Finish-to-Start (FS)...",
  "Resource Loading: Assigning Excavators & Gangs...",
  "Applying High-Rise Floor Replication Logic (Typical Floors)...",
  "Identifying Critical Path (Longest Path)...",
  "Optimizing Float & Lag times...",
  "Generating Gantt Chart Data Structure...",
  "Finalizing Baseline Schedule..."
];

export const AnalysisView: React.FC<AnalysisViewProps> = ({ fileName, fileUrl, fileType, onCancel }) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeLogs = SCHEDULING_LOGS; 

  const isImage = fileType?.startsWith('image/');
  const bgStyle = isImage && fileUrl 
    ? { backgroundImage: `url(${fileUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } 
    : { backgroundImage: `url('https://www.transparenttextures.com/patterns/blueprint-grid.png')` };

  useEffect(() => {
    let delay = 0;
    const totalDuration = 20000; // 20s simulation
    const intervalTime = totalDuration / 100;

    // Progress Bar
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 98) return 99;
        return prev + 1;
      });
    }, intervalTime);

    // Timeout Warning after 25s
    const timeoutTimer = setTimeout(() => {
        setShowTimeoutWarning(true);
    }, 25000);

    // Logs
    const randomLogs = [...activeLogs].sort(() => Math.random() - 0.5); 
    activeLogs.forEach((log, index) => {
      delay += Math.random() * 1200 + 500; 
      setTimeout(() => {
        setLogs(prev => [...prev, `> ${log}`]);
      }, delay);
    });

    return () => {
        clearInterval(progressInterval);
        clearTimeout(timeoutTimer);
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="relative flex flex-col items-center justify-center h-full w-full bg-slate-900 overflow-hidden">
      
      {/* BACKGROUND: THE "READING" EFFECT */}
      <div className="absolute inset-0 z-0 opacity-40 flex items-center justify-center overflow-hidden grayscale contrast-125" style={bgStyle}>
          <div className="absolute top-0 left-0 w-full h-2 bg-green-500/50 shadow-[0_0_50px_20px_rgba(34,197,94,0.5)] animate-scan-vertical z-10"></div>
          <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,0,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,0,0.1)_1px,transparent_1px)] bg-[size:100px_100px] pointer-events-none"></div>
      </div>

      {/* FOREGROUND CONTENT */}
      <div className="relative z-20 w-full max-w-4xl p-6 flex flex-col items-center">
        
        {/* CENTRAL BRAIN ANIMATION */}
        <div className="mb-10 relative">
            <div className="absolute inset-0 bg-green-500 blur-[60px] opacity-20 animate-pulse rounded-full"></div>
            <div className="bg-slate-950/80 backdrop-blur-md border border-green-500/30 p-6 rounded-2xl shadow-2xl flex items-center justify-center relative overflow-hidden group">
                <BrainCircuit className="w-16 h-16 text-green-400 animate-pulse relative z-10" />
                <ScanLine className="absolute inset-0 w-full h-full text-green-500/20 animate-scan-vertical" />
            </div>
            <div className="absolute top-0 left-1/2 w-full h-full animate-spin-slow">
                <div className="absolute top-0 left-0 w-3 h-3 bg-green-400 rounded-full shadow-[0_0_10px_rgba(74,222,128,1)]"></div>
            </div>
        </div>

        <h2 className="text-3xl font-black text-white tracking-tight mb-2 text-center drop-shadow-lg uppercase">
            Analyzing {fileName}
        </h2>
        
        {showTimeoutWarning && (
            <div className="mb-4 bg-amber-500/20 border border-amber-500/50 text-amber-200 px-4 py-2 rounded-lg flex items-center text-xs animate-bounce">
                <AlertTriangle className="w-4 h-4 mr-2" />
                <span>Taking longer than usual. Please wait or check your API Key / Connection.</span>
            </div>
        )}

        <p className="text-green-400 font-mono text-xs uppercase tracking-[0.3em] mb-8 animate-pulse bg-green-900/30 px-3 py-1 rounded border border-green-500/30">
            AI AGENT: SENIOR PLANNER MODE ACTIVE
        </p>

        {/* PROGRESS BAR */}
        <div className="w-full max-w-2xl mb-8">
            <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wide">
                <span>Processing Geometry...</span>
                <span>{progress}%</span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden relative">
                <div 
                className="absolute top-0 left-0 h-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)] transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
                ></div>
            </div>
        </div>

        {/* TERMINAL LOG */}
        <div className="w-full max-w-3xl bg-slate-950/90 backdrop-blur border border-slate-800 rounded-lg shadow-2xl overflow-hidden font-mono text-xs">
            <div className="bg-slate-900/50 px-4 py-2 flex items-center justify-between border-b border-slate-800">
                <div className="flex space-x-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/50"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/50"></div>
                </div>
                <div className="text-slate-500 text-[10px] font-bold flex items-center">
                    <Terminal className="w-3 h-3 mr-1" /> GEMINI_VISION_V3_EXEC
                </div>
            </div>
            <div 
                ref={scrollRef}
                className="p-6 h-48 overflow-y-auto custom-scrollbar space-y-2"
            >
                {logs.map((log, i) => (
                    <div key={i} className="text-green-400/90 flex items-start animate-in fade-in slide-in-from-left-2 duration-300">
                        <span className="opacity-40 mr-3 text-slate-500 whitespace-nowrap">
                            [{new Date().toLocaleTimeString('en-US', {hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit'})}]
                        </span>
                        <span>{log}</span>
                    </div>
                ))}
                <div className="text-green-500 animate-pulse mt-2">_</div>
            </div>
        </div>

        <div className="mt-6 flex items-center justify-center space-x-4">
            <div className="flex items-center space-x-3 bg-slate-800/50 backdrop-blur px-4 py-2 rounded-full border border-slate-700/50">
                <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
                <span className="text-[10px] text-slate-400 font-medium">Enterprise Grade Security • 256-bit Encryption</span>
            </div>
            
            {onCancel && (
                <button 
                    onClick={onCancel}
                    className="flex items-center space-x-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 px-4 py-2 rounded-full border border-red-500/30 transition-colors text-[10px] font-bold uppercase tracking-wider"
                >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Cancel</span>
                </button>
            )}
        </div>

      </div>
    </div>
  );
};
