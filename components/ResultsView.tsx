
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { TakeoffResult, UploadedFile, TakeoffItem, AppMode, CertificateMetadata } from '../types';
import { Download, ChevronLeft, PlusCircle, Files, Coins, Lock, ZoomIn, ZoomOut, FileCode, AlertTriangle, Star, Grid, FileCheck, Building, BookOpen, Calendar, BadgeDollarSign, Eye, ChevronDown, ChevronRight, Sparkles, Loader2, ClipboardList, ArrowRight, PenTool, HelpCircle, AlertOctagon, Calculator, X, Save, Hammer, Truck, HardHat, Package, PieChart as PieChartIcon, Search, Filter, TrendingUp, AlertCircle, Settings, Printer, Share2, Unlock, Maximize2, RefreshCw, Trash2, Plus, FileImage, Lightbulb, TrendingDown, ShieldAlert } from 'lucide-react';
import * as XLSX from 'xlsx';
import { getRateSuggestion, generateInsights, Insight } from '../services/geminiService';
import { Logo } from './Logo';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { MeasurementCanvas } from './MeasurementCanvas';

interface ResultsViewProps {
  data: TakeoffResult;
  files: UploadedFile[];
  onReset: () => void;
  onAddDrawing: () => void;
  credits: number;
  onUnlockProject: () => boolean; 
  onBuyCredits: () => void;
  appMode: AppMode;
}

interface RateComponent {
    id: string;
    name: string;
    cost: number;
}

interface RateBreakdown {
    materials: RateComponent[];
    labor: RateComponent[];
    plant: RateComponent[];
    overheadPct: number;
    profitPct: number;
}

interface BoqGroup {
  id: string; // Unique key for overrides
  name: string; 
  unit: string;
  category: string;
  items: TakeoffItem[]; 
  totalQuantity: number; // Contract Qty
  estimatedRate: number;
  contractRate?: number; 
  executedQuantity: number; // Current Qty
  executedPercentage: number; 
  previousQuantity: number; // Previous Qty
  previousPercentage: number;
  orderIndex: number; 
  rateBreakdown?: RateBreakdown; // New field
}

