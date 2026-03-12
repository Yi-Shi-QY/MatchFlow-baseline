import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MOCK_MATCHES, type Match } from '@/src/data/matches';
import { Card, CardContent } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { ArrowLeft, BrainCircuit } from 'lucide-react';
import { motion } from 'motion/react';
import { saveSubject } from '@/src/services/savedSubjects';
import { decompressFromEncodedURIComponent } from 'lz-string';
import { getActiveAnalysisDomain } from '@/src/services/domains/registry';
import { buildSubjectRoute } from '@/src/services/navigation/subjectRoute';
import type { EditableSubjectDataFormModel } from '@/src/pages/matchDetail/contracts';

function resolveTeamLogo(input: string | undefined, fallback: string): string {
  return typeof input === 'string' && input.trim().length > 0 ? input : fallback;
}

function normalizeMatchStatus(input: unknown): Match['status'] {
  if (input === 'upcoming' || input === 'live' || input === 'finished') {
    return input;
  }
  return 'upcoming';
}

function buildSharedSubjectPreview(data: EditableSubjectDataFormModel): Match {
  const fallbackMatch =
    typeof data.id === 'string' && data.id.trim().length > 0
      ? MOCK_MATCHES.find((item) => item.id === data.id.trim())
      : undefined;
  const subjectId =
    typeof data.id === 'string' && data.id.trim().length > 0 ? data.id.trim() : 'custom';

  return {
    ...(fallbackMatch || {}),
    id: subjectId,
    league:
      typeof data.league === 'string' && data.league.trim().length > 0
        ? data.league
        : fallbackMatch?.league || 'Unknown League',
    date:
      typeof data.date === 'string' && data.date.trim().length > 0
        ? data.date
        : fallbackMatch?.date || new Date().toISOString(),
    status:
      typeof data.status === 'string' && data.status.trim().length > 0
        ? normalizeMatchStatus(data.status)
        : normalizeMatchStatus(fallbackMatch?.status),
    homeTeam: {
      ...(fallbackMatch?.homeTeam || {}),
      ...(data.homeTeam || {}),
      id:
        typeof data.homeTeam?.id === 'string' && data.homeTeam.id.trim().length > 0
          ? data.homeTeam.id
          : fallbackMatch?.homeTeam?.id || `${subjectId}_home`,
      name:
        typeof data.homeTeam?.name === 'string' && data.homeTeam.name.trim().length > 0
          ? data.homeTeam.name
          : fallbackMatch?.homeTeam?.name || 'Home',
      logo: resolveTeamLogo(
        typeof data.homeTeam?.logo === 'string' ? data.homeTeam.logo : fallbackMatch?.homeTeam?.logo,
        'https://picsum.photos/seed/share-home/200/200',
      ),
      form:
        Array.isArray(data.homeTeam?.form) && data.homeTeam.form.length > 0
          ? data.homeTeam.form
          : fallbackMatch?.homeTeam?.form || ['?', '?', '?', '?', '?'],
    },
    awayTeam: {
      ...(fallbackMatch?.awayTeam || {}),
      ...(data.awayTeam || {}),
      id:
        typeof data.awayTeam?.id === 'string' && data.awayTeam.id.trim().length > 0
          ? data.awayTeam.id
          : fallbackMatch?.awayTeam?.id || `${subjectId}_away`,
      name:
        typeof data.awayTeam?.name === 'string' && data.awayTeam.name.trim().length > 0
          ? data.awayTeam.name
          : fallbackMatch?.awayTeam?.name || 'Away',
      logo: resolveTeamLogo(
        typeof data.awayTeam?.logo === 'string' ? data.awayTeam.logo : fallbackMatch?.awayTeam?.logo,
        'https://picsum.photos/seed/share-away/200/200',
      ),
      form:
        Array.isArray(data.awayTeam?.form) && data.awayTeam.form.length > 0
          ? data.awayTeam.form
          : fallbackMatch?.awayTeam?.form || ['?', '?', '?', '?', '?'],
    },
    stats:
      (data.stats as Match['stats'] | undefined) ||
      fallbackMatch?.stats || {
        possession: { home: 50, away: 50 },
        shots: { home: 0, away: 0 },
        shotsOnTarget: { home: 0, away: 0 },
      },
  };
}

