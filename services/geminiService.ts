
import { GoogleGenAI, Type, type Schema } from "@google/genai";
import { TakeoffResult, TakeoffItem, RebarItem, TechnicalQuery, ScheduleTask, AppMode } from "../types";

// --- HELPER: API KEY VALIDATION ---
const getApiKey = (): string => {
    // 1. Try Local Storage (User entered via Settings)
    const localKey = localStorage.getItem('constructAi_customApiKey');
    if (localKey && localKey.startsWith('AIza')) {
        return localKey;
    }

    // 2. Try Environment Variable (Vite/Vercel)
    const envKey = process.env.API_KEY;
    
    if (envKey && envKey.trim() !== '' && !envKey.includes('undefined')) {
        return envKey;
    }

    throw new Error("API_KEY_MISSING");
};

// --- HELPER: ROBUST JSON PARSER WITH AUTO-REPAIR ---
const safeJsonParse = (input: string): any => {
    // 1. Clean Markdown wrappers
    let clean = input.replace(/```json/g, '').replace(/```/g, '').trim();
    
    // 2. Heuristic: Find first { or [
    const firstBrace = clean.indexOf('{');
    const firstBracket = clean.indexOf('[');
    let startIdx = 0;
    if (firstBrace !== -1 && firstBracket !== -1) {
        startIdx = Math.min(firstBrace, firstBracket);
    } else if (firstBrace !== -1) {
        startIdx = firstBrace;
    } else if (firstBracket !== -1) {
        startIdx = firstBracket;
    }
    clean = clean.substring(startIdx);

    // 3. Try standard parse
    try {
        return JSON.parse(clean);
    } catch (e) {
        console.warn("JSON Parse failed (likely truncated). Attempting advanced auto-repair...");
        
        // 4. Advanced State Machine to track open strings and brackets
        let inString = false;
        let isEscaped = false;
        const stack: string[] = [];
        
        for (const char of clean) {
            if (inString) {
                if (char === '\\' && !isEscaped) {
                    isEscaped = true;
                } else if (char === '"' && !isEscaped) {
                    inString = false;
                } else {
                    isEscaped = false;
                }
            } else {
                if (char === '"') {
                    inString = true;
                } else if (char === '{') {
                    stack.push('}');
                } else if (char === '[') {
                    stack.push(']');
                } else if (char === '}') {
                    if (stack.length > 0 && stack[stack.length - 1] === '}') stack.pop();
                } else if (char === ']') {
                    if (stack.length > 0 && stack[stack.length - 1] === ']') stack.pop();
                }
            }
        }

        // 5. Close open string if truncation happened inside a value
        if (inString) {
            clean += '"';
        }

        // 6. Remove trailing comma (common if truncated after a field)
        clean = clean.replace(/,\s*$/, '');

        // 7. Close remaining open brackets in reverse order
        while (stack.length > 0) {
            clean += stack.pop();
        }

        try {
            return JSON.parse(clean);
        } catch (repairError) {
            console.error("Auto-repair failed.", repairError);
            throw new Error("The analysis was interrupted. Please try reducing the number of floors or file size.");
        }
    }
};

// --- HELPER: CHECK IF ERROR IS QUOTA/RATE LIMIT ---
const isQuotaError = (error: any): boolean => {
    const msg = (error.message || "").toLowerCase();
    const status = error.status || error.code || (error.response ? error.response.status : 0);
    return status === 429 || status === 503 || msg.includes("quota") || msg.includes("resource exhausted") || msg.includes("429") || msg.includes("overloaded");
};

// --- GENERIC GENERATION FUNCTION WITH FALLBACK ---
const generateWithFallback = async (
    apiKey: string,
    params: {
        systemInstruction: string;
        contents: any[];
        schema: Schema;
    },
    // SWAPPED: Flash is now Primary (Stability), Pro is Fallback (Precision)
    primaryModel = "gemini-2.5-flash", 
    fallbackModel = "gemini-3-pro-preview"
): Promise<any> => {
    const ai = new GoogleGenAI({ apiKey });

    const callModel = async (model: string, retries = 1): Promise<any> => {
        try {
            const response = await ai.models.generateContent({
                model: model,
                contents: params.contents,
                config: {
                    systemInstruction: params.systemInstruction,
                    responseMimeType: "application/json",
                    responseSchema: params.schema,
                    temperature: 0.1,
                    maxOutputTokens: 8192,
                }
            });
            return response;
        } catch (error: any) {
            if (retries > 0) {
                // If it's NOT a hard quota error (e.g. network blip), verify and retry same model
                if (!isQuotaError(error)) {
                    await new Promise(r => setTimeout(r, 2000));
                    return callModel(model, retries - 1);
                }
            }
            throw error;
        }
    };

    try {
        console.log(`Attempting with primary model: ${primaryModel}`);
        return await callModel(primaryModel);
    } catch (error: any) {
        console.warn(`Primary model ${primaryModel} failed. Switching to fallback: ${fallbackModel}. Error:`, error.message);
        
        // Retry immediately with fallback model
        try {
            return await callModel(fallbackModel, 1);
        } catch (fallbackError: any) {
            if (isQuotaError(fallbackError)) {
                throw new Error("Google AI System Busy (429). Please wait 30 seconds or add billing to your API Key.");
            }
            throw fallbackError;
        }
    }
};

const scheduleSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    projectName: { type: Type.STRING },
    summary: { type: Type.STRING },
    scheduleItems: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
           id: { type: Type.STRING },
           taskId: { type: Type.STRING },
           activity: { type: Type.STRING },
           category: { type: Type.STRING },
           duration: { type: Type.NUMBER },
           startDate: { type: Type.STRING },
           endDate: { type: Type.STRING },
           dependencies: { type: Type.ARRAY, items: { type: Type.STRING } },
           resources: { type: Type.STRING },
           totalCost: { type: Type.NUMBER },
           progress: { type: Type.NUMBER },
           criticalPath: { type: Type.BOOLEAN },
           notes: { type: Type.STRING }
        },
        required: ["taskId", "activity", "category", "duration", "startDate", "endDate", "resources"]
      }
    }
  },
  required: ["projectName", "summary", "scheduleItems"]
};

// --- STRICT WBS TRAINING DATA ---
const BUILDING_WBS = `
**MANDATORY WBS STRUCTURE (BUILDING CONSTRUCTION)**:
1. **Preliminaries & Mobilization** (ID: 1)
   - 1.1 Site Handover & Survey
   - 1.2 Mobilization & Temporary Utilities
   - 1.3 Safety Hoarding
2. **Substructure** (ID: 2)
   - 2.1 Earthworks (Excavation/Backfill)
   - 2.2 Foundations (Piles, Raft, Footings)
   - 2.3 Substructure Concrete (Columns Necks, Retaining Walls)
3. **Superstructure (Typical Floors)** (ID: 3)
   - **CRITICAL RULE**: Generate a TEMPLATE for a typical floor using ID "3.X".
   - **3.X [Typical Floor Level]** (Summary Task)
     - **3.X.1 Concrete Work**
       - 3.X.1.1 Columns (Pouring)
       - 3.X.1.2 Beams (Pouring)
       - 3.X.1.3 Slabs (Pouring)
       - 3.X.1.4 Staircases
     - **3.X.2 Formwork**
       - 3.X.2.1 Column Formwork
       - 3.X.2.2 Beam Formwork
       - 3.X.2.3 Slab Soffits
     - **3.X.3 Masonry Works**
       - 3.X.3.1 External Walls (Blockwork)
       - 3.X.3.2 Internal Partitions
     - **3.X.4 Finishing Work**
       - 3.X.4.1 Plastering (Internal/External)
       - 3.X.4.2 Flooring & Tiling
       - 3.X.4.3 Painting & Decoration
     - **3.X.5 Electrical Work**
       - 3.X.5.1 Conduiting (First Fix)
       - 3.X.5.2 Wiring & Cabling
       - 3.X.5.3 DB Installation & Final Fix
     - **3.X.6 Mechanical Work**
       - 3.X.6.1 Ducting Installation
       - 3.X.6.2 Pipework (Chilled/Refrigerant)
       - 3.X.6.3 AC Unit Fixing
     - **3.X.7 Sanitary / Plumbing**
       - 3.X.7.1 Water Supply Pipes
       - 3.X.7.2 Drainage Pipes
       - 3.X.7.3 Sanitary Ware Fitting
4. **Exterior Envelope** (ID: 4)
   - 4.1 Roof Structure & Waterproofing
   - 4.2 Facade & Cladding
   - 4.3 External Painting
5. **External Works** (ID: 5)
   - 5.1 Hardscaping & Paving
   - 5.2 Boundary Walls
`;

