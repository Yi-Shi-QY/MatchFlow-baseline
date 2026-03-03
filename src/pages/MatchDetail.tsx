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
import { jsPDF } from 'jspdf';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { ensurePdfCjkFont, PDF_CJK_FONT_FAMILY } from '@/src/services/pdfFont';
import {
  fetchMatchAnalysisConfig,
  mergeServerPlanningIntoMatchData,
  resolveAnalysisConfig,
} from '@/src/services/analysisConfig';
import {
  FormFieldSchema,
  SourceIconKey,
  SourceSelection
} from '@/src/services/dataSources';
import { getActiveAnalysisDomain } from '@/src/services/domains/registry';
import {
  formatConclusionCardValue,
  getAnalysisConclusionCards,
  getAnalysisOutcomeDistribution,
} from '@/src/services/analysisSummary';
import { findBuiltinDomainLocalTestCaseById } from '@/src/services/domains/builtinModules';

interface ExportSegmentOption {
  includeSegment: boolean;
}

export default function MatchDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const importedData = location.state?.importedData;
  const {
    activeAnalyses,
    startAnalysis: contextStartAnalysis,
    stopAnalysis: contextStopAnalysis,
    setCollapsedSegments: contextSetCollapsedSegments
  } = useAnalysis();
  
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
  const [resumeMatch, setResumeMatch] = useState<Match | undefined>(undefined);
  const [isLoadingRecordContext, setIsLoadingRecordContext] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setIsLoadingRecordContext(true);
      try {
        const history = await getHistory();
        const record = history.find(h => h.matchId === id);
        setHistoryRecord(record);

        if (!record) {
          const savedMatches = await getSavedMatches();
          const saved = savedMatches.find(s => s.id === id);
          setSavedMatchRecord(saved);
        } else {
          setSavedMatchRecord(undefined);
        }

        if (id) {
          const resumeState = await getResumeState(id);
          const snapshot = resumeState?.state?.matchSnapshot;
          if (snapshot && typeof snapshot === 'object') {
            setResumeMatch(snapshot as Match);
          } else {
            setResumeMatch(undefined);
          }
        } else {
          setResumeMatch(undefined);
        }
      } finally {
        setIsLoadingRecordContext(false);
      }
    };
    loadData();
  }, [id]);

  const routeActiveAnalysis = id ? activeAnalyses[id] : null;
  const routeBuiltinCase = React.useMemo(() => {
    if (!id || id === 'custom') return null;
    return findBuiltinDomainLocalTestCaseById(id);
  }, [id]);
  const match =
    (importedData ? customMatch : null) ||
    (isCustom
      ? customMatch
      : (routeActiveAnalysis?.match ||
        historyRecord?.match ||
        savedMatchRecord?.match ||
        resumeMatch ||
        routeBuiltinCase ||
        MOCK_MATCHES.find(m => m.id === id)));

  const activeAnalysis = routeActiveAnalysis || (match ? activeAnalyses[match.id] : null);

  // Local state for UI
  const [step, setStep] = useState<'selection' | 'analyzing' | 'result'>('selection');
  const [includeAnimations, setIncludeAnimations] = useState(true);
  const [selectedSources, setSelectedSources] = useState<Partial<SourceSelection>>({});
  const activeDomain = getActiveAnalysisDomain();
  const domainSourceCatalog = activeDomain.dataSources;

  const [editableData, setEditableData] = useState("");
  const [showJson, setShowJson] = useState(false);
  const [savedResumeState, setSavedResumeState] = useState<any | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(true);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportSegments, setExportSegments] = useState<Record<string, ExportSegmentOption>>({});
  const [includeSummaryInExport, setIncludeSummaryInExport] = useState(true);

  useEffect(() => {
    setSelectedSources({});
  }, [match?.id]);

  const resolvedSelectedSources = React.useMemo<SourceSelection>(() => {
    if (!match) {
      const emptySelection: SourceSelection = {};
      domainSourceCatalog.forEach((source) => {
        emptySelection[source.id] = false;
      });
      return emptySelection;
    }
    return activeDomain.resolveSourceSelection(match as Match, importedData, selectedSources);
  }, [match, importedData, selectedSources, activeDomain, domainSourceCatalog]);

  const availableSources = React.useMemo(() => {
    if (!match) return domainSourceCatalog;
    const ctx = { match: match as Match, importedData };
    return activeDomain.getAvailableDataSources(ctx);
  }, [match, importedData, activeDomain, domainSourceCatalog]);

  const renderSourceIcon = (icon: SourceIconKey) => {
    if (icon === 'layout') return <LayoutTemplate className="w-5 h-5 text-zinc-400" />;
    if (icon === 'trending') return <TrendingUp className="w-5 h-5 text-zinc-400" />;
    return <FileText className="w-5 h-5 text-zinc-400" />;
  };

  const normalizeTextForPdf = (input: string) => {
    return input
      .replace(/<[^>]+>/g, ' ')
      .replace(/[*_`>#-]/g, ' ')
      .replace(/\|/g, ' ')
      .replace(/\s+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
  };

  const openExportModal = (stream: AgentResult | null, hasSummary: boolean) => {
    const segments = stream?.segments || [];
    const defaults = segments.reduce((acc, seg) => {
      acc[seg.id] = {
        includeSegment: true,
      };
      return acc;
    }, {} as Record<string, ExportSegmentOption>);

    setExportSegments(defaults);
    setIncludeSummaryInExport(hasSummary);
    setShowExportModal(true);
  };

  const handleExportPDF = async (stream: AgentResult | null, summary: MatchAnalysis | null) => {
    if (!match || isExporting) return;

    const selectedSegments = (stream?.segments || []).filter(
      seg => exportSegments[seg.id]?.includeSegment
    );

    if (selectedSegments.length === 0 && !includeSummaryInExport) {
      alert(t('match.export_validation'));
      return;
    }

    setIsExporting(true);
    setShowExportModal(false);

    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const canUseCjkFont = await ensurePdfCjkFont(pdf);
      const pdfFontFamily = canUseCjkFont ? PDF_CJK_FONT_FAMILY : 'helvetica';
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 12;
      const maxTextWidth = pageWidth - margin * 2;
      const lineHeight = 5;
      let cursorY = 14;

      const ensureSpace = (requiredHeight: number) => {
        if (cursorY + requiredHeight > pageHeight - 12) {
          pdf.addPage();
          cursorY = 14;
        }
      };

      const writeParagraph = (
        text: string,
        options: { fontSize?: number; bold?: boolean; spacingAfter?: number } = {}
      ) => {
        const content = text.trim();
        if (!content) return;
        const fontSize = options.fontSize ?? 11;
        const spacingAfter = options.spacingAfter ?? 1.5;
        pdf.setFont(pdfFontFamily, options.bold ? 'bold' : 'normal');
        pdf.setFontSize(fontSize);
        const lines = pdf.splitTextToSize(content, maxTextWidth);
        ensureSpace(lines.length * lineHeight + spacingAfter + 1);
        pdf.text(lines, margin, cursorY);
        cursorY += lines.length * lineHeight + spacingAfter;
      };

      const locale = i18n.language.startsWith('zh') ? 'zh-CN' : 'en-US';
      const timestamp = new Date().toLocaleString(locale);
      const homeName = match.homeTeam.name;
      const awayName = match.awayTeam.name;
      const title = `${homeName} vs ${awayName}`;
      const statusLabel =
        match.status === 'live'
          ? t('home.live')
          : match.status === 'finished'
            ? t('home.finished')
            : match.status === 'upcoming'
              ? t('home.upcoming')
              : match.status;

      writeParagraph(title, { fontSize: 16, bold: true, spacingAfter: 2 });
      writeParagraph(`${match.league} | ${match.date} | ${statusLabel}`, { fontSize: 10 });
      writeParagraph(t('match.generated_by', { time: timestamp }), { fontSize: 9, spacingAfter: 3 });

      selectedSegments.forEach((seg, index) => {
        ensureSpace(10);
        writeParagraph(`${index + 1}. ${seg.title || t('match.export_segment_fallback', { index: index + 1 })}`, {
          fontSize: 13,
          bold: true,
          spacingAfter: 1.5,
        });

        const cleanedThoughts = normalizeTextForPdf(seg.thoughts || '');
        if (cleanedThoughts) {
          writeParagraph(cleanedThoughts, { fontSize: 10.5, spacingAfter: 1.5 });
        }

        if (seg.tags && seg.tags.length > 0) {
          writeParagraph(`${t('match.pdf_tags')}: ${seg.tags.map(tag => tag.label).join(', ')}`, {
            fontSize: 9.5,
            spacingAfter: 1.5,
          });
        }

        cursorY += 1;
      });

      if (includeSummaryInExport && summary) {
        ensureSpace(14);
        writeParagraph(t('match.final_summary'), { fontSize: 13, bold: true, spacingAfter: 1.5 });
        if (summary.prediction) {
          writeParagraph(`${t('match.pdf_prediction')}: ${normalizeTextForPdf(summary.prediction)}`, { fontSize: 10.5 });
        }
        const isZh = i18n.language.startsWith('zh');
        const summaryDistribution = getAnalysisOutcomeDistribution(summary, {
          homeLabel: homeName,
          drawLabel: t('match.draw'),
          awayLabel: awayName,
        });
        if (summaryDistribution.length > 0) {
          writeParagraph(
            `${isZh ? '结果分布' : 'Outcome Distribution'}: ${summaryDistribution
              .map((entry) => `${entry.label} ${entry.value}%`)
              .join(' / ')}`,
            { fontSize: 10 },
          );
        }
        const summaryCards = getAnalysisConclusionCards(summary);
        if (summaryCards.length > 0) {
          writeParagraph(isZh ? '结论卡片' : 'Conclusion Cards', { fontSize: 10, bold: true, spacingAfter: 1 });
          summaryCards.forEach((card) => {
            const details: string[] = [];
            if (typeof card.confidence === 'number') details.push(`${isZh ? '置信度' : 'Confidence'} ${card.confidence}%`);
            if (card.trend) details.push(`${isZh ? '趋势' : 'Trend'} ${card.trend}`);
            if (card.note) details.push(card.note);
            const detailSuffix = details.length > 0 ? ` (${details.join(' | ')})` : '';
            writeParagraph(`- ${card.label}: ${formatConclusionCardValue(card)}${detailSuffix}`, { fontSize: 10 });
          });
        }
        if (summary.expectedGoals) {
          writeParagraph(t('match.pdf_expected_goals', {
            home: summary.expectedGoals.home,
            away: summary.expectedGoals.away,
          }), { fontSize: 10 });
        }
        if (Array.isArray(summary.keyFactors) && summary.keyFactors.length > 0) {
          writeParagraph(`${t('match.pdf_key_factors')}: ${summary.keyFactors.join(' / ')}`, { fontSize: 10 });
        }
      }

      // Disclaimer page is always included by policy.
      pdf.addPage();
      cursorY = 16;
      writeParagraph(t('match.disclaimer_title'), { fontSize: 14, bold: true, spacingAfter: 3 });
      [1, 2, 3, 4, 5].forEach((index) => {
        writeParagraph(t(`match.disclaimer_${index}`), { fontSize: 10 });
      });

      const safeFilePart = (value: string) =>
        value.replace(/[\\/:*?"<>|]/g, '_').trim() || 'match';
      const fileName = t('match.export_file_name', {
        home: safeFilePart(homeName),
        away: safeFilePart(awayName),
      }).replace(/[\\/:*?"<>|]/g, '_');

      if (Capacitor.isNativePlatform()) {
        const pdfBase64 = pdf.output('datauristring').split(',')[1];
        const fileResult = await Filesystem.writeFile({
          path: fileName,
          data: pdfBase64,
          directory: Directory.Cache
        });

        await Share.share({
          title: t('match.share_report'),
          text: t('match.share_text', { home: homeName, away: awayName }),
          url: fileResult.uri,
          dialogTitle: t('match.share_report')
        });
      } else {
        pdf.save(fileName);
      }
    } catch (error: any) {
      console.error('Failed to export PDF:', error);
      alert(`${t('match.export_failed')}: ${error?.message || t('match.export_unknown_error')}`);
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
      } else {
        setStep('selection');
      }
    }
  }, [activeAnalysis]);

  useEffect(() => {
    if (!match) return;

    const shouldLoadResume =
      !activeAnalysis || (!activeAnalysis.isAnalyzing && !activeAnalysis.analysis);

    if (historyRecord && !activeAnalysis) {
      setStep('result');
      setSavedResumeState(null);
    } else if (shouldLoadResume) {
      // Check for resume state if no completed history exists
      getResumeState(match.id).then(resumeState => {
        setSavedResumeState(resumeState || null);
      });
    } else {
      setSavedResumeState(null);
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

    domainSourceCatalog.forEach((source) => {
      if (resolvedSelectedSources[source.id]) {
        source.applyToData(newData, sourceContext);
      } else {
        source.removeFromData(newData);
      }
    });

    const capabilities = activeDomain.buildSourceCapabilities(
      newData,
      resolvedSelectedSources,
    );

    // Explicit source context helps deterministic planning routing in ai.ts.
    newData.sourceContext = {
      origin: m.source || (importedData ? 'imported' : 'local'),
      domainId: activeDomain.id,
      selectedSources: { ...resolvedSelectedSources },
      selectedSourceIds: domainSourceCatalog
        .filter(source => resolvedSelectedSources[source.id])
        .map(source => source.id),
      capabilities,
      matchStatus: (newData.status || m.status || 'unknown')
    };
    
    const newJson = JSON.stringify(newData, null, 2);
    if (newJson !== editableDataRef.current) {
      setEditableData(newJson);
    }
  }, [match, step, importedData, resolvedSelectedSources, activeDomain, domainSourceCatalog]);

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
            placeholder={placeholder ?? field.placeholder}
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
      alert(t('match.invalid_json_preview'));
      return;
    }

    try {
      let serverConfig = null;
      if (typeof match.id === 'string' && match.id.trim().length > 0 && !match.id.startsWith('custom_')) {
        serverConfig = await fetchMatchAnalysisConfig(match.id.trim());
      }

      if (!serverConfig) {
        serverConfig = await resolveAnalysisConfig(dataToAnalyze);
      }

      dataToAnalyze = mergeServerPlanningIntoMatchData(dataToAnalyze, serverConfig);
    } catch (error) {
      console.warn('Failed to load server planning config; continue with local source context.', error);
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

  if (!match) {
    if (isLoadingRecordContext) {
      return (
        <div className="min-h-screen bg-black text-zinc-100 flex items-center justify-center gap-2 text-sm">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
          <span>Loading analysis context...</span>
        </div>
      );
    }
    return <div className="p-8 text-white text-center">Match not found</div>;
  }

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

  let editablePreviewData: any = null;
  try {
    editablePreviewData = editableData ? JSON.parse(editableData) : null;
  } catch (e) {
    editablePreviewData = null;
  }

  const summaryHomeLabel = editablePreviewData?.homeTeam?.name || match.homeTeam.name;
  const summaryAwayLabel = editablePreviewData?.awayTeam?.name || match.awayTeam.name;
  const summaryDistribution = getAnalysisOutcomeDistribution(analysis, {
    homeLabel: summaryHomeLabel,
    drawLabel: t('match.draw'),
    awayLabel: summaryAwayLabel,
  });
  const summaryCards = getAnalysisConclusionCards(analysis);
  const summaryBarPalette = ['#10b981', '#71717a', '#3b82f6', '#f59e0b', '#ef4444'];
  const summaryIsZh = i18n.language.startsWith('zh');

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
          {isAnalyzing && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => contextStopAnalysis(match.id)}
              title={t('match.stop_analysis')}
              aria-label={t('match.stop_analysis')}
              className="h-8 w-8 rounded-full border-red-500/50 text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Pause className="w-4 h-4" />
            </Button>
          )}
          {step === 'result' && (
            <>
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => openExportModal(parsedStream, !!analysis)}
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

                    {summaryDistribution.length > 0 && (
                      <div className="w-full max-w-[320px] space-y-3">
                        {summaryDistribution.map((entry, index) => (
                          <div key={entry.id} className="space-y-1">
                            <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                              <span className="truncate max-w-[180px]">{entry.label}</span>
                              <span>{entry.value}%</span>
                            </div>
                            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${entry.value}%` }}
                                transition={{ duration: 0.9, delay: index * 0.08 }}
                                className="h-full"
                                style={{
                                  backgroundColor:
                                    entry.color || summaryBarPalette[index % summaryBarPalette.length],
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {summaryCards.length > 0 && (
                      <div className="mt-5 w-full grid grid-cols-2 gap-2">
                        {summaryCards.map((card, index) => (
                          <div
                            key={`${card.label}_${index}`}
                            className="rounded-lg border border-white/10 bg-black/40 p-2.5 space-y-1"
                          >
                            <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                              {card.label}
                            </div>
                            <div className="text-sm font-semibold text-zinc-100">
                              {formatConclusionCardValue(card)}
                            </div>
                            {(typeof card.confidence === 'number' || card.trend) && (
                              <div className="text-[10px] text-zinc-400">
                                {typeof card.confidence === 'number'
                                  ? `${summaryIsZh ? '置信度' : 'Confidence'} ${card.confidence}%`
                                  : ''}
                                {typeof card.confidence === 'number' && card.trend ? ' | ' : ''}
                                {card.trend ? `${summaryIsZh ? '趋势' : 'Trend'} ${card.trend}` : ''}
                              </div>
                            )}
                            {card.note && (
                              <div className="text-[10px] text-zinc-500 line-clamp-2">{card.note}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {analysis.prediction && (
                      <div className="mt-6 p-4 rounded-xl bg-black/50 border border-white/5 w-full">
                        <p className="text-xs text-zinc-300 leading-relaxed italic text-center">
                          "{analysis.prediction}"
                        </p>
                      </div>
                    )}

                    {Array.isArray(analysis.keyFactors) && analysis.keyFactors.length > 0 && (
                      <div className="mt-4 w-full flex flex-wrap items-center justify-center gap-1.5">
                        {analysis.keyFactors.slice(0, 6).map((factor, index) => (
                          <span
                            key={`${factor}_${index}`}
                            className="text-[10px] px-2 py-1 rounded-full bg-zinc-800 text-zinc-300 border border-white/10"
                          >
                            {factor}
                          </span>
                        ))}
                      </div>
                    )}
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

      {/* Export Modal */}
      <AnimatePresence>
        {showExportModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setShowExportModal(false)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 14 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 14 }}
              className="bg-zinc-900 border border-white/10 rounded-2xl p-5 max-w-md w-full shadow-2xl max-h-[80vh] overflow-hidden flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-base font-bold text-white mb-1">{t('match.export_modal_title')}</h3>
              <p className="text-[11px] text-zinc-500 mb-4">
                {t('match.export_modal_desc')}
              </p>

              <div className="flex-1 overflow-y-auto pr-1 space-y-3">
                {(parsedStream?.segments || []).map((seg, index) => {
                  const selected = exportSegments[seg.id];
                  return (
                    <div key={seg.id} className="border border-white/10 rounded-xl p-3 bg-black/30">
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!selected?.includeSegment}
                          onChange={(e) =>
                            setExportSegments(prev => ({
                              ...prev,
                              [seg.id]: {
                                includeSegment: e.target.checked,
                              },
                            }))
                          }
                          className="mt-0.5"
                        />
                        <div className="min-w-0">
                          <div className="text-xs text-zinc-300 font-medium line-clamp-1">
                            {index + 1}. {seg.title || t('match.export_segment_fallback', { index: index + 1 })}
                          </div>
                          <div className="text-[10px] text-zinc-500 mt-0.5 line-clamp-2">
                            {(seg.thoughts || '').replace(/\s+/g, ' ').slice(0, 90) || t('match.export_segment_empty')}
                          </div>
                        </div>
                      </label>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 space-y-2 border-t border-white/10 pt-3">
                <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeSummaryInExport}
                    onChange={(e) => setIncludeSummaryInExport(e.target.checked)}
                  />
                  {t('match.export_include_summary')}
                </label>
                <div className="text-[11px] text-zinc-500">
                  {t('match.export_disclaimer_forced')}
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <Button
                  variant="outline"
                  className="flex-1 border-zinc-700 bg-zinc-800 hover:bg-zinc-700"
                  onClick={() => setShowExportModal(false)}
                  disabled={isExporting}
                >
                  {t('home.cancel')}
                </Button>
                <Button
                  className="flex-1 gap-2"
                  onClick={() => handleExportPDF(parsedStream, analysis)}
                  disabled={isExporting}
                >
                  {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  {t('match.export_share')}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
