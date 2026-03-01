import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MOCK_MATCHES, Match } from '@/src/data/matches';
import { MatchAnalysis } from '@/src/services/ai';
import { getHistory, getResumeState, HistoryRecord } from '@/src/services/history';
import { getSavedMatches, SavedMatchRecord } from '@/src/services/savedMatches';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { ArrowLeft, Share2, BrainCircuit, Play, Pause, Activity, Info, CheckCircle2, TrendingUp, BarChart2, RefreshCw, Code2, LayoutTemplate, FileText, ChevronDown, ChevronUp, Video, Download, Loader2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'motion/react';
import { AgentResult } from '@/src/services/agentParser';
import { RemotionPlayer } from '@/src/components/RemotionPlayer';
import { useAnalysis } from '@/src/contexts/AnalysisContext';
import { compressToEncodedURIComponent } from 'lz-string';
import { toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import {
  ANALYSIS_DATA_SOURCES,
  FormFieldSchema,
  SourceIconKey,
  SourceSelection,
  buildSourceCapabilities,
  resolveSourceSelection
} from '@/src/services/dataSources';

export default function MatchDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const location = useLocation();
  const importedData = location.state?.importedData;
  const { activeAnalyses, startAnalysis: contextStartAnalysis, setCollapsedSegments: contextSetCollapsedSegments } = useAnalysis();
  
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

  const match = (importedData ? customMatch : null) || (isCustom ? customMatch : (MOCK_MATCHES.find(m => m.id === id) || historyRecord?.match || savedMatchRecord?.match));

  const activeAnalysis = match ? activeAnalyses[match.id] : null;

  // Local state for UI
  const [step, setStep] = useState<'selection' | 'analyzing' | 'result'>('selection');
  const [includeAnimations, setIncludeAnimations] = useState(true);
  const [selectedSources, setSelectedSources] = useState<Partial<SourceSelection>>({});

  const [editableData, setEditableData] = useState("");
  const [showJson, setShowJson] = useState(false);
  const [savedResumeState, setSavedResumeState] = useState<any | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(true);

  useEffect(() => {
    setSelectedSources({});
  }, [match?.id]);

  const resolvedSelectedSources = React.useMemo<SourceSelection>(() => {
    if (!match) {
      return { fundamental: false, market: false, custom: false };
    }
    return resolveSourceSelection(match as Match, importedData, selectedSources);
  }, [match, importedData, selectedSources]);

  const availableSources = React.useMemo(() => {
    if (!match) return ANALYSIS_DATA_SOURCES;
    const ctx = { match: match as Match, importedData };
    return ANALYSIS_DATA_SOURCES.filter(source => source.isAvailable(ctx));
  }, [match, importedData]);

  const renderSourceIcon = (icon: SourceIconKey) => {
    if (icon === 'layout') return <LayoutTemplate className="w-5 h-5 text-zinc-400" />;
    if (icon === 'trending') return <TrendingUp className="w-5 h-5 text-zinc-400" />;
    return <FileText className="w-5 h-5 text-zinc-400" />;
  };

  const handleExportPDF = async () => {
    if (!match || isExporting) return;
    setIsExporting(true);

    try {
      // 1. Expand all segments
      const originalCollapsed = { ...activeAnalysis?.collapsedSegments };
      const allExpanded: Record<string, boolean> = {};
      if (activeAnalysis?.parsedStream) {
        activeAnalysis.parsedStream.segments.forEach(seg => {
          allExpanded[seg.id] = false;
        });
        contextSetCollapsedSegments(match.id, allExpanded);
      }

      // 2. Wait for expansion animation and DOM update
      await new Promise(resolve => setTimeout(resolve, 1000));

      const element = document.getElementById('analysis-content');
      if (!element) throw new Error('Content element not found');

      // 3. Capture with html-to-image
      const dataUrl = await toJpeg(element, {
        quality: 0.95,
        backgroundColor: '#000000',
        pixelRatio: 2,
        // Filter out video elements to avoid tainted canvas issues
        filter: (node) => node.tagName !== 'VIDEO',
      });

      // 4. Generate PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgProps = pdf.getImageProperties(dataUrl);
      const imgWidth = imgProps.width;
      const imgHeight = imgProps.height;
      
      const ratio = pdfWidth / imgWidth;
      const scaledHeight = imgHeight * ratio;
      
      let heightLeft = scaledHeight;
      let position = 0;
      
      // Helper to add watermark
      const addWatermark = () => {
        const timestamp = new Date().toLocaleString();
        pdf.setFontSize(10);
        pdf.setTextColor(150, 150, 150);
        pdf.text(`Generated by MatchFlow at ${timestamp}`, 10, pdfHeight - 10);
      };

      // First page
      pdf.addImage(dataUrl, 'JPEG', 0, position, pdfWidth, scaledHeight);
      addWatermark();
      heightLeft -= pdfHeight;
      
      // Subsequent pages
      while (heightLeft > 0) {
        position = heightLeft - scaledHeight;
        pdf.addPage();
        pdf.addImage(dataUrl, 'JPEG', 0, position, pdfWidth, scaledHeight);
        addWatermark();
        heightLeft -= pdfHeight;
      }
      
      // Add Disclaimer Page (Render as image to support Chinese characters)
      const disclaimerContainer = document.createElement('div');
      // Set fixed size approximating A4 ratio
      const containerWidth = 800;
      const containerHeight = 1132; 

      disclaimerContainer.style.width = `${containerWidth}px`;
      disclaimerContainer.style.height = `${containerHeight}px`;
      disclaimerContainer.style.padding = '60px';
      disclaimerContainer.style.backgroundColor = '#141414';
      disclaimerContainer.style.color = '#ffffff';
      // Use fixed position to ensure it's in the viewport for capture
      disclaimerContainer.style.position = 'fixed';
      disclaimerContainer.style.top = '0';
      disclaimerContainer.style.left = '0';
      disclaimerContainer.style.zIndex = '10000'; // Ensure it's on top
      disclaimerContainer.style.fontFamily = '"Inter", "Microsoft YaHei", "PingFang SC", sans-serif';
      disclaimerContainer.style.boxSizing = 'border-box';

      disclaimerContainer.innerHTML = `
        <div style="height: 100%; display: flex; flex-direction: column; justify-content: space-between;">
            <div>
                <h1 style="font-size: 32px; margin-bottom: 40px; border-bottom: 1px solid #333; padding-bottom: 20px; color: #fff; font-weight: bold;">Disclaimer / 免责声明</h1>
                <div style="font-size: 16px; line-height: 1.8; color: #cccccc;">
                <p style="margin-bottom: 15px;">1. 本报告由 MatchFlow AI 自动生成，仅供娱乐和参考。</p>
                <p style="margin-bottom: 15px;">2. 报告中的分析、预测和数据解读均基于历史数据与算法模型，不代表确定性结果。</p>
                <p style="margin-bottom: 15px;">3. MatchFlow 不提供任何形式的博彩建议或投资建议，用户应自行承担基于本报告做出决策的风险。</p>
                <p style="margin-bottom: 15px;">4. 足球比赛存在高度不确定性，AI 模型无法覆盖所有突发情况（如临场伤病、红牌等）。</p>
                <p style="margin-bottom: 15px;">5. 请理性看待比赛结果，切勿沉迷赌博。</p>
                <hr style="border: 0; border-top: 1px solid #333; margin: 40px 0;" />
                <p style="margin-bottom: 15px;">1. This report is automatically generated by MatchFlow AI and is for entertainment and reference purposes only.</p>
                <p style="margin-bottom: 15px;">2. All analyses, predictions, and data interpretations in this report are based on historical data and algorithmic models and do not represent deterministic results.</p>
                <p style="margin-bottom: 15px;">3. MatchFlow does not provide any form of gambling or investment advice. Users shall bear the risks of any decisions made based on this report.</p>
                <p style="margin-bottom: 15px;">4. Football matches are full of uncertainties, and AI models cannot predict all sudden situations (such as last-minute injuries, red cards, etc.).</p>
                <p style="margin-bottom: 15px;">5. Please view the match results rationally and do not indulge in gambling.</p>
                </div>
            </div>
            <div style="text-align: center; color: #555; font-size: 12px; padding-top: 20px;">
                Generated by MatchFlow at ${new Date().toLocaleString()}
            </div>
        </div>
      `;

      document.body.appendChild(disclaimerContainer);

      try {
        // Wait a short moment for rendering
        await new Promise(resolve => setTimeout(resolve, 100));

        const disclaimerUrl = await toJpeg(disclaimerContainer, {
          quality: 0.95,
          backgroundColor: '#141414',
          pixelRatio: 2,
        });

        pdf.addPage();
        // Fill page with dark background first
        pdf.setFillColor(20, 20, 20);
        pdf.rect(0, 0, pdfWidth, pdfHeight, 'F');
        
        // Add the full page image
        pdf.addImage(disclaimerUrl, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      } catch (e) {
        console.error("Failed to generate disclaimer page:", e);
      } finally {
        document.body.removeChild(disclaimerContainer);
      }
      
      // Note: We don't call addWatermark() for the last page because we included it in the HTML image.

      // 5. Save or Share
      const fileName = `${match.homeTeam.name}_vs_${match.awayTeam.name}_分析报告.pdf`;

      if (Capacitor.isNativePlatform()) {
        // Native: Save to cache and share
        const pdfBase64 = pdf.output('datauristring').split(',')[1];
        
        const fileResult = await Filesystem.writeFile({
          path: fileName,
          data: pdfBase64,
          directory: Directory.Cache
        });

        await Share.share({
          title: '比赛分析报告',
          text: `查看 ${match.homeTeam.name} vs ${match.awayTeam.name} 的分析报告`,
          url: fileResult.uri,
          dialogTitle: '分享分析报告'
        });
      } else {
        // Web: Download directly
        pdf.save(fileName);
      }

      // 5. Restore state
      if (activeAnalysis?.parsedStream) {
        contextSetCollapsedSegments(match.id, originalCollapsed);
      }
    } catch (error: any) {
      console.error('Failed to export PDF:', error);
      alert(`导出 PDF 失败: ${error.message || '未知错误'}`);
    } finally {
      setIsExporting(false);
    }
  };

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

  const editableDataRef = React.useRef(editableData);
  useEffect(() => {
    editableDataRef.current = editableData;
  }, [editableData]);

  useEffect(() => {
    if (!match || step !== 'selection') return;
    
    let currentData: any = {};
    try {
      if (editableDataRef.current) {
        currentData = JSON.parse(editableDataRef.current);
      }
    } catch (e) {
      // If JSON is invalid and not empty, avoid overwriting user's work
      if (editableDataRef.current && editableDataRef.current.trim() !== "") return;
    }

    const m = match as Match;
    const newData: any = { ...currentData };
    const sourceContext = { match: m, importedData };

    ANALYSIS_DATA_SOURCES.forEach((source) => {
      if (resolvedSelectedSources[source.id]) {
        source.applyToData(newData, sourceContext);
      } else {
        source.removeFromData(newData);
      }
    });

    const capabilities = buildSourceCapabilities(newData, resolvedSelectedSources);

    // Explicit source context helps deterministic planning routing in ai.ts.
    newData.sourceContext = {
      origin: m.source || (importedData ? 'imported' : 'local'),
      selectedSources: { ...resolvedSelectedSources },
      selectedSourceIds: ANALYSIS_DATA_SOURCES
        .filter(source => resolvedSelectedSources[source.id])
        .map(source => source.id),
      capabilities,
      matchStatus: (newData.status || m.status || 'unknown')
    };
    
    const newJson = JSON.stringify(newData, null, 2);
    if (newJson !== editableDataRef.current) {
      setEditableData(newJson);
    }
  }, [match, step, importedData, resolvedSelectedSources]);

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

  const getValueByPath = (data: any, path: string[]) =>
    path.reduce((acc, key) => (acc == null ? undefined : acc[key]), data);

  const renderFormField = (data: any, field: FormFieldSchema) => {
    const inputClass = "w-full bg-zinc-900 border border-white/10 rounded p-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none";
    const centeredInputClass = "w-full bg-zinc-900 border border-white/10 rounded p-1.5 text-xs text-white text-center focus:border-emerald-500 focus:outline-none";
    const placeholder = 'placeholderKey' in field && field.placeholderKey ? t(field.placeholderKey) : undefined;

    if (field.type === 'text') {
      const value = getValueByPath(data, field.path);
      return (
        <div key={field.id}>
          {field.labelKey && <label className="text-[10px] text-zinc-500 block mb-1">{t(field.labelKey)}</label>}
          <input
            type="text"
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => handleDataChange(field.path, e.target.value)}
            placeholder={placeholder}
            className={inputClass}
          />
        </div>
      );
    }

    if (field.type === 'number') {
      const value = getValueByPath(data, field.path);
      return (
        <div key={field.id}>
          {field.labelKey && <label className="text-[10px] text-zinc-500 block mb-1">{t(field.labelKey)}</label>}
          <input
            type="number"
            value={typeof value === 'number' ? value : Number(value ?? 0)}
            onChange={(e) => handleDataChange(field.path, Number(e.target.value))}
            placeholder={placeholder}
            className={inputClass}
          />
        </div>
      );
    }

    if (field.type === 'textarea') {
      const value = getValueByPath(data, field.path);
      return (
        <div key={field.id} className="space-y-2">
          {field.labelKey && (
            <label className="text-[10px] text-zinc-500 block mb-1">
              {t(field.labelKey)}
            </label>
          )}
          <textarea
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => handleDataChange(field.path, e.target.value)}
            placeholder={placeholder}
            rows={field.rows || 4}
            className="w-full bg-zinc-900 border border-white/10 rounded p-2 text-xs text-white focus:border-emerald-500 focus:outline-none min-h-[80px] resize-none"
          />
        </div>
      );
    }

    if (field.type === 'csv_array') {
      const value = getValueByPath(data, field.path);
      const text = Array.isArray(value) ? value.join(', ') : (typeof value === 'string' ? value : '');
      return (
        <div key={field.id}>
          {field.labelKey && <label className="text-[10px] text-zinc-500 block mb-1">{t(field.labelKey)}</label>}
          <input
            type="text"
            value={text}
            onChange={(e) =>
              handleDataChange(
                field.path,
                e.target.value
                  .split(',')
                  .map(s => s.trim())
                  .filter(Boolean)
              )
            }
            placeholder={field.placeholder}
            className={inputClass}
          />
        </div>
      );
    }

    if (field.type === 'versus_number') {
      const homeValue = getValueByPath(data, field.homePath);
      const awayValue = getValueByPath(data, field.awayPath);
      return (
        <div key={field.id} className="space-y-2">
          {field.labelKey && <label className="text-[10px] text-zinc-500 block">{t(field.labelKey)}</label>}
          <div className="flex gap-2 items-center">
            <input
              type="number"
              value={typeof homeValue === 'number' ? homeValue : Number(homeValue ?? 0)}
              onChange={(e) => handleDataChange(field.homePath, Number(e.target.value))}
              className={centeredInputClass}
            />
            <span className="text-xs text-zinc-600">vs</span>
            <input
              type="number"
              value={typeof awayValue === 'number' ? awayValue : Number(awayValue ?? 0)}
              onChange={(e) => handleDataChange(field.awayPath, Number(e.target.value))}
              className={centeredInputClass}
            />
          </div>
        </div>
      );
    }

    const homeValue = getValueByPath(data, field.homePath);
    const drawValue = getValueByPath(data, field.drawPath);
    const awayValue = getValueByPath(data, field.awayPath);
    return (
      <div key={field.id} className="space-y-2">
        {field.labelKey && <label className="text-[10px] text-zinc-500 block">{t(field.labelKey)}</label>}
        <div className="flex gap-2">
          <input
            type="number"
            value={typeof homeValue === 'number' ? homeValue : Number(homeValue ?? 0)}
            onChange={(e) => handleDataChange(field.homePath, Number(e.target.value))}
            className={centeredInputClass}
            placeholder={t(field.homePlaceholderKey)}
          />
          <input
            type="number"
            value={typeof drawValue === 'number' ? drawValue : Number(drawValue ?? 0)}
            onChange={(e) => handleDataChange(field.drawPath, Number(e.target.value))}
            className={centeredInputClass}
            placeholder={t(field.drawPlaceholderKey)}
          />
          <input
            type="number"
            value={typeof awayValue === 'number' ? awayValue : Number(awayValue ?? 0)}
            onChange={(e) => handleDataChange(field.awayPath, Number(e.target.value))}
            className={centeredInputClass}
            placeholder={t(field.awayPlaceholderKey)}
          />
        </div>
      </div>
    );
  };

  const renderHumanReadableForm = () => {
    let data;
    try {
      data = JSON.parse(editableData);
    } catch (e) {
      return <div className="text-red-400 text-xs p-4">{t('match.invalid_json')}</div>;
    }

    const enabledSources = availableSources.filter(source => resolvedSelectedSources[source.id]);
    const isSimpleField = (field: FormFieldSchema) =>
      field.type === 'text' || field.type === 'number' || field.type === 'csv_array';

    return (
      <div className="space-y-4 text-sm">
        {enabledSources.map((source) => (
          <React.Fragment key={source.id}>
            {source.formSections.map((section) => {
              if (section.visibleWhen && !section.visibleWhen(data)) return null;
              const useGrid = section.columns === 2 && section.fields.every(isSimpleField);

              return (
                <div key={`${source.id}-${section.id}`} className="space-y-3">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase border-b border-white/10 pb-1">
                    {t(section.titleKey)}
                  </h3>
                  <div className={useGrid ? 'grid grid-cols-2 gap-2' : 'space-y-3'}>
                    {section.fields.map(field => renderFormField(data, field))}
                  </div>
                </div>
              );
            })}
          </React.Fragment>
        ))}
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

  const shareData = React.useMemo(() => {
    if (!editableData) return '';
    try {
      const data = JSON.parse(editableData);
      const jsonString = JSON.stringify({
        v: 3, // Increment version to indicate lz-string compression
        d: data
      });
      return compressToEncodedURIComponent(jsonString);
    } catch (e) {
      return '';
    }
  }, [editableData]);

  const shareUrl = `${window.location.origin}/share?d=${shareData}`;

  if (!match) return <div className="p-8 text-white text-center">Match not found</div>;

  // Determine what to render based on activeAnalysis or history
  let displayData = {
    analysis: null as MatchAnalysis | null,
    analyzedMatch: match,
    thoughts: '',
    parsedStream: null as AgentResult | null,
    collapsedSegments: {} as Record<string, boolean>,
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
    isAnalyzing,
    error
  } = displayData;

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans flex flex-col pb-[calc(5rem+env(safe-area-inset-bottom))]">
      {/* Mobile App Header */}
      <header className="sticky top-0 z-20 bg-black/80 backdrop-blur-md border-b border-white/10 px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] flex items-center justify-between">
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
            <>
              <Button 
                variant="outline" 
                size="icon"
                onClick={handleExportPDF}
                disabled={isExporting}
                className="h-8 w-8 rounded-full border-blue-500/50 text-blue-400 hover:bg-blue-500/10 transition-colors"
              >
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              </Button>
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => setStep('selection')}
                className="h-8 w-8 rounded-full border-zinc-500/50 text-zinc-400 hover:bg-zinc-800 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </>
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
          <h2 className="text-lg font-bold text-white mb-2">{t('match.select_sources')}</h2>
          
          <div className="grid grid-cols-2 gap-3">
            {availableSources.map((source) => {
              const isSelected = !!resolvedSelectedSources[source.id];
              return (
                <Card
                  key={source.id}
                  className={`cursor-pointer transition-colors ${source.cardSpan === 2 ? 'col-span-2' : ''} ${isSelected ? 'border-emerald-500 bg-emerald-500/10' : 'border-zinc-800 bg-zinc-900'}`}
                  onClick={() =>
                    setSelectedSources(prev => ({
                      ...prev,
                      [source.id]: !resolvedSelectedSources[source.id]
                    }))
                  }
                >
                  <CardContent className="p-4 flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      {renderSourceIcon(source.icon)}
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                    </div>
                    <span className="text-sm font-medium">{t(source.labelKey)}</span>
                    <span className="text-[10px] text-zinc-500">{t(source.descriptionKey)}</span>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="mt-4 flex flex-col gap-2 flex-1">
            <div className="flex justify-between items-center">
              <div 
                className="flex items-center gap-2 cursor-pointer group"
                onClick={() => setIsPreviewExpanded(!isPreviewExpanded)}
              >
                <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider cursor-pointer group-hover:text-zinc-300 transition-colors">
                  {t('match.agent_prompt_preview')}
                </label>
                {isPreviewExpanded ? (
                  <ChevronUp className="w-3 h-3 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
                ) : (
                  <ChevronDown className="w-3 h-3 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
                )}
              </div>
              
              {isPreviewExpanded && (
                <button 
                  onClick={() => setShowJson(!showJson)}
                  className="text-[10px] text-emerald-500 hover:text-emerald-400 flex items-center gap-1 font-mono uppercase tracking-wider bg-emerald-500/10 px-2 py-1 rounded transition-colors"
                >
                  {showJson ? <LayoutTemplate className="w-3 h-3" /> : <Code2 className="w-3 h-3" />}
                  {showJson ? t('match.form_view') : t('match.json_view')}
                </button>
              )}
            </div>
            
            <AnimatePresence>
              {isPreviewExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col gap-2 overflow-hidden"
                >
                  {showJson ? (
                    <textarea 
                      className="w-full min-h-[200px] bg-zinc-950 border border-white/10 rounded-xl p-4 text-xs font-mono text-zinc-300 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                      value={editableData}
                      onChange={(e) => setEditableData(e.target.value)}
                    />
                  ) : (
                    <div className="w-full min-h-[200px] bg-zinc-950/50 border border-white/10 rounded-xl p-4 overflow-y-auto max-h-[400px]">
                      {renderHumanReadableForm()}
                    </div>
                  )}
                  <p className="text-[10px] text-zinc-500">
                    {showJson ? t('match.edit_json_hint') : t('match.edit_form_hint')}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-3 mt-4 px-1">
            <div 
              className={`w-9 h-5 rounded-full flex items-center transition-colors p-1 cursor-pointer ${includeAnimations ? 'bg-emerald-500' : 'bg-zinc-700'}`}
              onClick={() => setIncludeAnimations(!includeAnimations)}
            >
              <motion.div 
                className="bg-white w-3 h-3 rounded-full shadow-sm"
                animate={{ x: includeAnimations ? 16 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            </div>
            <label 
              className="text-xs text-zinc-400 select-none cursor-pointer flex items-center gap-2"
              onClick={() => setIncludeAnimations(!includeAnimations)}
            >
              <Video className="w-3 h-3" /> {t('match.generate_animation')}
            </label>
          </div>

          <div className="flex flex-col gap-2 mt-4">
            {savedResumeState && (
              <Button 
                className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => startAnalysis(true)}
              >
                <Activity className="w-4 h-4" /> {t('match.continue_unfinished')}
              </Button>
            )}
            <Button 
              className="w-full gap-2"
              variant={savedResumeState ? "outline" : "default"}
              onClick={() => startAnalysis(false)}
            >
              <BrainCircuit className="w-4 h-4" /> {savedResumeState ? t('match.restart_analysis') : t('match.start_analysis')}
            </Button>
          </div>
        </motion.div>
      )}

      {(step === 'analyzing' || step === 'result') && (
        <main id="analysis-content" className="flex-1 flex flex-col gap-4 p-4 max-w-md mx-auto w-full">
          
          {isAnalyzing && !parsedStream?.segments?.length && (
            <div className="flex items-center justify-center p-8 text-emerald-500 animate-pulse font-mono text-xs">
              <Activity className="w-4 h-4 mr-2" /> {t('match.init_engine')}
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
                      {t('match.analysis_phase')} {i + 1}
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
                        <Video className="w-4 h-4" /> {seg.animation.title || t('match.data_visualization')}
                      </div>
                      <div className="text-zinc-300 text-xs italic bg-zinc-900/50 p-3 rounded-lg border-l-2 border-blue-500">
                        "{seg.animation.narration}"
                      </div>
                      
                      <div className="mt-2 w-full max-w-[300px] mx-auto">
                        <RemotionPlayer animation={seg.animation} />
                      </div>
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
                    {t('match.final_summary')}
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
                          <span className="truncate max-w-[80px]">{t('match.draw')}</span>
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
                <CardTitle className="text-red-400 text-sm">{t('match.parsing_failed')}</CardTitle>
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
              <h3 className="text-lg font-bold mb-4 text-center text-white">{t('match.share_config')}</h3>
              <div className="bg-white p-4 rounded-xl flex items-center justify-center mb-4">
                <QRCodeSVG value={shareUrl} size={180} />
              </div>
              <p className="text-xs text-zinc-400 text-center mb-6 font-mono">
                {t('match.scan_to_import')}
              </p>
              <Button className="w-full" onClick={() => setShowShare(false)}>
                {t('match.close')}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
