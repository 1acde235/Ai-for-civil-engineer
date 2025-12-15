
import React, { useMemo, useState, useEffect } from 'react';
import { TakeoffResult, ScheduleTask } from '../types';
import { Download, Calendar, ArrowLeft, AlertTriangle, Lock, Maximize2, Minimize2, MoreHorizontal, ChevronRight, ChevronDown, Clock, ArrowRight, RotateCw, Trello, ListTree, UploadCloud, X } from 'lucide-react';
import * as XLSX from 'xlsx';

interface SchedulingViewProps {
  data: TakeoffResult;
  onBack: () => void;
  isLocked: boolean;
  onUnlock: () => void;
  onReschedule?: () => void;
  onQuickReschedule?: (mode: 'master' | 'detail') => void;
}

// MS Project Style Constants
const DAY_WIDTH = 24; 
const ROW_HEIGHT = 32; 
const COLS = {
  id: 80, 
  info: 30,
  name: 300, 
  dur: 80,
  start: 110,
  end: 110,
  cost: 100,
  pred: 80,
  res: 150
};

const TOTAL_TABLE_WIDTH = Object.values(COLS).reduce((a, b) => a + b, 0);

export const SchedulingView: React.FC<SchedulingViewProps> = ({ data, onBack, isLocked, onUnlock, onReschedule, onQuickReschedule }) => {
  // Local state for tasks to allow editing dates/structure
  const [localTasks, setLocalTasks] = useState<ScheduleTask[]>([]);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [showRescheduleMenu, setShowRescheduleMenu] = useState(false);

  // Initialize local tasks from props
  useEffect(() => {
      if (data.scheduleItems) {
          // Sort initially
          const sorted = [...data.scheduleItems].sort((a, b) => {
            const partsA = (a.taskId || "").toString().split('.').map(n => parseFloat(n) || 0);
            const partsB = (b.taskId || "").toString().split('.').map(n => parseFloat(n) || 0);
            for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
                const valA = partsA[i] || 0;
                const valB = partsB[i] || 0;
                if (valA !== valB) return valA - valB;
            }
            return 0;
          });
          setLocalTasks(sorted);
      }
  }, [data.scheduleItems]);

  // 1. Determine Project Bounds (Dynamic)
  const projectStart = useMemo(() => {
    if (!localTasks.length) return new Date();
    let min = new Date(8640000000000000); // Max Date
    let found = false;
    localTasks.forEach(t => {
        const d = new Date(t.startDate);
        if (!isNaN(d.getTime()) && d < min) {
            min = d;
            found = true;
        }
    });
    return found ? min : new Date();
  }, [localTasks]);

  const projectEnd = useMemo(() => {
      if (!localTasks.length) return new Date();
      let max = new Date(-8640000000000000); // Min Date
      let found = false;
      localTasks.forEach(t => {
          const d = new Date(t.endDate);
          if (!isNaN(d.getTime()) && d > max) {
              max = d;
              found = true;
          }
      });
      return found ? max : new Date();
  }, [localTasks]);

  const viewStartDate = new Date(projectStart);
  if (!isNaN(viewStartDate.getTime())) {
     viewStartDate.setDate(viewStartDate.getDate() - 7); // Buffer start
  }
  
  const projectDurationDays = useMemo(() => {
      if (isNaN(projectStart.getTime()) || isNaN(projectEnd.getTime())) return 0;
      const diffTime = Math.abs(projectEnd.getTime() - projectStart.getTime());
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  }, [projectStart, projectEnd]);
  
  let totalDays = 60;
  if (!isNaN(projectEnd.getTime()) && !isNaN(viewStartDate.getTime())) {
      totalDays = Math.ceil((projectEnd.getTime() - viewStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 14;
  }

  // 2. Process Tree Structure & Visibility
  const processedTasks = useMemo(() => {
      // Create map for easy parent/child lookup
      const tempMap: Record<string, ScheduleTask & { children: string[] }> = {};
      localTasks.forEach(t => {
          if (t.taskId) tempMap[t.taskId.toString().trim()] = { ...t, children: [] };
      });

      // Build parent-child relationships
      localTasks.forEach(t => {
          if (!t.taskId) return;
          const cleanId = t.taskId.toString().trim();
          const parts = cleanId.split('.');
          if (parts.length > 1) {
             const parentId = parts.slice(0, -1).join('.');
             if (tempMap[parentId]) tempMap[parentId].children.push(cleanId);
          }
      });

      // Recursive cost rollup
      const getTaskCost = (taskId: string): number => {
          const task = tempMap[taskId];
          if (!task) return 0;
          if (task.children.length === 0) return task.totalCost || 0;
          let sum = 0;
          task.children.forEach(childId => sum += getTaskCost(childId));
          return sum;
      };

      const result: (ScheduleTask & { level: number, isSummary: boolean, isVisible: boolean, rolledUpCost: number, hasChildren: boolean })[] = [];
      
      localTasks.forEach((task) => {
          if (!task.taskId) return;
          const cleanId = task.taskId.toString().trim();
          const dots = (cleanId.match(/\./g) || []).length;
          const level = dots;
          const hasChildren = tempMap[cleanId] && tempMap[cleanId].children.length > 0;

          // Determine visibility based on collapsed parents
          let isVisible = true;
          const parts = cleanId.split('.');
          
          // Check all ancestors
          // e.g. for "1.2.1", check "1" and "1.2"
          let currentIdCheck = parts[0];
          for(let i = 0; i < parts.length - 1; i++) {
             if (collapsedIds.has(currentIdCheck)) {
                 isVisible = false;
                 break;
             }
             if (i < parts.length - 2) {
                currentIdCheck += '.' + parts[i+1];
             }
          }

          const rolledUpCost = getTaskCost(cleanId);
          result.push({ ...task, taskId: cleanId, level, isSummary: hasChildren, isVisible, rolledUpCost, hasChildren });
      });
      return result;
  }, [localTasks, collapsedIds]);

  const visibleTasks = processedTasks.filter(t => t.isVisible);

  // 3. Task Geometry
  const taskGeometry = useMemo(() => {
    const map = new Map<string, { x: number, w: number, y: number }>();
    if (isNaN(viewStartDate.getTime())) return map;

    visibleTasks.forEach((t, idx) => {
        const startDiff = (new Date(t.startDate).getTime() - viewStartDate.getTime()) / (1000 * 60 * 60 * 24);
        const duration = Math.max(t.duration, 1);
        const x = Math.floor(startDiff * DAY_WIDTH);
        const w = Math.floor(duration * DAY_WIDTH);
        const y = (idx * ROW_HEIGHT) + (ROW_HEIGHT / 2);
        map.set(t.taskId, { x, w, y });
    });
    return map;
  }, [visibleTasks, viewStartDate]);

  // 4. Dependency Lines
  const dependencyLines = useMemo(() => {
    const lines: React.ReactNode[] = [];
    visibleTasks.forEach(t => {
        if (!t.dependencies) return;
        const target = taskGeometry.get(t.taskId);
        if (!target) return;

        t.dependencies.forEach(depId => {
            const source = taskGeometry.get(depId);
            if (!source) return;

            const x1 = source.x + source.w; 
            const y1 = source.y;
            const x2 = target.x - 8; 
            const y2 = target.y;
            const midX = x1 + 10;
            
            let path = `M ${x1} ${y1} L ${midX} ${y1}`;
            if (x2 < x1) {
                path += ` L ${midX} ${y1 + 10} L ${x2 - 10} ${y1 + 10} L ${x2 - 10} ${y2} L ${x2} ${y2}`;
            } else {
                path += ` L ${midX} ${y2} L ${x2} ${y2}`;
            }

            lines.push(
                <path 
                    key={`${depId}-${t.taskId}`} 
                    d={path} 
                    stroke="#9ca3af" 
                    strokeWidth="1.5" 
                    fill="none" 
                    markerEnd="url(#arrowhead)"
                    className="opacity-60 hover:opacity-100 hover:stroke-black transition-all"
                />
            );
        });
    });
    return lines;
  }, [visibleTasks, taskGeometry]);

  // --- ACTIONS ---

  const toggleCollapse = (taskId: string) => {
      setCollapsedIds(prev => {
          const next = new Set(prev);
          if (next.has(taskId)) next.delete(taskId);
          else next.add(taskId);
          return next;
      });
  };

  const expandAll = () => setCollapsedIds(new Set());
  
  const collapseAll = () => {
      const summaryIds = new Set(processedTasks.filter(t => t.isSummary).map(t => t.taskId));
      setCollapsedIds(summaryIds);
  };

  const handleShiftProject = (newDateStr: string, mode: 'start' | 'end') => {
      const newDate = new Date(newDateStr);
      if (isNaN(newDate.getTime())) return;

      const baseDate = mode === 'start' ? projectStart : projectEnd;
      const diffTime = newDate.getTime() - baseDate.getTime();

      if (diffTime === 0) return;

      const updated = localTasks.map(t => {
          const s = new Date(t.startDate).getTime() + diffTime;
          const e = new Date(t.endDate).getTime() + diffTime;
          return {
              ...t,
              startDate: new Date(s).toISOString().split('T')[0],
              endDate: new Date(e).toISOString().split('T')[0]
          };
      });
      setLocalTasks(updated);
  };

  const handleExport = () => {
    if (isLocked) {
        onUnlock();
        return;
    }
    const wb = XLSX.utils.book_new();
    const rows: any[] = [
        ["Project:", data.projectName],
        ["Start Date:", new Date(projectStart).toLocaleDateString()],
        ["Finish Date:", new Date(projectEnd).toLocaleDateString()],
        ["Total Duration:", `${projectDurationDays} days`],
        [],
        ["ID", "Task Mode", "Task Name", "Duration", "Start", "Finish", "Predecessors", "Resource Names", "Cost"]
    ];

    processedTasks.forEach(t => {
        const indent = "    ".repeat(t.level);
        rows.push([
            t.taskId,
            "Auto Scheduled",
            indent + t.activity,
            `${t.duration} days`,
            new Date(t.startDate).toLocaleDateString(),
            new Date(t.endDate).toLocaleDateString(),
            t.dependencies?.join(', ') || '',
            t.resources,
            t.rolledUpCost || 0
        ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 8 }, { wch: 15 }, { wch: 50 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 30 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, ws, "Project Schedule");
    XLSX.writeFile(wb, `Schedule_${data.projectName.replace(/\s+/g, '_')}.xlsx`);
  };

  const formatDateForInput = (date: Date) => {
      try {
          return date.toISOString().split('T')[0];
      } catch (e) {
          return '';
      }
  };

  const handleMenuAction = (action: 'master' | 'detail' | 'upload') => {
      setShowRescheduleMenu(false);
      if (action === 'upload') {
          if (onReschedule) onReschedule();
      } else {
          if (onQuickReschedule) onQuickReschedule(action);
      }
  };

  return (
    <div className="flex flex-col h-full bg-white font-sans text-xs select-none relative">
       {/* SVG Definitions */}
       <svg style={{ position: 'absolute', width: 0, height: 0 }}>
         <defs>
           <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
             <polygon points="0 0, 6 2, 0 4" fill="#6b7280" />
           </marker>
         </defs>
       </svg>

       {/* TOOLBAR */}
       <div className="bg-[#f3f4f6] border-b border-[#e5e7eb] px-4 py-2 flex justify-between items-center print:hidden h-14 shrink-0 shadow-sm z-50">
          <div className="flex items-center gap-3">
             <button onClick={onBack} className="p-1.5 hover:bg-white rounded border border-transparent hover:border-slate-300 text-slate-500 hover:text-slate-800 transition-all">
                <ArrowLeft className="w-4 h-4" />
             </button>
             <div className="border-l border-slate-300 h-6 mx-1"></div>
             <div>
                <h1 className="font-bold text-slate-800 flex items-center text-sm">
                   <Calendar className="w-4 h-4 mr-2 text-brand-600" />
                   {data.projectName}
                </h1>
                <p className="text-[10px] text-slate-500">Gantt Chart View</p>
             </div>
             
             {/* EDITABLE PROJECT STATS */}
             <div className="hidden md:flex ml-6 space-x-3">
                 <div className="flex items-center bg-white px-2 py-1 rounded border border-slate-200 shadow-sm transition-colors hover:border-brand-300">
                     <Clock className="w-3 h-3 text-slate-400 mr-2" />
                     <div className="flex flex-col">
                         <span className="text-[8px] text-slate-400 uppercase font-bold leading-none mb-0.5">Start Date</span>
                         <input 
                            type="date" 
                            className="text-[10px] font-bold text-slate-700 leading-none bg-transparent border-none p-0 focus:ring-0 cursor-pointer h-3 w-20"
                            value={formatDateForInput(projectStart)}
                            onChange={(e) => handleShiftProject(e.target.value, 'start')}
                         />
                     </div>
                 </div>
                 <ArrowRight className="w-3 h-3 text-slate-300 self-center" />
                 <div className="flex items-center bg-white px-2 py-1 rounded border border-slate-200 shadow-sm transition-colors hover:border-brand-300">
                     <div className="flex flex-col">
                         <span className="text-[8px] text-slate-400 uppercase font-bold leading-none mb-0.5">Finish Date</span>
                         <input 
                            type="date" 
                            className="text-[10px] font-bold text-slate-700 leading-none bg-transparent border-none p-0 focus:ring-0 cursor-pointer h-3 w-20"
                            value={formatDateForInput(projectEnd)}
                            onChange={(e) => handleShiftProject(e.target.value, 'end')}
                         />
                     </div>
                 </div>
                 <div className="flex items-center bg-brand-50 px-2 py-1 rounded border border-brand-200 shadow-sm">
                     <div className="flex flex-col">
                         <span className="text-[8px] text-brand-400 uppercase font-bold leading-none">Duration</span>
                         <span className="text-[10px] font-bold text-brand-700 leading-none">{projectDurationDays} Days</span>
                     </div>
                 </div>
             </div>
          </div>
          <div className="flex items-center space-x-2">
             {onReschedule && (
                 <div className="relative">
                     <button 
                        onClick={() => setShowRescheduleMenu(!showRescheduleMenu)}
                        className={`flex items-center px-3 py-1.5 rounded border text-xs font-bold transition-colors mr-2 shadow-sm ${showRescheduleMenu ? 'bg-brand-50 border-brand-300 text-brand-700' : 'bg-white border-brand-200 text-brand-600 hover:bg-brand-50'}`}
                        title="Reschedule Options"
                     >
                        <RotateCw className={`w-3.5 h-3.5 mr-1.5 ${showRescheduleMenu ? 'animate-spin' : ''}`} />
                        Reschedule
                     </button>
                     
                     {/* RESCHEDULE MODAL */}
                     {showRescheduleMenu && (
                         <>
                             <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setShowRescheduleMenu(false)}></div>
                             <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 p-2 animate-in fade-in zoom-in-95 origin-top-right">
                                 <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 mb-1">Select Strategy</div>
                                 <button 
                                    onClick={() => handleMenuAction('master')}
                                    className="w-full text-left p-3 hover:bg-slate-50 rounded-lg flex items-start transition-colors group"
                                 >
                                     <div className="bg-blue-100 p-2 rounded-md mr-3 text-blue-600 group-hover:bg-blue-200"><Trello className="w-4 h-4" /></div>
                                     <div>
                                         <div className="font-bold text-slate-800 text-sm">Master Schedule</div>
                                         <p className="text-[10px] text-slate-500">High-level phases & milestones only.</p>
                                     </div>
                                 </button>
                                 <button 
                                    onClick={() => handleMenuAction('detail')}
                                    className="w-full text-left p-3 hover:bg-slate-50 rounded-lg flex items-start transition-colors group"
                                 >
                                     <div className="bg-green-100 p-2 rounded-md mr-3 text-green-600 group-hover:bg-green-200"><ListTree className="w-4 h-4" /></div>
                                     <div>
                                         <div className="font-bold text-slate-800 text-sm">Construction Detail</div>
                                         <p className="text-[10px] text-slate-500">WBS, Tasks, Dependencies & Resources.</p>
                                     </div>
                                 </button>
                                 
                                 <div className="border-t border-slate-100 my-2"></div>
                                 
                                 <button 
                                    onClick={() => handleMenuAction('upload')}
                                    className="w-full text-left p-3 hover:bg-slate-50 rounded-lg flex items-center transition-colors text-slate-600 hover:text-brand-600 group"
                                 >
                                     <UploadCloud className="w-4 h-4 mr-3" />
                                     <span className="font-bold text-sm">Upload New File...</span>
                                 </button>
                             </div>
                         </>
                     )}
                 </div>
             )}
             <div className="flex items-center space-x-1 mr-4 bg-white border border-slate-300 rounded p-1">
                <button onClick={expandAll} className="p-1.5 hover:bg-slate-100 rounded text-slate-500 flex items-center transition-colors" title="Expand All Tasks">
                    <Maximize2 className="w-3.5 h-3.5 mr-1" /> <span className="text-[10px] font-bold">Expand</span>
                </button>
                <div className="w-px h-4 bg-slate-200"></div>
                <button onClick={collapseAll} className="p-1.5 hover:bg-slate-100 rounded text-slate-500 flex items-center transition-colors" title="Collapse All Tasks">
                    <Minimize2 className="w-3.5 h-3.5 mr-1" /> <span className="text-[10px] font-bold">Collapse</span>
                </button>
             </div>
             <button 
                onClick={handleExport}
                className={`flex items-center px-4 py-1.5 rounded border shadow-sm text-xs font-bold transition-all ${isLocked ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}
             >
                {isLocked ? <Lock className="w-3 h-3 mr-2" /> : <Download className="w-3 h-3 mr-2" />}
                {isLocked ? "Unlock to Export" : "Export to XML"}
             </button>
          </div>
       </div>

       {/* MAIN SCROLLABLE AREA */}
       <div className="flex-1 overflow-auto relative custom-scrollbar bg-white pb-10">
          <div style={{ width: TOTAL_TABLE_WIDTH + (totalDays * DAY_WIDTH), minWidth: '100%' }}>
             
             {/* HEADER ROW */}
             <div className="sticky top-0 z-30 bg-[#f9fafb] border-b border-slate-300 flex h-[50px]">
                 
                 {/* Table Headers */}
                 <div className="sticky left-0 z-40 bg-[#f3f4f6] flex h-full shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                    <div style={{ width: COLS.id }} className="border-r border-slate-300 flex items-center justify-center font-semibold text-slate-500">ID</div>
                    <div style={{ width: COLS.info }} className="border-r border-slate-300 flex items-center justify-center font-semibold text-slate-500"><AlertTriangle className="w-3 h-3"/></div>
                    <div style={{ width: COLS.name }} className="border-r border-slate-300 flex items-center px-2 font-semibold text-slate-600">Task Name</div>
                    <div style={{ width: COLS.dur }} className="border-r border-slate-300 flex items-center justify-center font-semibold text-slate-600">Duration</div>
                    <div style={{ width: COLS.start }} className="border-r border-slate-300 flex items-center justify-center font-semibold text-slate-600">Start</div>
                    <div style={{ width: COLS.end }} className="border-r border-slate-300 flex items-center justify-center font-semibold text-slate-600">Finish</div>
                    <div style={{ width: COLS.cost }} className="border-r border-slate-300 flex items-center justify-end px-2 font-semibold text-slate-600">Cost</div>
                    <div style={{ width: COLS.pred }} className="border-r border-slate-300 flex items-center justify-center font-semibold text-slate-600">Pred</div>
                    <div style={{ width: COLS.res }} className="border-r border-slate-300 flex items-center px-2 font-semibold text-slate-600">Resources</div>
                 </div>

                 {/* Gantt Timeline Header */}
                 <div className="flex flex-col flex-1 bg-white">
                     {/* Month/Date Row */}
                     <div className="flex h-1/2 border-b border-slate-200">
                         {Array.from({length: Math.ceil(totalDays/7)}).map((_, i) => {
                               const d = new Date(viewStartDate);
                               if (!isNaN(d.getTime())) {
                                  d.setDate(d.getDate() + (i * 7));
                                  return (
                                      <div key={i} className="flex-shrink-0 border-r border-slate-200 px-2 text-[10px] text-slate-600 font-medium flex items-center bg-slate-50" style={{ width: DAY_WIDTH * 7 }}>
                                          {d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })}
                                      </div>
                                  );
                               }
                               return null;
                           })}
                     </div>
                     {/* Day of Week Row */}
                     <div className="flex h-1/2">
                         {Array.from({length: totalDays}).map((_, i) => {
                               const d = new Date(viewStartDate);
                               if (!isNaN(d.getTime())) {
                                  d.setDate(d.getDate() + i);
                                  const dayName = d.toLocaleDateString(undefined, { weekday: 'narrow' });
                                  const isWeekend = dayName === 'S';
                                  return (
                                      <div key={i} className={`flex-shrink-0 border-r border-slate-200 text-[9px] text-slate-400 flex items-center justify-center ${isWeekend ? 'bg-slate-50' : 'bg-white'}`} style={{ width: DAY_WIDTH }}>
                                          {dayName}
                                      </div>
                                  );
                               }
                               return null;
                           })}
                     </div>
                 </div>
             </div>

             {/* TABLE BODY */}
             <div className="relative">
                 {/* Background Grid Lines */}
                 <div className="absolute inset-0 flex pointer-events-none" style={{ paddingLeft: TOTAL_TABLE_WIDTH }}>
                    {Array.from({length: totalDays}).map((_, i) => {
                         const d = new Date(viewStartDate);
                         d.setDate(d.getDate() + i);
                         const dayName = d.toLocaleDateString(undefined, { weekday: 'narrow' });
                         const isWeekend = dayName === 'S';
                        return (
                            <div key={i} className={`h-full border-r border-slate-100 ${isWeekend ? 'bg-slate-50/50' : ''}`} style={{ width: DAY_WIDTH }}></div>
                        );
                    })}
                 </div>

                 {/* Dependency SVG Layer */}
                 <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-10" style={{ marginLeft: TOTAL_TABLE_WIDTH }}>
                     {dependencyLines}
                 </svg>

                 {/* Rows */}
                 {visibleTasks.map((task, idx) => {
                     // Gantt Calculation
                     let startDiff = 0;
                     if (!isNaN(viewStartDate.getTime()) && task.startDate) {
                        startDiff = (new Date(task.startDate).getTime() - viewStartDate.getTime()) / (1000 * 60 * 60 * 24);
                     }
                     
                     const duration = Math.max(task.duration, 1); 
                     const isCritical = task.criticalPath;
                     const barLeft = startDiff * DAY_WIDTH;
                     const barWidth = duration * DAY_WIDTH;
                     
                     // Colors
                     const taskColor = isCritical ? 'bg-red-500' : 'bg-blue-500';
                     const progressWidth = `${Math.min(task.progress || 0, 100)}%`;

                     return (
                         <div key={task.id} className="flex h-[32px] border-b border-slate-100 hover:bg-blue-50/30 transition-colors group">
                             
                             {/* TABLE COLUMNS (Sticky Left) */}
                             <div className="sticky left-0 z-20 flex bg-white group-hover:bg-blue-50/30 shadow-[2px_0_5px_rgba(0,0,0,0.05)] text-slate-700">
                                 <div style={{ width: COLS.id }} className="border-r border-slate-200 flex items-center justify-center text-[10px]">{task.taskId}</div>
                                 <div style={{ width: COLS.info }} className="border-r border-slate-200 flex items-center justify-center">
                                     {task.notes && <MoreHorizontal className="w-3 h-3 text-slate-400" />}
                                 </div>
                                 <div style={{ width: COLS.name }} className="border-r border-slate-200 flex items-center px-2">
                                     <div 
                                        style={{ paddingLeft: `${task.level * 20}px` }} 
                                        className={`flex items-center w-full ${task.hasChildren ? 'cursor-pointer hover:text-blue-600' : ''}`}
                                        onClick={(e) => {
                                            if (task.hasChildren) {
                                                e.stopPropagation();
                                                toggleCollapse(task.taskId);
                                            }
                                        }}
                                     >
                                         {/* Indentation Line */}
                                         {task.level > 0 && (
                                             <div className="absolute left-0 top-0 bottom-0 border-l border-slate-200" style={{ left: `${task.level * 10}px` }}></div>
                                         )}

                                         {task.hasChildren && (
                                             <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleCollapse(task.taskId);
                                                }} 
                                                className="mr-1 hover:bg-slate-200 rounded p-0.5 z-10 transition-colors"
                                             >
                                                 {collapsedIds.has(task.taskId) ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                             </button>
                                         )}
                                         <span className={`truncate ${task.isSummary ? 'font-bold' : ''} select-none`}>{task.activity}</span>
                                     </div>
                                 </div>
                                 <div style={{ width: COLS.dur }} className="border-r border-slate-200 flex items-center justify-center">{task.duration} days</div>
                                 <div style={{ width: COLS.start }} className="border-r border-slate-200 flex items-center justify-center text-[10px]">{new Date(task.startDate).toLocaleDateString()}</div>
                                 <div style={{ width: COLS.end }} className="border-r border-slate-200 flex items-center justify-center text-[10px]">{new Date(task.endDate).toLocaleDateString()}</div>
                                 <div style={{ width: COLS.cost }} className="border-r border-slate-200 flex items-center justify-end px-2 font-mono text-slate-500">{task.rolledUpCost?.toLocaleString()}</div>
                                 <div style={{ width: COLS.pred }} className="border-r border-slate-200 flex items-center justify-center text-slate-400">{task.dependencies?.join(', ')}</div>
                                 <div style={{ width: COLS.res }} className="border-r border-slate-200 flex items-center px-2 text-slate-500 truncate text-[10px]">{task.resources}</div>
                             </div>

                             {/* GANTT BAR AREA */}
                             <div className="flex-1 relative">
                                 <div 
                                    className="absolute top-1/2 -translate-y-1/2 h-4 z-20 group-hover:brightness-110 transition-all cursor-pointer"
                                    style={{ left: `${barLeft}px`, width: `${barWidth}px` }}
                                    title={`${task.activity}: ${new Date(task.startDate).toLocaleDateString()} - ${new Date(task.endDate).toLocaleDateString()}`}
                                 >
                                     {task.isSummary ? (
                                         // Summary Bracket Style
                                         <div className="w-full h-full relative">
                                             <div className="absolute top-0 left-0 h-full w-2 border-t-4 border-l-4 border-slate-800 rounded-tl-sm"></div>
                                             <div className="absolute top-0 right-0 h-full w-2 border-t-4 border-r-4 border-slate-800 rounded-tr-sm"></div>
                                             <div className="absolute top-0 left-1 right-1 h-2 bg-slate-800 shadow-sm"></div>
                                         </div>
                                     ) : (
                                         // Normal Task Bar
                                         <div className={`w-full h-full ${taskColor} rounded-[2px] shadow-sm relative overflow-hidden border border-black/10`}>
                                             {/* Progress Bar */}
                                             <div className="h-full bg-white/20 absolute top-0 left-0" style={{ width: progressWidth }}></div>
                                         </div>
                                     )}
                                     
                                     {/* Label next to bar */}
                                     <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 text-[9px] text-slate-500 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                                         {task.resources}
                                     </div>
                                 </div>
                             </div>
                         </div>
                     );
                 })}
             </div>
          </div>
       </div>

       {/* PLANNER LEGEND FOOTER */}
       <div className="h-8 bg-slate-50 border-t border-slate-200 flex items-center px-4 space-x-6 text-[10px] text-slate-600 font-medium shrink-0 shadow-[0_-2px_5px_rgba(0,0,0,0.02)] z-50">
           <div className="flex items-center">
               <div className="w-4 h-2 bg-blue-500 border border-black/10 mr-2"></div>
               <span>Task</span>
           </div>
           <div className="flex items-center">
               <div className="w-4 h-2 bg-red-500 border border-black/10 mr-2"></div>
               <span>Critical Path</span>
           </div>
           <div className="flex items-center">
               <div className="w-4 h-2 bg-slate-800 border-x-4 border-slate-800 mr-2 relative">
                   <div className="absolute top-0 left-0 w-full h-[1px] bg-slate-800"></div>
               </div>
               <span>Summary</span>
           </div>
           <div className="flex items-center">
               <div className="w-2 h-2 rotate-45 bg-slate-800 mr-2"></div>
               <span>Milestone</span>
           </div>
           <div className="flex items-center">
               <div className="w-4 h-0.5 bg-white/20 border border-black/20 mr-2"></div>
               <span>Progress</span>
           </div>
       </div>
    </div>
  );
};
