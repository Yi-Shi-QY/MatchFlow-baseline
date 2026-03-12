import { Capacitor } from '@capacitor/core';
import type { AgentSegment } from '@/src/services/agentParser';
import type { MatchAnalysis } from '@/src/services/ai';
import {
  formatConclusionCardValue,
  getAnalysisConclusionCards,
} from '@/src/services/analysisSummary';
import type {
  DomainResultPresenter,
  ResultPresenterContext,
} from '@/src/services/domains/ui/presenter';
import type { SubjectDisplayMatch } from '@/src/services/subjectDisplayMatch';

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

export interface ExportSubjectReportPdfInput {
  subjectDisplay: SubjectDisplayMatch;
  selectedSegments: AgentSegment[];
  includeSummaryInExport: boolean;
  summary: MatchAnalysis | null;
  draftData: any | null;
  resultPresenter: DomainResultPresenter;
  resultPresenterContext: ResultPresenterContext;
  presenterSubjectSnapshot: unknown;
  language: string;
  t: TranslateFn;
}

function normalizeTextForPdf(input: string): string {
  return input
    .replace(/<[^>]+>/g, ' ')
    .replace(/[*_`>#-]/g, ' ')
    .replace(/\|/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function safeFilePart(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, '_').trim() || 'subject';
}

export async function exportSubjectReportPdf(
  input: ExportSubjectReportPdfInput,
): Promise<void> {
  const {
    subjectDisplay,
    selectedSegments,
    includeSummaryInExport,
    summary,
    draftData,
    resultPresenter,
    resultPresenterContext,
    presenterSubjectSnapshot,
    language,
    t,
  } = input;

  const [{ jsPDF }, { ensurePdfCjkFont, PDF_CJK_FONT_FAMILY }] = await Promise.all([
    import('jspdf'),
    import('@/src/services/pdfFont'),
  ]);

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
    options: { fontSize?: number; bold?: boolean; spacingAfter?: number } = {},
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

  const exportMeta = resultPresenter.getExportMeta(
    subjectDisplay,
    draftData,
    resultPresenterContext,
    presenterSubjectSnapshot,
  );
  const exportHeader = resultPresenter.getHeader(
    subjectDisplay,
    draftData,
    resultPresenterContext,
    presenterSubjectSnapshot,
  );
  const primaryName = exportMeta.primaryEntityName;
  const secondaryName =
    typeof exportMeta.secondaryEntityName === 'string' &&
    exportMeta.secondaryEntityName.trim().length > 0
      ? exportMeta.secondaryEntityName.trim()
      : primaryName;
  const locale = language.startsWith('zh') ? 'zh-CN' : 'en-US';
  const timestamp = new Date().toLocaleString(locale);

  writeParagraph(exportMeta.reportTitle, { fontSize: 16, bold: true, spacingAfter: 2 });
  writeParagraph(
    `${exportHeader.subtitle || subjectDisplay.league} | ${subjectDisplay.date} | ${exportMeta.statusLabel}`,
    {
      fontSize: 10,
    },
  );
  writeParagraph(t('match.generated_by', { time: timestamp }), { fontSize: 9, spacingAfter: 3 });

  selectedSegments.forEach((segment, index) => {
    ensureSpace(10);
    writeParagraph(
      `${index + 1}. ${segment.title || t('match.export_segment_fallback', { index: index + 1 })}`,
      {
        fontSize: 13,
        bold: true,
        spacingAfter: 1.5,
      },
    );

    const cleanedThoughts = normalizeTextForPdf(segment.thoughts || '');
    if (cleanedThoughts) {
      writeParagraph(cleanedThoughts, { fontSize: 10.5, spacingAfter: 1.5 });
    }

    if (segment.tags && segment.tags.length > 0) {
      writeParagraph(`${t('match.pdf_tags')}: ${segment.tags.map((tag) => tag.label).join(', ')}`, {
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
      writeParagraph(`${t('match.pdf_prediction')}: ${normalizeTextForPdf(summary.prediction)}`, {
        fontSize: 10.5,
      });
    }

    const isZh = language.startsWith('zh');
    const summaryDistribution = resultPresenter.getSummaryDistribution(
      summary,
      subjectDisplay,
      draftData,
      resultPresenterContext,
      presenterSubjectSnapshot,
    );
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
      writeParagraph(isZh ? '结论卡片' : 'Conclusion Cards', {
        fontSize: 10,
        bold: true,
        spacingAfter: 1,
      });
      summaryCards.forEach((card) => {
        const details: string[] = [];
        if (typeof card.confidence === 'number') {
          details.push(`${isZh ? '置信度' : 'Confidence'} ${card.confidence}%`);
        }
        if (card.trend) {
          details.push(`${isZh ? '趋势' : 'Trend'} ${card.trend}`);
        }
        if (card.note) {
          details.push(card.note);
        }
        const detailSuffix = details.length > 0 ? ` (${details.join(' | ')})` : '';
        writeParagraph(`- ${card.label}: ${formatConclusionCardValue(card)}${detailSuffix}`, {
          fontSize: 10,
        });
      });
    }

    if (summary.expectedGoals) {
      writeParagraph(
        t('match.pdf_expected_goals', {
          home: summary.expectedGoals.home,
          away: summary.expectedGoals.away,
        }),
        { fontSize: 10 },
      );
    }
    if (Array.isArray(summary.keyFactors) && summary.keyFactors.length > 0) {
      writeParagraph(`${t('match.pdf_key_factors')}: ${summary.keyFactors.join(' / ')}`, {
        fontSize: 10,
      });
    }
  }

  // Disclaimer page is always included by policy.
  pdf.addPage();
  cursorY = 16;
  writeParagraph(t('match.disclaimer_title'), { fontSize: 14, bold: true, spacingAfter: 3 });
  [1, 2, 3, 4, 5].forEach((index) => {
    writeParagraph(t(`match.disclaimer_${index}`), { fontSize: 10 });
  });

  const fileName = t('match.export_file_name', {
    home: safeFilePart(primaryName),
    away: safeFilePart(secondaryName),
  }).replace(/[\\/:*?"<>|]/g, '_');

  if (Capacitor.isNativePlatform()) {
    const [{ Filesystem, Directory }, { Share: NativeShare }] = await Promise.all([
      import('@capacitor/filesystem'),
      import('@capacitor/share'),
    ]);
    const pdfBase64 = pdf.output('datauristring').split(',')[1];
    const fileResult = await Filesystem.writeFile({
      path: fileName,
      data: pdfBase64,
      directory: Directory.Cache,
    });

    await NativeShare.share({
      title: t('match.share_report'),
      text: t('match.share_text', { home: primaryName, away: secondaryName }),
      url: fileResult.uri,
      dialogTitle: t('match.share_report'),
    });
    return;
  }

  pdf.save(fileName);
}
