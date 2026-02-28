import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { Match } from '@/src/data/matches';
import { streamAgentThoughts, MatchAnalysis, AnalysisResumeState, streamRemotionCode } from '@/src/services/ai';
import { saveHistory, saveResumeState, clearResumeState, getResumeState } from '@/src/services/history';
import { deleteSavedMatch } from '@/src/services/savedMatches';
import { AgentResult, parseAgentStream } from '@/src/services/agentParser';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { getSettings } from '@/src/services/settings';

export interface ActiveAnalysis {
  matchId: string;
  match: Match;
  dataToAnalyze: any;
  includeAnimations: boolean;
  thoughts: string;
  parsedStream: AgentResult | null;
  collapsedSegments: Record<string, boolean>;
  generatedCodes: Record<string, string>;
  isGeneratingCode: Record<string, boolean>;
  isAnalyzing: boolean;
  analysis: MatchAnalysis | null;
  error: string | null;
}

interface AnalysisContextType {
  activeAnalyses: Record<string, ActiveAnalysis>;
  startAnalysis: (match: Match, dataToAnalyze: any, includeAnimations: boolean, isResume?: boolean) => void;
  clearActiveAnalysis: (matchId: string) => void;
  setCollapsedSegments: (matchId: string, segments: Record<string, boolean>) => void;
  generateCodeForSegment: (matchId: string, seg: any, customInstruction?: string) => void;
}

