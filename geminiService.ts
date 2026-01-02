
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, CharacterInfo } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const analyzeScript = async (text: string): Promise<AnalysisResult> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Analyze the following script/text:
    1. Extract a "Character Sheet" with detailed physical descriptions for ALL main characters to ensure visual consistency.
    2. Divide the text into specific scenes.
    3. For each scene, identify ONLY the characters that are actually present or active in that specific scene.
    4. Create a "refinedPrompt" for each scene that strictly describes what is happening. Do NOT include characters who are not in the scene.
    
    Style: Professional Realistic Photography, 8k, cinematic lighting.
    
    Text: ${text}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          characters: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                description: { type: Type.STRING }
              },
              required: ["name", "description"]
            }
          },
          visualStyle: { type: Type.STRING, description: "Detailed description of the photographic style" },
          scenes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                originalText: { type: Type.STRING },
                refinedPrompt: { type: Type.STRING, description: "Action-focused prompt describing ONLY what is in this scene." },
                presentCharacters: { 
                  type: Type.ARRAY, 
                  items: { type: Type.STRING },
                  description: "Names of characters from the character sheet who appear in this specific scene."
                }
              },
              required: ["id", "originalText", "refinedPrompt", "presentCharacters"]
            }
          }
        },
        required: ["characters", "visualStyle", "scenes"]
      }
    }
  });

  return JSON.parse(response.text || '{}');
};

export const generateImage = async (prompt: string, characterContext: string, globalStyle: string, aspectRatio: string = "16:9"): Promise<string> => {
  // Use a cleaner prompt structure to prevent character bloat
  const finalPrompt = `PHOTOREALISTIC CINEMATIC IMAGE.
  STYLE: ${globalStyle}.
  ACTIVE CHARACTERS IN THIS SCENE: ${characterContext}.
  SCENE DESCRIPTION: ${prompt}.
  TECHNICAL: 8k resolution, ultra-detailed, professional color grading, realistic skin textures, natural lighting.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [{ text: finalPrompt }]
    },
    config: {
      imageConfig: {
        aspectRatio: aspectRatio as any
      }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }

  throw new Error("No image data received from API");
};
