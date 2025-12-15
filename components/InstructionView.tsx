
import React, { useState, useEffect } from 'react';
import { MessageSquarePlus, ChevronRight, CheckSquare, Square, Grid, Ruler, Layers, ArrowDownToLine, Globe, FolderOpen, CalendarClock, ListTree, Trello, Calendar, Clock, Briefcase, HardHat, RotateCw } from 'lucide-react';
import { AppMode } from '../types';

interface InstructionViewProps {
  fileName: string;
  onStart: (
    instructions: string, 
    scopes: string[], 
    includeRebar: boolean, 
    floorCount: number, 
    basementCount: number, 
    storyHeight: number, 
    unitSystem: 'metric' | 'imperial', 
    scheduleDetailLevel: 'master' | 'detail' | 'reschedule',
    projectType: 'building' | 'infrastructure' | 'interior',
    calendarSettings: {
        workingDays: string[];
        hoursPerDay: number;
        holidays: string;
    }
  ) => void;
  onCancel: () => void;
  appMode: AppMode;
}

const SUGGESTIONS = [
  "Use Trench Fill Foundation methodology",
  "Calculate for Deep Strip Foundations",
  "Assume Raft Foundation with 200mm slab",
  "Ignore external landscaping works"
];

const SCHEDULE_SUGGESTIONS = [
  "Fast-track schedule with 6 day work week",
  "Include 2 weeks for site mobilization",
  "Assume concurrent finishing works",
  "Target completion within 12 months"
];

// Granular Scopes grouped by Category
const SCOPE_GROUPS = [
  {
    title: "General & Civil",
    items: [
      { id: 'Preliminaries', label: 'Preliminaries', desc: 'Site Setup, Mobilization, Survey' },
      { id: 'Demolition', label: 'Demolition / Clearance', desc: 'Site clearing, tree removal' },
      { id: 'Earthworks', label: 'Earthworks', desc: 'Excavation, Filling, Dredging' },
      { id: 'ExternalWorks', label: 'Landscaping / Paving', desc: 'Roads, paths, softscaping' }
    ]
  },
  {
    title: "Structural / Heavy Civil",
    items: [
      { id: 'Foundations', label: 'Foundations / Piling', desc: 'Footings, Sheet Piles' },
      { id: 'Concrete', label: 'Concrete Works', desc: 'Beams, Slabs, Retaining Walls' },
      { id: 'Steelwork', label: 'Structural Steel', desc: 'Frames, Trusses, Bridges' },
      { id: 'RiverWorks', label: 'River/Marine Works', desc: 'Gabions, Revetments, Check Dams' }, 
    ]
  },
  {
    title: "Architectural & Finishes",
    items: [
      { id: 'Walls_Masonry', label: 'Masonry Walls', desc: 'Brick/Block Partitions' },
      { id: 'Facade', label: 'Facade / Cladding', desc: 'Glass, Stone, Curtain Wall' },
      { id: 'Flooring', label: 'Finishes', desc: 'Flooring, Ceiling, Painting' },
      { id: 'Joinery', label: 'Joinery', desc: 'Doors, Windows, Cabinetry' },
    ]
  },
  {
    title: "MEP Services",
    items: [
      { id: 'Electrical', label: 'Electrical', desc: 'Lighting, Power, Data' },
      { id: 'Plumbing', label: 'Plumbing / Drainage', desc: 'Water, Sanitary, Stormwater' },
      { id: 'Mechanical', label: 'Mechanical', desc: 'HVAC, Ventilation' },
      { id: 'InfraUtilities', label: 'Infrastructure Utilities', desc: 'Main lines, Manholes, Street Lights' },
    ]
  }
];

