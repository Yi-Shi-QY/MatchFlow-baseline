import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MOCK_MATCHES } from '@/src/data/matches';
import { analyzeMatch, streamAgentThoughts, MatchAnalysis } from '@/src/services/ai';
import { saveHistory, getHistory } from '@/src/services/history';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { ArrowLeft, Share2, BrainCircuit, Play, Pause, Activity, Info, CheckCircle2, TrendingUp, BarChart2, RefreshCw, Code2, LayoutTemplate } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'motion/react';

export default function MatchDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const match = MOCK_MATCHES.find(m => m.id === id);

  const [analysis, setAnalysis] = useState<MatchAnalysis | null>(null);
  const [thoughts, setThoughts] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const [step, setStep] = useState<'selection' | 'analyzing' | 'result'>('selection');
  const [selectedSources, setSelectedSources] = useState({
    basic: true,
    form: true,
    stats: true,
  });
  const [editableData, setEditableData] = useState("");
  const [showJson, setShowJson] = useState(false);

  useEffect(() => {
    if (!match) return;

    // Check history first
    const history = getHistory();
    const existingRecord = history.find(h => h.matchId === match.id);

    if (existingRecord) {
      setAnalysis(existingRecord.analysis);
      setThoughts('[SYSTEM] Loaded from local history cache.\n\nAnalysis complete.');
      setIsPlaying(true);
      setStep('result');
    }
  }, [match]);

  useEffect(() => {
    if (!match || step !== 'selection') return;
    
    const dataToSend: any = {};
    
    if (selectedSources.basic) {
      dataToSend.id = match.id;
      dataToSend.league = match.league;
      dataToSend.status = match.status;
      dataToSend.date = match.date;
      dataToSend.homeTeam = { name: match.homeTeam.name };
      dataToSend.awayTeam = { name: match.awayTeam.name };
    }
    
    if (selectedSources.form) {
      if (!dataToSend.homeTeam) dataToSend.homeTeam = {};
      if (!dataToSend.awayTeam) dataToSend.awayTeam = {};
      dataToSend.homeTeam.form = match.homeTeam.form;
      dataToSend.awayTeam.form = match.awayTeam.form;
    }
    
    if (selectedSources.stats && match.stats) {
      dataToSend.stats = match.stats;
    }
    
    setEditableData(JSON.stringify(dataToSend, null, 2));
  }, [match, selectedSources, step]);

  const handleDataChange = (path: string[], value: any) => {
    try {
      const data = JSON.parse(editableData);
      let current = data;
      for (let i = 0; i < path.length - 1; i++) {
        if (!current[path[i]]) current[path[i]] = {};
        current = current[path[i]];
      }
      current[path[path.length - 1]] = value;
      setEditableData(JSON.stringify(data, null, 2));
    } catch (e) {
      // ignore if invalid json
    }
  };

  const renderHumanReadableForm = () => {
    let data;
    try {
      data = JSON.parse(editableData);
    } catch (e) {
      return <div className="text-red-400 text-xs p-4">Invalid JSON data. Please fix in JSON view.</div>;
    }

    return (
      <div className="space-y-4 text-sm">
        {selectedSources.basic && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-zinc-400 uppercase border-b border-white/10 pb-1">基本信息</h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-zinc-500 block mb-1">联赛</label>
                <input 
                  type="text" 
                  value={data.league || ''} 
                  onChange={(e) => handleDataChange(['league'], e.target.value)}
                  className="w-full bg-zinc-900 border border-white/10 rounded p-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 block mb-1">状态</label>
                <input 
                  type="text" 
                  value={data.status || ''} 
                  onChange={(e) => handleDataChange(['status'], e.target.value)}
                  className="w-full bg-zinc-900 border border-white/10 rounded p-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 block mb-1">主队</label>
                <input 
                  type="text" 
                  value={data.homeTeam?.name || ''} 
                  onChange={(e) => handleDataChange(['homeTeam', 'name'], e.target.value)}
                  className="w-full bg-zinc-900 border border-white/10 rounded p-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 block mb-1">客队</label>
                <input 
                  type="text" 
                  value={data.awayTeam?.name || ''} 
                  onChange={(e) => handleDataChange(['awayTeam', 'name'], e.target.value)}
                  className="w-full bg-zinc-900 border border-white/10 rounded p-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {selectedSources.form && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-zinc-400 uppercase border-b border-white/10 pb-1">近期状态</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-zinc-500 block mb-1">主队状态 (胜,平,负)</label>
                <input 
                  type="text" 
                  value={(data.homeTeam?.form || []).join(', ')} 
                  onChange={(e) => handleDataChange(['homeTeam', 'form'], e.target.value.split(',').map(s => s.trim()))}
                  className="w-full bg-zinc-900 border border-white/10 rounded p-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 block mb-1">客队状态 (胜,平,负)</label>
                <input 
                  type="text" 
                  value={(data.awayTeam?.form || []).join(', ')} 
                  onChange={(e) => handleDataChange(['awayTeam', 'form'], e.target.value.split(',').map(s => s.trim()))}
                  className="w-full bg-zinc-900 border border-white/10 rounded p-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {selectedSources.stats && data.stats && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-zinc-400 uppercase border-b border-white/10 pb-1">比赛数据</h3>
            
            <div className="space-y-2">
              <label className="text-[10px] text-zinc-500 block">控球率 (%)</label>
              <div className="flex gap-2 items-center">
                <input 
                  type="number" 
                  value={data.stats.possession?.home || 0} 
                  onChange={(e) => handleDataChange(['stats', 'possession', 'home'], Number(e.target.value))}
                  className="w-full bg-zinc-900 border border-white/10 rounded p-1.5 text-xs text-white text-center focus:border-emerald-500 focus:outline-none"
                />
                <span className="text-xs text-zinc-600">vs</span>
                <input 
                  type="number" 
                  value={data.stats.possession?.away || 0} 
                  onChange={(e) => handleDataChange(['stats', 'possession', 'away'], Number(e.target.value))}
                  className="w-full bg-zinc-900 border border-white/10 rounded p-1.5 text-xs text-white text-center focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] text-zinc-500 block">射门次数</label>
              <div className="flex gap-2 items-center">
                <input 
                  type="number" 
                  value={data.stats.shots?.home || 0} 
                  onChange={(e) => handleDataChange(['stats', 'shots', 'home'], Number(e.target.value))}
                  className="w-full bg-zinc-900 border border-white/10 rounded p-1.5 text-xs text-white text-center focus:border-emerald-500 focus:outline-none"
                />
                <span className="text-xs text-zinc-600">vs</span>
                <input 
                  type="number" 
                  value={data.stats.shots?.away || 0} 
                  onChange={(e) => handleDataChange(['stats', 'shots', 'away'], Number(e.target.value))}
                  className="w-full bg-zinc-900 border border-white/10 rounded p-1.5 text-xs text-white text-center focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] text-zinc-500 block">射正次数</label>
              <div className="flex gap-2 items-center">
                <input 
                  type="number" 
                  value={data.stats.shotsOnTarget?.home || 0} 
                  onChange={(e) => handleDataChange(['stats', 'shotsOnTarget', 'home'], Number(e.target.value))}
                  className="w-full bg-zinc-900 border border-white/10 rounded p-1.5 text-xs text-white text-center focus:border-emerald-500 focus:outline-none"
                />
                <span className="text-xs text-zinc-600">vs</span>
                <input 
                  type="number" 
                  value={data.stats.shotsOnTarget?.away || 0} 
                  onChange={(e) => handleDataChange(['stats', 'shotsOnTarget', 'away'], Number(e.target.value))}
                  className="w-full bg-zinc-900 border border-white/10 rounded p-1.5 text-xs text-white text-center focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const startAnalysis = async () => {
    let dataToAnalyze;
    try {
      dataToAnalyze = JSON.parse(editableData);
    } catch (e) {
      alert("Invalid JSON format in preview");
      return;
    }

    setStep('analyzing');
    setIsAnalyzing(true);
    setThoughts('');
    
    try {
      // 1. Stream thoughts
      const stream = streamAgentThoughts(dataToAnalyze);
      for await (const chunk of stream) {
        setThoughts(prev => prev + chunk);
      }

      // 2. Get final structured analysis
      const result = await analyzeMatch(dataToAnalyze);
      setAnalysis(result);
      
      // Save to history
      saveHistory(match!, result);

      // Auto-play the visualization once analysis is done
      setIsPlaying(true);
      setStep('result');
    } catch (error) {
      console.error("Analysis failed:", error);
      setThoughts(prev => prev + "\n\n[ERROR] Analysis failed. Please try again.");
      setStep('result');
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!match) return <div className="p-8 text-white text-center">Match not found</div>;

  const shareData = analysis ? btoa(JSON.stringify({
    m: match.id,
    p: analysis.prediction,
    w: analysis.winProbability
  })) : '';

  const shareUrl = `${window.location.origin}/share?d=${shareData}`;

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans flex flex-col pb-20">
      {/* Mobile App Header */}
      <header className="sticky top-0 z-20 bg-black/80 backdrop-blur-md border-b border-white/10 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="h-8 w-8 rounded-full bg-zinc-900 border border-white/10">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex flex-col">
            <span className="text-[10px] text-zinc-500 uppercase font-mono">{match.league}</span>
            <h1 className="text-sm font-bold tracking-tight text-white line-clamp-1">
              {match.homeTeam.name} vs {match.awayTeam.name}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {step === 'result' && (
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => setStep('selection')}
              className="h-8 w-8 rounded-full border-zinc-500/50 text-zinc-400 hover:bg-zinc-800 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          )}
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => setShowShare(true)}
            disabled={!analysis}
            className="h-8 w-8 rounded-full border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10 transition-colors"
          >
            <Share2 className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {step === 'selection' && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-1 flex flex-col gap-4 p-4 max-w-md mx-auto w-full"
        >
          <h2 className="text-lg font-bold text-white mb-2">选择分析数据源</h2>
          
          <div className="grid grid-cols-2 gap-3">
            <Card 
              className={`cursor-pointer transition-colors ${selectedSources.basic ? 'border-emerald-500 bg-emerald-500/10' : 'border-zinc-800 bg-zinc-900'}`}
              onClick={() => setSelectedSources(s => ({...s, basic: !s.basic}))}
            >
              <CardContent className="p-4 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <Info className="w-5 h-5 text-zinc-400" />
                  {selectedSources.basic && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                </div>
                <span className="text-sm font-medium">基本信息</span>
                <span className="text-[10px] text-zinc-500">球队、日期、联赛</span>
              </CardContent>
            </Card>
            
            <Card 
              className={`cursor-pointer transition-colors ${selectedSources.form ? 'border-emerald-500 bg-emerald-500/10' : 'border-zinc-800 bg-zinc-900'}`}
              onClick={() => setSelectedSources(s => ({...s, form: !s.form}))}
            >
              <CardContent className="p-4 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <TrendingUp className="w-5 h-5 text-zinc-400" />
                  {selectedSources.form && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                </div>
                <span className="text-sm font-medium">近期状态</span>
                <span className="text-[10px] text-zinc-500">近5场比赛</span>
              </CardContent>
            </Card>

            {match.stats && (
              <Card 
                className={`cursor-pointer transition-colors col-span-2 ${selectedSources.stats ? 'border-emerald-500 bg-emerald-500/10' : 'border-zinc-800 bg-zinc-900'}`}
                onClick={() => setSelectedSources(s => ({...s, stats: !s.stats}))}
              >
                <CardContent className="p-4 flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <BarChart2 className="w-5 h-5 text-zinc-400" />
                    {selectedSources.stats && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                  </div>
                  <span className="text-sm font-medium">比赛数据</span>
                  <span className="text-[10px] text-zinc-500">控球率、射门等</span>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-2 flex-1">
            <div className="flex justify-between items-center">
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                Agent 提示词预览
              </label>
              <button 
                onClick={() => setShowJson(!showJson)}
                className="text-[10px] text-emerald-500 hover:text-emerald-400 flex items-center gap-1 font-mono uppercase tracking-wider bg-emerald-500/10 px-2 py-1 rounded"
              >
                {showJson ? <LayoutTemplate className="w-3 h-3" /> : <Code2 className="w-3 h-3" />}
                {showJson ? '表单视图' : 'JSON 视图'}
              </button>
            </div>
            
            {showJson ? (
              <textarea 
                className="w-full flex-1 min-h-[200px] bg-zinc-950 border border-white/10 rounded-xl p-4 text-xs font-mono text-zinc-300 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                value={editableData}
                onChange={(e) => setEditableData(e.target.value)}
              />
            ) : (
              <div className="w-full flex-1 min-h-[200px] bg-zinc-950/50 border border-white/10 rounded-xl p-4 overflow-y-auto">
                {renderHumanReadableForm()}
              </div>
            )}
            <p className="text-[10px] text-zinc-500">
              {showJson ? "您可以在发送给 Agent 之前手动编辑 JSON 数据。" : "在发送给 Agent 之前，请在下方编辑参数。"}
            </p>
          </div>

          <Button 
            className="w-full mt-4 gap-2"
            onClick={startAnalysis}
          >
            <BrainCircuit className="w-4 h-4" /> 开始分析
          </Button>
        </motion.div>
      )}

      {(step === 'analyzing' || step === 'result') && (
        <main className="flex-1 flex flex-col gap-4 p-4 max-w-md mx-auto w-full">
          
          {/* Render Engine (Simulated Remotion) - Top on Mobile */}
          <Card className="flex flex-col border-zinc-800 bg-zinc-950 overflow-hidden relative shadow-lg">
            <CardHeader className="border-b border-white/5 py-3 px-4 flex flex-row items-center justify-between bg-zinc-900/50">
              <CardTitle className="flex items-center gap-2 text-blue-400 text-sm">
                <Play className="w-4 h-4" /> 
                渲染引擎
              </CardTitle>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setIsPlaying(!isPlaying)}
                className="h-6 w-6 text-zinc-400 hover:text-white"
              >
                {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              </Button>
            </CardHeader>
            
            <CardContent className="p-0 flex items-center justify-center bg-black relative overflow-hidden aspect-video">
              {/* Simulated Video Player Area */}
              <AnimatePresence>
                {analysis && isPlaying && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-gradient-to-br from-zinc-900 to-black"
                  >
                    <div className="flex items-center gap-6 mb-6">
                      <motion.img 
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        src={match.homeTeam.logo} 
                        className="w-16 h-16 object-contain drop-shadow-2xl" 
                      />
                      <div className="text-xl font-bold font-mono text-zinc-500">VS</div>
                      <motion.img 
                        initial={{ x: 20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        src={match.awayTeam.logo} 
                        className="w-16 h-16 object-contain drop-shadow-2xl" 
                      />
                    </div>

                    <motion.div 
                      initial={{ y: 10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.6 }}
                      className="w-full max-w-[240px] space-y-3"
                    >
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                          <span className="truncate max-w-[80px]">{match.homeTeam.name}</span>
                          <span>{analysis.winProbability.home}%</span>
                        </div>
                        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${analysis.winProbability.home}%` }}
                            transition={{ delay: 1, duration: 1 }}
                            className="h-full bg-emerald-500"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                          <span className="truncate max-w-[80px]">{match.awayTeam.name}</span>
                          <span>{analysis.winProbability.away}%</span>
                        </div>
                        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${analysis.winProbability.away}%` }}
                            transition={{ delay: 1.2, duration: 1 }}
                            className="h-full bg-blue-500"
                          />
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {!analysis && !isAnalyzing && (
                <div className="text-zinc-600 font-mono text-xs">等待分析...</div>
              )}
            </CardContent>
          </Card>

          {/* Agent Runtime - Bottom on Mobile */}
          <Card className="flex flex-col border-zinc-800 bg-zinc-950 shadow-lg flex-1 min-h-[300px]">
            <CardHeader className="border-b border-white/5 py-3 px-4 bg-zinc-900/50">
              <CardTitle className="flex items-center gap-2 text-emerald-500 text-sm">
                <BrainCircuit className="w-4 h-4" /> 
                Agent 运行环境
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 flex-1 overflow-y-auto font-mono text-[11px] text-zinc-400 leading-relaxed space-y-4 bg-black/50 rounded-b-xl border-t border-white/5">
              {isAnalyzing && (
                <div className="flex items-center gap-2 text-emerald-500 animate-pulse mb-4">
                  <Activity className="w-3 h-3" /> [SYSTEM] 正在执行沙盒...
                </div>
              )}
              <div className="whitespace-pre-wrap text-zinc-300">{thoughts}</div>
              
              {analysis && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-100"
                >
                  <h4 className="font-bold mb-2 text-emerald-400 uppercase tracking-wider text-[9px]">[FINAL_OUTPUT_JSON]</h4>
                  <pre className="text-[9px] overflow-x-auto text-emerald-300/80">
                    {JSON.stringify(analysis, null, 2)}
                  </pre>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </main>
      )}

      {/* Share Modal */}
      <AnimatePresence>
        {showShare && analysis && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setShowShare(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-xs w-full shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold mb-4 text-center text-white">分享分析结果</h3>
              <div className="bg-white p-4 rounded-xl flex items-center justify-center mb-4">
                <QRCodeSVG value={shareUrl} size={180} />
              </div>
              <p className="text-xs text-zinc-400 text-center mb-6 font-mono">
                扫码查看赛事分析
              </p>
              <Button className="w-full" onClick={() => setShowShare(false)}>
                关闭
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