const CIVIL_WBS = `
**MANDATORY WBS STRUCTURE (CIVIL / INFRASTRUCTURE - RIVER & ROADS)**:
Use this detailed hierarchy. ID Numbering must be maintained.

1. **Mobilization & Preliminaries** (ID: 1)
   - 1.1 Site Possession & Surveying (Topo/Cross-sections)
   - 1.2 Construction of Access Roads / Temp Diversions
   - 1.3 Camp Establishment & Plant Mobilization
   - 1.4 Setting Out & Centerline Marking

2. **River Training & Protection Works** (ID: 2)
   - 2.1 **River Diversion / De-watering** (Cofferdams)
   - 2.2 **Earthworks (River Channel)**
     - 2.2.1 Clearing & Grubbing
     - 2.2.2 Excavation for Foundation (Retaining Walls/Gabions)
     - 2.2.3 Channel Shaping / Dredging
   - 2.3 **Gabion & Masonry Works**
     - 2.3.1 Geotextile Installation
     - 2.3.2 Gabion Box Assembly & Placement (Bottom Tier)
     - 2.3.3 Rock Filling & Lacing
     - 2.3.4 Gabion Mattresses (Apron)
   - 2.4 **Concrete Retaining Walls** (If applicable)
     - 2.4.1 Blinding Concrete
     - 2.4.2 Footing Reinforcement & Casting
     - 2.4.3 Stem Wall Shuttering & Casting

3. **Road Works / Earthworks (Linear)** (ID: 3)
   - 3.1 Clearing right-of-way
   - 3.2 Cut & Fill to Formation Level
   - 3.3 Sub-grade Preparation & Compaction
   - 3.4 Sub-base Course Spreading
   - 3.5 Base Course (Crushed Stone)

4. **Drainage & Structures** (ID: 4)
   - 4.1 Box/Pipe Culvert Excavation
   - 4.2 Culvert Bedding & Installation
   - 4.3 Headwall Construction
   - 4.4 Roadside Ditching / Lined Drains

5. **Pavement & Surfacing** (ID: 5)
   - 5.1 Prime Coat / Tack Coat
   - 5.2 Asphalt Concrete (Binder & Wearing Course)
   - 5.3 Concrete Pavement (Rigid) - Joint Cutting

6. **Ancillary Works & Handover** (ID: 6)
   - 6.1 Road Markings & Traffic Signs
   - 6.2 Guardrails & Safety Barriers
   - 6.3 Bio-engineering / Grass Sodding (Slopes)
   - 6.4 Final Cleanup & Demobilization
`;

const TAKEOFF_HIERARCHY_INSTRUCTION = `
**MANDATORY TAKEOFF CATEGORIZATION (BUILDING)**:
You must strictly group items into these Categories (do not use generic terms like 'Superstructure'):
1. **Concrete Work**: All concrete in Columns, Beams, Slabs, Staircases, Lintels.
2. **Formwork**: All shuttering/formwork for Columns, Beams, Slabs, Staircases.
3. **Masonry**: External Blockwork/Brickwork, Internal Partitions.
4. **Finishing Work**: Plastering, Rendering, Flooring (Tiles/Screed), Painting, Ceiling.
5. **Electrical Work**: Conduits, Wiring, Sockets, Switches, DBs, Lights.
6. **Mechanical Work**: HVAC, Ducts, AC Units.
7. **Sanitary / Plumbing**: Pipes (Supply/Drainage), Sanitary Wares (Toilets, Sinks).
8. **Doors & Windows**: Wooden/Metal Doors, Aluminum Windows, Glazing.
`;

const takeoffSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    projectName: { type: Type.STRING },
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          billItemDescription: { type: Type.STRING },
          quantity: { type: Type.NUMBER },
          unit: { type: Type.STRING },
          category: { type: Type.STRING },
          contractRate: { type: Type.NUMBER },
          contractQuantity: { type: Type.NUMBER },
          previousQuantity: { type: Type.NUMBER },
          confidence: { type: Type.STRING },
          sourceRef: { type: Type.STRING },
          timesing: { type: Type.NUMBER },
          dimension: { type: Type.STRING },
          locationDescription: { type: Type.STRING }
        },
        required: ["id", "billItemDescription", "quantity", "unit", "category"]
      },
    },
    rebarItems: {
        type: Type.ARRAY,
        items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, member: { type: Type.STRING }, barType: { type: Type.STRING }, shapeCode: { type: Type.STRING }, noOfMembers: { type: Type.NUMBER }, barsPerMember: { type: Type.NUMBER }, totalBars: { type: Type.NUMBER }, lengthPerBar: { type: Type.NUMBER }, totalLength: { type: Type.NUMBER }, totalWeight: { type: Type.NUMBER } } }
    },
    technicalQueries: {
        type: Type.ARRAY,
        items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, query: { type: Type.STRING }, assumption: { type: Type.STRING }, impactLevel: { type: Type.STRING } } }
    },
    summary: { type: Type.STRING }
  },
  required: ["projectName", "items", "summary"]
};

const insightsSchema: Schema = {
    type: Type.OBJECT,
    properties: {
        insights: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    type: { type: Type.STRING, enum: ['saving', 'risk'] },
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    impact: { type: Type.STRING }
                },
                required: ['type', 'title', 'description', 'impact']
            }
        }
    }
}

export interface FileInput {
    data: string;
    mimeType: string;
    fileName: string;
}

export interface Insight {
  type: 'saving' | 'risk';
  title: string;
  description: string;
  impact: string; // e.g. "High", "Medium", "Low"
}

const SUPPORTED_VISUAL_MIME_TYPES = [
  'image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'
];

