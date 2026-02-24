import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { MOCK_MATCHES } from '@/src/data/matches';
import { Card, CardContent } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { ArrowLeft, Activity } from 'lucide-react';
import { motion } from 'motion/react';

export default function Share() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [match, setMatch] = useState<any>(null);

  useEffect(() => {
    const d = searchParams.get('d');
    if (d) {
      try {
        const decoded = JSON.parse(atob(d));
        setData(decoded);
        const m = MOCK_MATCHES.find(x => x.id === decoded.m);
        setMatch(m);
      } catch (e) {
        console.error("Failed to decode share data", e);
      }
    }
  }, [searchParams]);

  if (!data || !match) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <Card className="max-w-xs w-full text-center p-6 border-red-500/20 bg-red-500/5">
          <h2 className="text-lg font-bold text-red-400 mb-4">无效链接</h2>
          <Button onClick={() => navigate('/')} size="sm">返回首页</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans flex flex-col items-center justify-center p-4 pb-20">
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
                <img src={match.homeTeam.logo} alt={match.homeTeam.name} className="w-12 h-12 object-contain drop-shadow-lg" />
                <span className="font-bold text-xs truncate max-w-[80px] text-center">{match.homeTeam.name}</span>
              </div>
              <div className="text-xl font-bold font-mono text-zinc-600">VS</div>
              <div className="flex flex-col items-center gap-2">
                <img src={match.awayTeam.logo} alt={match.awayTeam.name} className="w-12 h-12 object-contain drop-shadow-lg" />
                <span className="font-bold text-xs truncate max-w-[80px] text-center">{match.awayTeam.name}</span>
              </div>
            </div>

            <div className="w-full space-y-4 bg-black/50 p-4 rounded-xl border border-white/5">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono text-zinc-400">
                  <span>主胜</span>
                  <span>{data.w.home}%</span>
                </div>
                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${data.w.home}%` }}
                    transition={{ delay: 0.5, duration: 1 }}
                    className="h-full bg-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono text-zinc-400">
                  <span>客胜</span>
                  <span>{data.w.away}%</span>
                </div>
                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${data.w.away}%` }}
                    transition={{ delay: 0.7, duration: 1 }}
                    className="h-full bg-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 p-3 border-l-2 border-emerald-500 bg-emerald-500/5 text-zinc-300 italic text-xs leading-relaxed w-full">
              "{data.p}"
            </div>

            <Button 
              className="w-full mt-6 gap-2" 
              onClick={() => navigate(`/match/${match.id}`)}
              size="sm"
            >
              <Activity className="w-4 h-4" /> 查看完整分析
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