// Utility to convert number to words for Payment Certificate
const numberToWords = (num: number, currency: string) => {
    const a = ['','One ','Two ','Three ','Four ','Five ','Six ','Seven ','Eight ','Nine ','Ten ','Eleven ','Twelve ','Thirteen ','Fourteen ','Fifteen ','Sixteen ','Seventeen ','Eighteen ','Nineteen '];
    const b = ['', '', 'Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];

    const regex = /^(\d{1,12})(\.(\d{1,2}))?$/; 
    if (!regex.test(num.toFixed(2))) return '';

    const match = num.toFixed(2).match(regex);
    if (!match) return '';

    let whole = match[1];
    let decimal = match[3] || '00';
    
    if (parseInt(whole) === 0) return 'Zero';

    const convertNN = (n: number) => {
        if (n < 20) return a[n];
        return b[Math.floor(n / 10)] + (n % 10 !== 0 ? '-' + a[n % 10] : ' ');
    }
    
    const convertNNN = (n: number) => {
        let str = '';
        if (n > 99) {
            str += a[Math.floor(n / 100)] + 'Hundred ';
            n %= 100;
        }
        str += convertNN(n);
        return str;
    }

    // Split into groups of 3
    let groups = [];
    let w = parseInt(whole).toString(); // remove leading zeros
    while(w.length > 0) {
        let chunk = w.length > 3 ? w.slice(-3) : w;
        groups.push(parseInt(chunk));
        w = w.length > 3 ? w.slice(0, -3) : '';
    }

    let str = '';
    const scales = ['', 'Thousand ', 'Million ', 'Billion '];
    
    for(let i=0; i<groups.length; i++) {
        if(groups[i] !== 0) {
            str = convertNNN(groups[i]) + scales[i] + str;
        }
    }
    
    const currName = currency === 'ETB' ? 'Birr' : (currency === 'USD' ? 'Dollars' : currency);
    const centName = currency === 'ETB' ? 'Cents' : 'Cents';

    str = str.trim() + " " + currName;
    if (parseInt(decimal) > 0) {
        str += " and " + convertNN(parseInt(decimal)).trim() + " " + centName;
    } else {
        str += " Only";
    }

    return str;
}

// Chart Colors
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export const ResultsView: React.FC<ResultsViewProps> = ({ 
  data, 
  files, 
  onReset, 
  onAddDrawing, 
  credits, 
  onUnlockProject,
  onBuyCredits, 
  appMode
}) => {
  const [activeTab, setActiveTab] = useState<'list' | 'boq' | 'summary' | 'payment' | 'rebar' | 'technical' | 'analytics' | 'insights'>('list');
  
  // Document Viewer State
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  
  // Local File URL Management (For re-uploaded files in saved projects)
  const [localFileUrls, setLocalFileUrls] = useState<Record<string, string>>({});
  
  const activeFile = files[activeFileIndex] || files[0];
  const activeFileUrl = localFileUrls[activeFile?.name] || activeFile?.url;
  
  // Measurement Canvas State
  const [showMeasurementCanvas, setShowMeasurementCanvas] = useState(false);

  // Initialize Unit Prices and Breakdowns
  const [unitPrices, setUnitPrices] = useState<Record<string, number>>({});
  const [rateBreakdowns, setRateBreakdowns] = useState<Record<string, RateBreakdown>>({});
  
  // Payment Mode Overrides (Keyed by Group ID)
  const [boqOverrides, setBoqOverrides] = useState<Record<string, { contract?: number, previous?: number }>>({});
  
  const [projectCurrency, setProjectCurrency] = useState<string>('ETB');
  const [isFinalAccount, setIsFinalAccount] = useState(false); 
  
  // Rate Suggestion State
  const [activeSuggestion, setActiveSuggestion] = useState<{ id: string, text: string, loading: boolean } | null>(null);

  // Rate Analysis Modal State
  const [showRateAnalysis, setShowRateAnalysis] = useState<{ id: string, name: string, unit: string } | null>(null);

  // Collapsed Categories State
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  // Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState('All');

  // INSIGHTS STATE
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loadingInsights, setLoadingInsights] = useState(false);

  const isLocked = !data.isPaid;

  // Takeoff Metadata
  const [takeoffMeta, setTakeoffMeta] = useState({
      projectName: data.projectName || "Sample Villa Project",
      client: "",
      contractor: "",
      consultant: ""
  });

  const [certMeta, setCertMeta] = useState<CertificateMetadata>({
      certNo: "01",
      valuationDate: new Date().toISOString().split('T')[0],
      clientName: "Client Name PLC",
      contractorName: "Contractor Name",
      contractRef: "REF-2025-001",
      projectTitle: data.projectName
  });

  // Certificate Signatures
  const [signatures, setSignatures] = useState({
      prepared: { name: '', date: new Date().toISOString().split('T')[0] },
      checked: { name: '', date: '' },
      approved: { name: '', date: '' }
  });

  const [retentionPct, setRetentionPct] = useState(5);
  const [vatPct, setVatPct] = useState(15);
  const [contingencyPct, setContingencyPct] = useState(10); // Default 10% Contingency
  const [advanceRecovery, setAdvanceRecovery] = useState(0);
  const [previousPayments, setPreviousPayments] = useState(0);

  const [items, setItems] = useState<TakeoffItem[]>(data.items || []);

  // CAD/Image Viewer State
  const [cadZoom, setCadZoom] = useState(1);
  const [cadPan, setCadPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const [showRating, setShowRating] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState('');

  // Identify file type
  const isPdf = activeFile?.name.toLowerCase().endsWith('.pdf') || activeFile?.type.includes('pdf');
  const isImage = activeFile?.type.includes('image') || activeFile?.name.toLowerCase().match(/\.(jpg|jpeg|png)$/);
  const isDwg = activeFile?.name.toLowerCase().endsWith('.dwg') || activeFile?.name.toLowerCase().endsWith('.dxf');

  // Handle local file re-upload for viewing
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleReloadDrawing = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          const file = e.target.files[0];
          const url = URL.createObjectURL(file);
          setLocalFileUrls(prev => ({...prev, [activeFile.name]: url}));
      }
  };

  useEffect(() => {
     // Reset zoom/pan when file changes
     setCadZoom(1);
     setCadPan({ x: 0, y: 0 });
  }, [activeFileIndex]);

  useEffect(() => {
     setItems(data.items);
     
     // Initialize prices if empty
     setUnitPrices(prev => {
         const newPrices = { ...prev };
         data.items.forEach(i => {
             const key = i.billItemDescription || i.description;
             if (newPrices[key] === undefined) {
                 newPrices[key] = i.contractRate || i.estimatedRate || 0;
             }
         });
         return newPrices;
     });
     
     // Initialize Overrides
     if (appMode === AppMode.PAYMENT) {
         const overrides: Record<string, { contract?: number, previous?: number }> = {};
         data.items.forEach(i => {
             const billName = (i.billItemDescription || i.description).includes(':') 
                ? (i.billItemDescription || i.description).split(':')[1].trim()
                : (i.billItemDescription || i.description);
             const key = `${billName}|${i.unit}|${i.category}`;
             
             if (i.contractQuantity !== undefined || i.previousQuantity !== undefined) {
                 overrides[key] = {
                     contract: i.contractQuantity,
                     previous: i.previousQuantity
                 };
             }
         });
         setBoqOverrides(prev => ({ ...prev, ...overrides }));
     }
  }, [data.items, appMode]);

  useEffect(() => {
      if (appMode === AppMode.PAYMENT) {
          setActiveTab('boq'); 
      } else {
          setActiveTab('list');
      }
  }, [appMode]);

  const handleGenerateInsights = async () => {
      setLoadingInsights(true);
      const res = await generateInsights(items);
      setInsights(res);
      setLoadingInsights(false);
  };

  useEffect(() => {
      if (activeTab === 'insights' && insights.length === 0 && !loadingInsights) {
          handleGenerateInsights();
      }
  }, [activeTab]);

  const categoryAppearanceOrder = useMemo(() => {
      const orderMap: Record<string, number> = {};
      items.forEach((item, index) => {
          if (orderMap[item.category] === undefined) {
              orderMap[item.category] = index;
          }
      });
      return orderMap;
  }, [items]);

  // Derived source list
  const uniqueSources = useMemo(() => {
      const sources = new Set(items.map(i => i.sourceRef || "Unknown").filter(s => s));
      return Array.from(sources);
  }, [items]);

  const boqGroups = useMemo(() => {
    const groups: Record<string, BoqGroup> = {};

    items.forEach((item, index) => {
        let billName = (item.billItemDescription || item.description);
        if (billName.includes(':')) {
            billName = billName.split(':')[1].trim();
        }

        const key = `${billName}|${item.unit}|${item.category}`;

        if (!groups[key]) {
            groups[key] = {
                id: key,
                name: billName,
                unit: item.unit,
                category: item.category,
                items: [],
                totalQuantity: 0,
                estimatedRate: item.estimatedRate || 0,
                contractRate: item.contractRate, 
                executedQuantity: 0,
                executedPercentage: 0,
                previousQuantity: 0,
                previousPercentage: 0,
                orderIndex: index 
            };
        }
        groups[key].items.push(item);
        
        const measuredQty = item.quantity;
        
        if (appMode === AppMode.PAYMENT) {
            groups[key].executedQuantity += measuredQty;
        } else {
            groups[key].totalQuantity += measuredQty;
        }
    });

    Object.values(groups).forEach(g => {
        if (appMode === AppMode.PAYMENT) {
            const saved = boqOverrides[g.id] || {};
            g.totalQuantity = saved.contract !== undefined ? saved.contract : g.executedQuantity;
            g.previousQuantity = saved.previous !== undefined ? saved.previous : 0;
        }

        if (g.totalQuantity !== 0) {
            g.executedPercentage = (g.executedQuantity / g.totalQuantity) * 100;
            g.previousPercentage = (g.previousQuantity / g.totalQuantity) * 100;
        }
    });

    return Object.values(groups).sort((a, b) => {
        const catOrderA = categoryAppearanceOrder[a.category] ?? 99999;
        const catOrderB = categoryAppearanceOrder[b.category] ?? 99999;
        
        if (catOrderA !== catOrderB) {
            return catOrderA - catOrderB;
        }
        return a.orderIndex - b.orderIndex;
    });
  }, [items, categoryAppearanceOrder, appMode, boqOverrides]);

  const boqCategories = useMemo(() => {
      const seen = new Set();
      const ordered = [];
      for (const g of boqGroups) {
          if (!seen.has(g.category)) {
              seen.add(g.category);
              ordered.push(g.category);
          }
      }
      return ordered;
  }, [boqGroups]);

  const categoryTotals = useMemo(() => {
    const t: Record<string, { contract: number, previous: number, current: number, cumulative: number }> = {};
    boqCategories.forEach(cat => {
        t[cat] = { contract: 0, previous: 0, current: 0, cumulative: 0 };
    });
    
    boqGroups.forEach(g => {
        const rate = unitPrices[g.name] || g.contractRate || g.estimatedRate || 0;
        t[g.category].contract += g.totalQuantity * rate;
        t[g.category].previous += g.previousQuantity * rate;
        t[g.category].current += g.executedQuantity * rate;
        t[g.category].cumulative += (g.previousQuantity + g.executedQuantity) * rate;
    });
    return t;
  }, [boqGroups, boqCategories, unitPrices]);

  // ANALYTICS DATA GENERATION
  const analyticsData = useMemo(() => {
      let totalMaterial = 0;
      let totalLabor = 0;
      let totalPlant = 0;
      let totalOverhead = 0;
      let totalProfit = 0;
      let unknownCost = 0;

      const categoryData: any[] = [];

      boqGroups.forEach(g => {
          const rate = unitPrices[g.name] || g.contractRate || g.estimatedRate || 0;
          const totalCost = g.totalQuantity * rate;
          
          // Use Rate Breakdown if available
          const bd = rateBreakdowns[g.id];
          if (bd) {
              const matCost = bd.materials.reduce((acc, i) => acc + i.cost, 0);
              const labCost = bd.labor.reduce((acc, i) => acc + i.cost, 0);
              const plantCost = bd.plant.reduce((acc, i) => acc + i.cost, 0);
              const subTotal = matCost + labCost + plantCost;
              const oh = subTotal * (bd.overheadPct / 100);
              const profit = (subTotal + oh) * (bd.profitPct / 100);
              
              // Scale to total quantity
              totalMaterial += matCost * g.totalQuantity;
              totalLabor += labCost * g.totalQuantity;
              totalPlant += plantCost * g.totalQuantity;
              totalOverhead += oh * g.totalQuantity;
              totalProfit += profit * g.totalQuantity;
          } else {
              // Heuristic Fallback (Estimated Split)
              // 50% Material, 30% Labor, 10% Plant, 10% Margin
              totalMaterial += totalCost * 0.5;
              totalLabor += totalCost * 0.3;
              totalPlant += totalCost * 0.1;
              totalProfit += totalCost * 0.1;
          }
      });

      // Prepare Chart Data
      const pieData = [
          { name: 'Materials', value: totalMaterial },
          { name: 'Labor', value: totalLabor },
          { name: 'Plant', value: totalPlant },
          { name: 'Overhead & Profit', value: totalOverhead + totalProfit },
      ];

      // Prepare Bar Chart Data
      boqCategories.forEach(cat => {
          categoryData.push({
              name: cat,
              cost: categoryTotals[cat].contract
          });
      });

      return { pieData, categoryData, totalProjectCost: totalMaterial + totalLabor + totalPlant + totalOverhead + totalProfit };
  }, [boqGroups, unitPrices, rateBreakdowns, boqCategories, categoryTotals]);

  const dimSheetGroups = useMemo(() => {
      const groups: Record<string, Record<string, TakeoffItem[]>> = {};
      items.forEach(item => {
          // Filter by Search Term
          if (searchTerm && !JSON.stringify(item).toLowerCase().includes(searchTerm.toLowerCase())) {
              return;
          }
          // Filter by Source
          if (sourceFilter !== 'All' && item.sourceRef !== sourceFilter) {
              return;
          }

          if (!groups[item.category]) groups[item.category] = {};
          let billName = (item.billItemDescription || item.description);
          if (billName.includes(':')) billName = billName.split(':')[1].trim();
          if (!groups[item.category][billName]) groups[item.category][billName] = [];
          groups[item.category][billName].push(item);
      });
      return groups;
  }, [items, searchTerm, sourceFilter]);

  const sortedCategories = useMemo(() => {
      return Object.keys(dimSheetGroups).sort((a, b) => {
          const catOrderA = categoryAppearanceOrder[a] ?? 99999;
          const catOrderB = categoryAppearanceOrder[b] ?? 99999;
          return catOrderA - catOrderB;
      });
  }, [dimSheetGroups, categoryAppearanceOrder]);

  const totals = useMemo(() => {
    let contract = 0;
    let previous = 0;
    let current = 0;
    let cumulative = 0;

    boqGroups.forEach(g => {
      const rate = unitPrices[g.name] || g.contractRate || g.estimatedRate || 0;
      contract += g.totalQuantity * rate;
      previous += g.previousQuantity * rate;
      current += g.executedQuantity * rate;
      cumulative += (g.previousQuantity * rate) + (g.executedQuantity * rate);
    });

    return { contract, previous, current, cumulative };
  }, [boqGroups, unitPrices]);

  const contingencyAmounts = useMemo(() => ({
      contract: totals.contract * (contingencyPct / 100),
      previous: totals.previous * (contingencyPct / 100),
      current: totals.current * (contingencyPct / 100),
      cumulative: totals.cumulative * (contingencyPct / 100)
  }), [totals, contingencyPct]);

  const taxableAmounts = useMemo(() => ({
      contract: totals.contract + (appMode === AppMode.ESTIMATION ? contingencyAmounts.contract : 0),
      previous: totals.previous + (appMode === AppMode.ESTIMATION ? contingencyAmounts.previous : 0),
      current: totals.current + (appMode === AppMode.ESTIMATION ? contingencyAmounts.current : 0),
      cumulative: totals.cumulative + (appMode === AppMode.ESTIMATION ? contingencyAmounts.cumulative : 0)
  }), [totals, contingencyAmounts, appMode]);

  const vatAmounts = useMemo(() => ({
      contract: taxableAmounts.contract * (vatPct / 100),
      previous: taxableAmounts.previous * (vatPct / 100),
      current: taxableAmounts.current * (vatPct / 100),
      cumulative: taxableAmounts.cumulative * (vatPct / 100)
  }), [taxableAmounts, vatPct]);

  const grandTotals = useMemo(() => ({
      contract: taxableAmounts.contract + vatAmounts.contract,
      previous: taxableAmounts.previous + vatAmounts.previous,
      current: taxableAmounts.current + vatAmounts.current,
      cumulative: taxableAmounts.cumulative + vatAmounts.cumulative
  }), [taxableAmounts, vatAmounts]);

  const workExecutedCumulative = totals.cumulative; 
  
  const retentionAmount = (workExecutedCumulative * retentionPct) / 100;
  const netValuation = workExecutedCumulative - retentionAmount - advanceRecovery;
  const vatAmountCert = (netValuation * vatPct) / 100;
  const totalCertified = netValuation + vatAmountCert;
  const amountDue = totalCertified - previousPayments;

  const toggleCategory = (cat: string) => {
      setCollapsedCategories(prev => ({
          ...prev,
          [cat]: !prev[cat]
      }));
  };

  const handleUpdateItem = (index: number, field: keyof TakeoffItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    if (field === 'dimension' || field === 'timesing') {
        const dimStr = newItems[index].dimension;
        const timesing = newItems[index].timesing;
        const nums = dimStr.match(/[+-]?([0-9]*[.])?[0-9]+/g);
        if (nums && nums.length > 0) {
            const product = nums.reduce((acc, n) => acc * parseFloat(n), 1);
            newItems[index].quantity = parseFloat((product * timesing).toFixed(2));
        }
    }
    setItems(newItems);
  };

  const handleManualMeasurement = (newItem: Partial<TakeoffItem>) => {
      const item: TakeoffItem = {
          id: crypto.randomUUID(),
          description: newItem.billItemDescription || "Manual Measurement",
          billItemDescription: newItem.billItemDescription,
          quantity: newItem.quantity || 0,
          unit: newItem.unit || 'm',
          category: newItem.category || 'Manual',
          timesing: 1,
          dimension: newItem.quantity?.toString() || '0',
          sourceRef: "Interactive Measure",
          confidence: 'High',
          ...newItem
      };
      setItems(prev => [...prev, item]);
      setShowMeasurementCanvas(false);
  };

  const handleUpdatePaymentQty = (groupId: string, value: number, field: 'contract' | 'previous') => {
      setBoqOverrides(prev => ({
          ...prev,
          [groupId]: {
              ...prev[groupId],
              [field]: value
          }
      }));
  };

  const handleSuggestRate = async (groupId: string, itemDescription: string) => {
      setActiveSuggestion({ id: groupId, text: "", loading: true });
      const result = await getRateSuggestion(itemDescription, projectCurrency);
      setActiveSuggestion({ id: groupId, text: result, loading: false });
  };

  const applySuggestion = (groupId: string, groupName: string, rangeText: string) => {
      const numMatch = rangeText.match(/([0-9,]+)/);
      if (numMatch) {
          const val = parseFloat(numMatch[1].replace(/,/g, ''));
          setUnitPrices(prev => ({ ...prev, [groupName]: val }));
      }
      setActiveSuggestion(null);
  };

  const handleRateRating = (rating: number) => {
      setUserRating(rating);
  };

  const handleSubmitRating = () => {
      if (userRating >= 1) {
          let msg = `I just used ConstructAI for my project "${data.projectName}" and gave it ${userRating} stars!`;
          if (feedbackText) {
              msg += `\n\nFeedback: ${feedbackText}`;
          }
          const encodedMsg = encodeURIComponent(msg);
          window.open(`https://wa.me/251927942534?text=${encodedMsg}`, '_blank');
      }
      setTimeout(() => {
          setShowRating(false);
          setFeedbackText('');
          setUserRating(0);
      }, 1000);
  };

  const handleSaveRateBreakdown = (breakdown: RateBreakdown) => {
      if (showRateAnalysis) {
          const totalMaterial = breakdown.materials.reduce((acc, i) => acc + i.cost, 0);
          const totalLabor = breakdown.labor.reduce((acc, i) => acc + i.cost, 0);
          const totalPlant = breakdown.plant.reduce((acc, i) => acc + i.cost, 0);
          const subTotal = totalMaterial + totalLabor + totalPlant;
          const overhead = subTotal * (breakdown.overheadPct / 100);
          const profit = (subTotal + overhead) * (breakdown.profitPct / 100);
          const finalRate = subTotal + overhead + profit;

          setRateBreakdowns(prev => ({ ...prev, [showRateAnalysis.id]: breakdown }));
          setUnitPrices(prev => ({ ...prev, [showRateAnalysis.name]: parseFloat(finalRate.toFixed(2)) }));
          setShowRateAnalysis(null);
      }
  };

  const addSignatureRows = (rows: any[]) => {
      rows.push([]);
      rows.push([]);
      rows.push(["APPROVAL SIGNATURES"]);
      rows.push([]);
      rows.push(["PREPARED BY:", signatures.prepared.name, "DATE:", signatures.prepared.date]);
      rows.push(["SIGNATURE:", "__________________________"]);
      rows.push([]);
      rows.push(["CHECKED BY:", signatures.checked.name, "DATE:", signatures.checked.date]);
      rows.push(["SIGNATURE:", "__________________________"]);
      rows.push([]);
      rows.push(["APPROVED BY:", signatures.approved.name, "DATE:", signatures.approved.date]);
      rows.push(["SIGNATURE:", "__________________________"]);
  };

  const handleExport = () => {
    if (isLocked) {
      onUnlockProject();
      return;
    }

    const wb = XLSX.utils.book_new();

    const dimRows: any[] = [];
    dimRows.push(["TAKEOFF SHEET"]);
    dimRows.push(["PROJECT NAME:", takeoffMeta.projectName]);
    dimRows.push(["CLIENT:", takeoffMeta.client]);
    dimRows.push(["CONTRACTOR:", takeoffMeta.contractor]);
    dimRows.push(["CONSULTANT:", takeoffMeta.consultant]);
    dimRows.push(["DATE:", new Date().toLocaleDateString()]);
    dimRows.push([]); 
    dimRows.push(["TIMESING", `DIMENSION (${data.unitSystem === 'imperial' ? 'ft' : 'm'})`, `QTY (${data.unitSystem === 'imperial' ? 'sq.ft/cu.yd' : 'm2/m3'})`, "DESCRIPTION", "SOURCE DRAWING"]);

    sortedCategories.forEach(cat => {
        dimRows.push(["", "", "", cat.toUpperCase(), ""]);
        Object.keys(dimSheetGroups[cat]).forEach(billName => {
            const groupItems = dimSheetGroups[cat][billName];
            dimRows.push(["", "", "", billName, ""]);
            let groupTotal = 0;
            groupItems.forEach(item => {
                dimRows.push([
                    item.timesing,
                    item.dimension, 
                    item.quantity, 
                    item.locationDescription,
                    item.sourceRef || ""
                ]);
                groupTotal += item.quantity;
            });
            const unit = groupItems[0]?.unit || "";
            dimRows.push(["", "", groupTotal.toFixed(2), `Total ${billName} (${unit})`, ""]);
            dimRows.push([]); 
        });
    });
    addSignatureRows(dimRows);

    const wsDim = XLSX.utils.aoa_to_sheet(dimRows);
    wsDim['!cols'] = [{ wch: 10 }, { wch: 25 }, { wch: 15 }, { wch: 60 }, { wch: 30 }]; 
    if(!wsDim['!merges']) wsDim['!merges'] = [];
    wsDim['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }); 
    XLSX.utils.book_append_sheet(wb, wsDim, "Takeoff Sheet");

    const boqRows: any[] = [];
    const summaryTitle = appMode === AppMode.PAYMENT 
       ? (isFinalAccount ? "FINAL SUMMARY" : "INTERIM SUMMARY PAGE 1")
       : "BILL OF QUANTITIES";

    boqRows.push([summaryTitle]); 
    boqRows.push(["PROJECT NAME:", takeoffMeta.projectName]); 
    boqRows.push(["CLIENT:", takeoffMeta.client]);
    boqRows.push(["CONTRACTOR:", takeoffMeta.contractor]);
    boqRows.push(["CONSULTANT:", takeoffMeta.consultant]);
    boqRows.push(["CURRENCY:", projectCurrency]);
    boqRows.push([]);

    let headerRow = [];
    if (appMode === AppMode.ESTIMATION) {
        headerRow = ["Ref", "Description", "Unit", "Quantity", "Rate", "Amount"];
    } else {
        headerRow = [
            "Ref", "Description", "Unit", 
            "Contract Qty", "Previous Qty", "Current Qty", "Cumulative Qty",
            "Rate", 
            "Contract Amt", "Previous Amt", "Current Amt", "Cumulative Amt"
        ];
    }
    boqRows.push(headerRow);

    let refCounter = 0;
    boqCategories.forEach((cat) => {
        const emptyCols = appMode === AppMode.ESTIMATION ? 5 : 11;
        boqRows.push([cat.toUpperCase(), ...Array(emptyCols).fill("")]);
        
        const catGroups = boqGroups.filter(g => g.category === cat);
        
        catGroups.forEach(g => {
             const ref = String.fromCharCode(65 + (refCounter % 26));
             refCounter++;
             const rate = unitPrices[g.name] || g.contractRate || g.estimatedRate || 0;
             const contractAmt = g.totalQuantity * rate;

             if (appMode === AppMode.ESTIMATION) {
                 boqRows.push([
                    ref, g.name, g.unit,
                    g.totalQuantity.toFixed(2),
                    rate.toFixed(2),
                    contractAmt.toFixed(2)
                 ]);
             } else {
                 const prevAmt = g.previousQuantity * rate;
                 const currAmt = g.executedQuantity * rate;
                 const cumAmt = prevAmt + currAmt; 
                 boqRows.push([
                    ref, g.name, g.unit,
                    g.totalQuantity.toFixed(2), g.previousQuantity.toFixed(2), g.executedQuantity.toFixed(2), (g.previousQuantity + g.executedQuantity).toFixed(2),
                    rate.toFixed(2),
                    contractAmt.toFixed(2), prevAmt.toFixed(2), currAmt.toFixed(2), cumAmt.toFixed(2)
                ]);
             }
        });

        const catTotal = categoryTotals[cat];
        if (appMode === AppMode.ESTIMATION) {
             boqRows.push(["", "Total Carried to Summary", "", "", "", catTotal.contract.toFixed(2)]);
        }
        boqRows.push([]); 
    });

    if (appMode === AppMode.PAYMENT) {
         boqRows.push(["", "", "", "", "", "", "", "", ""]); 
         boqRows.push(["", "SUB TOTAL", "", "", "", "", "", "",
            totals.contract.toFixed(2), totals.previous.toFixed(2), totals.current.toFixed(2), totals.cumulative.toFixed(2)
         ]);
         boqRows.push(["", `ADD: VAT (${vatPct}%)`, "", "", "", "", "", "",
            vatAmounts.contract.toFixed(2), vatAmounts.previous.toFixed(2), vatAmounts.current.toFixed(2), vatAmounts.cumulative.toFixed(2)
         ]);
         boqRows.push(["", "GRAND TOTAL", "", "", "", "", "", "",
            grandTotals.contract.toFixed(2), grandTotals.previous.toFixed(2), grandTotals.current.toFixed(2), grandTotals.cumulative.toFixed(2)
         ]);
    }
    
    addSignatureRows(boqRows);

    const wsBoq = XLSX.utils.aoa_to_sheet(boqRows);
    if (appMode === AppMode.ESTIMATION) {
        wsBoq['!cols'] = [{ wch: 5 }, { wch: 40 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 15 }];
        if(!wsBoq['!merges']) wsBoq['!merges'] = [];
        wsBoq['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }); 
    } else {
        wsBoq['!cols'] = [{ wch: 5 }, { wch: 40 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
        if(!wsBoq['!merges']) wsBoq['!merges'] = [];
        wsBoq['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 11 } });
    }
    XLSX.utils.book_append_sheet(wb, wsBoq, appMode === AppMode.ESTIMATION ? "Bill of Quantities" : "Valuation Summary");

    if (appMode === AppMode.ESTIMATION) {
        const summaryRows: any[] = [];
        summaryRows.push(["GRAND SUMMARY"]);
        summaryRows.push([]);
        summaryRows.push(["PROJECT NAME:", takeoffMeta.projectName]);
        summaryRows.push(["CLIENT:", takeoffMeta.client]);
        summaryRows.push(["CONTRACTOR:", takeoffMeta.contractor]);
        summaryRows.push(["CONSULTANT:", takeoffMeta.consultant]);
        summaryRows.push([]);
        summaryRows.push(["Description", "Amount"]);
        boqCategories.forEach(cat => {
            summaryRows.push([cat, categoryTotals[cat].contract.toFixed(2)]);
        });
        summaryRows.push(["", ""]);
        summaryRows.push(["SUB TOTAL (A)", totals.contract.toFixed(2)]);
        summaryRows.push([`CONTINGENCY (${contingencyPct}%)`, contingencyAmounts.contract.toFixed(2)]);
        summaryRows.push(["TOTAL AMOUNT (A+B)", taxableAmounts.contract.toFixed(2)]);
        summaryRows.push([`VAT (${vatPct}%)`, vatAmounts.contract.toFixed(2)]);
        summaryRows.push(["GRAND TOTAL", grandTotals.contract.toFixed(2)]);
        
        addSignatureRows(summaryRows);

        const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
        wsSummary['!cols'] = [{ wch: 40 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(wb, wsSummary, "Grand Summary");
    }

    if (appMode === AppMode.PAYMENT) {
        const certRows: any[] = [];
        certRows.push([isFinalAccount ? "FINAL PAYMENT CERTIFICATE" : "INTERIM PAYMENT CERTIFICATE"]);
        certRows.push(["PROJECT:", takeoffMeta.projectName]);
        certRows.push(["CLIENT:", takeoffMeta.client]);
        certRows.push(["CONTRACTOR:", takeoffMeta.contractor]);
        certRows.push(["CONSULTANT:", takeoffMeta.consultant]);
        certRows.push(["DATE:", certMeta.valuationDate]);
        certRows.push([]);
        certRows.push(["DESCRIPTION", "", `AMOUNT (${projectCurrency})`]);
        certRows.push(["Gross Value of Work Executed (Cumul. Sub Total)", "", workExecutedCumulative.toFixed(2)]);
        certRows.push([`Less: Retention (${retentionPct}%)`, "", `-${retentionAmount.toFixed(2)}`]);
        certRows.push([`Less: Advance Recovery`, "", `-${advanceRecovery.toFixed(2)}`]);
        certRows.push(["Net Value", "", netValuation.toFixed(2)]);
        certRows.push([`Add: VAT (${vatPct}%) on Net Value`, "", vatAmountCert.toFixed(2)]);
        certRows.push(["TOTAL CERTIFIED TO DATE", "", totalCertified.toFixed(2)]);
        certRows.push(["Less: Previous Payments (Certified to Date)", "", `-${previousPayments.toFixed(2)}`]);
        certRows.push(["NET AMOUNT DUE THIS CERTIFICATE", "", amountDue.toFixed(2)]);

        const amountInWords = numberToWords(amountDue, projectCurrency);
        const certText = `Therefore we certify to contractor payable net amount of ${amountDue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} ${projectCurrency} (${amountInWords})`;
        certRows.push([]);
        certRows.push([certText]);
        
        addSignatureRows(certRows);

        const wsCert = XLSX.utils.aoa_to_sheet(certRows);
        wsCert['!cols'] = [{ wch: 40 }, { wch: 5 }, { wch: 20 }];
        if(!wsCert['!merges']) wsCert['!merges'] = [];
        wsCert['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }); 
        
        const certRowIndex = certRows.findIndex(r => r[0] === certText);
        if (certRowIndex !== -1) {
            wsCert['!merges'].push({ s: { r: certRowIndex, c: 0 }, e: { r: certRowIndex, c: 2 } });
        }

        XLSX.utils.book_append_sheet(wb, wsCert, "Payment Certificate");
    }

    if (data.rebarItems && data.rebarItems.length > 0) {
       const rebarRows = [];
       rebarRows.push(["REBAR SCHEDULE"]);
       rebarRows.push(["PROJECT:", takeoffMeta.projectName]);
       rebarRows.push(["CLIENT:", takeoffMeta.client]);
       rebarRows.push(["CONTRACTOR:", takeoffMeta.contractor]);
       rebarRows.push(["CONSULTANT:", takeoffMeta.consultant]);
       rebarRows.push([]);
       rebarRows.push(["Member", "Bar Mark", "Type", "Shape", "No. Mb", "No. Bar", "Total No", "Length", "Total Len", "Weight (kg)"]);
       data.rebarItems.forEach(r => {
           rebarRows.push([r.member, r.id, r.barType, r.shapeCode, r.noOfMembers, r.barsPerMember, r.totalBars, r.lengthPerBar, r.totalLength, r.totalWeight]);
       });
       
       addSignatureRows(rebarRows);

       const wsRebar = XLSX.utils.aoa_to_sheet(rebarRows);
       XLSX.utils.book_append_sheet(wb, wsRebar, "Rebar Schedule");
    }

    if (data.technicalQueries && data.technicalQueries.length > 0) {
        const tqRows = [];
        tqRows.push(["CLARIFICATIONS & ASSUMPTIONS"]);
        tqRows.push(["PROJECT:", takeoffMeta.projectName]);
        tqRows.push([]);
        tqRows.push(["ID", "QUERY / AMBIGUITY", "ASSUMPTION MADE", "IMPACT"]);
        data.technicalQueries.forEach(tq => {
            tqRows.push([tq.id, tq.query, tq.assumption, tq.impactLevel]);
        });
        
        const wsTq = XLSX.utils.aoa_to_sheet(tqRows);
        wsTq['!cols'] = [{ wch: 10 }, { wch: 60 }, { wch: 60 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(wb, wsTq, "Clarifications");
    }

    XLSX.writeFile(wb, `Takeoff_${takeoffMeta.projectName.replace(/\s+/g, '_')}.xlsx`);
    setTimeout(() => setShowRating(true), 2000);
  };

  const renderMetaInputs = (theme: 'light' | 'dark' = 'light') => (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 text-left ${theme === 'dark' ? 'text-white' : ''} print:hidden`}>
      <div>
        <label className={`text-[10px] font-bold uppercase tracking-wider block mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Project Name</label>
        <input 
          type="text" 
          className={`w-full bg-slate-100 border border-slate-300 rounded px-2 outline-none text-sm font-bold py-1.5 transition-colors placeholder:font-normal focus:border-brand-500 focus:bg-white`}
          value={takeoffMeta.projectName} 
          onChange={(e) => setTakeoffMeta({...takeoffMeta, projectName: e.target.value})}
          placeholder="Project Name"
        />
      </div>
      <div>
        <label className={`text-[10px] font-bold uppercase tracking-wider block mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Client</label>
        <input 
          type="text" 
          className={`w-full bg-slate-100 border border-slate-300 rounded px-2 outline-none text-sm font-bold py-1.5 transition-colors placeholder:font-normal focus:border-brand-500 focus:bg-white`}
          value={takeoffMeta.client} 
          onChange={(e) => setTakeoffMeta({...takeoffMeta, client: e.target.value})}
          placeholder="Client Name"
        />
      </div>
      <div>
        <label className={`text-[10px] font-bold uppercase tracking-wider block mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Contractor</label>
        <input 
          type="text" 
          className={`w-full bg-slate-100 border border-slate-300 rounded px-2 outline-none text-sm font-bold py-1.5 transition-colors placeholder:font-normal focus:border-brand-500 focus:bg-white`}
          value={takeoffMeta.contractor} 
          onChange={(e) => setTakeoffMeta({...takeoffMeta, contractor: e.target.value})}
          placeholder="Contractor Name"
        />
      </div>
      <div>
        <label className={`text-[10px] font-bold uppercase tracking-wider block mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Consultant</label>
        <input 
          type="text" 
          className={`w-full bg-slate-100 border border-slate-300 rounded px-2 outline-none text-sm font-bold py-1.5 transition-colors placeholder:font-normal focus:border-brand-500 focus:bg-white`}
          value={takeoffMeta.consultant} 
          onChange={(e) => setTakeoffMeta({...takeoffMeta, consultant: e.target.value})}
          placeholder="Consultant Name"
        />
      </div>
    </div>
  );

  const renderSignatures = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12 pt-8 border-t border-slate-300 break-inside-avoid">
        <div className="space-y-4">
            <div className="flex items-center text-slate-900">
                <PenTool className="w-4 h-4 mr-2 text-slate-600" />
                <h4 className="font-bold uppercase text-xs tracking-wider">Prepared By</h4>
            </div>
            <input 
                type="text" 
                placeholder="Name" 
                className="w-full border-b border-slate-300 py-1 text-sm focus:border-brand-500 outline-none bg-transparent font-mono"
                value={signatures.prepared.name}
                onChange={e => setSignatures({...signatures, prepared: {...signatures.prepared, name: e.target.value}})}
            />
            <input 
                type="date" 
                className="w-full border-b border-slate-300 py-1 text-sm focus:border-brand-500 outline-none bg-transparent text-slate-500 font-mono"
                value={signatures.prepared.date}
                onChange={e => setSignatures({...signatures, prepared: {...signatures.prepared, date: e.target.value}})}
            />
            <div className="h-16 border-b border-slate-300 border-dashed flex items-end pb-2">
                <span className="text-xs text-slate-400">Signature</span>
            </div>
        </div>

        <div className="space-y-4">
            <div className="flex items-center text-slate-900">
                <FileCheck className="w-4 h-4 mr-2 text-slate-600" />
                <h4 className="font-bold uppercase text-xs tracking-wider">Checked By</h4>
            </div>
            <input 
                type="text" 
                placeholder="Name" 
                className="w-full border-b border-slate-300 py-1 text-sm focus:border-brand-500 outline-none bg-transparent font-mono"
                value={signatures.checked.name}
                onChange={e => setSignatures({...signatures, checked: {...signatures.checked, name: e.target.value}})}
            />
            <input 
                type="date" 
                className="w-full border-b border-slate-300 py-1 text-sm focus:border-brand-500 outline-none bg-transparent text-slate-500 font-mono"
                value={signatures.checked.date}
                onChange={e => setSignatures({...signatures, checked: {...signatures.checked, date: e.target.value}})}
            />
            <div className="h-16 border-b border-slate-300 border-dashed flex items-end pb-2">
                <span className="text-xs text-slate-400">Signature</span>
            </div>
        </div>

        <div className="space-y-4">
            <div className="flex items-center text-slate-900">
                <BadgeDollarSign className="w-4 h-4 mr-2 text-slate-600" />
                <h4 className="font-bold uppercase text-xs tracking-wider">Approved By</h4>
            </div>
            <input 
                type="text" 
                placeholder="Name" 
                className="w-full border-b border-slate-300 py-1 text-sm focus:border-brand-500 outline-none bg-transparent font-mono"
                value={signatures.approved.name}
                onChange={e => setSignatures({...signatures, approved: {...signatures.approved, name: e.target.value}})}
            />
            <input 
                type="date" 
                className="w-full border-b border-slate-300 py-1 text-sm focus:border-brand-500 outline-none bg-transparent text-slate-500 font-mono"
                value={signatures.approved.date}
                onChange={e => setSignatures({...signatures, approved: {...signatures.approved, date: e.target.value}})}
            />
            <div className="h-16 border-b border-slate-300 border-dashed flex items-end pb-2">
                <span className="text-xs text-slate-400">Signature</span>
            </div>
        </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-slate-100 print:bg-white font-sans">
      
      {/* PROFESSIONAL TITLE BAR (DARK MODE) - Hide in Print */}
      <div className="bg-slate-900 border-b border-slate-700 px-4 py-3 flex items-center justify-between sticky top-0 z-30 shadow-md print:hidden">
        <div className="flex items-center space-x-4">
          <button onClick={onReset} title="Back to Dashboard" className="p-1.5 hover:bg-slate-700 rounded-md text-slate-400 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-sm font-bold text-white flex items-center tracking-wide">
              {data.projectName}
              <span className="mx-3 text-slate-600">|</span>
              <span className="text-slate-400 font-normal">{appMode === AppMode.PAYMENT ? 'Payment Certificate' : 'Bill of Quantities'}</span>
              
              {/* Payment Badge */}
              <div className={`ml-4 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider flex items-center ${isLocked ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50' : 'bg-green-500/20 text-green-400 border border-green-500/50'}`}>
                 {isLocked ? <Lock className="w-3 h-3 mr-1" /> : <Unlock className="w-3 h-3 mr-1" />}
                 {isLocked ? 'LOCKED' : 'UNLOCKED'}
              </div>
            </h1>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center bg-slate-800 rounded-md p-0.5 border border-slate-700">
             {['ETB', 'USD'].map(c => (
                <button key={c} onClick={() => setProjectCurrency(c)} className={`px-3 py-1 text-[10px] font-bold rounded transition-all ${projectCurrency === c ? 'bg-slate-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-300'}`}>
                   {c}
                </button>
             ))}
          </div>
          <button onClick={() => setShowRating(true)} className="text-slate-400 hover:text-yellow-400 transition-colors p-2">
            <Star className="w-4 h-4" />
          </button>
          <div className="h-6 w-px bg-slate-700 mx-2"></div>
          <button onClick={onAddDrawing} className="text-xs font-bold text-slate-300 hover:text-white flex items-center px-3 py-1.5 rounded hover:bg-slate-800 transition-colors">
            <PlusCircle className="w-3.5 h-3.5 mr-2" />
            Add File
          </button>
          <button 
            onClick={handleExport} 
            className={`flex items-center px-4 py-1.5 rounded-md text-xs font-bold shadow-sm transition-all ${!isLocked ? 'bg-brand-600 hover:bg-brand-500 text-white' : 'bg-amber-500 hover:bg-amber-400 text-white'}`}
          >
            {!isLocked ? ( <><Download className="w-3.5 h-3.5 mr-2" /> Export XLSX</> ) : ( <><Lock className="w-3.5 h-3.5 mr-2" /> Unlock (1 Credit)</> )}
          </button>
        </div>
      </div>

      {/* RIBBON TOOLBAR & TABS - Hide in Print */}
      <div className="bg-slate-200 border-b border-slate-300 px-4 pt-4 flex items-end space-x-1 overflow-x-auto print:hidden shadow-inner">
        <button onClick={() => setActiveTab('list')} className={`px-4 py-2 text-xs font-bold border-t border-l border-r rounded-t-md transition-all flex items-center whitespace-nowrap ${activeTab === 'list' ? 'bg-white border-slate-300 text-slate-900 shadow-sm relative top-px' : 'bg-slate-100 border-transparent text-slate-500 hover:bg-slate-50'}`}>
          <Files className="w-3.5 h-3.5 mr-2" /> Takeoff Sheet
        </button>
        <button onClick={() => setActiveTab('boq')} className={`px-4 py-2 text-xs font-bold border-t border-l border-r rounded-t-md transition-all flex items-center whitespace-nowrap ${activeTab === 'boq' ? 'bg-white border-slate-300 text-slate-900 shadow-sm relative top-px' : 'bg-slate-100 border-transparent text-slate-500 hover:bg-slate-50'}`}>
          <Coins className="w-3.5 h-3.5 mr-2" /> {appMode === AppMode.PAYMENT ? 'Valuation' : 'Bill of Quantities'}
        </button>
        <button onClick={() => setActiveTab('insights')} className={`px-4 py-2 text-xs font-bold border-t border-l border-r rounded-t-md transition-all flex items-center whitespace-nowrap ${activeTab === 'insights' ? 'bg-white border-slate-300 text-brand-600 shadow-sm relative top-px' : 'bg-gradient-to-r from-brand-50 to-purple-50 border-transparent text-brand-700 hover:bg-brand-100'}`}>
          <Lightbulb className="w-3.5 h-3.5 mr-2" /> Smart Insights
        </button>
        <button onClick={() => setActiveTab('analytics')} className={`px-4 py-2 text-xs font-bold border-t border-l border-r rounded-t-md transition-all flex items-center whitespace-nowrap ${activeTab === 'analytics' ? 'bg-white border-slate-300 text-slate-900 shadow-sm relative top-px' : 'bg-slate-100 border-transparent text-slate-500 hover:bg-slate-50'}`}>
          <PieChartIcon className="w-3.5 h-3.5 mr-2" /> Analytics
        </button>
        {appMode === AppMode.ESTIMATION && (
            <button onClick={() => setActiveTab('summary')} className={`px-4 py-2 text-xs font-bold border-t border-l border-r rounded-t-md transition-all flex items-center whitespace-nowrap ${activeTab === 'summary' ? 'bg-white border-slate-300 text-slate-900 shadow-sm relative top-px' : 'bg-slate-100 border-transparent text-slate-500 hover:bg-slate-50'}`}>
              <ClipboardList className="w-3.5 h-3.5 mr-2" /> Grand Summary
            </button>
        )}
        {appMode === AppMode.PAYMENT && (
            <button onClick={() => setActiveTab('payment')} className={`px-4 py-2 text-xs font-bold border-t border-l border-r rounded-t-md transition-all flex items-center whitespace-nowrap ${activeTab === 'payment' ? 'bg-white border-slate-300 text-slate-900 shadow-sm relative top-px' : 'bg-slate-100 border-transparent text-slate-500 hover:bg-slate-50'}`}>
              <FileCheck className="w-3.5 h-3.5 mr-2" /> Payment Cert
            </button>
        )}
        <button onClick={() => setActiveTab('rebar')} className={`px-4 py-2 text-xs font-bold border-t border-l border-r rounded-t-md transition-all flex items-center whitespace-nowrap ${activeTab === 'rebar' ? 'bg-white border-slate-300 text-slate-900 shadow-sm relative top-px' : 'bg-slate-100 border-transparent text-slate-500 hover:bg-slate-50'}`}>
          <Grid className="w-3.5 h-3.5 mr-2" /> Rebar
        </button>
        <button onClick={() => setActiveTab('technical')} className={`px-4 py-2 text-xs font-bold border-t border-l border-r rounded-t-md transition-all flex items-center whitespace-nowrap ${activeTab === 'technical' ? 'bg-white border-slate-300 text-slate-900 shadow-sm relative top-px' : 'bg-slate-100 border-transparent text-slate-500 hover:bg-slate-50'}`}>
          <HelpCircle className="w-3.5 h-3.5 mr-2" /> Queries
        </button>
      </div>

      <div className="flex-1 overflow-hidden flex bg-white print:bg-white relative">
        
        {/* PAY TO PRINT PROTECTION */}
        {isLocked && (
            <div className="hidden print:flex absolute inset-0 z-50 flex-col items-center justify-center bg-white p-20 text-center space-y-6">
                <div className="border-4 border-slate-900 p-8 rounded-2xl">
                    <Lock className="w-24 h-24 text-slate-900 mx-auto mb-6" />
                    <h1 className="text-4xl font-black text-slate-900 uppercase tracking-widest mb-4">PREVIEW ONLY</h1>
                    <p className="text-xl font-bold text-slate-600 mb-8">PAYMENT REQUIRED TO PRINT</p>
                    <p className="text-sm text-slate-500 font-mono">Please unlock this project in ConstructAI Dashboard to export official documents.</p>
                </div>
                <div className="text-[10px] text-slate-400 mt-12 font-mono">
                    Document protected by ConstructAI DRM.
                </div>
            </div>
        )}

        <div className={`flex-1 overflow-y-auto custom-scrollbar p-6 print:p-0 print:overflow-visible ${activeTab !== 'list' ? 'w-full' : ''} ${isLocked ? 'print:hidden' : ''}`}>
          
          {/* TAB: SMART INSIGHTS */}
          {activeTab === 'insights' && (
              <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4">
                  <div className="text-center">
                      <div className="inline-flex items-center justify-center p-3 bg-brand-50 rounded-full mb-4">
                          <Lightbulb className="w-8 h-8 text-brand-600" />
                      </div>
                      <h2 className="text-2xl font-black text-slate-900 mb-2">Value Engineering & Risk Intelligence</h2>
                      <p className="text-slate-500 max-w-lg mx-auto">
                          Our AI Senior Commercial Manager has audited your project. Review the strategic insights below to optimize costs and mitigate risks.
                      </p>
                  </div>

                  {loadingInsights ? (
                      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                          <Loader2 className="w-12 h-12 animate-spin mb-4 text-brand-500" />
                          <p className="text-sm font-bold uppercase tracking-wider">Auditing Bill of Quantities...</p>
                      </div>
                  ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* SAVINGS COLUMN */}
                          <div className="space-y-4">
                              <h3 className="text-sm font-bold text-green-700 uppercase tracking-wide flex items-center border-b border-green-200 pb-2">
                                  <TrendingDown className="w-4 h-4 mr-2" /> Cost Saving Opportunities
                              </h3>
                              {insights.filter(i => i.type === 'saving').map((insight, idx) => (
                                  <div key={idx} className="bg-white border-l-4 border-green-500 p-5 rounded-r-xl shadow-sm hover:shadow-md transition-shadow">
                                      <div className="flex justify-between items-start mb-2">
                                          <h4 className="font-bold text-slate-800">{insight.title}</h4>
                                          <span className="bg-green-100 text-green-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase">{insight.impact}</span>
                                      </div>
                                      <p className="text-sm text-slate-600 leading-relaxed">{insight.description}</p>
                                  </div>
                              ))}
                              {insights.filter(i => i.type === 'saving').length === 0 && (
                                  <div className="p-4 text-center text-slate-400 text-xs italic bg-slate-50 rounded">No major savings detected.</div>
                              )}
                          </div>

                          {/* RISKS COLUMN */}
                          <div className="space-y-4">
                              <h3 className="text-sm font-bold text-amber-700 uppercase tracking-wide flex items-center border-b border-amber-200 pb-2">
                                  <ShieldAlert className="w-4 h-4 mr-2" /> Risk Alerts & Scope Gaps
                              </h3>
                              {insights.filter(i => i.type === 'risk').map((insight, idx) => (
                                  <div key={idx} className="bg-white border-l-4 border-amber-500 p-5 rounded-r-xl shadow-sm hover:shadow-md transition-shadow">
                                      <div className="flex justify-between items-start mb-2">
                                          <h4 className="font-bold text-slate-800">{insight.title}</h4>
                                          <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase">{insight.impact}</span>
                                      </div>
                                      <p className="text-sm text-slate-600 leading-relaxed">{insight.description}</p>
                                  </div>
                              ))}
                              {insights.filter(i => i.type === 'risk').length === 0 && (
                                  <div className="p-4 text-center text-slate-400 text-xs italic bg-slate-50 rounded">No critical risks detected.</div>
                              )}
                          </div>
                      </div>
                  )}
                  
                  <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-center text-xs text-blue-800">
                      <strong>Disclaimer:</strong> These insights are generated by AI based on standard engineering practices. Always validate with a qualified professional before making contractual changes.
                  </div>
              </div>
          )}

          {/* TAB 1: TAKEOFF SHEET (REDESIGNED FOR PROFESSIONAL QS LOOK) */}
          {activeTab === 'list' && (
            <div className="bg-white border border-slate-300 shadow-sm mb-24 max-w-6xl mx-auto print:shadow-none print:border-none print:mb-0 print:max-w-none">
              <div className="p-6 bg-slate-50 border-b border-slate-300 print:bg-white print:border-none">
                 <div className="text-center mb-6">
                    <h2 className="text-xl font-bold text-slate-900 uppercase tracking-widest border-b-2 border-slate-900 inline-block pb-1">
                       Takeoff Sheet
                    </h2>
                    <p className="text-[10px] text-slate-500 mt-1 font-mono uppercase">Standard Dimension Paper (SMM7)</p>
                 </div>
                 {renderMetaInputs()}
                 
                 {/* SEARCH & FILTER BAR */}
                 <div className="flex flex-col md:flex-row gap-2 mt-4 print:hidden">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                        <input 
                            type="text" 
                            placeholder="Filter items..." 
                            className="w-full pl-9 pr-4 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-brand-500 outline-none"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center space-x-2 min-w-[200px]">
                        <Filter className="text-slate-400 w-3.5 h-3.5" />
                        <select 
                            className="w-full py-1.5 px-2 border border-slate-300 rounded text-xs outline-none focus:ring-1 focus:ring-brand-500 bg-white"
                            value={sourceFilter}
                            onChange={(e) => setSourceFilter(e.target.value)}
                        >
                            <option value="All">All Drawings</option>
                            {uniqueSources.map(s => (
                                <option key={s} value={s}>{s.length > 30 ? s.substring(0,30)+'...' : s}</option>
                            ))}
                        </select>
                    </div>
                 </div>
              </div>

              {/* PROFESSIONAL DIMENSION PAPER TABLE */}
              <div className="overflow-x-auto print:overflow-visible">
                  <table className="w-full text-xs border-collapse bg-white print:bg-white">
                    <thead className="bg-slate-800 text-white font-bold print:bg-white print:text-black">
                      <tr>
                        <th className="py-2 px-2 text-center w-12 border-r border-slate-600 print:border-slate-300">Times</th>
                        <th className="py-2 px-2 text-center w-24 border-r border-slate-600 print:border-slate-300">Dim</th>
                        <th className="py-2 px-2 text-center w-20 border-r border-slate-600 print:border-slate-300">Qty</th>
                        <th className="py-2 px-4 text-left border-r border-slate-600 print:border-slate-300">Description</th>
                        <th className="py-2 px-2 text-left w-20 text-slate-400 print:text-black">Ref</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-mono text-slate-800">
                      {sortedCategories.map(cat => {
                        const isCollapsed = collapsedCategories[cat];
                        return (
                        <React.Fragment key={cat}>
                            {/* Category Header (Collapsible) */}
                            <tr 
                                className="bg-slate-100 cursor-pointer hover:bg-slate-200 transition-colors print:bg-slate-100"
                                onClick={() => toggleCategory(cat)}
                            >
                                <td className="border-r border-slate-300 bg-slate-200 print:bg-white"></td>
                                <td className="border-r border-slate-300 bg-slate-200 print:bg-white"></td>
                                <td className="border-r border-slate-300 bg-slate-200 print:bg-white"></td>
                                <td className="py-1.5 px-4 font-bold text-slate-800 uppercase text-[10px] tracking-wider border-r border-slate-300 flex items-center print:block">
                                    <span className="print:hidden">{isCollapsed ? <ChevronRight className="w-3 h-3 mr-2" /> : <ChevronDown className="w-3 h-3 mr-2" />}</span>
                                    {cat} 
                                    <span className="ml-2 text-slate-500 font-normal normal-case print:hidden">({Object.keys(dimSheetGroups[cat]).length} Items)</span>
                                </td>
                                <td></td>
                            </tr>
                            
                            {(!isCollapsed || window.matchMedia('print').matches) && Object.keys(dimSheetGroups[cat]).map((billName, grpIdx) => {
                                const groupItems = dimSheetGroups[cat][billName];
                                const groupTotal = groupItems.reduce((acc, i) => acc + i.quantity, 0);
                                const unit = groupItems[0]?.unit || "";

                                return (
                                    <React.Fragment key={grpIdx}>
                                        {/* Bill Item Header */}
                                        <tr className="bg-white">
                                            <td className="border-r border-slate-300 h-6"></td>
                                            <td className="border-r border-slate-300"></td>
                                            <td className="border-r border-slate-300"></td>
                                            <td className="py-1 px-4 font-bold text-brand-700 text-[10px] uppercase underline border-r border-slate-300 pt-2 print:text-black">{billName}</td>
                                            <td></td>
                                        </tr>
                                        {groupItems.map((item, index) => {
                                            const originalIndex = items.findIndex(i => i.id === item.id);
                                            const lowConfidence = item.confidence === 'Low';
                                            
                                            return (
                                                <tr key={item.id} className={`hover:bg-blue-50 group ${lowConfidence ? 'bg-amber-50' : ''}`}>
                                                    {/* Column 1: Timesing */}
                                                    <td className="p-1 text-center border-r border-slate-300 align-top relative">
                                                        <input type="number" className="w-full text-center bg-transparent border-none focus:ring-1 focus:ring-brand-500 outline-none text-slate-600 font-medium font-mono text-xs"
                                                            value={item.timesing !== 1 ? item.timesing : ''} onChange={(e) => handleUpdateItem(originalIndex, 'timesing', parseFloat(e.target.value) || 1)} 
                                                            placeholder={item.timesing !== 1 ? "" : "/"}
                                                        />
                                                    </td>
                                                    
                                                    {/* Column 2: Dimension */}
                                                    <td className="p-1 text-center border-r border-slate-300 align-top">
                                                        <input type="text" className="w-full text-center bg-transparent border-none focus:ring-1 focus:ring-brand-500 outline-none font-bold text-slate-800 font-mono text-xs"
                                                            value={item.dimension} onChange={(e) => handleUpdateItem(originalIndex, 'dimension', e.target.value)} />
                                                    </td>
                                                    
                                                    {/* Column 3: Squaring (Qty) */}
                                                    <td className="p-1 text-center border-r border-slate-300 align-top bg-slate-50/50">
                                                        <div className="font-bold text-slate-900 py-1 print:text-black font-mono">{item.quantity.toFixed(2)}</div>
                                                    </td>
                                                    
                                                    {/* Column 4: Description */}
                                                    <td className="p-1 px-4 text-slate-600 text-xs font-sans border-r border-slate-300 align-top relative">
                                                        <input type="text" className="w-full bg-transparent border-none focus:ring-1 focus:ring-brand-500 outline-none font-medium"
                                                            value={item.locationDescription} onChange={(e) => handleUpdateItem(originalIndex, 'locationDescription', e.target.value)} />
                                                        {lowConfidence && (
                                                            <div className="absolute right-2 top-1/2 -translate-y-1/2 text-amber-500 print:hidden" title="Low Confidence: Verify this item">
                                                                <AlertCircle className="w-3 h-3" />
                                                            </div>
                                                        )}
                                                    </td>

                                                    {/* Ref */}
                                                    <td className="p-1 px-2 text-slate-400 text-[9px] font-sans align-top">
                                                        {item.sourceRef ? item.sourceRef.substring(0, 10) : "-"}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {/* Total Row */}
                                        <tr className="border-t border-slate-300">
                                            <td className="border-r border-slate-300 bg-slate-50 print:bg-white"></td>
                                            <td className="border-r border-slate-300 bg-slate-50 print:bg-white"></td> 
                                            <td className="p-1 text-center border-r border-slate-300 font-bold text-slate-900 bg-slate-100 border-b-2 border-double border-slate-400 print:bg-white print:text-black print:border-black font-mono">{groupTotal.toFixed(2)}</td>
                                            <td className="p-1 px-4 text-slate-500 italic text-[10px] border-r border-slate-300 bg-slate-50 print:bg-white">Total {unit}</td>
                                            <td className="bg-slate-50 print:bg-white"></td>
                                        </tr>
                                        <tr><td colSpan={5} className="h-2 bg-slate-100 border-t border-slate-300 border-b print:border-none print:bg-white print:h-0"></td></tr>
                                    </React.Fragment>
                                );
                            })}
                        </React.Fragment>
                      )})}
                    </tbody>
                  </table>
              </div>
              <div className="p-6">
                 {renderSignatures()}
              </div>
            </div>
          )}

          {/* TAB 2: SUMMARY (BOQ) */}
          {activeTab === 'boq' && (
             <div className="bg-white border border-slate-300 shadow-sm mb-24 print:shadow-none print:border-none print:mb-0">
               <div className="p-6 bg-slate-50 border-b border-slate-300 print:bg-white print:border-none">
                 <div className="text-center mb-6">
                    <h2 className="text-xl font-bold text-slate-900 uppercase tracking-widest border-b-2 border-slate-900 inline-block pb-1">
                        {appMode === AppMode.PAYMENT 
                            ? (isFinalAccount ? "FINAL SUMMARY" : "INTERIM SUMMARY PAGE 1")
                            : "BILL OF QUANTITIES"
                        }
                    </h2>
                 </div>
                 {renderMetaInputs()}
               </div>
               <table className="w-full text-xs border-collapse">
                 <thead className="bg-slate-800 text-white font-bold print:bg-white print:text-black">
                   <tr>
                     <th className="py-2 px-2 text-left w-12 border-r border-slate-600 print:border-slate-300">Ref</th>
                     <th className="py-2 px-2 text-left border-r border-slate-600 print:border-slate-300">Description</th>
                     <th className="py-2 px-2 text-center w-12 border-r border-slate-600 print:border-slate-300">Unit</th>
                     {appMode === AppMode.ESTIMATION ? (
                       <>
                         <th className="py-2 px-2 text-center w-20 border-r border-slate-600 print:border-slate-300">Qty</th>
                         <th className="py-2 px-2 text-right w-24 border-r border-slate-600 print:border-slate-300">Rate</th>
                         <th className="py-2 px-2 text-right w-24">Amount</th>
                       </>
                     ) : (
                       <>
                         <th className="py-2 px-2 text-center w-20 bg-slate-700 border-l border-slate-600 print:bg-white print:border-slate-300">Cont.</th>
                         <th className="py-2 px-2 text-center w-20 bg-slate-700 border-r border-slate-600 print:bg-white print:border-slate-300">Prev</th>
                         <th className="py-2 px-2 text-center w-20 bg-slate-600 font-bold border-b-2 border-brand-500 print:bg-white print:border-black">Curr</th>
                         <th className="py-2 px-2 text-center w-20 bg-slate-700 border-r border-slate-600 print:bg-white print:border-slate-300">Cumul</th>
                         <th className="py-2 px-2 text-right w-20 border-r border-slate-600 print:border-slate-300">Rate</th>
                         <th className="py-2 px-2 text-right w-24 bg-slate-700 border-r border-slate-600 print:bg-white print:border-slate-300">Cont. Amt</th>
                         <th className="py-2 px-2 text-right w-24 bg-slate-700 border-r border-slate-600 print:bg-white print:border-slate-300">Prev. Amt</th>
                         <th className="py-2 px-2 text-right w-24 bg-slate-700 border-r border-slate-600 print:bg-white print:border-slate-300">Curr. Amt</th>
                         <th className="py-2 px-2 text-right w-24 bg-slate-600 font-bold print:bg-white">Cum. Amt</th>
                       </>
                     )}
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-200">
                    {boqCategories.map((cat, catIdx) => {
                         const colSpan = appMode === AppMode.ESTIMATION ? 6 : 12;
                         const catGroups = boqGroups.filter(g => g.category === cat);
                         
                         return (
                            <React.Fragment key={catIdx}>
                                 {/* Category Header */}
                                 <tr className="bg-slate-100 border-y border-slate-300 print:bg-slate-100">
                                    <td colSpan={colSpan} className="py-1.5 px-4 font-bold text-slate-800 uppercase text-[10px] tracking-wider">
                                        {cat}
                                    </td>
                                 </tr>
                                 {/* Items Loop */}
                                 {catGroups.map((group, idx) => {
                                     const rate = unitPrices[group.name] || group.contractRate || group.estimatedRate || 0;
                                     const contractAmt = group.totalQuantity * rate;
                                     const showSuggestion = activeSuggestion && activeSuggestion.id === group.id;
                                     const hasBreakdown = rateBreakdowns[group.id] !== undefined;

                                     return (
                                         <tr key={group.id} className="hover:bg-blue-50 relative group/row print:hover:bg-transparent">
                                             <td className="p-2 text-slate-500 font-mono text-[10px] border-r border-slate-200">{String.fromCharCode(65 + (idx % 26))}</td>
                                             <td className="p-2 border-r border-slate-200"><span className="font-medium text-slate-800">{group.name}</span></td>
                                             <td className="p-2 text-center text-slate-600 bg-slate-50/50 print:bg-transparent border-r border-slate-200">{group.unit}</td>
                                             
                                             {appMode === AppMode.ESTIMATION ? (
                                                <>
                                                    <td className="p-2 text-center font-mono text-slate-900 border-r border-slate-200">{group.totalQuantity.toFixed(2)}</td>
                                                    <td className="p-2 text-right relative border-r border-slate-200">
                                                        <div className="flex items-center justify-end space-x-1">
                                                            <div className="relative">
                                                                <input 
                                                                    type="number" 
                                                                    className={`w-20 text-right bg-transparent border-b border-dashed border-slate-300 outline-none font-mono focus:border-brand-500 text-xs ${hasBreakdown ? 'text-green-700 font-bold border-green-300' : ''}`}
                                                                    value={rate} 
                                                                    onChange={(e) => { const newPrices = {...unitPrices, [group.name]: parseFloat(e.target.value)}; setUnitPrices(newPrices); }} 
                                                                />
                                                                {hasBreakdown && <span className="absolute -top-1.5 -right-1.5 w-1.5 h-1.5 bg-green-500 rounded-full print:hidden"></span>}
                                                            </div>
                                                            
                                                            <button 
                                                                onClick={() => setShowRateAnalysis({ id: group.id, name: group.name, unit: group.unit })}
                                                                className={`p-1 rounded hover:bg-slate-200 transition-colors print:hidden ${hasBreakdown ? 'text-green-600 bg-green-50' : 'text-slate-400'}`}
                                                                title="Rate Analysis"
                                                            >
                                                                <Calculator className="w-3.5 h-3.5" />
                                                            </button>

                                                            <button onClick={() => handleSuggestRate(group.id, group.name)} className="opacity-0 group-hover/row:opacity-100 p-1 rounded bg-slate-100 text-slate-500 hover:text-brand-600 transition-all print:hidden">
                                                                <Sparkles className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                        {showSuggestion && (
                                                            <div className="absolute z-50 right-0 top-full mt-2 w-48 bg-white rounded shadow-xl border border-slate-300 p-3 animate-in fade-in zoom-in-95 print:hidden">
                                                                {activeSuggestion.loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto text-slate-500" /> : 
                                                                    <button onClick={() => applySuggestion(group.id, group.name, activeSuggestion.text)} className="text-xs font-bold text-brand-700 hover:underline block w-full text-left">{activeSuggestion.text}</button>
                                                                }
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="p-2 text-right font-mono text-slate-900 font-bold">{contractAmt.toFixed(2)}</td>
                                                </>
                                             ) : (
                                                // Payment mode columns (omitted for brevity)
                                                <>
                                                    <td className="p-2 text-center border-l border-slate-200 border-r">
                                                        <input type="number" className="w-16 text-center bg-transparent border-none outline-none font-mono text-slate-700 text-xs font-bold"
                                                            value={group.totalQuantity} onChange={(e) => handleUpdatePaymentQty(group.id, parseFloat(e.target.value) || 0, 'contract')} />
                                                    </td>
                                                    <td className="p-2 text-center border-r border-slate-200">
                                                        <input type="number" className="w-16 text-center bg-transparent border-none outline-none font-mono text-slate-600 text-xs"
                                                            value={group.previousQuantity} onChange={(e) => handleUpdatePaymentQty(group.id, parseFloat(e.target.value) || 0, 'previous')} />
                                                    </td>
                                                    <td className="p-2 text-center border-r border-slate-200"><div className="w-16 mx-auto text-center bg-white border border-slate-300 rounded-sm text-xs py-0.5 font-bold text-slate-900 print:border-none print:text-black font-mono">{group.executedQuantity.toFixed(2)}</div></td>
                                                    <td className="p-2 text-center font-mono font-bold text-slate-800 border-r border-slate-200 bg-slate-50 print:bg-transparent">{(group.previousQuantity + group.executedQuantity).toFixed(2)}</td>
                                                    <td className="p-2 text-right border-r border-slate-200">
                                                         <input type="number" className="w-16 text-right bg-transparent border-b border-dashed border-slate-300 outline-none font-mono text-xs" 
                                                                value={rate} onChange={(e) => { const newPrices = {...unitPrices, [group.name]: parseFloat(e.target.value)}; setUnitPrices(newPrices); }} />
                                                    </td>
                                                    <td className="p-2 text-right font-mono text-slate-500 text-xs border-r border-slate-200 print:bg-transparent">{contractAmt.toFixed(2)}</td>
                                                    <td className="p-2 text-right font-mono text-slate-500 text-xs border-r border-slate-200 print:bg-transparent">{(group.previousQuantity * rate).toFixed(2)}</td>
                                                    <td className="p-2 text-right font-mono text-slate-800 font-medium text-xs border-r border-slate-200 print:text-black print:bg-transparent">{(group.executedQuantity * rate).toFixed(2)}</td>
                                                    <td className="p-2 text-right font-mono text-slate-900 font-bold text-xs bg-slate-50 print:bg-transparent">{((group.previousQuantity + group.executedQuantity) * rate).toFixed(2)}</td>
                                                </>
                                             )}
                                         </tr>
                                     );
                                 })}
                            </React.Fragment>
                         );
                    })}
                 </tbody>
               </table>
               <div className="p-6 border-t border-slate-200">
                 {renderSignatures()}
               </div>
             </div>
          )}

          {/* TAB 3: GRAND SUMMARY (NEW) */}
          {activeTab === 'summary' && appMode === AppMode.ESTIMATION && (
             <div className="bg-white border border-slate-300 shadow-sm mb-24 max-w-4xl mx-auto print:shadow-none print:border-none print:mb-0 print:max-w-none animate-in fade-in slide-in-from-bottom-2">
               <div className="p-8 bg-white border-b border-slate-200">
                 <div className="text-center mb-8">
                    <h2 className="text-2xl font-black text-slate-900 uppercase tracking-widest border-b-4 border-slate-900 inline-block pb-2">
                        Grand Summary
                    </h2>
                 </div>
                 {renderMetaInputs('light')}
               </div>
               
               <div className="p-8">
                   <table className="w-full text-sm border-collapse border border-slate-300">
                       <thead className="bg-slate-100 text-slate-900 uppercase tracking-wider text-xs">
                           <tr>
                               <th className="border border-slate-300 p-3 text-left">Description</th>
                               <th className="border border-slate-300 p-3 text-right w-48">Amount ({projectCurrency})</th>
                           </tr>
                       </thead>
                       <tbody className="font-mono text-slate-700">
                           {boqCategories.map(cat => (
                               <tr key={cat}>
                                   <td className="border border-slate-300 p-3">{cat}</td>
                                   <td className="border border-slate-300 p-3 text-right font-bold">
                                       {categoryTotals[cat].contract.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                   </td>
                               </tr>
                           ))}
                           {/* Empty Spacer */}
                           <tr><td className="border border-slate-300 p-4 bg-slate-50" colSpan={2}></td></tr>
                           
                           {/* Totals */}
                           <tr>
                               <td className="border border-slate-300 p-3 font-bold text-slate-800">SUB TOTAL (A)</td>
                               <td className="border border-slate-300 p-3 text-right font-bold text-slate-900">
                                   {totals.contract.toLocaleString(undefined, {minimumFractionDigits: 2})}
                               </td>
                           </tr>
                           <tr>
                               <td className="border border-slate-300 p-3 flex items-center justify-between">
                                   <span className="font-bold text-slate-800">ADD: CONTINGENCY</span>
                                   <div className="flex items-center bg-slate-100 rounded px-2 py-1 print:hidden">
                                       <input 
                                           type="number" 
                                           className="w-12 bg-transparent text-right font-mono text-xs outline-none"
                                           value={contingencyPct}
                                           onChange={(e) => setContingencyPct(parseFloat(e.target.value)||0)}
                                       />
                                       <span className="text-xs text-slate-500 ml-1">%</span>
                                   </div>
                                   <span className="hidden print:inline font-normal text-slate-500">({contingencyPct}%)</span>
                               </td>
                               <td className="border border-slate-300 p-3 text-right font-bold text-slate-600">
                                   {contingencyAmounts.contract.toLocaleString(undefined, {minimumFractionDigits: 2})}
                               </td>
                           </tr>
                           <tr>
                               <td className="border border-slate-300 p-3 font-bold text-slate-800">TOTAL AMOUNT (A+B)</td>
                               <td className="border border-slate-300 p-3 text-right font-bold text-slate-900">
                                   {taxableAmounts.contract.toLocaleString(undefined, {minimumFractionDigits: 2})}
                               </td>
                           </tr>
                           <tr>
                               <td className="border border-slate-300 p-3 flex items-center justify-between">
                                   <span className="font-bold text-slate-800">ADD: VAT</span>
                                   <div className="flex items-center bg-slate-100 rounded px-2 py-1 print:hidden">
                                       <input 
                                           type="number" 
                                           className="w-12 bg-transparent text-right font-mono text-xs outline-none"
                                           value={vatPct}
                                           onChange={(e) => setVatPct(parseFloat(e.target.value)||0)}
                                       />
                                       <span className="text-xs text-slate-500 ml-1">%</span>
                                   </div>
                                   <span className="hidden print:inline font-normal text-slate-500">({vatPct}%)</span>
                               </td>
                               <td className="border border-slate-300 p-3 text-right font-bold text-slate-600">
                                   {vatAmounts.contract.toLocaleString(undefined, {minimumFractionDigits: 2})}
                               </td>
                           </tr>
                           <tr className="bg-slate-900 text-white">
                               <td className="border border-slate-900 p-4 font-black uppercase text-lg">Grand Total</td>
                               <td className="border border-slate-900 p-4 text-right font-black text-lg font-mono">
                                   {projectCurrency} {grandTotals.contract.toLocaleString(undefined, {minimumFractionDigits: 2})}
                               </td>
                           </tr>
                       </tbody>
                   </table>
                   
                   <div className="mt-8 text-xs text-slate-500 italic">
                       Amount in Words: {numberToWords(grandTotals.contract, projectCurrency)}
                   </div>
               </div>

               <div className="p-8 border-t border-slate-200">
                   {renderSignatures()}
               </div>
             </div>
          )}

        </div>
        
        {/* SIDEBAR PREVIEW - HIDE IN PRINT */}
        {activeTab === 'list' && activeFile && (
            <div className={`w-1/3 bg-slate-100 border-l border-slate-300 relative overflow-hidden hidden lg:flex flex-col print:hidden`}>
                <div className="bg-white border-b border-slate-300 px-3 py-2 flex justify-between items-center text-[10px] font-bold text-slate-500 z-10 shadow-sm">
                   <div className="flex items-center space-x-2">
                       <Eye className="w-3 h-3 mr-1" /> 
                       <div className="relative">
                          <select 
                            className="appearance-none bg-transparent font-bold text-brand-700 pr-6 cursor-pointer focus:outline-none"
                            value={activeFileIndex}
                            onChange={(e) => setActiveFileIndex(Number(e.target.value))}
                          >
                             {files.map((f, i) => (
                                <option key={i} value={i}>
                                   {f.name.length > 25 ? f.name.substring(0, 25) + '...' : f.name}
                                </option>
                             ))}
                          </select>
                          <ChevronDown className="w-3 h-3 text-brand-700 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" />
                       </div>
                   </div>
                   <div className="flex items-center space-x-2">
                       <span className="text-slate-400 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{isPdf ? 'PDF' : (isDwg ? 'CAD' : 'IMG')}</span>
                       {isImage && activeFileUrl && (
                           <button onClick={() => setShowMeasurementCanvas(true)} className="flex items-center bg-slate-900 text-white px-2 py-0.5 rounded hover:bg-slate-700 transition-colors" title="Launch Interactive Overlay">
                               <Maximize2 className="w-3 h-3 mr-1" /> Measure
                           </button>
                       )}
                   </div>
                </div>

                {isPdf && activeFileUrl ? (
                    <iframe src={activeFileUrl} className="w-full h-full border-none" title="PDF Viewer" />
                ) : (isPdf && !activeFileUrl ? (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 p-8 text-center bg-slate-50 space-y-4">
                        <FileCode className="w-12 h-12 text-slate-300" />
                        <div>
                            <h3 className="text-sm font-bold text-slate-800">Preview Not Available</h3>
                            <p className="text-xs mt-1 text-slate-400 max-w-[200px] mx-auto">This project was restored from backup. Please re-upload the drawing to view it.</p>
                        </div>
                        <label className="cursor-pointer bg-white border border-slate-300 hover:border-brand-500 text-brand-600 px-4 py-2 rounded shadow-sm text-xs font-bold flex items-center transition-all">
                            <RefreshCw className="w-3 h-3 mr-2" />
                            Reload {activeFile.name.substring(0,10)}...
                            <input type="file" className="hidden" accept=".pdf" onChange={handleReloadDrawing} />
                        </label>
                    </div>
                ) : null)}

                {isImage && activeFileUrl ? (
                    <div className="flex-1 relative overflow-hidden bg-slate-900 grid-pattern">
                        <div className="absolute top-4 left-4 z-20 bg-slate-800/80 backdrop-blur rounded shadow-sm border border-slate-600 p-1 space-y-1">
                            <button onClick={() => setCadZoom(z => Math.min(z + 0.5, 5))} className="p-1 hover:bg-white/10 rounded block"><ZoomIn className="w-3.5 h-3.5 text-white" /></button>
                            <button onClick={() => setCadZoom(z => Math.max(z - 0.5, 0.5))} className="p-1 hover:bg-white/10 rounded block"><ZoomOut className="w-3.5 h-3.5 text-white" /></button>
                        </div>
                        <div className="absolute bottom-4 right-4 z-20">
                            <button onClick={() => setShowMeasurementCanvas(true)} className="bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-lg flex items-center transition-all">
                                <PenTool className="w-4 h-4 mr-2" /> Interactive Measure
                            </button>
                        </div>
                        <div 
                            className="w-full h-full cursor-move flex items-center justify-center"
                            onMouseDown={(e) => { setIsDragging(true); setDragStart({ x: e.clientX - cadPan.x, y: e.clientY - cadPan.y }); }}
                            onMouseMove={(e) => { if (isDragging) setCadPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y }); }}
                            onMouseUp={() => setIsDragging(false)}
                            onMouseLeave={() => setIsDragging(false)}
                        >
                            <div style={{ transform: `translate(${cadPan.x}px, ${cadPan.y}px) scale(${cadZoom})`, transition: isDragging ? 'none' : 'transform 0.1s ease-out' }}>
                                <img src={activeFileUrl} alt="Drawing Plan" className="max-w-none shadow-2xl border border-slate-700" draggable={false} />
                            </div>
                        </div>
                    </div>
                ) : (isImage && !activeFileUrl ? (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 p-8 text-center bg-slate-50 space-y-4">
                        <FileImage className="w-12 h-12 text-slate-300" />
                        <div>
                            <h3 className="text-sm font-bold text-slate-800">Image Not Loaded</h3>
                            <p className="text-xs mt-1 text-slate-400 max-w-[200px] mx-auto">Re-upload to enable measurement tools.</p>
                        </div>
                        <label className="cursor-pointer bg-white border border-slate-300 hover:border-brand-500 text-brand-600 px-4 py-2 rounded shadow-sm text-xs font-bold flex items-center transition-all">
                            <RefreshCw className="w-3 h-3 mr-2" />
                            Reload Image
                            <input type="file" className="hidden" accept="image/*" onChange={handleReloadDrawing} />
                        </label>
                    </div>
                ) : null)}

                {!isPdf && !isImage && (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 p-8 text-center bg-slate-50">
                        <div className="w-16 h-16 bg-slate-200 rounded flex items-center justify-center mb-4">
                            <AlertTriangle className="w-8 h-8 text-amber-500" />
                        </div>
                        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Preview Unavailable</h3>
                        <p className="text-xs mt-2 text-slate-400">Binary file format (DWG/DXF)</p>
                    </div>
                )}
            </div>
        )}
      </div>

      {/* --- MEASUREMENT CANVAS OVERLAY --- */}
      {showMeasurementCanvas && activeFileUrl && (
          <MeasurementCanvas 
             imageFile={{ url: activeFileUrl, name: activeFile.name }}
             onClose={() => setShowMeasurementCanvas(false)}
             onSaveMeasurement={handleManualMeasurement}
          />
      )}

      {showRateAnalysis && (
          <RateAnalysisModal 
             item={showRateAnalysis}
             existingBreakdown={rateBreakdowns[showRateAnalysis.id]}
             onClose={() => setShowRateAnalysis(null)}
             onSave={handleSaveRateBreakdown}
             currency={projectCurrency}
          />
      )}

      {showRating && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 print:hidden">
              <div className="bg-white p-8 rounded shadow-2xl max-w-sm w-full text-center relative overflow-hidden border border-slate-200">
                  <Star className="w-12 h-12 text-yellow-400 mx-auto mb-4 fill-current" />
                  <h3 className="text-lg font-bold text-slate-800 mb-2">How was your experience?</h3>
                  <div className="flex justify-center space-x-2 mb-6">
                      {[1,2,3,4,5].map(star => (
                          <button key={star} onClick={() => handleRateRating(star)} className={`p-2 rounded-full hover:bg-slate-50 transition-colors transform ${userRating >= star ? 'text-yellow-400' : 'text-slate-300'}`}>
                              <Star className={`w-6 h-6 ${userRating >= star ? 'fill-current' : ''}`} />
                          </button>
                      ))}
                  </div>
                  {userRating > 0 && (
                      <div className="animate-in slide-in-from-bottom-2 duration-300">
                          <textarea 
                             className="w-full p-3 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-brand-500 outline-none resize-none mb-4 bg-white"
                             rows={3}
                             placeholder="Feedback..."
                             value={feedbackText}
                             onChange={(e) => setFeedbackText(e.target.value)}
                          />
                          <button 
                             onClick={handleSubmitRating}
                             className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-2 rounded text-sm transition-colors"
                          >
                             Submit
                          </button>
                      </div>
                  )}
                  <button onClick={() => setShowRating(false)} className="text-xs text-slate-400 hover:text-slate-600 mt-4">Close</button>
              </div>
          </div>
      )}
    </div>
  );
};

interface RateAnalysisModalProps {
    item: { id: string, name: string, unit: string };
    existingBreakdown?: RateBreakdown;
    onClose: () => void;
    onSave: (breakdown: RateBreakdown) => void;
    currency: string;
}

const RateAnalysisModal: React.FC<RateAnalysisModalProps> = ({ item, existingBreakdown, onClose, onSave, currency }) => {
    const [breakdown, setBreakdown] = useState<RateBreakdown>(existingBreakdown || {
        materials: [],
        labor: [],
        plant: [],
        overheadPct: 15,
        profitPct: 10
    });

    const [newItemName, setNewItemName] = useState('');
    const [newItemCost, setNewItemCost] = useState('');
    const [activeSection, setActiveSection] = useState<'materials' | 'labor' | 'plant'>('materials');

    const addItem = () => {
        if (!newItemName || !newItemCost) return;
        const component: RateComponent = {
            id: crypto.randomUUID(),
            name: newItemName,
            cost: parseFloat(newItemCost)
        };
        setBreakdown(prev => ({
            ...prev,
            [activeSection]: [...prev[activeSection], component]
        }));
        setNewItemName('');
        setNewItemCost('');
    };

    const removeItem = (section: 'materials' | 'labor' | 'plant', id: string) => {
        setBreakdown(prev => ({
            ...prev,
            [section]: prev[section].filter(i => i.id !== id)
        }));
    };

    const totalMaterials = breakdown.materials.reduce((acc, i) => acc + i.cost, 0);
    const totalLabor = breakdown.labor.reduce((acc, i) => acc + i.cost, 0);
    const totalPlant = breakdown.plant.reduce((acc, i) => acc + i.cost, 0);
    const subTotal = totalMaterials + totalLabor + totalPlant;
    const overhead = subTotal * (breakdown.overheadPct / 100);
    const profit = (subTotal + overhead) * (breakdown.profitPct / 100);
    const finalRate = subTotal + overhead + profit;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] overflow-hidden border border-slate-200">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 flex items-center">
                            <Calculator className="w-5 h-5 mr-2 text-brand-600" />
                            Rate Analysis
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 font-mono">{item.name} ({item.unit})</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-200 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                    <div className="flex space-x-2 mb-6 border-b border-slate-200 pb-1">
                        {(['materials', 'labor', 'plant'] as const).map(sec => (
                            <button
                                key={sec}
                                onClick={() => setActiveSection(sec)}
                                className={`px-4 py-2 text-sm font-bold capitalize transition-colors border-b-2 ${
                                    activeSection === sec 
                                    ? 'text-brand-600 border-brand-600' 
                                    : 'text-slate-500 border-transparent hover:text-slate-800'
                                }`}
                            >
                                {sec}
                            </button>
                        ))}
                    </div>

                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6">
                        <div className="flex space-x-2 mb-2">
                            <input 
                                type="text" 
                                placeholder="Component Name (e.g. Cement)" 
                                className="flex-1 px-3 py-2 border border-slate-300 rounded text-sm outline-none focus:border-brand-500"
                                value={newItemName}
                                onChange={e => setNewItemName(e.target.value)}
                            />
                            <input 
                                type="number" 
                                placeholder="Cost" 
                                className="w-24 px-3 py-2 border border-slate-300 rounded text-sm outline-none focus:border-brand-500"
                                value={newItemCost}
                                onChange={e => setNewItemCost(e.target.value)}
                            />
                            <button onClick={addItem} className="bg-slate-900 text-white p-2 rounded hover:bg-slate-800">
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                        <ul className="space-y-2">
                            {breakdown[activeSection].map(comp => (
                                <li key={comp.id} className="flex justify-between items-center bg-white p-2 rounded border border-slate-100 text-sm">
                                    <span className="text-slate-700">{comp.name}</span>
                                    <div className="flex items-center space-x-3">
                                        <span className="font-mono font-bold text-slate-900">{comp.cost.toFixed(2)}</span>
                                        <button onClick={() => removeItem(activeSection, comp.id)} className="text-red-400 hover:text-red-600">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </li>
                            ))}
                            {breakdown[activeSection].length === 0 && (
                                <li className="text-center text-xs text-slate-400 py-2 italic">No items added yet.</li>
                            )}
                        </ul>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Overhead %</label>
                            <input 
                                type="number" 
                                className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-bold text-slate-700"
                                value={breakdown.overheadPct}
                                onChange={e => setBreakdown({...breakdown, overheadPct: parseFloat(e.target.value) || 0})}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Profit %</label>
                            <input 
                                type="number" 
                                className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-bold text-slate-700"
                                value={breakdown.profitPct}
                                onChange={e => setBreakdown({...breakdown, profitPct: parseFloat(e.target.value) || 0})}
                            />
                        </div>
                    </div>
                </div>

                <div className="bg-slate-50 px-6 py-4 border-t border-slate-200">
                    <div className="flex justify-between items-center text-xs text-slate-500 mb-1">
                        <span>Base Cost (Mat + Lab + Plt):</span>
                        <span>{subTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-slate-500 mb-1">
                        <span>Overhead ({breakdown.overheadPct}%):</span>
                        <span>{overhead.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-slate-500 mb-4">
                        <span>Profit ({breakdown.profitPct}%):</span>
                        <span>{profit.toFixed(2)}</span>
                    </div>
                    
                    <div className="flex justify-between items-center mb-6">
                        <span className="text-sm font-bold text-slate-800 uppercase">Final Unit Rate</span>
                        <span className="text-2xl font-black text-brand-600 font-mono">
                            {currency} {finalRate.toFixed(2)}
                        </span>
                    </div>

                    <button 
                        onClick={() => onSave(breakdown)}
                        className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 rounded-lg flex items-center justify-center transition-colors shadow-lg shadow-brand-500/20"
                    >
                        <Save className="w-4 h-4 mr-2" /> Apply Rate to Estimate
                    </button>
                </div>
            </div>
        </div>
    );
};