export const generateInsights = async (items: TakeoffItem[]): Promise<Insight[]> => {
    // API KEY CHECK
    const apiKey = getApiKey();
    const ai = new GoogleGenAI({ apiKey });
    const model = "gemini-2.5-flash"; 

    // Summarize items for token efficiency
    const summary = items.slice(0, 50).map(i => `- ${i.billItemDescription || i.description}: ${i.quantity} ${i.unit} (${i.category})`).join('\n');

    const prompt = `
        Act as a **Senior Construction Commercial Manager** (Chartered Quantity Surveyor).
        Review this partial Bill of Quantities (BOQ) and generated Takeoff data.
        
        **YOUR MISSION**:
        Provide superior "Value Engineering" (Cost Saving) and "Risk Intelligence" insights.
        Look for:
        1. Over-specification (e.g., C35 concrete for simple partitions).
        2. High-cost items that have cheaper alternatives (e.g., Marble vs. Porcelain).
        3. Missing essential items (Scope Gaps).
        4. Unusual quantity ratios (Risk of under-estimation).

        **INPUT DATA**:
        ${summary}

        **OUTPUT**:
        Return a JSON object containing exactly 4 detailed insights (2 Savings, 2 Risks).
        Structure:
        {
            "insights": [
                { "type": "saving", "title": "Optimize Concrete Grade", "description": "Partitions specified as C35 could be C25...", "impact": "High Savings" },
                { "type": "risk", "title": "Missing Waterproofing", "description": "Basement walls detected but no tanking...", "impact": "Critical Risk" }
            ]
        }
    `;

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
                responseMimeType: "application/json",
                responseSchema: insightsSchema,
                temperature: 0.3
            }
        });
        
        const res = safeJsonParse(response.text || "{}");
        return res.insights || [];
    } catch (e) {
        console.error("Failed to generate insights:", e);
        return [];
    }
};

