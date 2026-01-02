
import React, { useState, useCallback, useRef } from 'react';
import { analyzeScript, generateImage } from './geminiService';
import { AnalysisResult, ScenePrompt, CharacterInfo } from './types';
import JSZip from 'jszip';

const App: React.FC = () => {
  const [inputText, setInputText] = useState<string>('');
  const [aspectRatio, setAspectRatio] = useState<string>('16:9');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isZipping, setIsZipping] = useState<boolean>(false);
  const [results, setResults] = useState<AnalysisResult | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const aspectRatios = [
    { label: '16:9 (Landscape)', value: '16:9', icon: 'fa-rectangle-ad' },
    { label: '9:16 (Portrait)', value: '9:16', icon: 'fa-mobile-screen' },
    { label: '1:1 (Square)', value: '1:1', icon: 'fa-square' },
    { label: '4:3 (Classic)', value: '4:3', icon: 'fa-tv' },
    { label: '3:4 (Portrait)', value: '3:4', icon: 'fa-file' },
  ];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setInputText(text);
      };
      reader.readAsText(file);
    }
  };

  const processBulk = async () => {
    if (!inputText.trim()) return;

    try {
      setIsAnalyzing(true);
      const analysis = await analyzeScript(inputText);
      setResults(analysis);
      setIsAnalyzing(false);

      setIsGenerating(true);
      const updatedScenes = [...analysis.scenes].map(s => ({ ...s, status: 'pending' as const }));
      setResults(prev => prev ? { ...prev, scenes: updatedScenes } : null);
      setProgress({ current: 0, total: updatedScenes.length });

      for (let i = 0; i < updatedScenes.length; i++) {
        const scene = updatedScenes[i];
        
        setResults(prev => {
          if (!prev) return null;
          const newScenes = [...prev.scenes];
          newScenes[i].status = 'generating';
          return { ...prev, scenes: newScenes };
        });

        try {
          // KEY FIX: Only pass the descriptions of characters who are actually in this scene
          const sceneCharacterContext = analysis.characters
            .filter(c => scene.presentCharacters.some(name => name.toLowerCase().includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(name.toLowerCase())))
            .map(c => `${c.name} (${c.description})`)
            .join('; ');

          const imageUrl = await generateImage(
            scene.refinedPrompt, 
            sceneCharacterContext || "No specific character", 
            analysis.visualStyle, 
            aspectRatio
          );
          
          setResults(prev => {
            if (!prev) return null;
            const newScenes = [...prev.scenes];
            newScenes[i].status = 'completed';
            newScenes[i].imageUrl = imageUrl;
            return { ...prev, scenes: newScenes };
          });
        } catch (error) {
          setResults(prev => {
            if (!prev) return null;
            const newScenes = [...prev.scenes];
            newScenes[i].status = 'error';
            newScenes[i].error = 'Failed to generate image';
            return { ...prev, scenes: newScenes };
          });
        }
        
        setProgress(p => ({ ...p, current: i + 1 }));
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred during processing. Please check your script and try again.');
    } finally {
      setIsGenerating(false);
      setIsAnalyzing(false);
    }
  };

  const downloadImage = (url: string, index: number) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `scene-${index + 1}.png`;
    link.click();
  };

  const downloadAllAsZip = async () => {
    if (!results) return;
    setIsZipping(true);
    const zip = new JSZip();
    const completedScenes = results.scenes.filter(s => s.imageUrl && s.status === 'completed');
    if (completedScenes.length === 0) {
      alert("No images ready to download yet.");
      setIsZipping(false);
      return;
    }
    for (let i = 0; i < completedScenes.length; i++) {
      const scene = completedScenes[i];
      if (scene.imageUrl) {
        const base64Data = scene.imageUrl.split(',')[1];
        zip.file(`scene-${i + 1}.png`, base64Data, { base64: true });
      }
    }
    try {
      const content = await zip.generateAsync({ type: "blob" });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = "visionbulk-scenes.zip";
      link.click();
    } catch (err) {
      console.error("Failed to create ZIP", err);
    } finally {
      setIsZipping(false);
    }
  };

  const hasAnyCompleted = results?.scenes.some(s => s.imageUrl && s.status === 'completed');

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-20 text-zinc-300">
      <nav className="sticky top-0 z-50 glass-morphism border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-500/20">
            <i className="fas fa-bolt text-white"></i>
          </div>
          <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
            VisionBulk AI
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full border border-white/20 hover:bg-white/5 transition-all text-sm font-medium"
          >
            <i className="fas fa-file-upload"></i> Upload Script
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept=".txt" 
            className="hidden" 
          />
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 pt-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-5 space-y-6">
            <div className="glass-morphism p-6 rounded-3xl space-y-6 border-white/5 shadow-2xl">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Input Script / Story</label>
                  <span className="text-xs text-zinc-500">{inputText.length} chars</span>
                </div>
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Paste your script here. For example: 'Ayesha is in the park. Later, Bilal enters and they talk. Finally, Ayesha walks away alone.'"
                  className="w-full h-64 bg-zinc-900/50 border border-white/10 rounded-2xl p-5 text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all resize-none shadow-inner"
                />
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wider block">Aspect Ratio</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {aspectRatios.map((ratio) => (
                    <button
                      key={ratio.value}
                      onClick={() => setAspectRatio(ratio.value)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                        aspectRatio === ratio.value
                          ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20'
                          : 'bg-zinc-900/50 border-white/5 text-zinc-400 hover:border-white/10'
                      }`}
                    >
                      <i className={`fas ${ratio.icon}`}></i>
                      {ratio.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={processBulk}
                disabled={isAnalyzing || isGenerating || !inputText.trim()}
                className={`w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all ${
                  isAnalyzing || isGenerating || !inputText.trim()
                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-blue-500/20'
                }`}
              >
                {isAnalyzing ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i> Analyzing Script...
                  </>
                ) : isGenerating ? (
                  <>
                    <i className="fas fa-circle-notch fa-spin"></i> Generating ({progress.current}/{progress.total})
                  </>
                ) : (
                  <>
                    <i className="fas fa-magic"></i> Generate Bulk Images
                  </>
                )}
              </button>
            </div>

            {results && (
              <div className="glass-morphism p-6 rounded-3xl space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 border-white/5 shadow-xl">
                <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Character Sheet (Consistency)</h3>
                <div className="space-y-3">
                  {results.characters.map((char, i) => (
                    <div key={i} className="p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 transition-colors">
                      <p className="font-bold text-blue-400">{char.name}</p>
                      <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{char.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-7">
            {!results && !isAnalyzing ? (
              <div className="h-full min-h-[500px] border-2 border-dashed border-white/5 rounded-[40px] flex flex-col items-center justify-center text-center p-12 bg-white/[0.01]">
                <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center mb-6 shadow-inner">
                  <i className="fas fa-images text-3xl text-zinc-700"></i>
                </div>
                <h2 className="text-2xl font-bold text-zinc-500 mb-2">No Images Generated Yet</h2>
                <p className="text-zinc-600 max-w-sm">Enter a script on the left. The AI will detect who is in each scene automatically.</p>
              </div>
            ) : (
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold tracking-tight">Storyboards</h2>
                  <div className="flex items-center gap-4">
                    {hasAnyCompleted && (
                      <button 
                        onClick={downloadAllAsZip}
                        disabled={isZipping}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600/20 border border-blue-500/30 text-blue-400 rounded-full text-sm font-bold hover:bg-blue-600/30 transition-all disabled:opacity-50"
                      >
                        {isZipping ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-file-zipper"></i>}
                        Download ZIP
                      </button>
                    )}
                    {isGenerating && (
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-32 md:w-48 bg-zinc-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500 transition-all duration-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" 
                            style={{ width: `${(progress.current / progress.total) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm text-zinc-400 font-mono">
                          {Math.round((progress.current / progress.total) * 100)}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {results?.scenes.map((scene, idx) => (
                    <div 
                      key={scene.id} 
                      className="group relative glass-morphism rounded-3xl overflow-hidden border border-white/10 transition-all hover:border-blue-500/50 hover:shadow-2xl hover:shadow-blue-500/5"
                    >
                      <div className={`relative bg-zinc-950 flex items-center justify-center overflow-hidden`} style={{ aspectRatio: aspectRatio.replace(':', '/') }}>
                        {scene.imageUrl ? (
                          <>
                            <img 
                              src={scene.imageUrl} 
                              alt={`Scene ${idx + 1}`} 
                              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                              <button 
                                onClick={() => downloadImage(scene.imageUrl!, idx)}
                                className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-xl"
                                title="Download"
                              >
                                <i className="fas fa-download"></i>
                              </button>
                            </div>
                          </>
                        ) : scene.status === 'generating' ? (
                          <div className="flex flex-col items-center gap-4">
                            <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                            <span className="text-xs font-semibold text-blue-400 uppercase tracking-widest animate-pulse">Creating Visuals...</span>
                          </div>
                        ) : scene.status === 'error' ? (
                          <div className="text-center px-6">
                            <i className="fas fa-exclamation-triangle text-red-500 mb-2"></i>
                            <p className="text-xs text-red-400">{scene.error || 'Generation Failed'}</p>
                          </div>
                        ) : (
                          <i className="fas fa-hourglass-half text-zinc-800 text-3xl"></i>
                        )}
                        <div className="absolute top-4 left-4 flex gap-2">
                          <div className="bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                            <span className="text-[10px] font-bold text-white uppercase tracking-wider">SCENE {idx + 1}</span>
                          </div>
                        </div>
                        {scene.presentCharacters.length > 0 && (
                          <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                            {scene.presentCharacters.map((c, ci) => (
                              <span key={ci} className="text-[9px] bg-blue-600/80 backdrop-blur px-2 py-0.5 rounded-md text-white border border-white/10 font-medium">
                                {c}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="p-5 space-y-3">
                        <div className="space-y-1">
                          <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Source Segment</p>
                          <p className="text-sm text-zinc-300 line-clamp-2 leading-relaxed italic">"{scene.originalText}"</p>
                        </div>
                        <div className="pt-2 border-t border-white/5">
                          <p className="text-[9px] font-bold text-blue-400 uppercase tracking-[0.2em]">AI Visual Prompt</p>
                          <p className="text-xs text-zinc-500 line-clamp-3 mt-1 leading-normal">{scene.refinedPrompt}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {hasAnyCompleted && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
          <button 
            onClick={downloadAllAsZip}
            disabled={isZipping}
            className="flex items-center gap-3 px-10 py-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white rounded-full font-bold shadow-2xl hover:scale-105 active:scale-95 transition-all disabled:opacity-70 group"
          >
            {isZipping ? (
              <>
                <i className="fas fa-spinner fa-spin"></i> Bundling Zip...
              </>
            ) : (
              <>
                <i className="fas fa-cloud-arrow-down group-hover:bounce"></i> Download All Storyboards
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default App;
