
import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, PlayCircle, MessageCircle, CheckCircle2, Star, UploadCloud, Cpu, FileSpreadsheet, Zap, Briefcase, Ruler, Calculator, Globe, CreditCard, ChevronDown, Check, X, CalendarClock, Users, Building2, MapPin, Quote, ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react';
import { Logo } from './Logo';
import { TermsModal, PrivacyModal } from './LegalModals';

interface LandingPageProps {
  onGetStarted: () => void;
  onLogin: () => void; 
  onTryDemo: () => void; 
  onOpenGuide: () => void;
}

const FAQS = [
  { q: "Is the AI accurate enough for tenders?", a: "Yes. ConstructAI uses the latest Gemini 3 Pro models, trained on SMM7 and CESMM4 standards. However, like any tool, we recommend a final human review. The output includes formulas, making it easy to check and adjust." },
  { q: "What file formats do you support?", a: "We support PDF (Vector & Scanned), DWG/DXF (AutoCAD), and High-Res Images (JPG/PNG). You can also upload ZIP files containing multiple drawings." },
  { q: "Do I need a monthly subscription?", a: "No! We operate on a 'Pay-As-You-Go' credit system. You buy credits (via Card or Mobile Money) and use them only when you export a project. Previewing analysis is free." },
  { q: "Can it generate Construction Schedules?", a: "Yes! Our new AI Scheduler reads your drawings to create a WBS and Gantt chart with dependencies, resource loading, and critical path analysis." },
];

const HERO_IMAGES = [
  "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2000&auto=format&fit=crop", // Modern Glass Building
  "https://images.unsplash.com/photo-1503387762-592deb58ef4e?q=80&w=2000&auto=format&fit=crop", // Architecture Wood/Concrete
  "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?q=80&w=2000&auto=format&fit=crop", // Construction Site
  "https://images.unsplash.com/photo-1504307651254-35680f356dfd?q=80&w=2000&auto=format&fit=crop"  // Blueprints/3D Model
];

const TESTIMONIALS = [
    { name: "Ahmed K.", role: "Senior QS, Sunshine Construction", text: "I used to spend 3 days measuring a G+5. ConstructAI does the heavy lifting in 10 minutes. The formula export is a lifesaver." },
    { name: "Sarah M.", role: "Project Manager, Afro-Tsion", text: "The scheduling feature is impressive. It spotted critical path items I missed. It's like having a senior planner on my laptop." },
    { name: "David T.", role: "Freelance Estimator", text: "Pay-as-you-go is perfect for me. I don't have projects every month, so I just buy credits when I need them. Works flawlessly with Telebirr." },
    { name: "Michael B.", role: "Site Engineer, MIDROC", text: "The accuracy on rebar schedules is surprising. It caught a conflict in the beam detailing that would have cost us delays." },
    { name: "Lisa W.", role: "Architect, Zeleke Consult", text: "Finally, a tool that understands local context. The ability to export directly to Excel with formulas makes checking the work so easy." }
];

type Currency = 'USD' | 'EUR' | 'ETB';

const PRICING_TIERS = [
  { 
    title: "Single Project", 
    credits: 1, 
    prices: { USD: 49, EUR: 45, ETB: 5000 },
    features: ["1 Full Project Export", "Takeoff & BOQ", "Basic Schedule", "7-Day Cloud Storage"] 
  },
  { 
    title: "Starter Pack", 
    credits: 3, 
    popular: true, 
    prices: { USD: 129, EUR: 119, ETB: 20000 },
    features: ["3 Full Project Exports", "Takeoff, BOQ & Schedules", "Rebar Schedule Generation", "30-Day Cloud Storage"] 
  },
  { 
    title: "Pro Bundle", 
    credits: 10, 
    prices: { USD: 399, EUR: 369, ETB: 50000 },
    features: ["10 Full Project Exports", "Advanced Scheduling (WBS)", "Team Access", "Unlimited Storage"] 
  },
];