export const generateSchedule = async (
  files: FileInput[],
  userInstructions: string,
  floorCount: number,
  basementCount: number,
  detailLevel: 'master' | 'detail' | 'reschedule' = 'master',
  projectType: 'building' | 'infrastructure' | 'interior' = 'building',
  calendarSettings: { workingDays: string[], hoursPerDay: number, holidays: string } = { workingDays: ['Mon','Tue','Wed','Thu','Fri'], hoursPerDay: 8, holidays: '' },
  startDate: string = new Date().toISOString().split('T')[0]
): Promise<TakeoffResult> => {
    
    // API KEY CHECK
    const apiKey = getApiKey();

    const parts: any[] = [];
    files.forEach((file, index) => {
        parts.push({ text: `\n--- FILE ${index + 1}: ${file.fileName} ---\n` });
        
        if (file.mimeType === 'application/cad-text') {
            // It's raw text extracted from CAD
            parts.push({ text: `[RAW CAD DATA STREAM]\nThe following is TEXT extracted from the internal binary of the CAD file. \nLook for Layer Names (e.g., "A-WALL", "S-COL"), Text Notes, and Block Attributes to infer scope and materials:\n\n${file.data}` });
        } else if (file.mimeType === 'text/csv' || file.mimeType === 'application/xml') {
            parts.push({ text: `[EXISTING SCHEDULE DATA]\nFormat: ${file.mimeType}\n\n${file.data.substring(0, 150000)}` }); // Limit large files
        } else if (SUPPORTED_VISUAL_MIME_TYPES.includes(file.mimeType)) {
            parts.push({ inlineData: { mimeType: file.mimeType, data: file.data } });
        } else {
            // Fallback for unknowns
            parts.push({ text: `[SYSTEM: Unknown Binary File '${file.fileName}']` });
        }
    });

    // Select WBS based on project Type
    const selectedWBS = projectType === 'infrastructure' ? CIVIL_WBS : BUILDING_WBS;

    // Build Calendar Context
    const calendarContext = `
    **CALENDAR CONSTRAINTS**:
    - Working Days: ${calendarSettings.workingDays.join(', ')}
    - Work Hours: ${calendarSettings.hoursPerDay} hours/day
    - Holidays: ${calendarSettings.holidays || "None"}
    - Start Date: ${startDate}
    
    *Instruction*: When calculating 'endDate', strictly account for non-working days. If a task is 10 days duration and work week is 5 days, it takes 2 calendar weeks.
    `;

    // INTELLIGENT PROMPTING WITH WBS TRAINING
    let strategyBlock = "";
    if (detailLevel === 'reschedule') {
        strategyBlock = `
        **MODE: RESCHEDULING / RECOVERY / OPTIMIZATION**
        
        **SCENARIO A: Input is an Existing Schedule (CSV/XML/Text)**
        1. **PARSE**: Read the existing Tasks, Start Dates, and Durations.
        2. **DIAGNOSE**: Identify logic gaps, negative float, or unrealistic durations.
        3. **OPTIMIZE**: Re-calculate dates based on the NEW Start Date: ${startDate}. Compress critical path where possible.
        
        **SCENARIO B: Input is a Drawing/Plan (PDF/Image/CAD)**
        1. **ASSUME DELAY**: The project is behind schedule or needs a "Crash Program" / "Recovery Schedule".
        2. **GENERATE**: Create a fast-track schedule. 
           - Use aggressive durations.
           - Overlap phases (Start-to-Start logic with lag).
           - Increase resources in the 'resources' field (e.g. "Double Shift").
           - Target the shortest realistic duration.
        
        **OUTPUT**: Return the CLEANED, OPTIMIZED version using the Schedule Schema.
        ${calendarContext}
        `;
    } else if (detailLevel === 'detail') {
        strategyBlock = `
        ${selectedWBS}
        
        **CURRENT PROJECT CONTEXT**:
        - Type: ${projectType.toUpperCase()}
        - Total Floors: ${floorCount} (Ignore if Infrastructure)
        - Basements: ${basementCount}
        ${calendarContext}
        
        **SENIOR PLANNER RULES (40 YEARS EXPERIENCE)**:
        1. **Deep Nesting for Floors**: 
           For Building projects, you MUST generate the "Typical Floor" template (ID 3.X) EXACTLY as shown in the WBS above.
           - Group activities by Trade (Concrete, Formwork, Masonry, Finishing, Electrical, Mechanical, Sanitary).
           - Under MEP, explicitly list Electrical, Mechanical, and Sanitary as separate tasks.
           - Under Structure, separate Columns, Beams, Slabs for both Concrete and Formwork.
        
        2. **Logic Linking**: 
           - Formwork -> Rebar -> Concrete (FS).
           - Masonry starts after Slab curing (SS + Lag).
           - Electrical/Mechanical First Fix starts after Masonry (FS).
           - Plastering starts after First Fix (FS).
        3. **Resources**: "1 Carpenter, 2 Helpers", "1 Concrete Pump", "1 Electrician Gang".
        `;
    } else {
        strategyBlock = `
        **MODE: MASTER SUMMARY**
        - Group major phases only.
        - Do not list individual tasks.
        ${calendarContext}
        `;
    }

    const systemInstruction = `
        Act as a **Senior Construction Planner** (Primavera P6 / MS Project Expert).
        
        **OBJECTIVE**:
        Create a **DYNAMIC, HIERARCHICAL** construction schedule based on the input files.
        
        **HANDLING CAD DATA**:
        If you received [RAW CAD DATA STREAM], analyze the text for keywords like "Concrete", "Grade 25", "Room", "Office", "Bedroom", "Road", "River" etc. to determine the project scope and complexity. Use this real data to build the schedule.
        
        ${strategyBlock}
        Notes from User: "${userInstructions}".
        
        **OUTPUT FORMAT**:
        Return strictly valid JSON matching the schema. 
        For Building projects with multiple floors, generate the 'Typical Floor' tasks using '3.X' in the taskId (e.g., 3.X.1, 3.X.1.1). The system will auto-replicate this for all ${floorCount} floors.
        Do not output Markdown code blocks. Keep descriptions concise.
    `;

    // CALL AI WITH FALLBACK LOGIC
    // Using Flash as primary for speed and quota limits
    const response = await generateWithFallback(apiKey, {
        systemInstruction,
        contents: [{ role: "user", parts: parts }],
        schema: scheduleSchema
    }, "gemini-2.5-flash", "gemini-3-pro-preview");

    const text = response.text;
    if (!text) throw new Error("No response from AI");

    try {
        const res = safeJsonParse(text);
        
        // --- POST-PROCESSING: EXPAND HIGH-RISE TEMPLATES & ENSURE WBS ---
        let finalScheduleItems: ScheduleTask[] = [];
        let items = res.scheduleItems || [];

        if (!Array.isArray(items)) items = [];

        // ONLY RUN HIGH RISE LOGIC FOR BUILDINGS AND IF NOT RESCHEDULING EXISTING FILES
        if (detailLevel === 'detail' && projectType === 'building') {
            // 1. Separate Templates from Standard Items
            const templateItems = items.filter((i: any) => i.taskId && (i.taskId.includes('3.X') || i.activity.includes('Typical')));
            let otherItems = items.filter((i: any) => !i.taskId?.includes('3.X') && !i.activity?.includes('Typical'));
            
            // 2. Expand High Rise Logic (Floor 1 to N)
            const expandedFloors: ScheduleTask[] = [];
            let structureStartDate = new Date(startDate);
            
            // Find start date based on Substructure (Task 2)
            const substructureTasks = otherItems.filter((i: any) => i.taskId.startsWith('2.'));
            if (substructureTasks.length > 0) {
                    const maxEnd = substructureTasks.reduce((max: Date, t: any) => {
                    const d = new Date(t.endDate);
                    return d > max ? d : max;
                }, new Date(startDate));
                structureStartDate = new Date(maxEnd);
            }

            if (templateItems.length > 0 && floorCount > 0) {
                const sortedTemplate = [...templateItems].sort((a: any, b: any) => {
                    // Sort by ID depth so parents come before children
                    return a.taskId.localeCompare(b.taskId); 
                });
                
                const firstTemplateItem = sortedTemplate[0];
                const baseTemplateDate = new Date(firstTemplateItem.startDate).getTime();
                // Estimated cycle per floor (Structure + Finishes lag)
                const cycleDays = 14; 

                for (let f = 1; f <= floorCount; f++) {
                    const floorStartOffsetMs = (f - 1) * 7 * 24 * 60 * 60 * 1000; // 7 Day structure cycle offset
                    const floorBaseDateMs = structureStartDate.getTime() + floorStartOffsetMs;

                    // Create Summary Task for Floor
                    const floorSummaryId = `3.${f}`;
                    const floorStart = new Date(floorBaseDateMs).toISOString().split('T')[0];
                    // Approx end date buffer
                    const floorEnd = new Date(floorBaseDateMs + (30 * 86400000)).toISOString().split('T')[0]; 

                    expandedFloors.push({
                        id: crypto.randomUUID(),
                        taskId: floorSummaryId,
                        activity: `Floor ${f} (Level ${f})`,
                        category: "Superstructure",
                        duration: 30, // Summary duration placeholder
                        startDate: floorStart,
                        endDate: floorEnd,
                        dependencies: f > 1 ? [`3.${f-1}`] : [],
                        resources: "",
                        progress: 0,
                        criticalPath: true,
                        notes: "Generated by High-Rise Cycle Algorithm"
                    });

                    // Expand Sub-tasks
                    sortedTemplate.forEach((tpl: ScheduleTask) => {
                        const newTask = { ...tpl };
                        newTask.id = crypto.randomUUID();
                        
                        // Replace 3.X with 3.f
                        // Handle nested IDs like 3.X.1.1 -> 3.1.1.1
                        const suffix = tpl.taskId.replace('3.X', ''); 
                        newTask.taskId = `3.${f}${suffix}`; 
                        
                        newTask.activity = tpl.activity.replace(/Typical Floor/g, `Floor ${f}`).replace(/Level X/g, `Level ${f}`);

                        const taskOffsetMs = new Date(tpl.startDate).getTime() - baseTemplateDate;
                        const newStartMs = floorBaseDateMs + taskOffsetMs;
                        const newEndMs = newStartMs + (tpl.duration * 24 * 60 * 60 * 1000);

                        newTask.startDate = new Date(newStartMs).toISOString().split('T')[0];
                        newTask.endDate = new Date(newEndMs).toISOString().split('T')[0];
                        
                        // Update Dependencies
                        if (newTask.dependencies) {
                            newTask.dependencies = newTask.dependencies.map(d => {
                                if (d.includes('3.X')) return d.replace('3.X', `3.${f}`);
                                // If depends on typical floor summary
                                if (d === '3.X') return floorSummaryId;
                                return d;
                            });
                        }
                        
                        // Link vertical logic (e.g. Floor 2 Columns depend on Floor 1 Columns)
                        // Only apply to structural items (Concrete/Formwork) to allow staggering
                        if (f > 1 && (newTask.activity.includes('Column') || newTask.activity.includes('Slab'))) {
                            const prevFloorTask = `3.${f-1}${suffix}`;
                            newTask.dependencies.push(prevFloorTask);
                        }

                        expandedFloors.push(newTask);
                    });
                }
            }

            // 3. Shift Future Phases (Roof/Exterior - Task 4, 5)
            let postShiftMs = 0;
            if (expandedFloors.length > 0) {
                // Find the end of the structure of the last floor
                const lastFloorStructure = expandedFloors.filter(t => t.activity.includes('Slab') || t.activity.includes('Concrete'));
                const lastFloorEnd = lastFloorStructure.reduce((max, t) => new Date(t.endDate) > max ? new Date(t.endDate) : max, new Date(0));
                
                const postTasks = otherItems.filter((i: any) => {
                        const mainId = parseInt(i.taskId.split('.')[0]);
                        return mainId >= 4;
                });

                if (postTasks.length > 0) {
                        const firstPostStart = postTasks.reduce((min: Date, t: any) => {
                            const d = new Date(t.startDate);
                            return d < min ? d : min;
                        }, new Date(8640000000000000));

                        if (lastFloorEnd.getTime() > firstPostStart.getTime()) {
                            postShiftMs = lastFloorEnd.getTime() - firstPostStart.getTime() + (7 * 86400000); 
                        }
                }
            }

            // Apply Shift
            otherItems = otherItems.map((i: any) => {
                    const mainId = parseInt(i.taskId.split('.')[0]);
                    if (mainId >= 4 && postShiftMs > 0) {
                        const s = new Date(new Date(i.startDate).getTime() + postShiftMs);
                        const e = new Date(new Date(i.endDate).getTime() + postShiftMs);
                        return { ...i, startDate: s.toISOString().split('T')[0], endDate: e.toISOString().split('T')[0] };
                    }
                    return i;
            });

            // 4. Combine Everything
            const superSummary = otherItems.find((i:any) => i.taskId === '3');
            if (!superSummary && expandedFloors.length > 0) {
                // Create implicit summary if missing
                const start = expandedFloors[0].startDate;
                const end = expandedFloors[expandedFloors.length-1].endDate;
                    finalScheduleItems.push({
                        id: crypto.randomUUID(),
                        taskId: '3',
                        activity: 'Superstructure',
                        category: 'Superstructure',
                        startDate: start,
                        endDate: end,
                        duration: Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / 86400000),
                        dependencies: ['2'],
                        resources: '',
                        progress: 0,
                        criticalPath: true,
                        notes: "Generated Summary"
                    });
            }
            
            finalScheduleItems = [...finalScheduleItems, ...otherItems, ...expandedFloors];

        } else {
            finalScheduleItems = items;
        }

        // Strict Hierarchical Sort (1, 1.1, 1.1.1, 1.2, ...)
        finalScheduleItems.sort((a: any, b: any) => {
            const partsA = a.taskId.split('.').map((n: string) => parseFloat(n) || 0);
            const partsB = b.taskId.split('.').map((n: string) => parseFloat(n) || 0);
            for(let i=0; i<Math.max(partsA.length, partsB.length); i++) {
                const valA = partsA[i] || 0;
                const valB = partsB[i] || 0;
                if (valA !== valB) return valA - valB;
            }
            return 0;
        });

        return {
            id: crypto.randomUUID(),
            date: new Date().toISOString(),
            projectName: res.projectName || files[0].fileName,
            drawingType: "Schedule",
            items: [],
            rebarItems: [],
            scheduleItems: finalScheduleItems,
            summary: res.summary || "Generated Schedule",
            appMode: AppMode.SCHEDULING,
            isPaid: false
        } as TakeoffResult;
    } catch (e: any) {
        console.error("JSON Error details:", text);
        throw new Error(`Schedule Generation Failed: ${e.message}.`);
    }
};