export const InstructionView: React.FC<InstructionViewProps> = ({ fileName, onStart, onCancel, appMode }) => {
  const [instructions, setInstructions] = useState('');
  
  // Project Type
  const [projectType, setProjectType] = useState<'building' | 'infrastructure' | 'interior'>('building');

  // Building Parameters
  const [floorCount, setFloorCount] = useState(1);
  const [basementCount, setBasementCount] = useState(0);
  const [storyHeight, setStoryHeight] = useState(3.0);
  const [unitSystem, setUnitSystem] = useState<'metric' | 'imperial'>('metric');
  
  // Schedule Specific
  const [scheduleDetailLevel, setScheduleDetailLevel] = useState<'master' | 'detail' | 'reschedule'>('master');
  
  // Calendar Settings
  const [workingDays, setWorkingDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const [hoursPerDay, setHoursPerDay] = useState(8);
  const [holidays, setHolidays] = useState('');

  // Default to selecting major structural elements including Formwork
  const [selectedScopes, setSelectedScopes] = useState<string[]>([
    'Preliminaries', 'Earthworks', 'Foundations', 'Concrete', 'RiverWorks'
  ]);
  
  const [includeRebar, setIncludeRebar] = useState(false);

  const isScheduling = appMode === AppMode.SCHEDULING;
  const isRescheduling = appMode === AppMode.RESCHEDULING;

  // Auto-select relevant scopes when Project Type changes
  useEffect(() => {
    if (projectType === 'infrastructure') {
      setSelectedScopes(['Preliminaries', 'Earthworks', 'RiverWorks', 'InfraUtilities', 'Concrete']);
    } else if (projectType === 'interior') {
      setSelectedScopes(['Flooring', 'Walls_Masonry', 'Joinery', 'Electrical', 'Plumbing']);
    } else {
      // Building Default
      setSelectedScopes(['Preliminaries', 'Earthworks', 'Foundations', 'Concrete', 'Facade']);
    }
  }, [projectType]);

  const handleSuggestionClick = (text: string) => {
    setInstructions(prev => prev ? `${prev}\n${text}` : text);
  };

  const toggleScope = (id: string) => {
    setSelectedScopes(prev => 
      prev.includes(id) 
        ? prev.filter(s => s !== id)
        : [...prev, id]
    );
  };

  const toggleAllInGroup = (groupIndex: number) => {
    const groupItems = SCOPE_GROUPS[groupIndex].items.map(i => i.id);
    const allSelected = groupItems.every(id => selectedScopes.includes(id));

    if (allSelected) {
      setSelectedScopes(prev => prev.filter(id => !groupItems.includes(id)));
    } else {
      setSelectedScopes(prev => [...Array.from(new Set([...prev, ...groupItems]))]);
    }
  };

  const handleUnitChange = (sys: 'metric' | 'imperial') => {
      setUnitSystem(sys);
      if (sys === 'imperial') {
          if (storyHeight === 3.0) setStoryHeight(10.0); // Approx 3m -> 10ft
      } else {
          if (storyHeight === 10.0) setStoryHeight(3.0);
      }
  };

  const toggleDay = (day: string) => {
      setWorkingDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  return (
    <div className="w-full max-w-6xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col md:flex-row h-[85vh]">
      
      {/* Left: Configuration */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 px-8 py-6 flex-shrink-0 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center">
                {isRescheduling ? (
                    <RotateCw className="w-5 h-5 mr-2 text-amber-600" />
                ) : isScheduling ? (
                    <CalendarClock className="w-5 h-5 mr-2 text-brand-600" />
                ) : (
                    <FolderOpen className="w-5 h-5 mr-2 text-brand-600" />
                )}
                {isRescheduling ? "Reschedule Optimization" : (isScheduling ? "Schedule Configuration" : "Custom Takeoff Configuration")}
            </h2>
            <p className="text-slate-500 text-sm mt-1">
                Analyzing <strong>{fileName}</strong>. {isRescheduling ? "Configure recovery parameters." : (isScheduling ? "Define timeline parameters." : "Select elements to measure.")}
            </p>
          </div>
          <div className="flex bg-white border border-slate-200 rounded-lg p-1">
             <button 
                onClick={() => handleUnitChange('metric')}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${unitSystem === 'metric' ? 'bg-brand-600 text-white' : 'text-slate-500'}`}
             >
                Metric (m)
             </button>
             <button 
                onClick={() => handleUnitChange('imperial')}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${unitSystem === 'imperial' ? 'bg-brand-600 text-white' : 'text-slate-500'}`}
             >
                Imperial (ft)
             </button>
          </div>
        </div>

        <div className="p-8 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
          
          {/* Project Type Definition */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide mb-4 flex items-center">
              <Layers className="w-4 h-4 mr-2 text-brand-500" />
              Project Context
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <button 
                    onClick={() => setProjectType('building')}
                    className={`p-3 rounded-lg border text-left transition-all ${projectType === 'building' ? 'bg-brand-50 border-brand-500 ring-1 ring-brand-500' : 'bg-white border-slate-200 hover:border-brand-300'}`}
                >
                    <div className="font-bold text-sm text-slate-800 flex items-center mb-1"><Briefcase className="w-3.5 h-3.5 mr-2" /> Building Construction</div>
                    <p className="text-[10px] text-slate-500">Vertical structures, Multi-story, Villas, Commercial.</p>
                </button>
                <button 
                    onClick={() => setProjectType('infrastructure')}
                    className={`p-3 rounded-lg border text-left transition-all ${projectType === 'infrastructure' ? 'bg-brand-50 border-brand-500 ring-1 ring-brand-500' : 'bg-white border-slate-200 hover:border-brand-300'}`}
                >
                    <div className="font-bold text-sm text-slate-800 flex items-center mb-1"><HardHat className="w-3.5 h-3.5 mr-2" /> Civil / Infrastructure</div>
                    <p className="text-[10px] text-slate-500">Roads, Rivers, Bridges, Dams, Utilities.</p>
                </button>
                <button 
                    onClick={() => setProjectType('interior')}
                    className={`p-3 rounded-lg border text-left transition-all ${projectType === 'interior' ? 'bg-brand-50 border-brand-500 ring-1 ring-brand-500' : 'bg-white border-slate-200 hover:border-brand-300'}`}
                >
                    <div className="font-bold text-sm text-slate-800 flex items-center mb-1"><Grid className="w-3.5 h-3.5 mr-2" /> Interior / Fit-out</div>
                    <p className="text-[10px] text-slate-500">Renovations, Decor, Finishing works.</p>
                </button>
            </div>

            {projectType === 'building' && (
                <div className="grid grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-2">
                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5 flex items-center">
                    <ArrowDownToLine className="w-3 h-3 mr-1" /> Basements
                    </label>
                    <div className="relative">
                    <input 
                        type="number" 
                        min={0} 
                        max={10}
                        value={basementCount}
                        onChange={(e) => setBasementCount(parseInt(e.target.value) || 0)}
                        className="w-full pl-3 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    />
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Floors (Above Ground)</label>
                    <div className="relative">
                    <input 
                        type="number" 
                        min={1} 
                        max={100}
                        value={floorCount}
                        onChange={(e) => setFloorCount(parseInt(e.target.value) || 1)}
                        className="w-full pl-3 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    />
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Avg. Story Height</label>
                    <div className="relative">
                    <input 
                        type="number" 
                        step={0.1}
                        value={storyHeight}
                        onChange={(e) => setStoryHeight(parseFloat(e.target.value) || (unitSystem === 'metric' ? 3.0 : 10.0))}
                        className="w-full pl-3 pr-8 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                        {unitSystem === 'metric' ? 'm' : 'ft'}
                    </span>
                    </div>
                </div>
                </div>
            )}
            
            {projectType === 'infrastructure' && (
                 <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-xs text-blue-800 animate-in fade-in">
                     <strong>Note:</strong> For Civil Works (River, Roads), the system will focus on linear length, earthwork volumes (cut/fill), and protection works rather than vertical floors.
                 </div>
            )}
          </div>

          {/* CALENDAR SETTINGS (Only for Schedule/Reschedule Mode) */}
          {(isScheduling || isRescheduling) && (
             <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide mb-4 flex items-center">
                   <Calendar className="w-4 h-4 mr-2 text-brand-500" />
                   Working Calendar
                </h3>
                
                <div className="mb-4">
                    <label className="block text-xs font-bold text-slate-500 mb-2">Working Days</label>
                    <div className="flex space-x-2">
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                            <button
                                key={day}
                                onClick={() => toggleDay(day)}
                                className={`w-10 h-10 rounded-full text-xs font-bold flex items-center justify-center transition-all ${
                                    workingDays.includes(day) 
                                    ? 'bg-brand-600 text-white shadow-sm' 
                                    : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                                }`}
                            >
                                {day[0]}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-2 flex items-center">
                            <Clock className="w-3.5 h-3.5 mr-1" /> Hours Per Day
                        </label>
                        <select 
                           value={hoursPerDay}
                           onChange={(e) => setHoursPerDay(parseInt(e.target.value))}
                           className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                        >
                            <option value="8">8 Hours (Standard)</option>
                            <option value="9">9 Hours</option>
                            <option value="10">10 Hours (Overtime)</option>
                            <option value="12">12 Hours (Shift)</option>
                            <option value="24">24 Hours (Double Shift)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-2">Non-Working Days / Holidays</label>
                        <input 
                           type="text"
                           placeholder="e.g. Christmas, New Year, Public Holidays"
                           value={holidays}
                           onChange={(e) => setHolidays(e.target.value)}
                           className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                        />
                    </div>
                </div>
             </div>
          )}

          {/* SCHEDULE LEVEL SELECTOR - ONLY FOR NORMAL SCHEDULING */}
          {isScheduling && (
             <div className="bg-brand-50 rounded-xl border border-brand-100 p-5 shadow-sm">
                <h3 className="font-bold text-brand-800 text-sm uppercase tracking-wide mb-4 flex items-center">
                   <CalendarClock className="w-4 h-4 mr-2" />
                   Schedule Level of Detail
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <button 
                      onClick={() => setScheduleDetailLevel('master')}
                      className={`relative p-4 rounded-lg border text-left transition-all ${
                          scheduleDetailLevel === 'master' 
                          ? 'bg-white border-brand-500 ring-1 ring-brand-500 shadow-sm' 
                          : 'bg-white/50 border-transparent hover:bg-white hover:border-brand-200'
                      }`}
                   >
                       <div className="flex items-center mb-2">
                           <Trello className={`w-5 h-5 mr-2 ${scheduleDetailLevel === 'master' ? 'text-brand-600' : 'text-slate-400'}`} />
                           <span className={`font-bold text-sm ${scheduleDetailLevel === 'master' ? 'text-brand-900' : 'text-slate-600'}`}>Master / Strategic</span>
                       </div>
                       <p className="text-xs text-slate-500 leading-relaxed">
                           Groups major phases. Best for high-level planning.
                       </p>
                   </button>

                   <button 
                      onClick={() => setScheduleDetailLevel('detail')}
                      className={`relative p-4 rounded-lg border text-left transition-all ${
                          scheduleDetailLevel === 'detail' 
                          ? 'bg-white border-brand-500 ring-1 ring-brand-500 shadow-sm' 
                          : 'bg-white/50 border-transparent hover:bg-white hover:border-brand-200'
                      }`}
                   >
                       <div className="flex items-center mb-2">
                           <ListTree className={`w-5 h-5 mr-2 ${scheduleDetailLevel === 'detail' ? 'text-brand-600' : 'text-slate-400'}`} />
                           <span className={`font-bold text-sm ${scheduleDetailLevel === 'detail' ? 'text-brand-900' : 'text-slate-600'}`}>Construction Detail</span>
                       </div>
                       <p className="text-xs text-slate-500 leading-relaxed">
                           Detailed WBS, Tasks, Dependencies & Resources.
                       </p>
                   </button>
                </div>
             </div>
          )}

          {/* Granular Scope Selector */}
          <div>
            <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide mb-4">
              {isScheduling || isRescheduling ? "Included Works (For Schedule)" : "Included Scopes (For Takeoff)"}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {SCOPE_GROUPS.map((group, gIdx) => (
                <div key={gIdx} className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide">{group.title}</h3>
                    <button 
                      onClick={() => toggleAllInGroup(gIdx)}
                      className="text-xs text-brand-600 hover:text-brand-700 font-medium"
                    >
                      Toggle All
                    </button>
                  </div>
                  <div className="space-y-2">
                    {group.items.map((item) => {
                      const isSelected = selectedScopes.includes(item.id);
                      return (
                        <button
                          key={item.id}
                          onClick={() => toggleScope(item.id)}
                          className={`w-full flex items-center space-x-3 p-2 rounded-lg text-left transition-all duration-200 border ${
                            isSelected 
                              ? 'bg-brand-50 border-brand-200 shadow-sm' 
                              : 'bg-white border-transparent hover:bg-slate-50'
                          }`}
                        >
                          <div className={`flex-shrink-0 ${isSelected ? 'text-brand-600' : 'text-slate-300'}`}>
                            {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                          </div>
                          <div>
                            <span className="block text-sm font-medium text-slate-900">
                              {item.label}
                            </span>
                            <span className="block text-xs text-slate-400">{item.desc}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rebar Option - HIDE IN SCHEDULE MODE */}
          {!isScheduling && !isRescheduling && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex items-start space-x-3">
                  <button 
                    onClick={() => setIncludeRebar(!includeRebar)}
                    className={`mt-1 flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                      includeRebar ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-slate-300'
                    }`}
                  >
                    {includeRebar && <CheckSquare className="w-3.5 h-3.5" />}
                  </button>
                  <div onClick={() => setIncludeRebar(!includeRebar)} className="cursor-pointer">
                    <span className="block text-sm font-bold text-slate-800 flex items-center">
                      <Grid className="w-4 h-4 mr-2 text-slate-500" />
                      Generate Rebar Schedule
                    </span>
                    <p className="text-xs text-slate-500 mt-1">
                      Only select this if the uploaded file contains <strong>Structural Reinforcement Details</strong>. 
                    </p>
                  </div>
                </div>
              </div>
          )}

          {/* Text Instructions */}
          <div>
            <label className="block text-sm font-bold text-slate-900 mb-2 uppercase tracking-wide">
              {isRescheduling ? "Recovery Instructions" : "Specific Instructions"}
            </label>
            <textarea
              className="w-full h-24 p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none text-slate-800 placeholder:text-slate-400 text-sm"
              placeholder={isRescheduling ? "E.g., 'Compress timeline by 20%', 'Prioritize finishing works', 'Saturday is now a working day'..." : (isScheduling ? "E.g., 'Work week is 6 days', 'Start date is next Monday'..." : "E.g., 'Exclude the garage area', 'Use C25 concrete for all slabs'...")}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {(isScheduling || isRescheduling ? SCHEDULE_SUGGESTIONS : SUGGESTIONS).map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="text-xs bg-slate-100 hover:bg-brand-50 hover:text-brand-700 text-slate-600 px-3 py-1.5 rounded-md border border-slate-200 transition-colors flex items-center"
                >
                  <MessageSquarePlus className="w-3 h-3 mr-1.5" />
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-slate-50 px-8 py-4 border-t border-slate-200 flex justify-between items-center flex-shrink-0">
          <button
            onClick={onCancel}
            className="text-slate-500 hover:text-slate-800 text-sm font-medium px-4 py-2"
          >
            Cancel
          </button>
          <button
            onClick={() => onStart(
                instructions, 
                selectedScopes, 
                includeRebar, 
                floorCount, 
                basementCount, 
                storyHeight, 
                unitSystem, 
                scheduleDetailLevel,
                projectType,
                { workingDays, hoursPerDay, holidays }
            )}
            disabled={selectedScopes.length === 0}
            className={`px-6 py-2.5 rounded-lg font-medium flex items-center shadow-sm transition-all ${
              selectedScopes.length === 0 
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : 'bg-brand-600 hover:bg-brand-700 text-white hover:shadow-md'
            }`}
          >
            <span>{isRescheduling ? "Start Optimization" : (isScheduling ? "Generate Schedule" : "Start Analysis")}</span>
            <ChevronRight className="w-4 h-4 ml-2" />
          </button>
        </div>
      </div>
    </div>
  );
};
