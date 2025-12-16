
import React, { useState, useEffect, useRef } from 'react';
import { FileUpload } from './components/FileUpload';
import { AnalysisView } from './components/AnalysisView';
import { ResultsView } from './components/ResultsView';
import { SchedulingView } from './components/SchedulingView'; 
import { InstructionView } from './components/InstructionView';
import { PaymentModal } from './components/PaymentModal'; 
import { LandingPage } from './components/LandingPage';
import { DisclaimerModal } from './components/DisclaimerModal';
import { DashboardView } from './components/DashboardView'; 
import { TutorialModal } from './components/TutorialModal';
import { ChatSupport } from './components/ChatSupport'; 
import { MarketingGenerator } from './components/MarketingGenerator'; // Import
import { generateTakeoff, generateSchedule, FileInput } from './services/geminiService';
import { AppState, TakeoffResult, UploadedFile, AppMode } from './types';
import { Wallet, CheckCircle, Phone, Shield, FileText, Mail, Calculator, FileCheck, ArrowRight, ChevronLeft, BookOpen, CalendarClock, ArrowLeft, RotateCw, Settings, PlayCircle } from 'lucide-react';
import { Logo } from './components/Logo';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';

const COUPON_SALT = "CONSTRUCT-AI-SECURE-HASH-V1";

