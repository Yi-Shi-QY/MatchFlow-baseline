import { listTodayLocalMatches } from '@/src/services/syncedMatches';
import type { ManagerLanguage } from '@/src/services/manager/types';

export function isTodayMatchesQuery(input: string): boolean {
  return /(today('?s)? matches|matches today|what matches.*today|今天.*(比赛|赛程)|今日.*(比赛|赛程)|今天有哪些比赛)/i.test(
    input,
  );
}

export function isAnalysisFactorsQuestion(input: string): boolean {
  return /(what factors|which factors|consider.*factors|分析.*(因素|维度)|要考虑哪些因素|关注哪些因素)/i.test(
    input,
  );
}

export function isAnalysisSequenceQuestion(input: string): boolean {
  return /(analysis order|what order|sequence|步骤顺序|分析顺序|先看什么|怎么排序)/i.test(
    input,
  );
}

export function looksLikeTaskCommand(input: string): boolean {
  return /(analy[sz]e|run analysis|schedule|automate|create task|创建分析|分析|安排分析|定时|自动分析|每天.*分析)/i.test(
    input,
  );
}

function resolveMatchStatusLabel(status: string, language: ManagerLanguage): string {
  if (language === 'zh') {
    if (status === 'live') return '进行中';
    if (status === 'finished') return '已结束';
    return '未开赛';
  }

  if (status === 'live') return 'live';
  if (status === 'finished') return 'finished';
  return 'upcoming';
}

export async function answerTodayMatchesQuery(
  domainId: string,
  language: ManagerLanguage,
): Promise<string> {
  const matches = await listTodayLocalMatches(domainId);
  if (matches.length === 0) {
    return language === 'zh'
      ? '我刚按本地同步库查询过了，今天还没有可用比赛记录。'
      : 'I queried the local synced database and there are no match records for today yet.';
  }

  const lines = matches.slice(0, 12).map((match, index) => {
    const kickOff = new Date(match.date).toLocaleTimeString(
      language === 'zh' ? 'zh-CN' : 'en-US',
      {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
      },
    );

    return `${index + 1}. ${kickOff} | ${match.league} | ${match.homeTeam.name} vs ${match.awayTeam.name} | ${resolveMatchStatusLabel(match.status, language)}`;
  });

  if (language === 'zh') {
    return `我刚按本地同步库查了今天的比赛，共找到 ${matches.length} 场：\n${lines.join('\n')}`;
  }

  return `I queried the local synced database and found ${matches.length} match(es) today:\n${lines.join('\n')}`;
}
