import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MOCK_MATCHES, Match } from '@/src/data/matches';
import { analyzeMatch, streamAgentThoughts, streamRemotionCode, MatchAnalysis, AnalysisResumeState } from '@/src/services/ai';
import { saveHistory, getHistory, saveResumeState, getResumeState, clearResumeState, HistoryRecord } from '@/src/services/history';
import { getSavedMatches, SavedMatchRecord } from '@/src/services/savedMatches';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { ArrowLeft, Share2, BrainCircuit, Play, Pause, Activity, Info, CheckCircle2, TrendingUp, BarChart2, RefreshCw, Code2, LayoutTemplate, FileText, ChevronDown, ChevronUp, Video } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'motion/react';
import { parseAgentStream, AgentResult } from '@/src/services/agentParser';
import { RemotionPlayer } from '@/src/components/RemotionPlayer';
import { useAnalysis } from '@/src/contexts/AnalysisContext';

export default function MatchDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const importedData = location.state?.importedData;
  const { activeAnalyses, startAnalysis: contextStartAnalysis, setCollapsedSegments: contextSetCollapsedSegments, generateCodeForSegment: contextGenerateCode } = useAnalysis();
  
  const isCustom = id === 'custom';
  const customMatch = React.useMemo(() => {
    if (importedData) {
      return {
        id: importedData.id || `custom_${Date.now()}`,
        league: importedData.league || '自定义赛事',
        date: importedData.date || new Date().toISOString().split('T')[0],
        status: importedData.status || 'upcoming',
        homeTeam: { 
          id: importedData.homeTeam?.id || 'home',
          name: importedData.homeTeam?.name || '主队', 
          logo: importedData.homeTeam?.logo || 'https://picsum.photos/seed/home/200/200', 
          form: importedData.homeTeam?.form || ['?', '?', '?', '?', '?'] 
        },
        awayTeam: { 
          id: importedData.awayTeam?.id || 'away',
          name: importedData.awayTeam?.name || '客队', 
          logo: importedData.awayTeam?.logo || 'https://picsum.photos/seed/away/200/200', 
          form: importedData.awayTeam?.form || ['?', '?', '?', '?', '?'] 
        },
        stats: importedData.stats || { possession: { home: 50, away: 50 }, shots: { home: 0, away: 0 }, shotsOnTarget: { home: 0, away: 0 } },
        customInfo: importedData.customInfo
      } as Match;
    }
    return {
      id: `custom_${Date.now()}`,
      league: '自定义赛事',
      date: new Date().toISOString().split('T')[0],
      status: 'upcoming',
      homeTeam: { id: 'home', name: '主队', logo: 'https://picsum.photos/seed/home/200/200', form: ['?', '?', '?', '?', '?'] },
      awayTeam: { id: 'away', name: '客队', logo: 'https://picsum.photos/seed/away/200/200', form: ['?', '?', '?', '?', '?'] },
      stats: { possession: { home: 50, away: 50 }, shots: { home: 0, away: 0 }, shotsOnTarget: { home: 0, away: 0 } }
    } as Match;
  }, [importedData]);
  
  const [historyRecord, setHistoryRecord] = useState<HistoryRecord | undefined>(undefined);
  const [savedMatchRecord, setSavedMatchRecord] = useState<SavedMatchRecord | undefined>(undefined);

  useEffect(() => {
    const loadData = async () => {
      const history = await getHistory();
      const record = history.find(h => h.matchId === id);
      setHistoryRecord(record);

      if (!record) {
        const savedMatches = await getSavedMatches();
        const saved = savedMatches.find(s => s.id === id);
        setSavedMatchRecord(saved);
      }
    };
    loadData();
  }, [id]);

  const match = isCustom ? customMatch : (MOCK_MATCHES.find(m => m.id === id) || historyRecord?.match || savedMatchRecord?.match);

  const activeAnalysis = match ? activeAnalyses[match.id] : null;

  // Local state for UI
  const [step, setStep] = useState<'selection' | 'analyzing' | 'result'>('selection');
  const [includeAnimations, setIncludeAnimations] = useState(true);
  const [selectedSources, setSelectedSources] = useState({
    basic: true,
    form: true,
    stats: true,
    custom: false,
  });

  useEffect(() => {
    if (match) {
      const m = match as any;
      setSelectedSources(prev => ({
        ...prev,
        stats: !!m.stats,
        custom: !!m.customInfo
      }));
    }
  }, [match]);
  const [editableData, setEditableData] = useState("");
  const [showJson, setShowJson] = useState(false);
  const [savedResumeState, setSavedResumeState] = useState<any | null>(null);
  const [showShare, setShowShare] = useState(false);

  // Sync with active analysis
  useEffect(() => {
    if (activeAnalysis) {
      if (activeAnalysis.isAnalyzing) {
        setStep('analyzing');
      } else if (activeAnalysis.analysis) {
        setStep('result');
      }
    }
  }, [activeAnalysis]);

  useEffect(() => {
    if (!match) return;

    if (historyRecord && !activeAnalysis) {
      setStep('result');
    } else if (!activeAnalysis) {
      // Check for resume state if no completed history exists
      getResumeState(match.id).then(resumeState => {
        if (resumeState) {
          setSavedResumeState(resumeState);
        }
      });
    }
  }, [match, activeAnalysis, historyRecord]);

  useEffect(() => {
    if (!match || step !== 'selection') return;
    
    const m = match as Match;
    const dataToSend: any = {};
    
    if (selectedSources.basic) {
      dataToSend.id = m.id;
      dataToSend.league = m.league;
      dataToSend.status = m.status;
      dataToSend.date = m.date;
      dataToSend.homeTeam = { 
        id: m.homeTeam.id,
        name: m.homeTeam.name,
        logo: m.homeTeam.logo,
        form: m.homeTeam.form
      };
      dataToSend.awayTeam = { 
        id: m.awayTeam.id,
        name: m.awayTeam.name,
        logo: m.awayTeam.logo,
        form: m.awayTeam.form
      };
    }
    
    if (selectedSources.form) {
      if (!dataToSend.homeTeam) dataToSend.homeTeam = {};
      if (!dataToSend.awayTeam) dataToSend.awayTeam = {};
      dataToSend.homeTeam.form = m.homeTeam.form;
      dataToSend.awayTeam.form = m.awayTeam.form;
    }
    
    if (selectedSources.stats && m.stats) {
      dataToSend.stats = m.stats;
    }
    
    if (selectedSources.custom) {
      dataToSend.customInfo = (m as any).customInfo || "";
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

        {selectedSources.custom && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-zinc-400 uppercase border-b border-white/10 pb-1">自定义数据</h3>
            <textarea 
              value={data.customInfo || ''} 
              onChange={(e) => handleDataChange(['customInfo'], e.target.value)}
              placeholder="输入伤停信息、天气、裁判、战意等其他因素..."
              className="w-full bg-zinc-900 border border-white/10 rounded p-2 text-xs text-white focus:border-emerald-500 focus:outline-none min-h-[80px] resize-none"
            />
          </div>
        )}
      </div>
    );
  };

  const startAnalysis = async (isResume: boolean = false) => {
    if (!match) return;
    let dataToAnalyze;
    try {
      dataToAnalyze = JSON.parse(editableData);
    } catch (e) {
      alert("Invalid JSON format in preview");
      return;
    }

    setStep('analyzing');
    contextStartAnalysis(match, dataToAnalyze, includeAnimations, isResume);
  };

  if (!match) return <div className="p-8 text-white text-center">Match not found</div>;

  // Determine what to render based on activeAnalysis or history
  let displayData = {
    analysis: null as MatchAnalysis | null,
    analyzedMatch: match,
    thoughts: '',
    parsedStream: null as AgentResult | null,
    collapsedSegments: {} as Record<string, boolean>,
    generatedCodes: {} as Record<string, string>,
    isGeneratingCode: {} as Record<string, boolean>,
    isAnalyzing: false,
    error: null as string | null
  };

  if (activeAnalysis) {
    displayData = {
      analysis: activeAnalysis.analysis,
      analyzedMatch: match,
      thoughts: activeAnalysis.thoughts,
      parsedStream: activeAnalysis.parsedStream,
      collapsedSegments: activeAnalysis.collapsedSegments,
      generatedCodes: activeAnalysis.generatedCodes,
      isGeneratingCode: activeAnalysis.isGeneratingCode,
      isAnalyzing: activeAnalysis.isAnalyzing,
      error: activeAnalysis.error
    };
  } else if (historyRecord) {
    displayData = {
      analysis: historyRecord.analysis,
      analyzedMatch: historyRecord.match,
      thoughts: '[SYSTEM] Loaded from local history cache.\n\nAnalysis complete.',
      parsedStream: historyRecord.parsedStream || null,
      collapsedSegments: {},
      generatedCodes: historyRecord.generatedCodes || {},
      isGeneratingCode: {},
      isAnalyzing: false,
      error: null
    };
  }

  const {
    analysis,
    analyzedMatch,
    thoughts,
    parsedStream,
    collapsedSegments,
    generatedCodes,
    isGeneratingCode,
    isAnalyzing,
    error
  } = displayData;

  const shareData = React.useMemo(() => {
    if (!editableData) return '';
    try {
      const data = JSON.parse(editableData);
      return btoa(encodeURIComponent(JSON.stringify({
        v: 2,
        d: data
      })));
    } catch (e) {
      return '';
    }
  }, [editableData]);

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
            <span className="text-[10px] text-zinc-500 uppercase font-mono">
              {(() => {
                try {
                  const d = JSON.parse(editableData);
                  return d.league || match.league;
                } catch(e) { return match.league; }
              })()}
            </span>
            <h1 className="text-sm font-bold tracking-tight text-white line-clamp-1">
              {(() => {
                try {
                  const d = JSON.parse(editableData);
                  return `${d.homeTeam?.name || match.homeTeam.name} vs ${d.awayTeam?.name || match.awayTeam.name}`;
                } catch(e) { return `${match.homeTeam.name} vs ${match.awayTeam.name}`; }
              })()}
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
            disabled={!editableData}
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
                className={`cursor-pointer transition-colors ${selectedSources.stats ? 'border-emerald-500 bg-emerald-500/10' : 'border-zinc-800 bg-zinc-900'}`}
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

            <Card 
              className={`cursor-pointer transition-colors ${!match.stats ? 'col-span-2' : ''} ${selectedSources.custom ? 'border-emerald-500 bg-emerald-500/10' : 'border-zinc-800 bg-zinc-900'}`}
              onClick={() => setSelectedSources(s => ({...s, custom: !s.custom}))}
            >
              <CardContent className="p-4 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <FileText className="w-5 h-5 text-zinc-400" />
                  {selectedSources.custom && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                </div>
                <span className="text-sm font-medium">自定义数据</span>
                <span className="text-[10px] text-zinc-500">伤停、天气、战意等</span>
              </CardContent>
            </Card>
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

          <div className="flex items-center gap-2 mt-4 px-1">
            <input 
              type="checkbox" 
              id="includeAnimations" 
              checked={includeAnimations}
              onChange={(e) => setIncludeAnimations(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0 accent-emerald-500"
            />
            <label htmlFor="includeAnimations" className="text-xs text-zinc-400 select-none cursor-pointer flex items-center gap-2">
              <Video className="w-3 h-3" /> 生成演示动画 (可能会增加分析时间)
            </label>
          </div>

          <div className="flex flex-col gap-2 mt-4">
            {savedResumeState && (
              <Button 
                className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => startAnalysis(true)}
              >
                <Activity className="w-4 h-4" /> 继续未完成的分析
              </Button>
            )}
            <Button 
              className="w-full gap-2"
              variant={savedResumeState ? "outline" : "default"}
              onClick={() => startAnalysis(false)}
            >
              <BrainCircuit className="w-4 h-4" /> {savedResumeState ? '重新开始分析' : '开始分析'}
            </Button>
          </div>
        </motion.div>
      )}

      {(step === 'analyzing' || step === 'result') && (
        <main className="flex-1 flex flex-col gap-4 p-4 max-w-md mx-auto w-full">
          
          {isAnalyzing && !parsedStream?.segments?.length && (
            <div className="flex items-center justify-center p-8 text-emerald-500 animate-pulse font-mono text-xs">
              <Activity className="w-4 h-4 mr-2" /> [SYSTEM] 初始化分析引擎...
            </div>
          )}

          {parsedStream?.segments.map((seg, i) => {
            const isCollapsed = collapsedSegments[seg.id];
            return (
              <motion.div 
                key={seg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col border border-zinc-800 rounded-xl bg-zinc-950 overflow-hidden shadow-lg"
              >
                {/* Thoughts Header (Collapsible) */}
                <div 
                  className="bg-zinc-900/80 p-3 flex justify-between items-center cursor-pointer hover:bg-zinc-800 transition-colors"
                  onClick={() => contextSetCollapsedSegments(match.id, { ...collapsedSegments, [seg.id]: !isCollapsed })}
                >
                  <div className="flex flex-col gap-1">
                    <span className={`text-xs font-mono flex items-center gap-2 ${seg.isThoughtComplete ? 'text-zinc-400' : 'text-emerald-500'}`}>
                      {seg.isThoughtComplete ? <CheckCircle2 className="w-3.5 h-3.5"/> : <Activity className="w-3.5 h-3.5 animate-pulse"/>}
                      分析阶段 {i + 1}
                      {seg.title && (
                        <span className="ml-2 text-zinc-500 font-bold border-l border-zinc-700 pl-2">
                          {seg.title}
                        </span>
                      )}
                    </span>
                    
                    {/* Tags Display (Visible even when collapsed) */}
                    {seg.tags && seg.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1 ml-6">
                        {seg.tags.map((tag, idx) => {
                          let colorClass = "bg-zinc-800 text-zinc-400 border-zinc-700";
                          if (tag.team === 'home') colorClass = "bg-emerald-950/30 text-emerald-400 border-emerald-500/30";
                          if (tag.team === 'away') colorClass = "bg-blue-950/30 text-blue-400 border-blue-500/30";
                          
                          return (
                            <span key={idx} className={`text-[9px] px-1.5 py-0.5 rounded border ${colorClass}`}>
                              {tag.label}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {isCollapsed ? <ChevronDown className="w-4 h-4 text-zinc-500" /> : <ChevronUp className="w-4 h-4 text-zinc-500" />}
                </div>
                
                {/* Thoughts Content */}
                <AnimatePresence>
                  {!isCollapsed && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="p-4 text-[11px] font-mono text-zinc-300 leading-relaxed bg-black/50"
                    >
                      <div className="prose prose-invert prose-xs max-w-none [&>ul]:list-disc [&>ul]:pl-4 [&>ol]:list-decimal [&>ol]:pl-4 [&>h3]:text-emerald-400 [&>h3]:font-bold [&>h3]:mt-2 [&>h3]:mb-1 [&>p]:mb-2 [&>strong]:text-white">
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          components={{
                            table: ({node, ...props}) => (
                              <div className="overflow-x-auto my-4 border border-zinc-800 rounded-lg">
                                <table className="w-full text-left text-[10px]" {...props} />
                              </div>
                            ),
                            thead: ({node, ...props}) => <thead className="bg-zinc-900 text-zinc-400 uppercase font-bold border-b border-zinc-800" {...props} />,
                            tbody: ({node, ...props}) => <tbody className="divide-y divide-zinc-800" {...props} />,
                            tr: ({node, ...props}) => <tr className="hover:bg-zinc-900/50 transition-colors" {...props} />,
                            th: ({node, ...props}) => <th className="px-3 py-2 whitespace-nowrap font-semibold" {...props} />,
                            td: ({node, ...props}) => <td className="px-3 py-2 whitespace-nowrap text-zinc-300" {...props} />,
                          }}
                        >
                          {seg.thoughts}
                        </ReactMarkdown>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Animation Block */}
                {seg.animation && (
                  <div className="border-t border-zinc-800 bg-black p-4">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2 text-blue-400 text-xs font-bold border-b border-white/10 pb-2">
                        <Video className="w-4 h-4" /> {seg.animation.title || '数据可视化'}
                      </div>
                      <div className="text-zinc-300 text-xs italic bg-zinc-900/50 p-3 rounded-lg border-l-2 border-blue-500">
                        "{seg.animation.narration}"
                      </div>
                      
                      {/* Remotion Player */}
                      {(isGeneratingCode[seg.id] || generatedCodes[seg.id]) && (
                        <div className="mt-2 w-full max-w-[300px] mx-auto">
                          <RemotionPlayer 
                            code={generatedCodes[seg.id]} 
                            data={seg.animation.data}
                            title={seg.animation.title || ''}
                            narration={seg.animation.narration || ''}
                            isGenerating={isGeneratingCode[seg.id]}
                          />
                        </div>
                      )}

                      {/* Raw Code Toggle */}
                      {generatedCodes[seg.id] && (
                        <details className="mt-2 group">
                          <summary className="text-[10px] text-emerald-500 cursor-pointer hover:text-emerald-400 font-mono flex items-center gap-1">
                            <Code2 className="w-3 h-3" /> 查看生成的 Remotion 代码
                          </summary>
                          <div className="bg-zinc-950 rounded-lg p-4 border border-white/5 font-mono text-[10px] text-zinc-400 overflow-x-auto mt-2">
                            <pre>{generatedCodes[seg.id]}</pre>
                          </div>
                        </details>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}

          {/* Final Summary Card */}
          {analysis && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 }}
            >
              <Card className="flex flex-col border-emerald-500/30 bg-zinc-950 overflow-hidden relative shadow-lg shadow-emerald-500/10">
                <CardHeader className="border-b border-white/5 py-3 px-4 flex flex-row items-center justify-between bg-emerald-500/10">
                  <CardTitle className="flex items-center gap-2 text-emerald-400 text-sm">
                    <BrainCircuit className="w-4 h-4" /> 
                    最终分析摘要
                  </CardTitle>
                </CardHeader>
                
                <CardContent className="p-0 flex flex-col items-center justify-center bg-gradient-to-br from-zinc-900 to-black relative overflow-hidden">
                  <div className="p-6 w-full flex flex-col items-center">
                    <div className="flex items-center gap-6 mb-6">
                      <img src={match.homeTeam.logo} className="w-16 h-16 object-contain drop-shadow-2xl rounded-full bg-white/5" />
                      <div className="text-xl font-bold font-mono text-zinc-500">VS</div>
                      <img src={match.awayTeam.logo} className="w-16 h-16 object-contain drop-shadow-2xl rounded-full bg-white/5" />
                    </div>

                    <div className="w-full max-w-[240px] space-y-4">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                          <span className="truncate max-w-[80px]">
                            {(() => {
                              try {
                                const d = JSON.parse(editableData);
                                return d.homeTeam?.name || match.homeTeam.name;
                              } catch(e) { return match.homeTeam.name; }
                            })()}
                          </span>
                          <span>{analysis.winProbability.home}%</span>
                        </div>
                        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${analysis.winProbability.home}%` }}
                            transition={{ duration: 1 }}
                            className="h-full bg-emerald-500"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                          <span className="truncate max-w-[80px]">平局</span>
                          <span>{analysis.winProbability.draw}%</span>
                        </div>
                        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${analysis.winProbability.draw}%` }}
                            transition={{ duration: 1 }}
                            className="h-full bg-zinc-500"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                          <span className="truncate max-w-[80px]">
                            {(() => {
                              try {
                                const d = JSON.parse(editableData);
                                return d.awayTeam?.name || match.awayTeam.name;
                              } catch(e) { return match.awayTeam.name; }
                            })()}
                          </span>
                          <span>{analysis.winProbability.away}%</span>
                        </div>
                        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${analysis.winProbability.away}%` }}
                            transition={{ duration: 1 }}
                            className="h-full bg-blue-500"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 p-4 rounded-xl bg-black/50 border border-white/5 w-full">
                      <p className="text-xs text-zinc-300 leading-relaxed italic text-center">
                        "{analysis.prediction}"
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Raw Output Fallback (if parsing fails completely but we have thoughts) */}
          {!parsedStream?.segments?.length && thoughts && !isAnalyzing && !analysis && (
            <Card className="border-red-500/30 bg-zinc-950">
              <CardHeader className="border-b border-white/5 py-3 px-4">
                <CardTitle className="text-red-400 text-sm">解析失败 (原始输出)</CardTitle>
              </CardHeader>
              <CardContent className="p-4 font-mono text-[10px] text-zinc-400 whitespace-pre-wrap">
                {thoughts}
              </CardContent>
            </Card>
          )}
        </main>
      )}

      {/* Share Modal */}
      <AnimatePresence>
        {showShare && (
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
              <h3 className="text-lg font-bold mb-4 text-center text-white">分享赛事配置</h3>
              <div className="bg-white p-4 rounded-xl flex items-center justify-center mb-4">
                <QRCodeSVG value={shareUrl} size={180} />
              </div>
              <p className="text-xs text-zinc-400 text-center mb-6 font-mono">
                扫码导入赛事数据并开始分析
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
