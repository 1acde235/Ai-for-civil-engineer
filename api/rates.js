
import { GoogleGenAI } from "@google/genai";

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { itemDescription, currency } = req.body;

  if (!process.env.API_KEY) {
      return res.status(500).json({ error: "Server Configuration Error: API_KEY missing" });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: [{ role: "user", parts: [{ text: `Act as a Construction Estimator. Price this item in ${currency || 'ETB'} (Provide a realistic High/Low Range and a brief 1-line justification): "${itemDescription}"` }] }],
    });
    
    return res.status(200).json({ text: response.text });
  } catch (error) {
    console.error("AI Rate Error:", error);
    return res.status(500).json({ error: "Failed to fetch rate" });
  }
}
