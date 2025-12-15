
export interface TakeoffItem {
  id: string;
  description: string; // Legacy field, kept for compatibility
  billItemDescription?: string; // The GENERIC technical description for the Bill (e.g. "Concrete in Beams")
  locationDescription?: string; // The SPECIFIC location for the Dim Sheet (e.g. "Axis A-1")
  sourceRef?: string; // NEW: Traces back to specific drawing (e.g. "Drg-01 & Drg-05")
  timesing: number; 
  dimension: string; 
  quantity: number; 
  unit: string; 
  category: string; 
  confidence: string;
  estimatedRate?: number; // AI Estimated Unit Rate
  contractRate?: number; // Rate extracted from uploaded Contract/BOQ
  
  // Payment Mode Fields
  completedPercentage?: number; // 0-100
  previousPercentage?: number; // Work done in previous certs
  
  // Excel Integration Fields
  contractQuantity?: number; // Extracted from uploaded Excel
  previousQuantity?: number; // Extracted from uploaded Excel
}

export interface RebarItem {
  id: string; 
  member: string; 
  barType: string; 
  shapeCode: string; 
  noOfMembers: number; 
  barsPerMember: number;
  totalBars: number; 
  lengthPerBar: number; 
  totalLength: number; 
  totalWeight: number; 
}

export interface TechnicalQuery {
  id: string;
  query: string;
  assumption: string;
  impactLevel: 'Low' | 'Medium' | 'High';
}

export interface ScheduleTask {
  id: string;
  taskId: string; // e.g., "1.1"
  activity: string;
  category: string; // e.g., "Substructure"
  duration: number; // Days
  startDate: string; // ISO Date String
  endDate: string; // ISO Date String
  dependencies: string[]; // IDs of predecessor tasks
  resources: string; // e.g., "Excavator, 3 Laborers"
  totalCost?: number; // NEW: Cost Loading for this task
  progress: number; // 0-100
  criticalPath: boolean;
  notes?: string;
}

export interface CertificateMetadata {
  certNo: string;
  valuationDate: string;
  clientName: string;
  contractorName: string;
  contractRef: string;
  projectTitle: string;
}

export interface TakeoffResult {
  id?: string; // Unique Project ID
  isPaid?: boolean; // NEW: Tracks if the project has been unlocked/purchased
  date?: string; // Creation Date
  projectName: string;
  sourceFiles?: string[]; // Tracks all files merged into this result
  drawingType?: string; 
  unitSystem?: 'metric' | 'imperial'; // New field to track the system used
  appMode?: AppMode; // Track which mode created this project
  items: TakeoffItem[];
  rebarItems: RebarItem[];
  scheduleItems?: ScheduleTask[]; // NEW: For Scheduling Mode
  technicalQueries?: TechnicalQuery[]; // New field for QS Clarifications
  summary: string;
}

export interface UploadedFile {
  name: string;
  type: string;
  data: string; 
  url: string; 
}

export enum AppState {
  LANDING = 'LANDING',
  DASHBOARD = 'DASHBOARD', // NEW: Project Hub
  MODE_SELECT = 'MODE_SELECT', // New Step
  UPLOAD = 'UPLOAD',
  INSTRUCTIONS = 'INSTRUCTIONS',
  ANALYZING = 'ANALYZING',
  RESULTS = 'RESULTS',
  ERROR = 'ERROR'
}

export enum AppMode {
  ESTIMATION = 'ESTIMATION', // Standard Takeoff / BOQ
  PAYMENT = 'PAYMENT',       // IPC / Valuation
  SCHEDULING = 'SCHEDULING',  // New Construction Schedule
  RESCHEDULING = 'RESCHEDULING' // Optimize/Recover existing schedule
}