// --- SALES ASSET: PRE-LOADED SAMPLE PROJECT ---
const SAMPLE_PROJECT: TakeoffResult = {
    id: "SAMPLE-VILLA-001",
    projectName: "G+1 Modern Villa (Sample)",
    date: new Date().toISOString(),
    isPaid: false, // Locked so they still have to buy to export!
    appMode: AppMode.SCHEDULING,
    summary: "Sample Project generated for demonstration.",
    unitSystem: 'metric',
    items: [
        { id: '1', description: "Excavation for footings", billItemDescription: "Excavation for footings", quantity: 145.5, unit: "m3", category: "Substructure", timesing: 1, dimension: "Various", confidence: "High", contractRate: 350 },
        { id: '2', description: "C25 Concrete in Footings", billItemDescription: "C25 Concrete in Footings", quantity: 42.0, unit: "m3", category: "Substructure", timesing: 1, dimension: "Various", confidence: "High", contractRate: 4500 },
        { id: '3', description: "Grade 25 Concrete Columns", billItemDescription: "Grade 25 Concrete Columns", quantity: 28.5, unit: "m3", category: "Concrete Work", timesing: 1, dimension: "Various", confidence: "High", contractRate: 5200 },
        { id: '4', description: "Slab on Grade (10cm)", billItemDescription: "Slab on Grade (10cm)", quantity: 180.0, unit: "m2", category: "Concrete Work", timesing: 1, dimension: "Various", confidence: "High", contractRate: 850 },
        { id: '5', description: "HCB Walling (200mm)", billItemDescription: "HCB Walling (200mm)", quantity: 340.0, unit: "m2", category: "Masonry", timesing: 1, dimension: "Various", confidence: "High", contractRate: 900 },
        { id: '6', description: "Gypsum Plastering", billItemDescription: "Gypsum Plastering", quantity: 650.0, unit: "m2", category: "Finishing Work", timesing: 1, dimension: "Various", confidence: "High", contractRate: 350 },
        { id: '7', description: "Ceramic Floor Tiles", billItemDescription: "Ceramic Floor Tiles", quantity: 160.0, unit: "m2", category: "Finishing Work", timesing: 1, dimension: "Various", confidence: "High", contractRate: 1200 },
    ],
    rebarItems: [
        { id: "B1", member: "Column C1", barType: "T16", shapeCode: "00", noOfMembers: 12, barsPerMember: 8, totalBars: 96, lengthPerBar: 3.5, totalLength: 336, totalWeight: 530 }
    ],
    scheduleItems: [
        { id: "t1", taskId: "1", activity: "Mobilization", category: "Preliminaries", duration: 5, startDate: "2025-03-01", endDate: "2025-03-06", dependencies: [], resources: "Site Engineer", progress: 100, criticalPath: true },
        { id: "t2", taskId: "2", activity: "Substructure", category: "Substructure", duration: 15, startDate: "2025-03-07", endDate: "2025-03-22", dependencies: ["1"], resources: "Excavator, Masons", progress: 100, criticalPath: true },
        { id: "t2.1", taskId: "2.1", activity: "Excavation", category: "Substructure", duration: 5, startDate: "2025-03-07", endDate: "2025-03-12", dependencies: ["1"], resources: "Excavator", progress: 100, criticalPath: true },
        { id: "t2.2", taskId: "2.2", activity: "Footing Concrete", category: "Substructure", duration: 7, startDate: "2025-03-13", endDate: "2025-03-20", dependencies: ["2.1"], resources: "Mixer, Labor", progress: 100, criticalPath: true },
        { id: "t3", taskId: "3", activity: "Superstructure G+0", category: "Structure", duration: 20, startDate: "2025-03-23", endDate: "2025-04-12", dependencies: ["2"], resources: "Carpenters", progress: 45, criticalPath: true },
        { id: "t3.1", taskId: "3.1", activity: "Columns G+0", category: "Structure", duration: 8, startDate: "2025-03-23", endDate: "2025-03-31", dependencies: ["2"], resources: "Carpenters", progress: 100, criticalPath: true },
        { id: "t3.2", taskId: "3.2", activity: "Slab Formwork", category: "Structure", duration: 10, startDate: "2025-04-01", endDate: "2025-04-11", dependencies: ["3.1"], resources: "Carpenters", progress: 0, criticalPath: true },
        { id: "t4", taskId: "4", activity: "Finishing Works", category: "Finishing", duration: 30, startDate: "2025-04-15", endDate: "2025-05-15", dependencies: ["3"], resources: "Painters, Tilers", progress: 0, criticalPath: false },
    ]
};

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.LANDING);
  const [appMode, setAppMode] = useState<AppMode>(AppMode.ESTIMATION);
  
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]); 
  const [specFile, setSpecFile] = useState<UploadedFile | null>(null);
  const [contractFile, setContractFile] = useState<UploadedFile | null>(null);
  
  const [credits, setCredits] = useState(() => {
    const saved = localStorage.getItem('constructAi_credits');
    return saved ? parseInt(saved, 10) : 0;
  });

  const [usedCodes, setUsedCodes] = useState<string[]>(() => {
    const saved = localStorage.getItem('constructAi_usedCodes');
    return saved ? JSON.parse(saved) : [];
  });

  const [savedProjects, setSavedProjects] = useState<TakeoffResult[]>(() => {
    const saved = localStorage.getItem('constructAi_projects');
    return saved ? JSON.parse(saved) : [];
  });

  const [hasAcceptedDisclaimer, setHasAcceptedDisclaimer] = useState(() => {
    return localStorage.getItem('constructAi_disclaimer') === 'true';
  });

  const [customCodes, setCustomCodes] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('constructAi_customCodes');
    const defaults = { 
      'MYDREAM..123': 3, 
    }; 
    return saved ? { ...defaults, ...JSON.parse(saved) } : defaults; 
  });

  // STORE LAST CONFIGURATION FOR QUICK RESCHEDULE
  const [lastAnalysisConfig, setLastAnalysisConfig] = useState<any>(null);

  useEffect(() => {
    localStorage.setItem('constructAi_credits', credits.toString());
  }, [credits]);

  useEffect(() => {
    localStorage.setItem('constructAi_usedCodes', JSON.stringify(usedCodes));
  }, [usedCodes]);

  useEffect(() => {
    localStorage.setItem('constructAi_customCodes', JSON.stringify(customCodes));
  }, [customCodes]);

  useEffect(() => {
    localStorage.setItem('constructAi_projects', JSON.stringify(savedProjects));
  }, [savedProjects]);

  const handleDisclaimerAccept = () => {
    setHasAcceptedDisclaimer(true);
    localStorage.setItem('constructAi_disclaimer', 'true');
  };

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [customApiKey, setCustomApiKey] = useState(() => localStorage.getItem('constructAi_customApiKey') || '');

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [initialRedeemCode, setInitialRedeemCode] = useState<string>('');
  const [takeoffData, setTakeoffData] = useState<TakeoffResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMerging, setIsMerging] = useState(false);
  const processedRef = useRef(false);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (appState === AppState.RESULTS) {
        e.preventDefault();
        e.returnValue = ''; 
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [appState]);

  // ON MOUNT: Check if API Key is configured
  useEffect(() => {
      const localKey = localStorage.getItem('constructAi_customApiKey');
      const envKey = process.env.API_KEY;
      
      const hasKey = (localKey && localKey.startsWith('AIza')) || (envKey && envKey.length > 10 && !envKey.includes('undefined'));
      
      if (!hasKey && appState !== AppState.LANDING && appState !== AppState.MARKETING) {
          showToast("API Key Missing. Please configure in Settings.");
          setShowSettings(true);
      }
  }, [appState]);

  const verifySignedCode = (code: string): number | null => {
    try {
      const parts = code.split('-');
      if (parts.length !== 4) return null;
      if (parts[0] !== 'CST') return null;

      const amount = parseInt(parts[1]);
      const random = parts[2];
      const providedSig = parts[3];

      const raw = `${amount}:${random}:${COUPON_SALT}`;
      let hash = 0;
      for (let i = 0; i < raw.length; i++) {
        hash = ((hash << 5) - hash) + raw.charCodeAt(i);
        hash |= 0;
      }
      const expectedSig = Math.abs(hash).toString(16).toUpperCase();

      if (providedSig === expectedSig) {
        return amount;
      }
      return null;
    } catch (e) {
      return null;
    }
  };

  useEffect(() => {
    if (processedRef.current) return;
    
    const params = new URLSearchParams(window.location.search);
    
    const isSuccess = params.get('payment_success');
    const amountToAdd = params.get('amount');

    if (isSuccess === 'true' && amountToAdd) {
      const creditsToAdd = parseInt(amountToAdd, 10);
      if (!isNaN(creditsToAdd)) {
        setCredits(prev => prev + creditsToAdd);
        showToast(`Payment Successful! ${creditsToAdd} Credits added.`);
        if (appState === AppState.LANDING) {
           setAppState(AppState.DASHBOARD);
        }
      }
    }

    const redeemCode = params.get('redeem');
    if (redeemCode) {
      const cleanCode = redeemCode.trim().toUpperCase();
      setInitialRedeemCode(cleanCode);
      setShowPaymentModal(true);
      if (appState === AppState.LANDING) {
           setAppState(AppState.DASHBOARD);
        }
    }

    if (isSuccess || redeemCode) {
       window.history.replaceState({}, document.title, window.location.pathname);
       processedRef.current = true;
    }
  }, [appState]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleSaveApiKey = () => {
      localStorage.setItem('constructAi_customApiKey', customApiKey);
      showToast("API Key Saved! You can now use the app.");
      setShowSettings(false);
  };

  // --- DATA PORTABILITY LOGIC ---
  const handleExportBackup = () => {
      const backupData = {
          version: "1.0",
          timestamp: new Date().toISOString(),
          credits: credits,
          projects: savedProjects,
          usedCodes: usedCodes
      };
      
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ConstructAI_Backup_${new Date().toISOString().split('T')[0]}.cai`; // Custom extension .cai
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("Backup downloaded successfully!");
  };

  const handleImportBackup = (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
          try {
              const text = e.target?.result as string;
              const data = JSON.parse(text);
              
              if (!data.version || !data.projects) {
                  throw new Error("Invalid backup file format.");
              }

              if (window.confirm(`Restore Backup?\n\nFound: ${data.projects.length} Projects, ${data.credits} Credits.\n\nWARNING: This will merge with your current data.`)) {
                  // Merge logic (Keep highest credits, merge unique projects)
                  setCredits(prev => Math.max(prev, data.credits || 0));
                  
                  setSavedProjects(prev => {
                      const newIds = new Set(data.projects.map((p: any) => p.id));
                      const filteredPrev = prev.filter(p => !newIds.has(p.id));
                      return [...data.projects, ...filteredPrev];
                  });

                  if (data.usedCodes) {
                      setUsedCodes(prev => Array.from(new Set([...prev, ...data.usedCodes])));
                  }

                  showToast("Workspace restored successfully!");
              }
          } catch (err) {
              console.error(err);
              showToast("Failed to restore backup. Invalid file.");
          }
      };
      reader.readAsText(file);
  };

  const handleTryDemo = () => {
    // Instead of a fake upload, we load the FULL SAMPLE PROJECT immediately.
    // This gives instant gratification and trust.
    setTakeoffData(SAMPLE_PROJECT);
    setAppMode(AppMode.SCHEDULING); // Shows the cool Gantt chart first
    setAppState(AppState.RESULTS);
    showToast("Sample Project Loaded! Try exploring the Schedule tab.");
  };

  const handleFileSelect = async (drawings: File[], spec?: File, contract?: File) => {
    setError(null);
    setSpecFile(null); 
    setContractFile(null);
    
    if (drawings.length === 0) return;

    const validMimeTypes = ['image/png', 'image/jpeg', 'application/pdf', 'application/x-pdf', 'application/zip', 'application/x-zip-compressed', 'application/octet-stream', 'application/dxf', 'image/vnd.dwg', 'application/vnd.ms-project', 'application/xml', 'text/xml', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv'];
    const validExtensions = ['.zip', '.pdf', '.png', '.jpg', '.jpeg', '.dwg', '.dxf', '.mpp', '.xml', '.xlsx', '.xls', '.csv'];

    const processedFiles: UploadedFile[] = [];

    try {
        for (const file of drawings) {
            const ext = '.' + file.name.split('.').pop()?.toLowerCase();
            
            if (ext === '.zip' || file.type.includes('zip')) {
                const zip = await JSZip.loadAsync(file);
                for (const filename of Object.keys(zip.files)) {
                    const zipFile = zip.files[filename];
                    if (zipFile.dir) continue;
                    
                    const subExt = '.' + filename.split('.').pop()?.toLowerCase();
                    if (validExtensions.includes(subExt)) {
                        const content = await zipFile.async('blob');
                        const extractedFile = new File([content], filename, { type: content.type });
                        const uf = await processSingleFile(extractedFile);
                        processedFiles.push(uf);
                    }
                }
            } else if (validExtensions.includes(ext) || validMimeTypes.includes(file.type)) {
                const uf = await processSingleFile(file);
                processedFiles.push(uf);
            }
        }

        if (processedFiles.length === 0) {
            setError("No valid drawings found. Please upload PDF, PNG, JPG, DWG, DXF, MS Project or Excel files.");
            return;
        }

        setUploadedFiles(processedFiles);

        if (spec) {
            const specUf = await processSingleFile(spec);
            setSpecFile(specUf);
        }

        if (contract) {
            const contractUf = await processSingleFile(contract);
            setContractFile(contractUf);
        }

        setAppState(AppState.INSTRUCTIONS);

    } catch (err) {
      console.error(err);
      setError("Failed to process uploaded files.");
    }
  };

  const processSingleFile = (file: File): Promise<UploadedFile> => {
    return new Promise((resolve, reject) => {
        const lowerName = file.name.toLowerCase();
        const ext = '.' + lowerName.split('.').pop();

        // Strategy 0: Excel / CSV parsing to Text (Best for Schedule Import)
        if (ext === '.xlsx' || ext === '.xls' || ext === '.csv') {
            const reader = new FileReader();
            reader.onload = (e) => {
                const data = e.target?.result as ArrayBuffer;
                const workbook = XLSX.read(data);
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const csv = XLSX.utils.sheet_to_csv(worksheet);
                resolve({
                    name: file.name,
                    type: 'text/csv', // Tell AI this is CSV data
                    data: csv, // Pass text directly
                    url: URL.createObjectURL(file)
                });
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
            return;
        }

        // Strategy 0.5: MS Project XML parsing to Text
        if (ext === '.xml') {
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target?.result as string;
                resolve({
                    name: file.name,
                    type: 'application/xml',
                    data: text,
                    url: URL.createObjectURL(file)
                });
            };
            reader.onerror = reject;
            reader.readAsText(file);
            return;
        }

        // Strategy 1: Text-based CAD (DXF)
        if (lowerName.endsWith('.dxf')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target?.result as string;
                // Truncate if too huge to prevent token overflow, preserve header and entities
                const truncated = text.length > 200000 ? text.substring(0, 200000) + "...[Truncated]" : text;
                resolve({
                    name: file.name,
                    type: 'application/cad-text', // Custom type flag for text data
                    data: truncated,
                    url: URL.createObjectURL(file) // For preview icon
                });
            };
            reader.onerror = reject;
            reader.readAsText(file);
            return;
        }

        // Strategy 2: Binary CAD (DWG) - Extract Strings
        // We cannot read binary directly in frontend LLM, but we can extract Metadata strings (Layers, Text Blocks)
        if (lowerName.endsWith('.dwg')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const buffer = e.target?.result as ArrayBuffer;
                const uint8 = new Uint8Array(buffer);
                
                // Simple string extraction for binary files
                // We look for sequences of printable characters to grab Layer Names, Materials, etc.
                let extracted = "";
                let currentSeq = "";
                for (let i = 0; i < uint8.length; i++) {
                    const code = uint8[i];
                    // Printable ASCII range (32-126)
                    if (code >= 32 && code <= 126) {
                        currentSeq += String.fromCharCode(code);
                    } else {
                        // Filter out short noise, keep meaningful words
                        if (currentSeq.length > 4) { 
                            extracted += currentSeq + "\n";
                        }
                        currentSeq = "";
                    }
                }
                
                // Limit size
                const finalData = extracted.length > 150000 ? extracted.substring(0, 150000) + "...[Truncated]" : extracted;

                resolve({
                    name: file.name,
                    type: 'application/cad-text', // Mark as extracted text
                    data: finalData,
                    url: URL.createObjectURL(file)
                });
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
            return;
        }

        // Strategy 3: Standard Visual (PDF/IMG/MPP)
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            const resultStr = e.target.result as string;
            const base64Data = resultStr.includes(',') ? resultStr.split(',')[1] : resultStr;
            const fileUrl = URL.createObjectURL(file);
            resolve({
              name: file.name,
              type: file.type || 'application/octet-stream', 
              data: base64Data, 
              url: fileUrl
            });
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
  }

  const handleStartAnalysis = async (
    instructions: string, 
    scopes: string[], 
    includeRebar: boolean, 
    floorCount: number, 
    basementCount: number, 
    storyHeight: number, 
    unitSystem: 'metric' | 'imperial',
    scheduleDetailLevel: 'master' | 'detail' | 'reschedule',
    projectType: 'building' | 'infrastructure' | 'interior' = 'building',
    calendarSettings: { workingDays: string[], hoursPerDay: number, holidays: string } = { workingDays: ['Mon','Tue','Wed','Thu','Fri'], hoursPerDay: 8, holidays: '' }
  ) => {
    if (uploadedFiles.length === 0) return;

    // SAVE CONFIG FOR QUICK RESCHEDULE
    setLastAnalysisConfig({
        instructions, 
        scopes, 
        includeRebar, 
        floorCount, 
        basementCount, 
        storyHeight, 
        unitSystem, 
        scheduleDetailLevel,
        projectType,
        calendarSettings
    });

    setAppState(AppState.ANALYZING);

    try {
      const filesToSend: FileInput[] = [];
      
      uploadedFiles.forEach(f => {
          let mime = f.type;
          
          // Pass the custom text type directly if set, otherwise map standard mimes
          if (mime !== 'application/cad-text' && mime !== 'text/csv' && mime !== 'application/xml') {
              const name = f.name.toLowerCase();
              if (name.endsWith('.pdf')) mime = 'application/pdf';
              else if (name.endsWith('.png')) mime = 'image/png';
              else if (name.endsWith('.jpg') || name.endsWith('.jpeg')) mime = 'image/jpeg';
          }
          
          filesToSend.push({
              fileName: f.name,
              data: f.data,
              mimeType: mime
          });
      });

      if (filesToSend.length === 0) {
          throw new Error("No files available for AI Analysis.");
      }
      
      let newResult: TakeoffResult;

      // Handle both Scheduling modes
      if (appMode === AppMode.SCHEDULING || appMode === AppMode.RESCHEDULING) {
         // Force 'reschedule' detail level if AppMode is RESCHEDULING
         const effectiveDetailLevel = appMode === AppMode.RESCHEDULING ? 'reschedule' : scheduleDetailLevel;
         
         newResult = await generateSchedule(
             filesToSend,
             instructions,
             floorCount,
             basementCount,
             effectiveDetailLevel,
             projectType,
             calendarSettings
         );
      } else {
         newResult = await generateTakeoff(
            filesToSend, 
            instructions, 
            scopes, 
            includeRebar, 
            floorCount, 
            basementCount, 
            storyHeight, 
            specFile?.data, 
            specFile?.type,
            unitSystem,
            appMode,
            contractFile?.data, 
            contractFile?.type
        );
      }
      
      let finalResult: TakeoffResult;

      if (isMerging && takeoffData && appMode !== AppMode.SCHEDULING && appMode !== AppMode.RESCHEDULING) {
        finalResult = {
          id: takeoffData.id, 
          isPaid: takeoffData.isPaid, 
          date: new Date().toISOString(), 
          projectName: takeoffData.projectName,
          sourceFiles: [...(takeoffData.sourceFiles || []), ...uploadedFiles.map(f => f.name)],
          items: [...takeoffData.items, ...(newResult.items || [])],
          rebarItems: [...takeoffData.rebarItems, ...(newResult.rebarItems || [])],
          summary: takeoffData.summary + "\n\n--- ADDITIONAL BATCH ---\n" + newResult.summary,
          drawingType: takeoffData.drawingType,
          unitSystem: takeoffData.unitSystem,
          appMode: takeoffData.appMode
        };
      } else {
        finalResult = {
          ...newResult,
          isPaid: false, 
          sourceFiles: uploadedFiles.map(f => f.name),
          appMode: appMode
        };
      }

      setTakeoffData(finalResult);
      
      setSavedProjects(prev => {
          const filtered = prev.filter(p => p.id !== finalResult.id);
          return [finalResult, ...filtered];
      });

      setAppState(AppState.RESULTS);
    } catch (err: any) {
      console.error(err);
      // Ensure errMsg is a string
      const errMsg = (err.message && typeof err.message === 'string') ? err.message : JSON.stringify(err);
      setError(errMsg);
      
      // CRITICAL FIX: If API key is missing, go to error state directly to show button
      if (errMsg.includes("API Key") || errMsg.includes("API_KEY")) {
          setShowSettings(true); // Open settings immediately
      }
      setAppState(AppState.ERROR);
    } finally {
        setIsMerging(false);
    }
  };

  const handleQuickReschedule = async (mode: 'master' | 'detail') => {
      if (!lastAnalysisConfig || uploadedFiles.length === 0) return;
      
      setAppState(AppState.ANALYZING);
      
      try {
          // Prepare Files
          const filesToSend: FileInput[] = [];
          uploadedFiles.forEach(f => {
              let mime = f.type;
              if (mime !== 'application/cad-text' && mime !== 'text/csv' && mime !== 'application/xml') {
                  const name = f.name.toLowerCase();
                  if (name.endsWith('.pdf')) mime = 'application/pdf';
                  else if (name.endsWith('.png')) mime = 'image/png';
                  else if (name.endsWith('.jpg') || name.endsWith('.jpeg')) mime = 'image/jpeg';
              }
              filesToSend.push({ fileName: f.name, data: f.data, mimeType: mime });
          });

          // Use Cached Config but Override Detail Level
          const newResult = await generateSchedule(
             filesToSend,
             lastAnalysisConfig.instructions,
             lastAnalysisConfig.floorCount,
             lastAnalysisConfig.basementCount,
             mode, // OVERRIDE
             lastAnalysisConfig.projectType,
             lastAnalysisConfig.calendarSettings
          );

          const finalResult = {
              ...newResult,
              isPaid: takeoffData?.isPaid || false, // Preserve paid status
              sourceFiles: uploadedFiles.map(f => f.name),
              appMode: AppMode.SCHEDULING
          };

          setTakeoffData(finalResult);
          
          setSavedProjects(prev => {
              const filtered = prev.filter(p => p.id !== finalResult.id);
              return [finalResult, ...filtered];
          });

          setAppState(AppState.RESULTS);

      } catch (err: any) {
          console.error(err);
          setError("Quick Reschedule Failed: " + err.message);
          setAppState(AppState.ERROR); // Go back to error state
      }
  };

  const handleUnlockProject = (): boolean => {
      if (credits >= 1) {
          setCredits(prev => prev - 1);
          if (takeoffData) {
              const updated = { ...takeoffData, isPaid: true };
              setTakeoffData(updated);
              setSavedProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
          }
          showToast("Project Unlocked! You can now export.");
          return true;
      } else {
          setShowPaymentModal(true);
          return false;
      }
  };

  const handleRedeemCode = (code: string): boolean => {
      if (usedCodes.includes(code)) return false;

      // 1. Check Custom/Hardcoded Codes
      if (customCodes[code]) {
          const amount = customCodes[code];
          setCredits(prev => prev + amount);
          setUsedCodes(prev => [...prev, code]);
          showToast(`Success! Redeemed ${amount} Credits.`);
          return true;
      }

      // 2. Check Cryptographic Signature Codes
      const signedAmount = verifySignedCode(code);
      if (signedAmount) {
          setCredits(prev => prev + signedAmount);
          setUsedCodes(prev => [...prev, code]);
          showToast(`Success! Redeemed ${signedAmount} Credits.`);
          return true;
      }

      return false;
  };

  const handleDeleteProject = (id: string) => {
      if (window.confirm("Are you sure you want to delete this project?")) {
          setSavedProjects(prev => prev.filter(p => p.id !== id));
      }
  };

  const handleOpenProject = (project: TakeoffResult) => {
      setTakeoffData(project);
      setAppMode(project.appMode || AppMode.ESTIMATION);
      setAppState(AppState.RESULTS);
  };

  const handleNewProject = () => {
      setAppState(AppState.MODE_SELECT);
      setTakeoffData(null);
  };

  const handleModeSelect = (mode: AppMode) => {
      setAppMode(mode);
      setAppState(AppState.UPLOAD);
      setUploadedFiles([]);
  };

  const handleBackToDashboard = () => {
      setAppState(AppState.DASHBOARD);
      setTakeoffData(null);
  };

  const handleAddDrawing = () => {
     if (takeoffData && appMode !== AppMode.SCHEDULING && appMode !== AppMode.RESCHEDULING) {
         setIsMerging(true);
         setAppState(AppState.UPLOAD);
     } else {
         alert("Batch merging is currently only supported for Takeoff Mode.");
     }
  };

  const handleReschedule = () => {
      // Keep existing files but go back to upload to allow adding MS Project/Excel files
      // We do NOT clear uploadedFiles here
      setAppState(AppState.UPLOAD);
  };

  // --- NEW MARKETING ROUTE HANDLER ---
  const handleOpenMarketing = () => {
      setAppState(AppState.MARKETING);
  };

  return (
    <div className="min-h-screen flex flex-col relative font-sans text-slate-900 bg-slate-50 selection:bg-brand-500 selection:text-white">
      
      {/* GLOBAL TOAST */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-[100] bg-slate-800 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center animate-in slide-in-from-right-10 duration-300">
           <CheckCircle className="w-5 h-5 mr-3 text-green-400" />
           <span className="font-bold text-sm">{toastMessage}</span>
        </div>
      )}

      {/* NAVBAR */}
      {appState !== AppState.LANDING && appState !== AppState.MARKETING && (
        <nav className="bg-white border-b border-slate-200 sticky top-0 z-40 h-16 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 h-full flex justify-between items-center">
            <div 
                className="flex items-center space-x-2 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => setAppState(AppState.DASHBOARD)}
            >
               <Logo className="w-6 h-6 text-brand-600" />
               <span className="text-lg font-bold text-slate-800 tracking-tight hidden md:inline">ConstructAI</span>
            </div>
            
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => setShowSettings(true)}
                className="text-slate-500 hover:text-slate-800 transition-colors p-2 rounded-full hover:bg-slate-100"
                title="Settings & API Key"
              >
                  <Settings className="w-5 h-5" />
              </button>

              <button 
                onClick={() => setShowTutorial(true)}
                className="text-slate-500 hover:text-slate-800 transition-colors p-2 rounded-full hover:bg-slate-100 hidden md:block"
                title="Help Guide"
              >
                  <BookOpen className="w-5 h-5" />
              </button>

              <div 
                className="flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200 cursor-pointer hover:border-brand-300 transition-colors"
                onClick={() => setShowPaymentModal(true)}
              >
                <Wallet className="w-4 h-4 text-brand-600" />
                <span className="font-bold text-slate-700 text-sm">{credits} Credits</span>
                <span className="bg-brand-600 text-white text-[10px] px-1.5 rounded-sm font-bold ml-1">+</span>
              </div>
            </div>
          </div>
        </nav>
      )}

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col relative">
        
        {appState === AppState.LANDING && (
          <LandingPage 
             onGetStarted={() => setAppState(AppState.DASHBOARD)}
             onLogin={() => setAppState(AppState.DASHBOARD)} 
             onTryDemo={handleTryDemo}
             onOpenGuide={() => setShowTutorial(true)}
             onOpenMarketing={() => setAppState(AppState.MARKETING)} // Pass new handler
          />
        )}

        {appState === AppState.DASHBOARD && (
             <DashboardView 
                projects={savedProjects}
                onNewProject={handleNewProject}
                onOpenProject={handleOpenProject}
                onDeleteProject={handleDeleteProject}
                onBack={() => setAppState(AppState.LANDING)}
                onOpenGuide={() => setShowTutorial(true)}
                onExportBackup={handleExportBackup}
                onImportBackup={handleImportBackup}
                onLoadSample={handleTryDemo} // Pass sample handler to dashboard
             />
        )}

        {/* --- MARKETING GENERATOR VIEW --- */}
        {appState === AppState.MARKETING && (
            <MarketingGenerator onBack={() => setAppState(AppState.LANDING)} />
        )}

        {appState === AppState.MODE_SELECT && (
            <div className="flex-1 flex flex-col items-center justify-center p-6 animate-in fade-in zoom-in-95 duration-300 bg-white">
                <button 
                  onClick={() => setAppState(AppState.DASHBOARD)}
                  className="absolute top-6 left-6 text-slate-400 hover:text-slate-700 flex items-center text-sm font-bold"
                >
                   <ArrowLeft className="w-4 h-4 mr-2" /> Back
                </button>

                <div className="text-center mb-10 max-w-lg">
                    <h2 className="text-3xl font-bold text-slate-900 mb-4">Select Module</h2>
                    <p className="text-slate-500">Choose the tool you need for this session. Each module is optimized for specific workflows.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl w-full">
                    <button 
                        onClick={() => handleModeSelect(AppMode.ESTIMATION)}
                        className="group relative p-8 bg-white border border-slate-200 rounded-2xl hover:border-brand-500 hover:shadow-xl transition-all text-left overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-brand-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                        <Calculator className="w-12 h-12 text-brand-600 mb-6 relative z-10" />
                        <h3 className="text-xl font-bold text-slate-900 mb-2 relative z-10">Smart Takeoff</h3>
                        <p className="text-xs text-slate-500 relative z-10">
                            Automated quantity extraction from PDF/CAD. Generates detailed BOQ with formulas.
                        </p>
                    </button>

                    <button 
                        onClick={() => handleModeSelect(AppMode.PAYMENT)}
                        className="group relative p-8 bg-white border border-slate-200 rounded-2xl hover:border-green-500 hover:shadow-xl transition-all text-left overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-green-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                        <FileCheck className="w-12 h-12 text-green-600 mb-6 relative z-10" />
                        <h3 className="text-xl font-bold text-slate-900 mb-2 relative z-10">Valuation / IPC</h3>
                        <p className="text-xs text-slate-500 relative z-10">
                            Create Interim Payment Certificates. Track previous vs. current quantities.
                        </p>
                    </button>

                    <button 
                        onClick={() => handleModeSelect(AppMode.SCHEDULING)}
                        className="group relative p-8 bg-white border border-slate-200 rounded-2xl hover:border-purple-500 hover:shadow-xl transition-all text-left overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-purple-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                        <CalendarClock className="w-12 h-12 text-purple-600 mb-6 relative z-10" />
                        <h3 className="text-xl font-bold text-slate-900 mb-2 relative z-10">Scheduling (Gantt)</h3>
                        <p className="text-xs text-slate-500 relative z-10">
                            AI-generated project timeline and WBS from drawings. Export to MS Project/Excel.
                        </p>
                    </button>

                    <button 
                        onClick={() => handleModeSelect(AppMode.RESCHEDULING)}
                        className="group relative p-8 bg-white border border-slate-200 rounded-2xl hover:border-amber-500 hover:shadow-xl transition-all text-left overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                        <span className="absolute top-4 right-4 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full animate-pulse z-20 shadow-md">NEW</span>
                        <RotateCw className="w-12 h-12 text-amber-600 mb-6 relative z-10" />
                        <h3 className="text-xl font-bold text-slate-900 mb-2 relative z-10">Rescheduling</h3>
                        <p className="text-xs text-slate-500 relative z-10">
                            Optimize and recover existing schedules (XML/CSV). Update dates, logic, and resources.
                        </p>
                    </button>
                </div>
            </div>
        )}

        {appState === AppState.UPLOAD && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-50 animate-in fade-in">
             <div className="w-full max-w-4xl">
                 <div className="flex items-center mb-8">
                     <button onClick={() => setAppState(AppState.MODE_SELECT)} className="mr-4 p-2 bg-white border border-slate-200 rounded-full hover:bg-slate-100 transition-colors">
                         <ArrowLeft className="w-5 h-5 text-slate-500" />
                     </button>
                     <h2 className="text-2xl font-bold text-slate-900">
                         {isMerging ? "Add More Drawings" : "Upload Documents"}
                     </h2>
                 </div>
                 <FileUpload onFileSelect={handleFileSelect} error={error} />
             </div>
          </div>
        )}

        {appState === AppState.INSTRUCTIONS && uploadedFiles.length > 0 && (
           <InstructionView 
              fileName={uploadedFiles[0].name + (uploadedFiles.length > 1 ? ` + ${uploadedFiles.length - 1} others` : "")}
              onStart={handleStartAnalysis}
              onCancel={() => setAppState(AppState.UPLOAD)}
              appMode={appMode}
           />
        )}

        {appState === AppState.ANALYZING && (
          <AnalysisView 
             fileName={uploadedFiles[0]?.name || "Document"} 
             fileUrl={uploadedFiles[0]?.url}
             fileType={uploadedFiles[0]?.type}
             onCancel={() => {
                 setAppState(AppState.UPLOAD); // Reset to upload
                 setError(null);
             }}
          />
        )}

        {appState === AppState.RESULTS && takeoffData && (
          <ResultsView 
            data={takeoffData} 
            files={uploadedFiles.length > 0 ? uploadedFiles : (takeoffData.sourceFiles?.map(name => ({ name, type: 'application/pdf', data: '', url: '' })) || [])}
            onReset={handleBackToDashboard} 
            onAddDrawing={handleAddDrawing}
            credits={credits}
            onUnlockProject={handleUnlockProject}
            onBuyCredits={() => setShowPaymentModal(true)}
            appMode={takeoffData.appMode || AppMode.ESTIMATION}
          />
        )}
        
        {appState === AppState.RESULTS && takeoffData && (appMode === AppMode.SCHEDULING || appMode === AppMode.RESCHEDULING) && (
            <div className="fixed inset-0 z-50 bg-white">
                <SchedulingView 
                   data={takeoffData}
                   onBack={handleBackToDashboard}
                   isLocked={!takeoffData.isPaid}
                   onUnlock={handleUnlockProject}
                   onReschedule={handleReschedule}
                   onQuickReschedule={handleQuickReschedule}
                />
            </div>
        )}

        {appState === AppState.ERROR && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
             <div className="bg-red-50 p-6 rounded-full mb-4 animate-bounce">
                 <Shield className="w-12 h-12 text-red-500" />
             </div>
             <h3 className="text-xl font-bold text-slate-800 mb-2">Analysis Failed</h3>
             <p className="text-slate-500 max-w-md mb-6">{error || "An unexpected error occurred."}</p>
             <div className="flex flex-col space-y-3">
                 <div className="flex space-x-3 justify-center">
                    <button onClick={() => setAppState(AppState.UPLOAD)} className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-6 py-2 rounded-lg font-bold">Try Again</button>
                    {(error?.includes("API_KEY") || error?.includes("API Key")) && (
                        <button onClick={() => setShowSettings(true)} className="bg-brand-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-brand-700">Enter API Key</button>
                    )}
                 </div>
                 
                 <div className="text-xs text-slate-400 pt-2 border-t border-slate-100 mt-2">
                     or continue with demo data
                 </div>
                 
                 <button onClick={handleTryDemo} className="text-brand-600 hover:text-brand-700 text-sm font-bold flex items-center justify-center">
                     <PlayCircle className="w-4 h-4 mr-2" /> Load Sample Project
                 </button>
             </div>
          </div>
        )}
      </main>

      {/* SETTINGS MODAL (API KEY) */}
      {showSettings && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-lg font-bold text-slate-900 flex items-center">
                          <Settings className="w-5 h-5 mr-2 text-slate-600" /> App Settings
                      </h3>
                      <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600"><Settings className="w-5 h-5" /></button>
                  </div>
                  <div className="mb-6">
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Custom Gemini API Key</label>
                      <input 
                          type="password" 
                          placeholder="AIzaSy..." 
                          className="w-full p-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none mb-2"
                          value={customApiKey}
                          onChange={(e) => setCustomApiKey(e.target.value)}
                      />
                      <p className="text-xs text-slate-400">
                          Use this if your deployed environment variable is missing. It will be saved securely in your browser's Local Storage.
                      </p>
                  </div>
                  <div className="flex justify-end space-x-3">
                      <button onClick={() => setShowSettings(false)} className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700">Cancel</button>
                      <button onClick={handleSaveApiKey} className="px-6 py-2 bg-brand-600 text-white text-sm font-bold rounded-lg hover:bg-brand-700">Save Key</button>
                  </div>
              </div>
          </div>
      )}

      {/* MODALS */}
      {showPaymentModal && (
        <PaymentModal 
           onClose={() => setShowPaymentModal(false)} 
           onSuccess={(amount) => {
               setCredits(prev => prev + amount);
               showToast(`Success! Added ${amount} Credits.`);
               setShowPaymentModal(false);
           }}
           onRedeem={handleRedeemCode}
           initialCode={initialRedeemCode}
        />
      )}

      {!hasAcceptedDisclaimer && (
          <DisclaimerModal onAccept={handleDisclaimerAccept} />
      )}

      {showTutorial && (
          <TutorialModal onClose={() => setShowTutorial(false)} />
      )}

      {/* AI Chat Support Widget */}
      <ChatSupport />

    </div>
  );
};

export default App;