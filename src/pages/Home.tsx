import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MOCK_MATCHES } from '@/src/data/matches';
import { Card, CardContent } from '@/src/components/ui/Card';
import { Activity, Calendar, ChevronRight, QrCode, History, Settings, Search, Trash2, ArrowUpDown, X } from 'lucide-react';
import { getHistory, clearHistory, deleteHistoryRecord, HistoryRecord } from '@/src/services/history';
import { Button } from '@/src/components/ui/Button';
import { motion, AnimatePresence } from 'motion/react';

export default function Home() {
  const navigate = useNavigate();
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    setHistory(getHistory());
  }, []);

  const handleClearHistory = () => {
    clearHistory();
    setHistory([]);
    setShowClearConfirm(false);
  };

  const handleDeleteRecord = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteHistoryRecord(id);
    setHistory(getHistory());
  };

  const filteredAndSortedHistory = history
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
        {/* History Section */}
        {history.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <History className="w-5 h-5 text-zinc-400" /> 历史分析
              </h2>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')}
                  className="text-zinc-400 hover:text-white transition-colors flex items-center gap-1 text-xs"
                >
                  <ArrowUpDown className="w-3 h-3" />
                  {sortOrder === 'newest' ? '最新' : '最早'}
                </button>
                <button 
                  onClick={() => setShowClearConfirm(true)}
                  className="text-red-400 hover:text-red-300 transition-colors flex items-center gap-1 text-xs ml-2"
                >
                  <Trash2 className="w-3 h-3" />
                  清空
                </button>
              </div>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input 
                type="text"
                placeholder="搜索球队或联赛..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-900 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
            
            {filteredAndSortedHistory.length > 0 ? (
              <div className="flex overflow-x-auto gap-4 pb-4 snap-x snap-mandatory hide-scrollbar">
                {filteredAndSortedHistory.map((record) => (
                  <Card 
                    key={record.id} 
                    className="snap-center shrink-0 w-64 cursor-pointer active:scale-[0.98] transition-all border-zinc-800 bg-zinc-900/80"
                    onClick={() => navigate(`/match/${record.matchId}`)}
                  >
                    <CardContent className="p-4 relative group">
                      <button 
                        onClick={(e) => handleDeleteRecord(e, record.id)}
                        className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400 hover:bg-black"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      <div className="flex items-center justify-between mb-3 pr-6">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">{record.match.league}</span>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          {new Date(record.timestamp).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex flex-col items-center gap-2 w-16">
                          <img src={record.match.homeTeam.logo} alt={record.match.homeTeam.name} className="w-8 h-8 object-contain drop-shadow-md" />
                          <span className="text-[10px] font-medium text-center line-clamp-1">{record.match.homeTeam.name}</span>
                        </div>
                        
                        <div className="flex flex-col items-center justify-center flex-1">
                          <div className="text-sm font-bold font-mono tracking-tighter text-zinc-400">VS</div>
                        </div>

                        <div className="flex flex-col items-center gap-2 w-16">
                          <img src={record.match.awayTeam.logo} alt={record.match.awayTeam.name} className="w-8 h-8 object-contain drop-shadow-md" />
                          <span className="text-[10px] font-medium text-center line-clamp-1">{record.match.awayTeam.name}</span>
                        </div>
                      </div>
                      
                      <div className="mt-3 pt-2 border-t border-white/5 text-[10px] text-zinc-400 italic line-clamp-1">
                        "{record.analysis.prediction}"
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-zinc-500 text-xs font-mono">
                未找到匹配 "{searchQuery}" 的记录
              </div>
            )}
          </section>
        )}

        {/* Live & Upcoming Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="w-5 h-5 text-zinc-400" /> 热门赛事
            </h2>
            <span className="text-xs text-emerald-500 font-medium">直播 & 即将开始</span>
          </div>
          
          <div className="grid gap-4">
            {MOCK_MATCHES.map((match) => (
              <Card 
                key={match.id} 
                className="cursor-pointer active:scale-[0.98] transition-all border-zinc-800 bg-zinc-900/80"
                onClick={() => navigate(`/match/${match.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">{match.league}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
                      match.status === 'live' ? 'bg-red-500/20 text-red-500 animate-pulse' : 
                      match.status === 'finished' ? 'bg-zinc-800 text-zinc-400' : 
                      'bg-emerald-500/20 text-emerald-500'
                    }`}>
                      {match.status === 'live' ? '直播中' : match.status === 'finished' ? '完场' : '未开始'}
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
                    <span className="text-[10px] font-mono">点击进行分析</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </CardContent>
              </Card>
            ))}
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
              <h3 className="text-lg font-bold mb-2 text-white">清空历史记录？</h3>
              <p className="text-sm text-zinc-400 mb-6">
                您确定要删除所有赛事分析历史记录吗？此操作无法撤销。
              </p>
              <div className="flex gap-3">
                <Button 
                  variant="ghost" 
                  className="flex-1"
                  onClick={() => setShowClearConfirm(false)}
                >
                  取消
                </Button>
                <Button 
                  variant="default"
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                  onClick={handleClearHistory}
                >
                  确认清空
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