const AnalysisContext = createContext<AnalysisContextType | undefined>(undefined);

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [activeAnalyses, setActiveAnalyses] = useState<Record<string, ActiveAnalysis>>({});

  // Background Notification Effect
  useEffect(() => {
    const updateNotification = async () => {
      if (!Capacitor.isNativePlatform()) return;
      
      const settings = getSettings();
      if (!settings.enableBackgroundMode) return;

      const analyzingMatches = Object.values(activeAnalyses).filter(a => a.isAnalyzing);
      
      if (analyzingMatches.length > 0) {
        const matchNames = analyzingMatches.map(a => `${a.match.homeTeam.name} vs ${a.match.awayTeam.name}`).join(', ');
        // Get the latest phase/step for the first match as a summary
        const firstMatch = analyzingMatches[0];
        const segments = firstMatch.parsedStream?.segments || [];
        const lastSegment = segments[segments.length - 1];
        const status = lastSegment ? (lastSegment.title || 'Processing...') : 'Starting...';
        
        await LocalNotifications.schedule({
          notifications: [{
            id: 1001,
            title: `MatchFlow: Analyzing ${analyzingMatches.length} Match(es)`,
            body: `${matchNames}\n${status}`,
            ongoing: true,
            autoCancel: false,
            schedule: { at: new Date(Date.now() + 100) }
          }]
        });
      } else {
        // Cancel notification if no analysis is running
        // We only cancel if we might have scheduled one (id 1001)
        try {
          await LocalNotifications.cancel({ notifications: [{ id: 1001 }] });
        } catch (e) {
          // Ignore error if notification doesn't exist
        }
      }
    };

    updateNotification();
  }, [activeAnalyses]);

  const updateAnalysis = useCallback((matchId: string, updates: Partial<ActiveAnalysis>) => {
    setActiveAnalyses(prev => {
      if (!prev[matchId]) return prev;
      return {
        ...prev,
        [matchId]: {
          ...prev[matchId],
          ...updates
        }
      };
    });
  }, []);

  const clearActiveAnalysis = useCallback((matchId: string) => {
    setActiveAnalyses(prev => {
      const next = { ...prev };
      delete next[matchId];
      return next;
    });
  }, []);

  const setCollapsedSegments = useCallback((matchId: string, segments: Record<string, boolean>) => {
    updateAnalysis(matchId, { collapsedSegments: segments });
  }, [updateAnalysis]);

  const generateCodeForSegment = useCallback(async (matchId: string, seg: any, customInstruction?: string) => {
    const analysis = activeAnalyses[matchId];
    if (!analysis || analysis.isGeneratingCode[seg.id]) return;

    updateAnalysis(matchId, { 
      isGeneratingCode: { ...analysis.isGeneratingCode, [seg.id]: true },
      generatedCodes: { ...analysis.generatedCodes, [seg.id]: '' }
    });
    
    try {
      let fullCode = '';
      const stream = streamRemotionCode(seg.animation, customInstruction);
      
      for await (const chunk of stream) {
        fullCode += chunk;
        setActiveAnalyses(prev => {
          if (!prev[matchId]) return prev;
          return {
            ...prev,
            [matchId]: {
              ...prev[matchId],
              generatedCodes: { ...prev[matchId].generatedCodes, [seg.id]: fullCode }
            }
          };
        });
      }
    } catch (error) {
      console.error(`Error generating code for segment ${seg.id}:`, error);
    } finally {
      setActiveAnalyses(prev => {
        if (!prev[matchId]) return prev;
        return {
          ...prev,
          [matchId]: {
            ...prev[matchId],
            isGeneratingCode: { ...prev[matchId].isGeneratingCode, [seg.id]: false }
          }
        };
      });
    }
  }, [activeAnalyses, updateAnalysis]);

  // Auto-generate code effect
  useEffect(() => {
    Object.values(activeAnalyses).forEach(analysis => {
      if (analysis.parsedStream) {
        analysis.parsedStream.segments.forEach(seg => {
          if (seg.animation && !analysis.generatedCodes[seg.id] && !analysis.isGeneratingCode[seg.id]) {
            generateCodeForSegment(analysis.matchId, seg);
          }
        });
      }
    });
  }, [activeAnalyses, generateCodeForSegment]);

  const startAnalysis = useCallback(async (match: Match, dataToAnalyze: any, includeAnimations: boolean, isResume: boolean = false) => {
    const matchId = match.id;
    
    // Initialize state
    let initialThoughts = '';
    let initialParsedStream: AgentResult | null = null;
    let initialCollapsed: Record<string, boolean> = {};
    let resumeStateData: AnalysisResumeState | undefined = undefined;

    if (isResume) {
      const savedState = await getResumeState(matchId);
      if (savedState) {
        resumeStateData = savedState.state;
        
        // Reconstruct initialThoughts from completed segments to discard any partial segment
        if (resumeStateData && resumeStateData.segmentResults) {
          initialThoughts = resumeStateData.segmentResults.map(r => r.content).join('');
        } else {
          initialThoughts = savedState.thoughts;
        }

        initialParsedStream = parseAgentStream(initialThoughts);
        
        initialParsedStream.segments.forEach(seg => {
          if (seg.isThoughtComplete) {
            initialCollapsed[seg.id] = true;
          }
        });
      }
    } else {
      await clearResumeState();
    }

    const newAnalysis: ActiveAnalysis = {
      matchId,
      match,
      dataToAnalyze,
      includeAnimations,
      thoughts: initialThoughts,
      parsedStream: initialParsedStream,
      collapsedSegments: initialCollapsed,
      generatedCodes: {},
      isGeneratingCode: {},
      isAnalyzing: true,
      analysis: null,
      error: null
    };

    setActiveAnalyses(prev => ({ ...prev, [matchId]: newAnalysis }));

    try {
      let currentThoughts = initialThoughts;
      let currentParsedStream = initialParsedStream;
      let currentCollapsed = initialCollapsed;
      
      const stream = streamAgentThoughts(
        dataToAnalyze, 
        includeAnimations,
        resumeStateData,
        (state) => {
          saveResumeState(matchId, state, currentThoughts);
        }
      );
      
      for await (const chunk of stream) {
        currentThoughts += chunk;
        currentParsedStream = parseAgentStream(currentThoughts);
        
        // Auto-collapse completed thoughts
        const newCollapsed = { ...currentCollapsed };
        currentParsedStream.segments.forEach(seg => {
          if (seg.isThoughtComplete && !newCollapsed[seg.id]) {
            newCollapsed[seg.id] = true;
          }
        });
        currentCollapsed = newCollapsed;

        setActiveAnalyses(prev => {
          if (!prev[matchId]) return prev;
          return {
            ...prev,
            [matchId]: {
              ...prev[matchId],
              thoughts: currentThoughts,
              parsedStream: currentParsedStream,
              collapsedSegments: currentCollapsed
            }
          };
        });
      }

      // Final parse after stream completes
      const finalParsed = parseAgentStream(currentThoughts);
      
      setActiveAnalyses(prev => {
        if (!prev[matchId]) return prev;
        return {
          ...prev,
          [matchId]: {
            ...prev[matchId],
            parsedStream: finalParsed
          }
        };
      });

      if (finalParsed.summary) {
        const finalAnalysis = finalParsed.summary as MatchAnalysis;
        
        // Update match object with edited names before saving
        const finalMatch = { ...match };
        if (!finalMatch.homeTeam.id) finalMatch.homeTeam.id = 'home';
        if (!finalMatch.awayTeam.id) finalMatch.awayTeam.id = 'away';
        if (dataToAnalyze.homeTeam?.name) finalMatch.homeTeam.name = dataToAnalyze.homeTeam.name;
        if (dataToAnalyze.awayTeam?.name) finalMatch.awayTeam.name = dataToAnalyze.awayTeam.name;
        if (dataToAnalyze.league) finalMatch.league = dataToAnalyze.league;
        if (dataToAnalyze.odds) finalMatch.odds = dataToAnalyze.odds;
        if (dataToAnalyze.customInfo) (finalMatch as any).customInfo = dataToAnalyze.customInfo;
        
        setActiveAnalyses(prev => {
          if (!prev[matchId]) return prev;
          const currentAnalysisState = prev[matchId];
          saveHistory(finalMatch, finalAnalysis, finalParsed, currentAnalysisState.generatedCodes).catch(console.error);
          
          // Also try to delete from saved matches if it exists (it's now history)
          deleteSavedMatch(matchId).catch(() => {});

          return {
            ...prev,
            [matchId]: {
              ...prev[matchId],
              analysis: finalAnalysis,
              isAnalyzing: false
            }
          };
        });
        
        await clearResumeState();
      } else {
        setActiveAnalyses(prev => {
          if (!prev[matchId]) return prev;
          return {
            ...prev,
            [matchId]: {
              ...prev[matchId],
              isAnalyzing: false
            }
          };
        });
      }

    } catch (error: any) {
      console.error("Analysis failed:", error);
      setActiveAnalyses(prev => {
        if (!prev[matchId]) return prev;
        return {
          ...prev,
          [matchId]: {
            ...prev[matchId],
            error: error.message || "Analysis failed",
            isAnalyzing: false,
            thoughts: prev[matchId].thoughts + "\n\n[ERROR] Analysis failed. Please try again."
          }
        };
      });
    }
  }, []);

  return (
    <AnalysisContext.Provider value={{ activeAnalyses, startAnalysis, clearActiveAnalysis, setCollapsedSegments, generateCodeForSegment }}>
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
