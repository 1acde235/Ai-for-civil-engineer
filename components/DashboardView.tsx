
import React, { useRef, useMemo } from 'react';
import { TakeoffResult, AppMode } from '../types';
import { PlusCircle, Trash2, ChevronRight, FolderOpen, Layers, Lock, Unlock, ArrowLeft, BookOpen, Calculator, FileCheck, CalendarClock, Download, Upload, TrendingUp, Archive, PlayCircle } from 'lucide-react';

interface DashboardViewProps {
  projects: TakeoffResult[];
  onNewProject: () => void;
  onOpenProject: (project: TakeoffResult) => void;
  onDeleteProject: (id: string) => void;
  onBack: () => void;
  onOpenGuide: () => void;
  onExportBackup?: () => void; 
  onImportBackup?: (file: File) => void;
  onLoadSample?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ projects, onNewProject, onOpenProject, onDeleteProject, onBack, onOpenGuide, onExportBackup, onImportBackup, onLoadSample }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
      fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0 && onImportBackup) {
          onImportBackup(e.target.files[0]);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Calculate Dashboard Stats
  const stats = useMemo(() => {
      let totalEst = 0;
      let active = 0;
      let completed = 0;

      projects.forEach(p => {
          if (p.isPaid) completed++; else active++;
          // Estimate project value based on sum of quantities (rough heuristic for display)
          // In real app, we'd persist the estimated total value
          if (p.items) {
              const projTotal = p.items.reduce((acc, i) => acc + (i.quantity * (i.estimatedRate || 0)), 0);
              totalEst += projTotal;
          }
      });

      return { totalEst, active, completed };
  }, [projects]);

  return (
    <div className="flex-1 flex flex-col max-w-7xl mx-auto w-full p-6 md:p-10 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-slate-200 pb-6">
        <div className="flex items-center">
          <button 
            onClick={onBack}
            className="mr-4 p-2 -ml-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-all"
            title="Back to Landing Page"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center uppercase tracking-wide">
              <FolderOpen className="w-6 h-6 mr-3 text-slate-400" />
              Project Hub
            </h1>
            <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-bold">Workspace: Default</p>
          </div>
        </div>
        
        {/* ACTION BUTTONS */}
        <div className="flex items-center gap-3 flex-wrap md:flex-nowrap">
            {/* Backup/Restore Controls */}
            <div className="flex items-center bg-white border border-slate-200 rounded-md p-1 mr-2 shadow-sm">
                <button 
                    onClick={onExportBackup}
                    className="flex items-center px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded transition-colors"
                    title="Download Backup"
                >
                    <Download className="w-3.5 h-3.5 mr-2" /> Backup
                </button>
                <div className="w-px h-4 bg-slate-200 mx-1"></div>
                <button 
                    onClick={handleImportClick}
                    className="flex items-center px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded transition-colors"
                    title="Restore from File"
                >
                    <Upload className="w-3.5 h-3.5 mr-2" /> Restore
                </button>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept=".cai,.json" 
                    onChange={handleFileChange}
                />
            </div>

            <button 
                onClick={onOpenGuide}
                className="text-slate-500 hover:text-brand-600 font-bold text-sm flex items-center px-4 py-2.5 rounded-md hover:bg-slate-100 transition-colors"
            >
                <BookOpen className="w-4 h-4 mr-2" />
                Guide
            </button>
            <button 
            onClick={onNewProject}
            className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-md font-bold text-sm flex items-center shadow-md transition-all hover:translate-y-[-1px]"
            >
            <PlusCircle className="w-4 h-4 mr-2" />
            New Estimation
            </button>
        </div>
      </div>

      {/* SUPERIOR STATS BAR */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Estimated Value</div>
                  <div className="text-2xl font-black text-slate-900">
                      {stats.totalEst > 0 ? `~${(stats.totalEst / 1000000).toFixed(1)}M` : '0'} 
                      <span className="text-xs font-medium text-slate-400 ml-1">ETB</span>
                  </div>
              </div>
              <div className="p-3 bg-green-50 rounded-full text-green-600">
                  <TrendingUp className="w-6 h-6" />
              </div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Active Projects</div>
                  <div className="text-2xl font-black text-slate-900">{stats.active}</div>
              </div>
              <div className="p-3 bg-brand-50 rounded-full text-brand-600">
                  <FolderOpen className="w-6 h-6" />
              </div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Unlocked / Delivered</div>
                  <div className="text-2xl font-black text-slate-900">{stats.completed}</div>
              </div>
              <div className="p-3 bg-purple-50 rounded-full text-purple-600">
                  <Archive className="w-6 h-6" />
              </div>
          </div>
      </div>

      {/* Project Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* SAMPLE PROJECT CARD (Always visible for onboarding) */}
          <div 
              onClick={onLoadSample}
              className="group bg-gradient-to-br from-brand-50 to-white rounded-lg border-2 border-dashed border-brand-300 hover:border-brand-500 hover:shadow-lg transition-all cursor-pointer relative overflow-hidden flex flex-col min-h-[200px]"
          >
              <div className="p-6 flex-1 flex flex-col justify-center items-center text-center">
                  <div className="p-3 bg-brand-100 rounded-full text-brand-600 mb-3 group-hover:scale-110 transition-transform">
                      <PlayCircle className="w-8 h-8" />
                  </div>
                  <h3 className="text-base font-bold text-brand-800 mb-1">
                      Load Sample Project
                  </h3>
                  <p className="text-xs text-brand-600/70 max-w-[200px]">
                      Explore a pre-loaded G+1 Villa to see the full capabilities of ConstructAI instantly.
                  </p>
              </div>
          </div>

          {projects.map((project) => (
            <div 
              key={project.id || Math.random().toString()} 
              className="group bg-white rounded-lg border border-slate-300 hover:border-brand-400 hover:shadow-lg transition-all cursor-pointer relative overflow-hidden flex flex-col"
              onClick={() => onOpenProject(project)}
            >
              {/* Status Strip */}
              <div className={`h-1.5 w-full transition-colors ${project.isPaid ? 'bg-green-500' : 'bg-amber-500'}`}></div>
              
              <div className="p-5 flex-1">
                  <div className="flex justify-between items-start mb-3">
                    <div className={`p-2 rounded-md border text-slate-600 ${
                        project.appMode === AppMode.SCHEDULING ? 'bg-purple-50 border-purple-200 text-purple-600' :
                        project.appMode === AppMode.PAYMENT ? 'bg-green-50 border-green-200 text-green-600' :
                        'bg-slate-100 border-slate-200'
                    }`}>
                      {project.appMode === AppMode.SCHEDULING ? <CalendarClock className="w-5 h-5" /> :
                       project.appMode === AppMode.PAYMENT ? <FileCheck className="w-5 h-5" /> : 
                       <Calculator className="w-5 h-5" />
                      }
                    </div>
                    <div className="flex items-center space-x-2">
                        {project.isPaid ? (
                            <div className="text-green-500 bg-green-50 p-1.5 rounded-full" title="Project Unlocked"><Unlock className="w-3.5 h-3.5" /></div>
                        ) : (
                            <div className="text-amber-500 bg-amber-50 p-1.5 rounded-full" title="Locked"><Lock className="w-3.5 h-3.5" /></div>
                        )}
                        <button 
                          onClick={(e) => { e.stopPropagation(); onDeleteProject(project.id!); }}
                          className="text-slate-300 hover:text-red-500 p-1 transition-colors"
                          title="Delete Project"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 mb-1 line-clamp-1 group-hover:text-brand-700 transition-colors">
                    {project.projectName}
                  </h3>
                  <div className="flex items-center text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-4">
                    Ref: {project.id ? project.id.substring(0,8) : 'N/A'}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs border-t border-slate-100 pt-3">
                     <div>
                        <span className="block text-slate-400 text-[10px] uppercase">
                            {project.appMode === AppMode.SCHEDULING ? 'Tasks' : 'Items'}
                        </span>
                        <span className="font-mono font-bold text-slate-700">
                            {project.appMode === AppMode.SCHEDULING ? project.scheduleItems?.length || 0 : project.items.length}
                        </span>
                     </div>
                     <div>
                        <span className="block text-slate-400 text-[10px] uppercase">Last Mod</span>
                        <span className="font-mono font-bold text-slate-700">{new Date(project.date || Date.now()).toLocaleDateString()}</span>
                     </div>
                  </div>
              </div>

              <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex justify-between items-center group-hover:bg-brand-50/30 transition-colors">
                 <span className="text-[10px] font-bold text-slate-500 uppercase">
                    Open File
                 </span>
                 <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-brand-500 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};
