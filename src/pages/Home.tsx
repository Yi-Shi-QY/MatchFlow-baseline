import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MOCK_MATCHES } from '@/src/data/matches';
import { Card, CardContent } from '@/src/components/ui/Card';
import { Activity, Calendar, ChevronRight, QrCode, History, Settings, Search, Trash2, ArrowUpDown, X, Plus, Loader2, RefreshCw } from 'lucide-react';
import { getHistory, clearHistory, deleteHistoryRecord, HistoryRecord, getResumeState, clearResumeState } from '@/src/services/history';
import { getSavedMatches, deleteSavedMatch, SavedMatchRecord } from '@/src/services/savedMatches';
import { fetchMatches } from '@/src/services/matchData';
import { Match } from '@/src/data/matches';
import { Button } from '@/src/components/ui/Button';
import { motion, AnimatePresence } from 'motion/react';
import { useAnalysis } from '@/src/contexts/AnalysisContext';

export default function Home() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [savedMatches, setSavedMatches] = useState<SavedMatchRecord[]>([]);
  const [liveMatches, setLiveMatches] = useState<Match[]>([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const { activeAnalyses, clearActiveAnalysis } = useAnalysis();
  const prevAnalysesRef = React.useRef<Record<string, boolean>>({});

  const loadMatches = async () => {
    setIsLoadingMatches(true);
    const matches = await fetchMatches();
    if (matches && matches.length > 0) {
      setLiveMatches(matches);
    } else {
      setLiveMatches(MOCK_MATCHES);
    }
    setIsLoadingMatches(false);
  };

  useEffect(() => {
    const loadData = async () => {
      const historyData = await getHistory();
      setHistory(historyData);
      
      const savedData = await getSavedMatches();
      setSavedMatches(savedData);

      await loadMatches();
    };
    loadData();
  }, []);

  // Re-fetch history when an active analysis completes
  useEffect(() => {
    let newlyCompleted = false;
    const currentAnalyzing: Record<string, boolean> = {};
    
    Object.values(activeAnalyses).forEach(a => {
      currentAnalyzing[a.matchId] = a.isAnalyzing;
      if (prevAnalysesRef.current[a.matchId] && !a.isAnalyzing && a.analysis) {
        newlyCompleted = true;
      }
    });

    prevAnalysesRef.current = currentAnalyzing;

    if (newlyCompleted) {
      getHistory().then(setHistory);
    }
  }, [activeAnalyses]);

  const handleClearHistory = () => {
    clearHistory();
    // Clear all completed analyses from context
    Object.values(activeAnalyses).forEach(analysis => {
      if (!analysis.isAnalyzing) {
        clearActiveAnalysis(analysis.matchId);
      }
    });
    // Also clear resume state
    clearResumeState();
    
    setHistory([]);
    setShowClearConfirm(false);
  };

  const handleDeleteRecord = async (e: React.MouseEvent, id: string, matchId: string) => {
    e.stopPropagation();
    deleteHistoryRecord(id);
    clearActiveAnalysis(matchId); // Clear from context
    
    // Also clear resume state if it matches this match
    const resumeState = await getResumeState(matchId);
    if (resumeState && resumeState.matchId === matchId) {
      clearResumeState();
    }

    const data = await getHistory();
    setHistory(data);
  };

  const handleDeleteSavedMatch = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteSavedMatch(id);
    const data = await getSavedMatches();
    setSavedMatches(data);
  };

  // Combine history and active analyses
  const allRecords = React.useMemo(() => {
    const activeRecords = Object.values(activeAnalyses)
      .filter(active => active.isAnalyzing)
      .map(active => ({
        id: `active_${active.matchId}`,
        matchId: active.matchId,
        match: active.match,
        timestamp: Date.now(), // Keep active ones at the top
        isActive: true,
        analysis: active.analysis,
        parsedStream: active.parsedStream
      }));

    // Filter out history records that are currently active
    const filteredHistory = history.filter(h => !activeAnalyses[h.matchId] || !activeAnalyses[h.matchId].isAnalyzing);

    return [...activeRecords, ...filteredHistory];
  }, [history, activeAnalyses]);

  const filteredAndSortedHistory = allRecords
    .filter(record => {
      const searchLower = searchQuery.toLowerCase();
      return (
        record.match.homeTeam.name.toLowerCase().includes(searchLower) ||
        record.match.awayTeam.name.toLowerCase().includes(searchLower) ||
        record.match.league.toLowerCase().includes(searchLower)
      );
    })
    .sort((a, b) => {
      if (sortOrder === 'newest') {
        return b.timestamp - a.timestamp;
      } else {
        return a.timestamp - b.timestamp;
      }
    });

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans pb-20">
      {/* Mobile App Header */}
      <header className="sticky top-0 z-10 bg-black/80 backdrop-blur-md border-b border-white/10 px-4 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Activity className="text-emerald-500 w-6 h-6" /> MatchFlow
          </h1>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/scan')}
              className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center border border-white/10 text-emerald-400 hover:bg-zinc-700 transition-colors"
            >
              <QrCode className="w-4 h-4" />
            </button>
            <button 
              onClick={() => navigate('/settings')}
              className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center border border-white/10 text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="px-4 pt-6 max-w-md mx-auto space-y-8">
        {/* Saved Matches Section */}
        {savedMatches.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Settings className="w-5 h-5 text-zinc-400" /> {t('home.saved_matches')}
            </h2>
            
            <div className="flex overflow-x-auto gap-3 pb-4 snap-x snap-mandatory hide-scrollbar px-1">
              {savedMatches.map((record) => (
                <Card 
                  key={record.id} 
                  className="snap-center shrink-0 w-48 cursor-pointer active:scale-[0.98] transition-all border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900 hover:border-zinc-700 group relative overflow-hidden"
                  onClick={() => navigate(`/match/${record.id}`)}
                >
                  <button 
                    onClick={(e) => handleDeleteSavedMatch(e, record.id)}
                    className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-black/60 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400 hover:bg-black"
                  >
                    <X className="w-3 h-3" />
                  </button>

                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-mono truncate max-w-[80px]">
                        {record.match.league}
                      </span>
                      <span className="text-[9px] text-zinc-600 font-mono">
                        {new Date(record.timestamp).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mb-3">
                      <div className="flex flex-col items-center gap-1.5 w-12">
                        <img src={record.match.homeTeam.logo} alt={record.match.homeTeam.name} className="w-8 h-8 object-contain drop-shadow-sm" />
                        <span className="text-[9px] font-medium text-center line-clamp-1 w-full text-zinc-300">
                          {record.match.homeTeam.name}
                        </span>
                      </div>
                      
                      <div className="text-[10px] font-bold font-mono text-zinc-600">VS</div>

                      <div className="flex flex-col items-center gap-1.5 w-12">
                        <img src={record.match.awayTeam.logo} alt={record.match.awayTeam.name} className="w-8 h-8 object-contain drop-shadow-sm" />
                        <span className="text-[9px] font-medium text-center line-clamp-1 w-full text-zinc-300">
                          {record.match.awayTeam.name}
                        </span>
                      </div>
                    </div>
                    
                    <div className="mt-2 pt-2 border-t border-white/5 flex justify-center">
                      <span className="text-[10px] text-emerald-500 font-mono">
                        {t('home.click_analyze')}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* History Section */}
        {allRecords.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <History className="w-5 h-5 text-zinc-400" /> {t('home.history_analysis')}
              </h2>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')}
                  className="text-zinc-400 hover:text-white transition-colors flex items-center gap-1 text-xs"
                >
                  <ArrowUpDown className="w-3 h-3" />
                  {sortOrder === 'newest' ? t('home.sort_newest') : t('home.sort_oldest')}
                </button>
                <button 
                  onClick={() => setShowClearConfirm(true)}
                  className="text-red-400 hover:text-red-300 transition-colors flex items-center gap-1 text-xs ml-2"
                >
                  <Trash2 className="w-3 h-3" />
                  {t('home.clear')}
                </button>
              </div>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input 
                type="text"
                placeholder={t('home.search_placeholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-900 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
            
            {filteredAndSortedHistory.length > 0 ? (
              <div className="flex overflow-x-auto gap-3 pb-4 snap-x snap-mandatory hide-scrollbar px-1">
                {filteredAndSortedHistory.map((record: any) => {
                  const winProb = record.analysis?.winProbability;
                  const isActive = record.isActive;
                  const parsedStream = record.parsedStream;
                  
                  let statusText = isActive ? t('home.analyzing') : t('home.completed');
                  if (isActive && parsedStream) {
                    const totalSegments = parsedStream.segments.length;
                    const completedSegments = parsedStream.segments.filter((s: any) => s.isThoughtComplete).length;
                    if (totalSegments > 0) {
                      statusText = `${t('home.analyzing')} (${completedSegments}/${totalSegments})`;
                    }
                  }

                  return (
                    <Card 
                      key={record.id} 
                      className={`snap-center shrink-0 w-48 cursor-pointer active:scale-[0.98] transition-all border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900 hover:border-zinc-700 group relative overflow-hidden ${isActive ? 'ring-1 ring-emerald-500/50' : ''}`}
                      onClick={() => navigate(`/match/${record.matchId}`)}
                    >
                      {/* Delete Button (only for non-active) */}
                      {!isActive && (
                        <button 
                          onClick={(e) => handleDeleteRecord(e, record.id, record.matchId)}
                          className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-black/60 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400 hover:bg-black"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}

                      <CardContent className="p-3">
                        {/* Header: League & Time */}
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-mono truncate max-w-[80px]">
                            {record.match.league}
                          </span>
                          <span className="text-[9px] text-zinc-600 font-mono flex items-center gap-1">
                            {isActive && <Loader2 className="w-3 h-3 animate-spin text-emerald-500" />}
                            {new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        {/* Teams */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex flex-col items-center gap-1.5 w-12">
                            <img src={record.match.homeTeam.logo} alt={record.match.homeTeam.name} className="w-8 h-8 object-contain drop-shadow-sm" />
                            <span className="text-[9px] font-medium text-center line-clamp-1 w-full text-zinc-300">
                              {record.match.homeTeam.name}
                            </span>
                          </div>
                          
                          <div className="text-[10px] font-bold font-mono text-zinc-600">VS</div>

                          <div className="flex flex-col items-center gap-1.5 w-12">
                            <img src={record.match.awayTeam.logo} alt={record.match.awayTeam.name} className="w-8 h-8 object-contain drop-shadow-sm" />
                            <span className="text-[9px] font-medium text-center line-clamp-1 w-full text-zinc-300">
                              {record.match.awayTeam.name}
                            </span>
                          </div>
                        </div>
                        
                        {/* Footer: Status or Probability Bar */}
                        <div className="mt-2 pt-2 border-t border-white/5">
                          {isActive ? (
                            <div className="flex items-center justify-center">
                              <span className="text-[10px] text-emerald-400 font-mono animate-pulse">
                                {statusText}
                              </span>
                            </div>
                          ) : winProb ? (
                            <div className="flex flex-col gap-1">
                              <div className="flex w-full h-1.5 rounded-full overflow-hidden">
                                <div style={{ width: `${winProb.home}%` }} className="bg-emerald-500" />
                                <div style={{ width: `${winProb.draw}%` }} className="bg-zinc-500" />
                                <div style={{ width: `${winProb.away}%` }} className="bg-red-500" />
                              </div>
                              <div className="flex justify-between text-[8px] text-zinc-500 font-mono px-1">
                                <span>主 {winProb.home}%</span>
                                <span>平 {winProb.draw}%</span>
                                <span>客 {winProb.away}%</span>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center">
                              <span className="text-[10px] text-zinc-500 font-mono">
                                {t('home.completed')}
                              </span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-zinc-500 text-xs font-mono">
                {t('home.no_records_found', { query: searchQuery })}
              </div>
            )}
          </section>
        )}

        {/* Live & Upcoming Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="w-5 h-5 text-zinc-400" /> {t('home.popular_matches')}
            </h2>
            <div className="flex items-center gap-3">
              <span className="text-xs text-emerald-500 font-medium hidden sm:inline-block">{t('home.live_upcoming')}</span>
              <button 
                onClick={loadMatches}
                className="flex items-center gap-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-white px-2 py-1 rounded border border-white/10 transition-colors"
                disabled={isLoadingMatches}
              >
                <RefreshCw className={`w-3 h-3 ${isLoadingMatches ? 'animate-spin' : ''}`} /> {t('home.refresh_matches')}
              </button>
            </div>
          </div>
          
          <div className="grid gap-4">
            {isLoadingMatches ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
              </div>
            ) : liveMatches.length > 0 ? (
              liveMatches.map((match) => (
                <Card 
                  key={match.id} 
                  className="cursor-pointer active:scale-[0.98] transition-all border-zinc-800 bg-zinc-900/80"
                  onClick={() => navigate(`/match/${match.id}`, { state: { importedData: match } })}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">{match.league}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
                        match.status === 'live' ? 'bg-red-500/20 text-red-500 animate-pulse' : 
                        match.status === 'finished' ? 'bg-zinc-800 text-zinc-400' : 
                        'bg-emerald-500/20 text-emerald-500'
                      }`}>
                        {match.status === 'live' ? t('home.live') : match.status === 'finished' ? t('home.finished') : t('home.upcoming')}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex flex-col items-center gap-2 w-20">
                        <img src={match.homeTeam.logo} alt={match.homeTeam.name} className="w-10 h-10 object-contain drop-shadow-md" />
                        <span className="text-xs font-medium text-center line-clamp-1">{match.homeTeam.name}</span>
                      </div>
                      
                      <div className="flex flex-col items-center justify-center flex-1">
                        {match.status === 'live' || match.status === 'finished' ? (
                          <div className="text-2xl font-bold font-mono tracking-tighter">
                            {match.score?.home} - {match.score?.away}
                          </div>
                        ) : (
                          <div className="text-sm font-medium text-zinc-400 font-mono">
                            {new Date(match.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-center gap-2 w-20">
                        <img src={match.awayTeam.logo} alt={match.awayTeam.name} className="w-10 h-10 object-contain drop-shadow-md" />
                        <span className="text-xs font-medium text-center line-clamp-1">{match.awayTeam.name}</span>
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-zinc-500">
                      <span className="text-[10px] font-mono">{t('home.click_to_analyze')}</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center py-8 text-zinc-500 text-xs font-mono">
                {t('home.no_match_data')}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Clear History Confirmation Modal */}
      <AnimatePresence>
        {showClearConfirm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setShowClearConfirm(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-xs w-full shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold mb-2 text-white">{t('home.confirm_clear_history')}</h3>
              <p className="text-sm text-zinc-400 mb-6">
                {t('home.confirm_clear_history_desc')}
              </p>
              <div className="flex gap-3">
                <Button 
                  variant="ghost" 
                  className="flex-1"
                  onClick={() => setShowClearConfirm(false)}
                >
                  {t('home.cancel')}
                </Button>
                <Button 
                  variant="default"
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                  onClick={handleClearHistory}
                >
                  {t('home.confirm')}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
