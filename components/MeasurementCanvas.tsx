
import React, { useState, useRef, useEffect } from 'react';
import { Ruler, MousePointer2, PenTool, Hash, X, Check, RotateCcw, Save, Move, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { TakeoffItem } from '../types';

interface MeasurementCanvasProps {
  imageFile: { url: string; name: string };
  onClose: () => void;
  onSaveMeasurement: (item: Partial<TakeoffItem>) => void;
}

type Tool = 'select' | 'calibrate' | 'line' | 'area' | 'count';

interface Point { x: number; y: number }

export const MeasurementCanvas: React.FC<MeasurementCanvasProps> = ({ imageFile, onClose, onSaveMeasurement }) => {
  const [scale, setScale] = useState<number | null>(null); // pixels per unit
  const [activeTool, setActiveTool] = useState<Tool>('select');
  const [points, setPoints] = useState<Point[]>([]);
  const [cursorPos, setCursorPos] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  
  // Calibration State
  const [calibDistance, setCalibDistance] = useState<string>('');
  const [showCalibInput, setShowCalibInput] = useState(false);

  // Measurement State
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Finishing Work');
  const [unit, setUnit] = useState('m');

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // --- MATH HELPERS ---
  const getDistance = (p1: Point, p2: Point) => {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  };

  const getPolyArea = (pts: Point[]) => {
    let area = 0;
    for (let i = 0; i < pts.length; i++) {
      let j = (i + 1) % pts.length;
      area += pts[i].x * pts[j].y;
      area -= pts[j].x * pts[i].y;
    }
    return Math.abs(area / 2);
  };

  const getRealValue = () => {
    if (!scale) return 0;
    if (activeTool === 'line' && points.length > 0) {
       // Total length of polyline
       let len = 0;
       for(let i=0; i<points.length-1; i++) len += getDistance(points[i], points[i+1]);
       // Add live segment
       len += getDistance(points[points.length-1], cursorPos);
       return len / scale;
    }
    if (activeTool === 'area' && points.length > 2) {
       // Approximate area with cursor as closing point
       const poly = [...points, cursorPos];
       return getPolyArea(poly) / (scale * scale);
    }
    if (activeTool === 'count') {
       return points.length;
    }
    return 0;
  };

  const getLiveText = () => {
      if (activeTool === 'calibrate' && points.length === 1) {
          const px = getDistance(points[0], cursorPos);
          return `${px.toFixed(0)}px`;
      }
      if (!scale) return "Uncalibrated";
      const val = getRealValue();
      if (activeTool === 'area') return `${val.toFixed(2)} m²`;
      if (activeTool === 'line') return `${val.toFixed(2)} m`;
      if (activeTool === 'count') return `${val.toFixed(0)} Nos`;
      return "";
  };

  // --- HANDLERS ---
  const handleCanvasClick = (e: React.MouseEvent) => {
      if (activeTool === 'select') return;
      
      // Get click coordinates relative to image
      const rect = imageRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      const x = (e.clientX - rect.left) / zoom;
      const y = (e.clientY - rect.top) / zoom;
      const newPoint = { x, y };

      if (activeTool === 'calibrate') {
          if (points.length === 0) {
              setPoints([newPoint]);
          } else {
              setPoints([...points, newPoint]);
              setShowCalibInput(true);
          }
      } else {
          setPoints(prev => [...prev, newPoint]);
      }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      const rect = imageRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = (e.clientX - rect.left) / zoom;
      const y = (e.clientY - rect.top) / zoom;
      setCursorPos({ x, y });
  };

  const finalizeCalibration = () => {
      const distPx = getDistance(points[0], points[1]);
      const distReal = parseFloat(calibDistance);
      if (distReal > 0) {
          setScale(distPx / distReal);
          setPoints([]);
          setActiveTool('select');
          setShowCalibInput(false);
      }
  };

  const saveMeasurement = () => {
      const qty = activeTool === 'count' ? points.length : 
                  (activeTool === 'line' ? 
                      (points.reduce((acc, p, i) => i > 0 ? acc + getDistance(points[i-1], p) : 0, 0) / (scale || 1)) : 
                      (getPolyArea(points) / ((scale || 1) * (scale || 1)))
                  );
      
      onSaveMeasurement({
          billItemDescription: description || `${activeTool === 'line' ? 'Length' : (activeTool === 'area' ? 'Area' : 'Count')} Measurement`,
          quantity: parseFloat(qty.toFixed(2)),
          unit: activeTool === 'area' ? 'm2' : (activeTool === 'line' ? 'm' : 'Nr'),
          category: category,
          timesing: 1,
          sourceRef: "Manual Measure"
      });
      setPoints([]);
      setDescription('');
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900 flex flex-col text-white font-sans animate-in fade-in duration-200">
        
        {/* HEADER TOOLBAR */}
        <div className="h-14 bg-slate-950 border-b border-slate-800 flex items-center justify-between px-4">
            <div className="flex items-center space-x-4">
                <span className="font-bold text-lg tracking-tight flex items-center text-brand-400">
                    <Maximize className="w-5 h-5 mr-2" /> Canvas Overlay
                </span>
                <div className="h-6 w-px bg-slate-800"></div>
                <div className="flex items-center bg-slate-900 rounded-md p-1 border border-slate-800">
                    <button onClick={() => { setActiveTool('select'); setPoints([]); }} className={`p-2 rounded ${activeTool === 'select' ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white'}`} title="Select / Pan">
                        <MousePointer2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => { setActiveTool('calibrate'); setPoints([]); }} className={`p-2 rounded ${activeTool === 'calibrate' ? 'bg-yellow-600 text-white' : 'text-slate-400 hover:text-white'}`} title="Calibrate Scale">
                        <Ruler className="w-4 h-4" />
                    </button>
                    <div className="w-px h-4 bg-slate-800 mx-1"></div>
                    <button onClick={() => { setActiveTool('line'); setPoints([]); }} disabled={!scale} className={`p-2 rounded ${activeTool === 'line' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white disabled:opacity-30'}`} title="Linear Measure">
                        <PenTool className="w-4 h-4" />
                    </button>
                    <button onClick={() => { setActiveTool('area'); setPoints([]); }} disabled={!scale} className={`p-2 rounded ${activeTool === 'area' ? 'bg-green-600 text-white' : 'text-slate-400 hover:text-white disabled:opacity-30'}`} title="Area Measure">
                        <Move className="w-4 h-4" />
                    </button>
                    <button onClick={() => { setActiveTool('count'); setPoints([]); }} disabled={!scale} className={`p-2 rounded ${activeTool === 'count' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white disabled:opacity-30'}`} title="Count Items">
                        <Hash className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="flex items-center space-x-4">
                {scale ? (
                    <span className="text-xs text-green-400 font-mono bg-green-900/30 px-2 py-1 rounded border border-green-800">Scale: 1m = {scale.toFixed(2)}px</span>
                ) : (
                    <span className="text-xs text-yellow-400 font-bold bg-yellow-900/30 px-2 py-1 rounded border border-yellow-800 animate-pulse">⚠️ Calibrate First</span>
                )}
                <div className="flex items-center space-x-1">
                    <button onClick={() => setZoom(z => Math.max(0.2, z - 0.2))} className="p-2 hover:bg-slate-800 rounded"><ZoomOut className="w-4 h-4" /></button>
                    <span className="text-xs w-12 text-center font-mono">{(zoom * 100).toFixed(0)}%</span>
                    <button onClick={() => setZoom(z => Math.min(5, z + 0.2))} className="p-2 hover:bg-slate-800 rounded"><ZoomIn className="w-4 h-4" /></button>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-red-900/50 hover:text-red-400 rounded transition-colors"><X className="w-5 h-5" /></button>
            </div>
        </div>

        {/* MAIN CANVAS AREA */}
        <div className="flex-1 relative overflow-hidden bg-[#1e1e1e] cursor-crosshair flex items-center justify-center"
             onMouseMove={handleMouseMove}
             onClick={handleCanvasClick}
        >
            {/* Grid Background */}
            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: `linear-gradient(#444 1px, transparent 1px), linear-gradient(90deg, #444 1px, transparent 1px)`, backgroundSize: '20px 20px' }}></div>

            <div className="relative shadow-2xl transition-transform duration-100 ease-out" 
                 style={{ transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`, transformOrigin: 'center' }}
            >
                <img ref={imageRef} src={imageFile.url} alt="Blueprint" className="max-w-none pointer-events-none select-none" />
                
                {/* SVG OVERLAY */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                    {/* Render Drawing Path */}
                    {activeTool === 'line' && points.length > 0 && (
                        <>
                            <polyline points={points.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#3b82f6" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                            <line x1={points[points.length-1].x} y1={points[points.length-1].y} x2={cursorPos.x} y2={cursorPos.y} stroke="#3b82f6" strokeWidth="2" strokeDasharray="4" vectorEffect="non-scaling-stroke" />
                        </>
                    )}
                    {activeTool === 'area' && points.length > 0 && (
                        <>
                            <polygon points={[...points, cursorPos].map(p => `${p.x},${p.y}`).join(' ')} fill="rgba(34, 197, 94, 0.3)" stroke="#22c55e" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                        </>
                    )}
                    {activeTool === 'count' && (
                        <>
                            {points.map((p, i) => (
                                <circle key={i} cx={p.x} cy={p.y} r={10/zoom} fill="#a855f7" stroke="white" strokeWidth="1" />
                            ))}
                            <circle cx={cursorPos.x} cy={cursorPos.y} r={10/zoom} fill="rgba(168, 85, 247, 0.5)" stroke="none" />
                        </>
                    )}
                    {/* Render Points */}
                    {points.map((p, i) => (
                        <circle key={i} cx={p.x} cy={p.y} r={3/zoom} fill="white" stroke="black" strokeWidth="1" />
                    ))}
                    {/* Calibration Line */}
                    {activeTool === 'calibrate' && points.length > 0 && (
                        <line x1={points[0].x} y1={points[0].y} x2={cursorPos.x} y2={cursorPos.y} stroke="#eab308" strokeWidth="2" strokeDasharray="4" vectorEffect="non-scaling-stroke" />
                    )}
                </svg>

                {/* LIVE TOOLTIP */}
                {activeTool !== 'select' && (
                    <div 
                        className="absolute bg-slate-900/90 text-white text-[10px] px-2 py-1 rounded border border-white/20 pointer-events-none whitespace-nowrap z-50 font-mono"
                        style={{ left: cursorPos.x + 15, top: cursorPos.y + 15, transform: `scale(${1/zoom})`, transformOrigin: 'top left' }}
                    >
                        {getLiveText()}
                    </div>
                )}
            </div>
        </div>

        {/* SIDEBAR / BOTTOM BAR CONTROLS */}
        {activeTool !== 'select' && activeTool !== 'calibrate' && points.length > 0 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-950 border border-slate-700 rounded-xl p-4 shadow-2xl flex items-end space-x-4 animate-in slide-in-from-bottom-4">
                <div>
                    <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Description</label>
                    <input type="text" autoFocus className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm w-48 outline-none focus:border-brand-500 text-white placeholder:text-slate-600" placeholder="e.g. Living Room Floor" value={description} onChange={e => setDescription(e.target.value)} />
                </div>
                <div>
                    <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Category</label>
                    <select className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm w-32 outline-none focus:border-brand-500 text-white" value={category} onChange={e => setCategory(e.target.value)}>
                        <option>Substructure</option>
                        <option>Concrete Work</option>
                        <option>Masonry</option>
                        <option>Finishing Work</option>
                        <option>Electrical</option>
                    </select>
                </div>
                <div className="h-10 w-px bg-slate-800 mx-2"></div>
                <div className="text-right mr-2">
                    <span className="block text-[10px] text-slate-400 uppercase font-bold">Value</span>
                    <span className="text-xl font-mono font-bold text-brand-400">{getLiveText()}</span>
                </div>
                <div className="flex space-x-2">
                    <button onClick={() => setPoints([])} className="p-2 bg-slate-800 hover:bg-red-900/50 rounded-lg text-slate-300 hover:text-red-400 transition-colors" title="Clear">
                        <RotateCcw className="w-5 h-5" />
                    </button>
                    <button onClick={saveMeasurement} disabled={!description} className="flex items-center px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-bold text-sm shadow-lg shadow-brand-500/20 transition-all">
                        <Save className="w-4 h-4 mr-2" /> Save Item
                    </button>
                </div>
            </div>
        )}

        {/* CALIBRATION DIALOG */}
        {showCalibInput && (
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in">
                <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl shadow-2xl w-80 text-center">
                    <Ruler className="w-10 h-10 text-yellow-500 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-white mb-2">Calibrate Scale</h3>
                    <p className="text-xs text-slate-400 mb-4">Enter the real-world distance between the two points you clicked.</p>
                    <div className="flex items-center bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 mb-4 focus-within:border-yellow-500">
                        <input 
                            type="number" 
                            className="bg-transparent border-none outline-none text-white text-lg font-mono w-full text-center" 
                            placeholder="5.0"
                            autoFocus
                            value={calibDistance}
                            onChange={e => setCalibDistance(e.target.value)}
                        />
                        <span className="text-slate-500 font-bold ml-2">m</span>
                    </div>
                    <div className="flex space-x-2">
                        <button onClick={() => { setPoints([]); setShowCalibInput(false); }} className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-bold text-slate-300">Cancel</button>
                        <button onClick={finalizeCalibration} className="flex-1 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-500 text-sm font-bold text-white shadow-lg shadow-yellow-600/20">Set Scale</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