export default function Share() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [importedData, setImportedData] = useState<EditableSubjectDataFormModel | null>(null);
  const [match, setMatch] = useState<Match | null>(null);

  useEffect(() => {
    const compressedPayload = searchParams.get('d');
    if (!compressedPayload) {
      setImportedData(null);
      setMatch(null);
      return;
    }

    try {
      const decodedStr = decompressFromEncodedURIComponent(compressedPayload) || '';
      if (!decodedStr) {
        setImportedData(null);
        setMatch(null);
        return;
      }

      const decoded = JSON.parse(decodedStr) as {
        v?: unknown;
        d?: EditableSubjectDataFormModel;
      };

      if (decoded.v !== 3 || !decoded.d || typeof decoded.d !== 'object') {
        setImportedData(null);
        setMatch(null);
        return;
      }

      setImportedData(decoded.d);
      setMatch(buildSharedSubjectPreview(decoded.d));
    } catch (error) {
      console.error('Failed to decode share data', error);
      setImportedData(null);
      setMatch(null);
    }
  }, [searchParams]);

  const handleImport = async () => {
    if (!importedData || !match) {
      return;
    }

    const activeDomainId = getActiveAnalysisDomain().id;
    const subjectId =
      typeof match.id === 'string' && match.id.trim().length > 0 && match.id !== 'custom'
        ? match.id
        : `custom_${Date.now()}`;
    const normalizedMatch: Match = {
      ...match,
      id: subjectId,
      homeTeam: {
        ...match.homeTeam,
        id:
          typeof match.homeTeam?.id === 'string' && match.homeTeam.id.trim().length > 0
            ? match.homeTeam.id
            : `${subjectId}_home`,
      },
      awayTeam: {
        ...match.awayTeam,
        id:
          typeof match.awayTeam?.id === 'string' && match.awayTeam.id.trim().length > 0
            ? match.awayTeam.id
            : `${subjectId}_away`,
      },
    };
    const normalizedImportedData: EditableSubjectDataFormModel = {
      ...importedData,
      id: subjectId,
      league: normalizedMatch.league,
      date: normalizedMatch.date,
      status: normalizedMatch.status,
      homeTeam: normalizedMatch.homeTeam,
      awayTeam: normalizedMatch.awayTeam,
      stats: normalizedMatch.stats,
      customInfo: importedData.customInfo,
    };

    await saveSubject(normalizedMatch, {
      domainId: activeDomainId,
      subjectId,
      subjectType: 'match',
      subjectSnapshot: normalizedMatch,
    });
    navigate(buildSubjectRoute(activeDomainId, subjectId), {
      state: { importedData: normalizedImportedData },
    });
  };

  if (!importedData || !match) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <Card className="max-w-xs w-full text-center p-6 border-red-500/20 bg-red-500/5">
          <h2 className="text-lg font-bold text-red-400 mb-4">{t('share.invalid_link')}</h2>
          <Button onClick={() => navigate('/')} size="sm">{t('share.return_home')}</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans flex flex-col items-center justify-center p-4 pb-[calc(5rem+env(safe-area-inset-bottom))]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <Card className="border-emerald-500/20 bg-zinc-950 shadow-2xl overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-blue-500" />

          <CardContent className="p-6 pt-10 flex flex-col items-center">
            <div className="flex items-center gap-6 mb-8 w-full justify-center">
              <div className="flex flex-col items-center gap-2">
                <img src={match.homeTeam.logo} alt={match.homeTeam.name} className="w-12 h-12 object-contain drop-shadow-lg rounded-full bg-white/5 p-1" />
                <span className="font-bold text-xs truncate max-w-[80px] text-center">{match.homeTeam.name}</span>
              </div>
              <div className="text-xl font-bold font-mono text-zinc-600">VS</div>
              <div className="flex flex-col items-center gap-2">
                <img src={match.awayTeam.logo} alt={match.awayTeam.name} className="w-12 h-12 object-contain drop-shadow-lg rounded-full bg-white/5 p-1" />
                <span className="font-bold text-xs truncate max-w-[80px] text-center">{match.awayTeam.name}</span>
              </div>
            </div>

            <div className="w-full bg-zinc-900/50 p-4 rounded-xl border border-white/5 text-center">
              <p className="text-sm text-zinc-300 mb-2">
                {t('share.received_config')}
              </p>
              <p className="text-xs text-zinc-500">
                {t('share.config_desc')}
              </p>
            </div>

            <div className="w-full mt-6 flex flex-col gap-2">
              <Button
                className="w-full gap-2 bg-emerald-600 hover:bg-emerald-500 text-white"
                onClick={handleImport}
                size="sm"
              >
                <BrainCircuit className="w-4 h-4" />
                {t('share.import_analyze')}
              </Button>

              <Button
                variant="outline"
                className="w-full gap-2 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                onClick={() => navigate('/')}
                size="sm"
              >
                <ArrowLeft className="w-4 h-4" /> {t('share.return_home')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
