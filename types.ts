
export interface CharacterInfo {
  name: string;
  description: string;
}

export interface ScenePrompt {
  id: string;
  originalText: string;
  refinedPrompt: string;
  presentCharacters: string[]; // List of character names present in this scene
  status: 'pending' | 'generating' | 'completed' | 'error';
  imageUrl?: string;
  error?: string;
}

export interface AnalysisResult {
  characters: CharacterInfo[];
  visualStyle: string;
  scenes: ScenePrompt[];
}
