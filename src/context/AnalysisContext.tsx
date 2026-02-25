import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { Match } from '@/src/data/matches';
import { streamAgentThoughts, MatchAnalysis } from '@/src/services/ai';
import { parseAgentStream, AgentResult } from '@/src/services/agentParser';
import { saveHistory, getHistory } from '@/src/services/history';

interface AnalysisContextType {
  activeMatchId: string | null;
  thoughts: string;
  isAnalyzing: boolean;
  parsedStream: AgentResult | null;
  generatedCodes: Record<string, string>;
  isGeneratingCode: Record<string, boolean>;
  startAnalysis: (match: Match, dataToAnalyze: any, includeAnimations: boolean) => Promise<void>;
  resumeAnalysis: (matchId: string) => void;
  setGeneratedCode: (segmentId: string, code: string) => void;
  setGeneratingCodeStatus: (segmentId: string, isGenerating: boolean) => void;
}

const AnalysisContext = createContext<AnalysisContextType | undefined>(undefined);

export function AnalysisProvider({ children }: { children: React.ReactNode }) {
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [thoughts, setThoughts] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [parsedStream, setParsedStream] = useState<AgentResult | null>(null);
  const [generatedCodes, setGeneratedCodes] = useState<Record<string, string>>({});
  const [isGeneratingCode, setIsGeneratingCode] = useState<Record<string, boolean>>({});
  
  const abortControllerRef = useRef<AbortController | null>(null);

  const startAnalysis = async (match: Match, dataToAnalyze: any, includeAnimations: boolean) => {
    // Cancel any existing analysis
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setActiveMatchId(match.id);
    setIsAnalyzing(true);
    setThoughts('');
    setParsedStream(null);
    setGeneratedCodes({});
    setIsGeneratingCode({});

    // Initial save to history with 'analyzing' status
    saveHistory(match, undefined, undefined, {}, 'analyzing', '');

    try {
      let currentThoughts = '';
      const stream = streamAgentThoughts(dataToAnalyze, includeAnimations);
      
      for await (const chunk of stream) {
        if (controller.signal.aborted) break;
        
        currentThoughts += chunk;
        setThoughts(currentThoughts);
        
        const parsed = parseAgentStream(currentThoughts);
        setParsedStream(parsed);
        
        // Periodic save (could be optimized to not save on every chunk, but for now it's fine)
        // We save the raw thoughts so we can resume parsing later
        saveHistory(match, parsed.summary || undefined, parsed, generatedCodes, 'analyzing', currentThoughts);
      }

      if (!controller.signal.aborted) {
        // Finalize
        const finalParsed = parseAgentStream(currentThoughts);
        setParsedStream(finalParsed);
        
        if (finalParsed.summary) {
          saveHistory(match, finalParsed.summary, finalParsed, generatedCodes, 'completed', currentThoughts);
        } else {
           // If no summary, it might be incomplete or failed
           saveHistory(match, undefined, finalParsed, generatedCodes, 'failed', currentThoughts);
        }
      }
    } catch (error) {
      console.error("Analysis failed:", error);
      if (!controller.signal.aborted) {
        setThoughts(prev => prev + "\n\n[ERROR] Analysis failed. Please try again.");
        saveHistory(match, undefined, undefined, generatedCodes, 'failed', thoughts);
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsAnalyzing(false);
        // We don't clear activeMatchId immediately so the user can see the result
      }
    }
  };

  const resumeAnalysis = (matchId: string) => {
    // Load from history
    const history = getHistory();
    const record = history.find(h => h.matchId === matchId);
    
    if (record) {
      setActiveMatchId(matchId);
      setThoughts(record.currentThoughts || '');
      setParsedStream(record.parsedStream || null);
      setGeneratedCodes(record.generatedCodes || {});
      
      if (record.status === 'analyzing') {
        // If it was 'analyzing' but we are resuming, it means it was interrupted.
        // We can't easily "resume" the stream connection.
        // So we just set state. The user might need to click "Restart" or we implement a complex "continue" prompt.
        // For now, we just show the state.
        setIsAnalyzing(false); 
      } else {
        setIsAnalyzing(false);
      }
    }
  };

  const setGeneratedCode = (segmentId: string, code: string) => {
    setGeneratedCodes(prev => {
        const next = { ...prev, [segmentId]: code };
        // Update history with new code
        const history = getHistory();
        const record = history.find(h => h.matchId === activeMatchId);
        if (record) {
            saveHistory(record.match, record.analysis, record.parsedStream, next, record.status, record.currentThoughts);
        }
        return next;
    });
  };

  const setGeneratingCodeStatus = (segmentId: string, isGenerating: boolean) => {
    setIsGeneratingCode(prev => ({ ...prev, [segmentId]: isGenerating }));
  };

  return (
    <AnalysisContext.Provider value={{
      activeMatchId,
      thoughts,
      isAnalyzing,
      parsedStream,
      generatedCodes,
      isGeneratingCode,
      startAnalysis,
      resumeAnalysis,
      setGeneratedCode,
      setGeneratingCodeStatus
    }}>
      {children}
    </AnalysisContext.Provider>
  );
}

export function useAnalysis() {
  const context = useContext(AnalysisContext);
  if (context === undefined) {
    throw new Error('useAnalysis must be used within an AnalysisProvider');
  }
  return context;
}