// Helper Component for Animated Numbers
const CountUp = ({ end, duration = 2000, suffix = "" }: { end: number, duration?: number, suffix?: string }) => {
    const [count, setCount] = useState(0);
    const ref = useRef<HTMLSpanElement>(null);
    const hasAnimated = useRef(false);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && !hasAnimated.current) {
                    hasAnimated.current = true;
                    let startTime: number | null = null;
                    const step = (timestamp: number) => {
                        if (!startTime) startTime = timestamp;
                        const progress = Math.min((timestamp - startTime) / duration, 1);
                        setCount(Math.floor(progress * end));
                        if (progress < 1) {
                            window.requestAnimationFrame(step);
                        }
                    };
                    window.requestAnimationFrame(step);
                }
            },
            { threshold: 0.5 }
        );
        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, [end, duration]);

    return <span ref={ref}>{count}{suffix}</span>;
};

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted, onLogin, onTryDemo, onOpenGuide }) => {
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [currency, setCurrency] = useState<Currency>('ETB'); // Default to ETB for local market context
  const [showBanner, setShowBanner] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [activeTestimonial, setActiveTestimonial] = useState(0);

  const whatsappUrl = "https://wa.me/251927942534";

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % HERO_IMAGES.length);
    }, 6000); // Rotate every 6 seconds
    return () => clearInterval(interval);
  }, []);

  // Testimonial Auto-slide
  useEffect(() => {
    const interval = setInterval(() => {
        setActiveTestimonial((prev) => (prev + 1) % TESTIMONIALS.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const nextTestimonial = () => setActiveTestimonial((prev) => (prev + 1) % TESTIMONIALS.length);
  const prevTestimonial = () => setActiveTestimonial((prev) => (prev - 1 + TESTIMONIALS.length) % TESTIMONIALS.length);

  const getPriceDisplay = (prices: { USD: number, EUR: number, ETB: number }) => {
    if (currency === 'USD') return `$${prices.USD}`;
    if (currency === 'EUR') return `€${prices.EUR}`;
    return `${prices.ETB.toLocaleString()} ETB`;
  };

  return (
    <div className="bg-white font-sans relative selection:bg-brand-500 selection:text-white overflow-x-hidden">
      
      {/* LAUNCH BANNER */}
      {showBanner && (
        <div className="bg-gradient-to-r from-brand-600 to-brand-800 text-white text-xs font-bold py-2 px-4 text-center relative z-50">
           <span className="opacity-90">🚀 NEW FEATURE: AI Construction Scheduling is now live! </span>
           <span className="bg-white text-brand-700 px-2 py-0.5 rounded mx-1 shadow-sm text-[10px] uppercase tracking-wider cursor-pointer" onClick={onGetStarted}>TRY IT NOW</span>
           <button onClick={() => setShowBanner(false)} className="absolute right-4 top-1/2 -translate-y-1/2 hover:text-brand-200">
             <X className="w-3 h-3" />
           </button>
        </div>
      )}

      {/* FLOATING WHATSAPP BUTTON */}
      <a 
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-8 right-8 z-50 group flex items-center justify-center animate-bounce duration-[2000ms]"
      >
        <div className="bg-[#25D366] hover:bg-[#20bd5a] text-white p-4 rounded-full shadow-[0_4px_14px_0_rgba(37,211,102,0.39)] transition-all hover:scale-110">
           <MessageCircle className="w-8 h-8 fill-current" />
        </div>
      </a>

      {/* --- HERO SECTION (SPLIT LAYOUT) --- */}
      <div className="relative isolate bg-slate-900 min-h-[90vh] flex flex-col overflow-hidden">
        
        {/* BACKGROUND SLIDESHOW */}
        {HERO_IMAGES.map((img, index) => (
            <div 
                key={img}
                className={`absolute inset-0 -z-20 transition-opacity duration-[2000ms] ease-in-out ${index === currentImageIndex ? 'opacity-40' : 'opacity-0'}`}
            >
                <img src={img} alt="Background" className="w-full h-full object-cover scale-105 animate-pulse-fast" style={{ animationDuration: '20s' }} />
            </div>
        ))}

        {/* GRADIENT OVERLAY (To make text readable) */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-slate-900/95 via-slate-900/80 to-slate-950"></div>
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-brand-900/30 via-transparent to-transparent"></div>
        
        {/* TOP NAV */}
        <div className="w-full px-6 py-6 flex justify-between items-center z-20 max-w-7xl mx-auto">
            <div className="flex items-center space-x-2">
                 <Logo className="w-8 h-8 text-brand-400" />
                 <span className="text-white font-bold text-xl tracking-tight">ConstructAI</span>
            </div>
            <div className="flex items-center gap-4">
              <button 
                onClick={onLogin}
                className="text-slate-300 hover:text-white text-sm font-medium transition-colors hidden sm:block"
              >
                Log In
              </button>
              <button 
                onClick={onGetStarted}
                className="px-5 py-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 backdrop-blur-md text-white text-sm font-bold transition-all"
              >
                Try for Free
              </button>
            </div>
        </div>

        {/* HERO CONTENT */}
        <div className="flex-1 flex items-center justify-center px-6 pb-20 pt-10">
            <div className="max-w-7xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                
                {/* LEFT: COPY */}
                <div className="text-center lg:text-left">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-brand-500/30 bg-brand-500/10 text-brand-300 text-xs font-bold uppercase tracking-wider mb-6 backdrop-blur-md">
                        <Globe className="w-3 h-3" /> Built for Africa & The World
                    </div>
                    
                    <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white mb-6 leading-[1.1] drop-shadow-2xl">
                        The All-in-One <br/>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 via-brand-200 to-white animate-pulse">AI Civil Engineer.</span>
                    </h1>
                    
                    <p className="text-lg text-slate-300 mb-8 max-w-xl mx-auto lg:mx-0 font-light leading-relaxed">
                        Complete your office workflow in minutes. <strong>Takeoff, BOQ, Valuation, Scheduling, and Recovery</strong>—all powered by Gemini 3 Pro.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
                        <button 
                            onClick={onGetStarted}
                            className="group relative w-full sm:w-auto px-8 py-4 rounded-xl bg-brand-600 text-white font-bold overflow-hidden shadow-[0_0_40px_rgba(2,132,199,0.4)] hover:shadow-[0_0_60px_rgba(2,132,199,0.6)] transition-all"
                        >
                            <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1s_infinite]"></div>
                            <span className="flex items-center justify-center relative z-10">
                                Start Workflow <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </span>
                        </button>
                        <button 
                            onClick={onTryDemo}
                            className="w-full sm:w-auto px-8 py-4 rounded-xl border border-slate-700 bg-slate-800/50 text-white font-bold hover:bg-slate-800 transition-all flex items-center justify-center backdrop-blur-sm hover:border-brand-500/50"
                        >
                            <PlayCircle className="mr-2 w-5 h-5 text-brand-400" /> View Demo
                        </button>
                    </div>

                    <div className="mt-8 flex items-center justify-center lg:justify-start gap-6 text-sm text-slate-400 font-medium">
                        <div className="flex items-center"><CheckCircle2 className="w-4 h-4 mr-2 text-green-500" /> Estimation</div>
                        <div className="flex items-center"><CheckCircle2 className="w-4 h-4 mr-2 text-green-500" /> Payment</div>
                        <div className="flex items-center"><CheckCircle2 className="w-4 h-4 mr-2 text-green-500" /> Scheduling</div>
                    </div>
                </div>

                {/* RIGHT: UI MOCKUP (The "Trust Builder") */}
                <div className="relative mx-auto w-full max-w-[500px] lg:max-w-none perspective-1000">
                    {/* Glow effect */}
                    <div className="absolute -inset-2 bg-gradient-to-r from-brand-600 to-purple-600 rounded-3xl blur-xl opacity-30 animate-pulse"></div>
                    
                    {/* App Window Mockup */}
                    <div className="relative bg-slate-900/90 border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl transform transition-transform hover:scale-[1.01] duration-500">
                        <div className="bg-slate-800/80 px-4 py-3 border-b border-slate-700/50 flex items-center space-x-2">
                            <div className="flex space-x-1.5">
                                <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
                                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></div>
                                <div className="w-2.5 h-2.5 rounded-full bg-green-500/80"></div>
                            </div>
                            <div className="ml-4 h-5 w-48 bg-slate-950/50 rounded-md flex items-center px-2 text-[8px] text-slate-500 font-mono">
                                construct-ai-engine-v3.0.exe
                            </div>
                        </div>
                        <div className="p-1">
                             {/* Fake UI Content */}
                             <div className="bg-slate-950/80 rounded-xl p-5 space-y-4 font-mono text-xs shadow-inner">
                                 <div className="flex justify-between text-slate-500 border-b border-slate-800/50 pb-2 text-[10px] tracking-widest uppercase">
                                     <span>Execution Log</span>
                                     <span>Status</span>
                                 </div>
                                 <div className="space-y-3">
                                     <div className="flex justify-between text-brand-300 animate-in slide-in-from-left-2 duration-700">
                                         <span className="flex items-center"><Check className="w-3 h-3 mr-2 text-green-500" /> Reading Geometry...</span>
                                         <span className="font-bold text-green-400 text-[10px] bg-green-900/20 px-2 py-0.5 rounded">OK</span>
                                     </div>
                                     <div className="flex justify-between text-brand-200 animate-in slide-in-from-left-2 duration-700 delay-100">
                                         <span className="flex items-center"><Check className="w-3 h-3 mr-2 text-green-500" /> Generating BOQ...</span>
                                         <span className="font-bold text-white">142.5m³</span>
                                     </div>
                                     <div className="flex justify-between text-yellow-300 animate-in slide-in-from-left-2 duration-700 delay-200">
                                         <span className="flex items-center"><TrendingUp className="w-3 h-3 mr-2 text-yellow-500" /> Value Engineering...</span>
                                         <span className="font-bold text-green-400 text-[10px] bg-green-900/20 px-2 py-0.5 rounded">SAVINGS DETECTED</span>
                                     </div>
                                     <div className="flex justify-between text-purple-200 animate-in slide-in-from-left-2 duration-700 delay-300">
                                         <span className="flex items-center"><Check className="w-3 h-3 mr-2 text-purple-500" /> Critical Path Analysis...</span>
                                         <span className="font-bold text-white">45 Days</span>
                                     </div>
                                 </div>
                                 <div className="mt-4 p-3 bg-gradient-to-r from-brand-900/40 to-slate-900/40 border border-brand-500/20 rounded-lg text-center text-brand-200 flex items-center justify-center gap-2">
                                     <Zap className="w-4 h-4 text-yellow-400 animate-pulse" />
                                     <span className="font-bold">Project Optimized (4.2s)</span>
                                 </div>
                             </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
      </div>

      {/* --- TRUST & LOGOS --- */}
      <div className="bg-slate-50 border-b border-slate-200 py-10 overflow-hidden">
         <div className="max-w-7xl mx-auto px-6 text-center">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-8">Compatible with Industry Standards</p>
            <div className="flex flex-wrap justify-center items-center gap-12 md:gap-20 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
                <div className="flex items-center gap-2 font-black text-slate-800 text-xl"><Briefcase className="w-6 h-6" /> SMM7</div>
                <div className="flex items-center gap-2 font-black text-slate-800 text-xl"><Ruler className="w-6 h-6" /> CESMM4</div>
                <div className="flex items-center gap-2 font-black text-green-700 text-xl"><FileSpreadsheet className="w-6 h-6" /> Excel</div>
                <div className="flex items-center gap-2 font-black text-slate-800 text-xl"><CalendarClock className="w-6 h-6" /> MS Project</div>
            </div>
         </div>
      </div>

      {/* --- VALUE PROPOSITION (Why Us?) --- */}
      <div className="py-24 bg-white relative">
        {/* Subtle Grid Texture */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
        
        <div className="max-w-7xl mx-auto px-6 relative z-10">
            <div className="text-center max-w-3xl mx-auto mb-16">
                <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-6">Complete Project Controls.</h2>
                <p className="text-slate-600 text-lg leading-relaxed">From initial Quantity Takeoff to Payment Certificates and Scheduling. We combine Google's Vision AI with senior engineering logic.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                <div className="group p-8 rounded-2xl bg-white border border-slate-100 shadow-xl shadow-slate-200/50 hover:border-brand-200 hover:shadow-2xl hover:shadow-brand-500/10 transition-all duration-300 hover:-translate-y-1">
                    <div className="w-14 h-14 bg-brand-50 rounded-2xl flex items-center justify-center mb-6 text-brand-600 group-hover:bg-brand-600 group-hover:text-white transition-colors">
                        <UploadCloud className="w-7 h-7" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-3">1. Upload</h3>
                    <p className="text-slate-500 text-sm leading-relaxed">PDFs, Images, or DWGs. Even photos of plans work. We extract the data you need automatically.</p>
                </div>
                <div className="group p-8 rounded-2xl bg-white border border-slate-100 shadow-xl shadow-slate-200/50 hover:border-brand-200 hover:shadow-2xl hover:shadow-brand-500/10 transition-all duration-300 hover:-translate-y-1">
                    <div className="w-14 h-14 bg-brand-50 rounded-2xl flex items-center justify-center mb-6 text-brand-600 group-hover:bg-brand-600 group-hover:text-white transition-colors">
                        <Zap className="w-7 h-7" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-3">2. Measure</h3>
                    <p className="text-slate-500 text-sm leading-relaxed">Our engine identifies walls, beams, and finishes, applying standard deduction rules automatically.</p>
                </div>
                <div className="group p-8 rounded-2xl bg-white border border-slate-100 shadow-xl shadow-slate-200/50 hover:border-brand-200 hover:shadow-2xl hover:shadow-brand-500/10 transition-all duration-300 hover:-translate-y-1">
                    <div className="w-14 h-14 bg-brand-50 rounded-2xl flex items-center justify-center mb-6 text-brand-600 group-hover:bg-brand-600 group-hover:text-white transition-colors">
                        <CalendarClock className="w-7 h-7" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-3">3. Schedule & Recover</h3>
                    <p className="text-slate-500 text-sm leading-relaxed">Generate a WBS and Gantt. Recover delayed projects with fast-track AI optimization.</p>
                </div>
                <div className="group p-8 rounded-2xl bg-white border border-slate-100 shadow-xl shadow-slate-200/50 hover:border-brand-200 hover:shadow-2xl hover:shadow-brand-500/10 transition-all duration-300 hover:-translate-y-1">
                    <div className="w-14 h-14 bg-brand-50 rounded-2xl flex items-center justify-center mb-6 text-brand-600 group-hover:bg-brand-600 group-hover:text-white transition-colors">
                        <FileSpreadsheet className="w-7 h-7" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-3">4. Export</h3>
                    <p className="text-slate-500 text-sm leading-relaxed">Get a clean BOQ and Schedule in <strong>Excel</strong> with live formulas. Ready for tender immediately.</p>
                </div>
            </div>
        </div>
      </div>

      {/* --- ABOUT US (REMASTERED) --- */}
      <div className="py-32 bg-slate-900 relative overflow-hidden">
          {/* Tech Background */}
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(#4f46e5 1px, transparent 1px), linear-gradient(to right, #4f46e5 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-brand-600/30 rounded-full blur-[120px] pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none"></div>

          <div className="max-w-7xl mx-auto px-6 relative z-10">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
                  
                  {/* Text Side */}
                  <div>
                      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-900/50 border border-brand-500/30 text-brand-300 text-xs font-bold uppercase tracking-widest mb-8">
                          <Cpu className="w-4 h-4" /> The ConstructAI Story
                      </div>
                      
                      <h2 className="text-4xl md:text-5xl font-black text-white mb-8 leading-tight">
                          We built the tool <br/>
                          <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-purple-400">we wished we had.</span>
                      </h2>
                      
                      <div className="space-y-6 text-slate-400 text-lg leading-relaxed">
                          <p>
                              Quantity Surveying hasn't changed in 50 years. It's slow, manual, and prone to error. 
                              <strong> We changed that.</strong>
                          </p>
                          <p>
                              ConstructAI was born in <span className="text-white font-bold">Addis Ababa</span>, created by a fusion of Civil Engineers and AI Researchers. We trained our models on thousands of real-world African and International blueprints to ensure it understands context—not just lines.
                          </p>
                      </div>

                      {/* Animated Stats Grid */}
                      <div className="grid grid-cols-3 gap-6 mt-12 border-t border-slate-800 pt-10">
                          <div className="group">
                              <div className="text-4xl font-black text-white mb-2 group-hover:text-brand-400 transition-colors">
                                  <CountUp end={1000} suffix="+" />
                              </div>
                              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Projects Delivered</div>
                          </div>
                          <div className="group">
                              <div className="text-4xl font-black text-white mb-2 group-hover:text-brand-400 transition-colors">
                                  <CountUp end={50} suffix="M+" />
                              </div>
                              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Items Measured</div>
                          </div>
                          <div className="group">
                              <div className="text-4xl font-black text-white mb-2 group-hover:text-brand-400 transition-colors">
                                  99.9%
                              </div>
                              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Uptime</div>
                          </div>
                      </div>
                  </div>

                  {/* Visual Side (The Cool Part) */}
                  <div className="relative">
                      {/* Main Card */}
                      <div className="relative z-10 rounded-3xl overflow-hidden border border-slate-700 shadow-2xl bg-slate-800 group">
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent opacity-60 z-10"></div>
                          <img 
                              src="https://images.unsplash.com/photo-1531482615713-2afd69097998?q=80&w=1000&auto=format&fit=crop" 
                              alt="Engineering Team" 
                              className="w-full h-auto object-cover opacity-80 group-hover:scale-105 transition-transform duration-700"
                          />
                          
                          {/* Scanning Line Effect */}
                          <div className="absolute top-0 left-0 w-full h-1 bg-brand-500 shadow-[0_0_20px_rgba(14,165,233,0.8)] animate-scan-vertical opacity-50 z-20"></div>

                          <div className="absolute bottom-0 left-0 w-full p-8 z-30">
                              <div className="flex items-center gap-4 mb-2">
                                  <div className="w-10 h-10 rounded-full bg-brand-600 flex items-center justify-center text-white font-bold shadow-lg">
                                      <Building2 className="w-5 h-5" />
                                  </div>
                                  <div>
                                      <div className="text-white font-bold text-lg">HQ: Bole, Addis Ababa</div>
                                      <div className="text-brand-300 text-xs font-mono">lat: 9.005401, long: 38.763611</div>
                                  </div>
                              </div>
                          </div>
                      </div>

                      {/* Floating Elements */}
                      <div className="absolute -top-10 -right-10 z-20 bg-white p-4 rounded-xl shadow-xl animate-float" style={{ animationDelay: '0s' }}>
                          <div className="flex items-center gap-3">
                              <div className="bg-green-100 p-2 rounded-lg text-green-600">
                                  <Zap className="w-6 h-6" />
                              </div>
                              <div>
                                  <div className="text-xs text-slate-400 font-bold uppercase">Speed</div>
                                  <div className="text-slate-900 font-black text-xl">10x Faster</div>
                              </div>
                          </div>
                      </div>

                      <div className="absolute -bottom-8 -left-8 z-20 bg-white p-4 rounded-xl shadow-xl animate-float" style={{ animationDelay: '2s' }}>
                          <div className="flex items-center gap-3">
                              <div className="bg-purple-100 p-2 rounded-lg text-purple-600">
                                  <Cpu className="w-6 h-6" />
                              </div>
                              <div>
                                  <div className="text-xs text-slate-400 font-bold uppercase">Technology</div>
                                  <div className="text-slate-900 font-black text-xl">Gemini 3 Pro</div>
                              </div>
                          </div>
                      </div>
                  </div>

              </div>
          </div>
      </div>

      {/* --- TESTIMONIALS SLIDER --- */}
      <div className="py-24 bg-white relative">
          <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
          <div className="max-w-4xl mx-auto px-6">
              <div className="text-center mb-12">
                  <h2 className="text-3xl font-black text-slate-900 mb-4">Trusted by Professionals</h2>
                  <p className="text-slate-500">Don't just take our word for it.</p>
              </div>
              
              <div className="relative bg-slate-50 rounded-3xl p-10 border border-slate-100 shadow-xl min-h-[300px] flex flex-col justify-center overflow-hidden group">
                  {/* Decorative Quote */}
                  <div className="absolute top-0 right-0 p-10 opacity-5">
                      <Quote className="w-32 h-32 text-slate-900 fill-current" />
                  </div>

                  {/* Slider Controls */}
                  <button 
                    onClick={prevTestimonial}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white shadow-lg text-slate-600 hover:text-brand-600 hover:scale-110 transition-all z-20 md:opacity-0 group-hover:opacity-100"
                  >
                      <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button 
                    onClick={nextTestimonial}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white shadow-lg text-slate-600 hover:text-brand-600 hover:scale-110 transition-all z-20 md:opacity-0 group-hover:opacity-100"
                  >
                      <ChevronRight className="w-6 h-6" />
                  </button>

                  {/* Slider Content */}
                  <div className="relative z-10 transition-all duration-500 ease-in-out">
                        {/* We use a key to force React to re-trigger animations when index changes */}
                        <div key={activeTestimonial} className="text-center px-4 md:px-16 animate-in slide-in-from-right-8 fade-in duration-500">
                            <div className="flex justify-center mb-6">
                                <div className="w-16 h-16 rounded-full bg-brand-100 flex items-center justify-center font-bold text-2xl text-brand-700 shadow-inner">
                                    {TESTIMONIALS[activeTestimonial].name[0]}
                                </div>
                            </div>
                            <p className="text-xl md:text-2xl text-slate-700 italic mb-8 font-light leading-relaxed">
                                "{TESTIMONIALS[activeTestimonial].text}"
                            </p>
                            <div>
                                <div className="font-bold text-slate-900 text-lg">{TESTIMONIALS[activeTestimonial].name}</div>
                                <div className="text-sm text-brand-600 font-medium uppercase tracking-wide mt-1">{TESTIMONIALS[activeTestimonial].role}</div>
                            </div>
                        </div>
                  </div>

                  {/* Dots Indicator */}
                  <div className="flex justify-center gap-2 mt-10">
                      {TESTIMONIALS.map((_, i) => (
                          <button 
                            key={i} 
                            onClick={() => setActiveTestimonial(i)}
                            className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${i === activeTestimonial ? 'bg-brand-600 w-8' : 'bg-slate-300 hover:bg-slate-400'}`} 
                          />
                      ))}
                  </div>
              </div>
          </div>
      </div>

      {/* --- PRICING --- */}
      <div className="py-24 bg-slate-900 text-white relative overflow-hidden" id="pricing">
          {/* Background decoration */}
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 opacity-20">
              <div className="absolute -top-1/2 -left-1/2 w-[1000px] h-[1000px] bg-brand-600 rounded-full blur-[120px]"></div>
              <div className="absolute bottom-0 right-0 w-[800px] h-[800px] bg-purple-900 rounded-full blur-[100px]"></div>
          </div>

          <div className="max-w-7xl mx-auto px-6 relative z-10">
              <div className="text-center mb-16">
                  <h2 className="text-3xl md:text-4xl font-black mb-4">Pay As You Go. No Subscriptions.</h2>
                  <p className="text-slate-400 mb-8 max-w-2xl mx-auto">Purchase credits using Telebirr, CBE, or Card. Credits never expire.</p>
                  
                  <div className="inline-flex items-center p-1 bg-slate-800/80 backdrop-blur rounded-lg border border-slate-700">
                      {(['USD', 'EUR', 'ETB'] as Currency[]).map(curr => (
                          <button
                            key={curr}
                            onClick={() => setCurrency(curr)}
                            className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${
                                currency === curr 
                                ? 'bg-brand-600 text-white shadow' 
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                              {curr}
                          </button>
                      ))}
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {PRICING_TIERS.map((plan, idx) => (
                      <div key={idx} className={`relative bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border flex flex-col transition-transform duration-300 hover:-translate-y-2 ${plan.popular ? 'border-brand-500 shadow-[0_0_40px_rgba(14,165,233,0.15)]' : 'border-slate-700'}`}>
                          {plan.popular && (
                              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-brand-500 to-brand-400 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wide shadow-lg">
                                  Best Value
                              </div>
                          )}
                          <div className="mb-4">
                              <h3 className="text-lg font-bold">{plan.title}</h3>
                              <div className="flex items-baseline gap-1 mt-2">
                                  <span className="text-4xl font-black animate-in fade-in">
                                      {getPriceDisplay(plan.prices)}
                                  </span>
                              </div>
                              <div className="mt-2 inline-block bg-white/10 px-3 py-1 rounded text-xs font-bold text-brand-300">
                                  {plan.credits} Credits
                              </div>
                          </div>
                          <ul className="space-y-4 mb-8 flex-1">
                              {plan.features.map((feat, fIdx) => (
                                  <li key={fIdx} className="flex items-center text-sm text-slate-300">
                                      <Check className="w-4 h-4 text-green-400 mr-3 flex-shrink-0" /> {feat}
                                  </li>
                              ))}
                          </ul>
                          <button onClick={onLogin} className={`w-full py-3 rounded-xl font-bold transition-all ${plan.popular ? 'bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-500/25' : 'bg-slate-700 hover:bg-slate-600 text-white'}`}>
                              Get Started
                          </button>
                      </div>
                  ))}
              </div>
          </div>
      </div>

      {/* --- FAQ --- */}
      <div className="py-24 bg-white">
          <div className="max-w-3xl mx-auto px-6">
              <h2 className="text-3xl font-black text-center text-slate-900 mb-12">Frequently Asked Questions</h2>
              <div className="space-y-4">
                  {FAQS.map((faq, idx) => (
                      <div key={idx} className="border border-slate-200 rounded-xl overflow-hidden">
                          <button 
                              onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                              className="w-full flex justify-between items-center p-5 text-left bg-slate-50 hover:bg-slate-100 transition-colors"
                          >
                              <span className="font-bold text-slate-800">{faq.q}</span>
                              <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${openFaq === idx ? 'rotate-180' : ''}`} />
                          </button>
                          {openFaq === idx && (
                              <div className="p-5 text-sm text-slate-600 leading-relaxed bg-white border-t border-slate-200 animate-in slide-in-from-top-2">
                                  {faq.a}
                              </div>
                          )}
                      </div>
                  ))}
              </div>
          </div>
      </div>
      
      {/* Footer */}
       <div className="bg-slate-950 border-t border-slate-900 py-12">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                    <Logo className="w-6 h-6 text-slate-600" />
                    <span className="text-white font-bold text-lg">ConstructAI</span>
                </div>
                <p className="text-xs text-slate-500">© 2025 ConstructAI Solutions. Addis Ababa, Ethiopia.</p>
                <div className="mt-2 flex items-center justify-center md:justify-start text-xs text-slate-500">
                    <MapPin className="w-3 h-3 mr-1" /> Bole, Addis Ababa
                </div>
            </div>
            <div className="flex flex-wrap justify-center gap-8">
                <button onClick={() => setShowTerms(true)} className="text-xs text-slate-500 hover:text-brand-400 transition-colors">Terms</button>
                <button onClick={() => setShowPrivacy(true)} className="text-xs text-slate-500 hover:text-brand-400 transition-colors">Privacy</button>
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-slate-500 hover:text-[#25D366] transition-colors">Contact Support</a>
            </div>
        </div>
      </div>

      {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}
      {showPrivacy && <PrivacyModal onClose={() => setShowPrivacy(false)} />}
    </div>
  );
};
