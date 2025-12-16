
import React, { useState, useRef } from 'react';
import { Download, Layout, Type, Palette, ArrowLeft, CheckCircle2, Zap, BarChart3, Globe, Smartphone, Monitor, Layers, FileSpreadsheet, CreditCard, ShieldCheck } from 'lucide-react';
import { Logo } from './Logo';

interface MarketingGeneratorProps {
  onBack: () => void;
}

export const MarketingGenerator: React.FC<MarketingGeneratorProps> = ({ onBack }) => {
  const [headline, setHeadline] = useState("The AI Quantity Surveyor");
  const [subhead, setSubhead] = useState("Upload Drawings. Get BOQ. Win Tenders.");
  const [cta, setCta] = useState("Try Free @ construct-ai.com");
  
  const [theme, setTheme] = useState<'dark' | 'light' | 'brand'>('brand');
  const [format, setFormat] = useState<'landscape' | 'portrait'>('portrait'); // Default to Portrait for LinkedIn
  const [layoutMode, setLayoutMode] = useState<'minimal' | 'flyer'>('flyer'); // Default to Flyer
  const [showGrid, setShowGrid] = useState(true);

  const bannerRef = useRef<HTMLDivElement>(null);

  // Function to simulate download (Instructions)
  const handleDownloadParams = () => {
      alert("To save this banner:\n\n1. Windows: Press Win + Shift + S\n2. Mac: Press Cmd + Shift + 4\n3. Select the banner area to save as an image!");
  };

  // Canvas Dimensions
  const width = format === 'landscape' ? 900 : 540; // Scaled down from 1200/1080 for UI fit
  const height = format === 'landscape' ? 472.5 : 675; // Scaled down from 630/1350

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {/* Editor Toolbar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm z-50">
        <div className="flex items-center">
            <button onClick={onBack} className="mr-4 p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
                <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold text-slate-800 flex items-center">
                <Layout className="w-5 h-5 mr-2 text-brand-600" /> Marketing Studio
            </h1>
        </div>
        <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 font-bold uppercase hidden md:inline">Use Snipping Tool to Save</span>
            <button 
                onClick={handleDownloadParams}
                className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center hover:bg-brand-700 transition-colors"
            >
                <Download className="w-4 h-4 mr-2" /> Capture
            </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Controls Sidebar */}
        <div className="w-80 bg-white border-r border-slate-200 p-6 overflow-y-auto z-40">
            
            {/* FORMAT SELECTOR */}
            <div className="mb-8">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center">
                    <Monitor className="w-4 h-4 mr-2" /> Canvas Format
                </h3>
                <div className="grid grid-cols-2 gap-2 mb-4">
                    <button 
                        onClick={() => setFormat('landscape')}
                        className={`p-3 rounded-lg border text-xs font-bold flex flex-col items-center justify-center transition-all ${format === 'landscape' ? 'bg-brand-50 border-brand-500 text-brand-700' : 'bg-white border-slate-200 text-slate-500 hover:border-brand-200'}`}
                    >
                        <div className="w-8 h-5 border-2 border-current rounded-sm mb-2"></div>
                        Landscape
                        <span className="text-[9px] font-normal opacity-70">Web / Link</span>
                    </button>
                    <button 
                        onClick={() => setFormat('portrait')}
                        className={`p-3 rounded-lg border text-xs font-bold flex flex-col items-center justify-center transition-all ${format === 'portrait' ? 'bg-brand-50 border-brand-500 text-brand-700' : 'bg-white border-slate-200 text-slate-500 hover:border-brand-200'}`}
                    >
                        <div className="w-5 h-7 border-2 border-current rounded-sm mb-2"></div>
                        Portrait
                        <span className="text-[9px] font-normal opacity-70">LinkedIn Mobile</span>
                    </button>
                </div>
                
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 mt-6 flex items-center">
                    <Layers className="w-4 h-4 mr-2" /> Layout Style
                </h3>
                <div className="flex gap-2 bg-slate-100 p-1 rounded-lg">
                    <button onClick={() => setLayoutMode('minimal')} className={`flex-1 py-1.5 text-xs font-bold rounded-md ${layoutMode === 'minimal' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>Minimal</button>
                    <button onClick={() => setLayoutMode('flyer')} className={`flex-1 py-1.5 text-xs font-bold rounded-md ${layoutMode === 'flyer' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>Flyer</button>
                </div>
            </div>

            {/* TEXT CONTENT */}
            <div className="mb-8">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center">
                    <Type className="w-4 h-4 mr-2" /> Content
                </h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Main Headline</label>
                        <textarea 
                            className="w-full p-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-brand-500 outline-none resize-none font-bold text-slate-900"
                            rows={2}
                            value={headline}
                            onChange={(e) => setHeadline(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Subheadline</label>
                        <textarea 
                            className="w-full p-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-brand-500 outline-none resize-none"
                            rows={3}
                            value={subhead}
                            onChange={(e) => setSubhead(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Footer / CTA</label>
                        <input 
                            type="text" 
                            className="w-full p-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-brand-500 outline-none font-mono"
                            value={cta}
                            onChange={(e) => setCta(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* VISUAL STYLE */}
            <div className="mb-8">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center">
                    <Palette className="w-4 h-4 mr-2" /> Theme
                </h3>
                <div className="grid grid-cols-3 gap-2 mb-4">
                    <button 
                        onClick={() => setTheme('dark')}
                        className={`p-2 rounded border text-xs font-bold ${theme === 'dark' ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-100 text-slate-600 border-slate-200'}`}
                    >
                        Dark
                    </button>
                    <button 
                        onClick={() => setTheme('light')}
                        className={`p-2 rounded border text-xs font-bold ${theme === 'light' ? 'bg-white text-slate-900 border-brand-500 shadow-sm' : 'bg-slate-100 text-slate-600 border-slate-200'}`}
                    >
                        Light
                    </button>
                    <button 
                        onClick={() => setTheme('brand')}
                        className={`p-2 rounded border text-xs font-bold ${theme === 'brand' ? 'bg-brand-600 text-white border-brand-600' : 'bg-slate-100 text-slate-600 border-slate-200'}`}
                    >
                        Brand
                    </button>
                </div>
                <label className="flex items-center space-x-2 cursor-pointer">
                    <input 
                        type="checkbox" 
                        checked={showGrid} 
                        onChange={(e) => setShowGrid(e.target.checked)} 
                        className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="text-sm text-slate-600">Show Blueprint Grid</span>
                </label>
            </div>

        </div>

        {/* Canvas Area */}
        <div className="flex-1 bg-slate-200/50 flex items-center justify-center p-10 overflow-auto">
            
            <div 
                ref={bannerRef}
                style={{ width: `${width}px`, height: `${height}px` }}
                className={`relative shadow-2xl flex flex-col overflow-hidden shrink-0 transition-all duration-500 ${
                    theme === 'dark' ? 'bg-slate-900' : 
                    theme === 'light' ? 'bg-white' : 
                    'bg-gradient-to-br from-brand-700 to-brand-900'
                }`}
            >
                {/* Background Decor */}
                {showGrid && (
                    <div className="absolute inset-0 opacity-10 pointer-events-none" 
                        style={{ 
                            backgroundImage: `linear-gradient(${theme === 'light' ? '#000' : '#fff'} 1px, transparent 1px), linear-gradient(90deg, ${theme === 'light' ? '#000' : '#fff'} 1px, transparent 1px)`, 
                            backgroundSize: '40px 40px' 
                        }}>
                    </div>
                )}
                
                {/* Glow Effects */}
                <div className={`absolute top-0 right-0 w-[500px] h-[500px] rounded-full blur-[120px] opacity-30 pointer-events-none ${theme === 'light' ? 'bg-brand-200' : 'bg-brand-400'}`}></div>
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-500 rounded-full blur-[120px] opacity-20 pointer-events-none"></div>

                {/* --- CONTENT LAYER --- */}
                <div className="relative z-10 w-full h-full flex flex-col p-12">
                    
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-auto">
                        <Logo className={`w-10 h-10 ${theme === 'light' ? 'text-brand-600' : 'text-brand-300'}`} />
                        <span className={`text-2xl font-black tracking-tighter ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>ConstructAI</span>
                    </div>

                    {/* Body */}
                    {layoutMode === 'minimal' ? (
                        <div className="flex-1 flex items-center">
                            <div className="w-2/3 pr-10">
                                <h2 className={`text-6xl font-black leading-[1] mb-6 ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
                                    {headline}
                                </h2>
                                <p className={`text-2xl font-medium leading-relaxed ${theme === 'light' ? 'text-slate-500' : 'text-brand-100'}`}>
                                    {subhead}
                                </p>
                            </div>
                            {/* Abstract Mockup Minimal */}
                            <div className="w-1/3 relative h-64 perspective-1000">
                                <div className={`absolute inset-0 rounded-xl transform rotate-y-[-15deg] rotate-z-[5deg] shadow-2xl border ${theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-800 border-slate-600'}`}>
                                    {/* Mockup lines */}
                                    <div className="p-4 space-y-3">
                                        <div className="h-4 w-1/2 bg-brand-500/20 rounded"></div>
                                        <div className="h-2 w-3/4 bg-slate-500/20 rounded"></div>
                                        <div className="h-2 w-full bg-slate-500/20 rounded"></div>
                                        <div className="h-20 w-full bg-slate-500/10 rounded mt-4 border border-dashed border-slate-500/20 flex items-center justify-center">
                                            <BarChart3 className="w-8 h-8 text-brand-500 opacity-50" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        // FLYER MODE (ONE PAGER)
                        <div className="flex-1 flex flex-col justify-center mt-8">
                            <h2 className={`text-5xl font-black leading-[1.1] mb-6 text-center ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
                                {headline}
                            </h2>
                            
                            {/* Feature Grid */}
                            <div className="grid grid-cols-2 gap-4 mb-8">
                                <div className={`p-4 rounded-xl border ${theme === 'light' ? 'bg-white/50 border-slate-200' : 'bg-white/10 border-white/10'}`}>
                                    <FileSpreadsheet className="w-8 h-8 text-green-500 mb-2" />
                                    <h3 className={`font-bold text-lg ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>Excel Export</h3>
                                    <p className={`text-xs ${theme === 'light' ? 'text-slate-500' : 'text-slate-300'}`}>Live formulas included.</p>
                                </div>
                                <div className={`p-4 rounded-xl border ${theme === 'light' ? 'bg-white/50 border-slate-200' : 'bg-white/10 border-white/10'}`}>
                                    <Smartphone className="w-8 h-8 text-brand-400 mb-2" />
                                    <h3 className={`font-bold text-lg ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>Telebirr Pay</h3>
                                    <p className={`text-xs ${theme === 'light' ? 'text-slate-500' : 'text-slate-300'}`}>No Visa needed.</p>
                                </div>
                                <div className={`p-4 rounded-xl border ${theme === 'light' ? 'bg-white/50 border-slate-200' : 'bg-white/10 border-white/10'}`}>
                                    <ShieldCheck className="w-8 h-8 text-yellow-400 mb-2" />
                                    <h3 className={`font-bold text-lg ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>SMM7 Ready</h3>
                                    <p className={`text-xs ${theme === 'light' ? 'text-slate-500' : 'text-slate-300'}`}>Standard Compliant.</p>
                                </div>
                                <div className={`p-4 rounded-xl border ${theme === 'light' ? 'bg-white/50 border-slate-200' : 'bg-white/10 border-white/10'}`}>
                                    <Zap className="w-8 h-8 text-purple-400 mb-2" />
                                    <h3 className={`font-bold text-lg ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>Instant</h3>
                                    <p className={`text-xs ${theme === 'light' ? 'text-slate-500' : 'text-slate-300'}`}>10x faster than humans.</p>
                                </div>
                            </div>

                            <p className={`text-xl text-center font-medium leading-relaxed max-w-md mx-auto ${theme === 'light' ? 'text-slate-600' : 'text-brand-100'}`}>
                                "{subhead}"
                            </p>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="mt-auto pt-8 flex items-center justify-center">
                        <div className={`px-8 py-3 rounded-full font-bold text-lg shadow-xl flex items-center ${theme === 'light' ? 'bg-slate-900 text-white' : 'bg-white text-brand-900'}`}>
                            {cta} <ArrowLeft className="w-5 h-5 ml-2 rotate-180" />
                        </div>
                    </div>
                </div>
            </div>

        </div>
      </div>
    </div>
  );
};