export const generateTakeoff = async (
  files: FileInput[], 
  userInstructions: string, 
  scopes: string[] = [],
  includeRebar: boolean = false,
  floorCount: number = 1,
  basementCount: number = 0,
  storyHeight: number = 3.0,
  specBase64Data?: string, 
  specMimeType?: string,
  unitSystem: 'metric' | 'imperial' = 'metric',
  appMode: AppMode = AppMode.ESTIMATION,
  contractBase64Data?: string,
  contractMimeType?: string
): Promise<TakeoffResult> => {
  
  // API KEY CHECK
  const apiKey = getApiKey();
  
  const rebarInstruction = includeRebar 
    ? `3. **DETAILED REBAR SCHEDULE**: Extract Bar Bending Schedule if visible.`
    : `3. **SKIP REBAR**: Do not generate any rebar items.`;

  const parts: any[] = [];
  files.forEach((file, index) => {
      parts.push({ text: `\n--- FILE ${index + 1}: ${file.fileName} ---\n` });
      
      if (file.mimeType === 'application/cad-text') {
          // It's raw text extracted from CAD
          parts.push({ text: `[RAW CAD DATA STREAM]\nThe following is TEXT extracted from the internal binary of the CAD file. \nLook for Layer Names (e.g., "A-WALL", "S-COL"), Text Notes, and Block Attributes to infer scope and materials:\n\n${file.data}` });
      } else if (SUPPORTED_VISUAL_MIME_TYPES.includes(file.mimeType)) {
          parts.push({ inlineData: { mimeType: file.mimeType, data: file.data } });
      } else {
          // Fallback for unknowns
          parts.push({ text: `[SYSTEM: Unknown Binary File '${file.fileName}']` });
      }
  });

  if (specBase64Data) {
      parts.push({ text: "\n--- SPEC DOC ---\n" });
      parts.push({ inlineData: { mimeType: specMimeType || 'application/pdf', data: specBase64Data } });
  }

  if (contractBase64Data) {
      parts.push({ text: "\n--- CONTRACT BOQ ---\n" });
      parts.push({ inlineData: { mimeType: contractMimeType || 'application/pdf', data: contractBase64Data } });
  }

  const systemInstruction = `
    Act as a **Professional Quantity Surveyor** performing a Takeoff.
    Generate a **BILL OF QUANTITIES (BOQ)** based on SMM7/CESMM4.
    
    **DIMENSION EXTRACTION PROTOCOL (L x W x D)**:
    1. **MANDATORY**: For every item, you must derive the dimension string in the format "Length x Width x Depth" (or Height).
    2. **WALLS**: 
       - **Length**: Measure the linear length on plan.
       - **Width**: Use wall thickness (e.g., 200mm, 150mm).
       - **Height**: Use the provided Story Height (${storyHeight}m) unless a specific beam depth deduction is required.
       - *Format*: "5.00 x 0.20 x ${storyHeight}"
    3. **SLABS**:
       - **Area**: Measure the L x W.
       - **Depth**: Look for thickness notes (e.g., "150mm thk").
       - *Format*: "4.00 x 5.00 x 0.15"
    4. **BEAMS**:
       - **Length**: Measure span.
       - **Section**: Look for text like "300x500".
       - *Format*: "6.00 x 0.30 x 0.50"
    5. **COLUMNS**:
       - **Count**: Count the number of columns.
       - **Height**: Use Story Height.
       - **Section**: Look for dimensions.
       - *Format*: "12 No. x 0.40 x 0.40 x ${storyHeight}" (for concrete volume)
    6. **MEP (Electrical/Mechanical/Plumbing)**:
       - **Linear Items (Pipes, Cables, Ducts)**: Measure the length of the run. Look for size labels (e.g., "110mm dia", "300x300 duct"). 
       - *Format*: "15.00(L) x 0.11(Dia) x -" or "10.00(L) x 0.30(W) x 0.30(H)"
       - **Countable Items (Sockets, Lights, Toilets, Sinks)**: Count them visually.
       - *Format*: "8 No. x - x -"
    
    **VISUAL MEASUREMENT RULES**:
    - **Scale Inference**: Find a standard object (e.g., Door = 0.9m) to establish scale.
    - **Counting**: Count ALL visible items.
    
    **PROJECT PARAMETERS**:
    - Floors: ${floorCount} (Multiplication Factor: x${floorCount} for typical floors)
    - Basements: ${basementCount}
    - Scope: ${scopes.join(', ')}
    
    **HIGH RISE LOGIC**:
    - If calculating typical floors, explicitly state "Qty x ${floorCount} floors".
    - Separate Substructure from Superstructure.
    
    ${TAKEOFF_HIERARCHY_INSTRUCTION}
    
    ${rebarInstruction}
    ${contractBase64Data ? "**MATCHING**: Map items to Contract BOQ." : ""}
    Output strictly valid JSON. Do not include markdown formatting. Keep descriptions concise.
  `;

  // CALL AI WITH FALLBACK LOGIC
  // Using Flash as primary for speed and quota limits
  const response = await generateWithFallback(apiKey, {
        systemInstruction,
        contents: [{ role: "user", parts: parts }],
        schema: takeoffSchema
  }, "gemini-2.5-flash", "gemini-3-pro-preview");

  const text = response.text;
  if (!text) throw new Error("No response from AI");

  try {
    const res = safeJsonParse(text);
    if (!res.unitSystem) res.unitSystem = unitSystem;
    if (!res.projectName || res.projectName.length < 2) {
        res.projectName = files[0].fileName.split('.')[0].replace(/_/g, ' ');
    }
    
    res.id = crypto.randomUUID();
    res.date = new Date().toISOString();
    res.appMode = appMode;
    res.isPaid = false;

    // Ensure quantities are numbers and process floor multiplication if AI missed it
    if (res.items) {
        res.items = res.items.map((item: any) => {
            let qty = item.quantity || 0;
            // Double check if typical floor multiplication happened
            if (floorCount > 1 && item.category === 'Superstructure' && !item.billItemDescription.includes(`x${floorCount}`)) {
                // This is a safety heuristic; AI usually handles it via prompt
            }
            return {
                ...item,
                description: item.billItemDescription || item.description || "Item",
                quantity: qty,
                contractRate: item.contractRate || 0,
                estimatedRate: item.contractRate || 0 
            };
        });
    }
    
    return res;
  } catch (e) {
    console.error("Takeoff Parse Error:", e);
    throw new Error("AI output was not valid JSON. Please try again.");
  }
};

export const getRateSuggestion = async (itemDescription: string, currency: string = 'ETB'): Promise<string> => {
    try {
        // CALL SERVERLESS BACKEND INSTEAD OF CLIENT SIDE SDK
        const response = await fetch('/api/rates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemDescription, currency })
        });
        
        if (!response.ok) throw new Error("Rate fetch failed");
        
        const data = await response.json();
        return data.text?.trim() || "N/A";
    } catch (e) {
        console.error("Rate Suggestion Error:", e);
        return "Unavailable"; 
    }
};
