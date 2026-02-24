import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { MOCK_MATCHES } from '@/src/data/matches';
import { Card, CardContent } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { ArrowLeft, Activity, Download, BrainCircuit } from 'lucide-react';
import { motion } from 'motion/react';
import { saveHistory } from '@/src/services/history';

export default function Share() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [importedData, setImportedData] = useState<any>(null);
  const [match, setMatch] = useState<any>(null);
  const [isLegacy, setIsLegacy] = useState(false);

  useEffect(() => {
    const d = searchParams.get('d');
    if (d) {
      try {
        const decodedStr = atob(d);
        let decoded;
        try {
          decoded = JSON.parse(decodeURIComponent(decodedStr));
        } catch (e) {
          decoded = JSON.parse(decodedStr); // fallback for old format
        }
        
        // Check version
        if (decoded.v === 2 && decoded.d) {
           // New format: just input data
           setImportedData(decoded.d);
           
           // Construct a match object for preview
           const m = {
             id: decoded.d.id || 'custom',
             league: decoded.d.league || 'Unknown League',
             homeTeam: decoded.d.homeTeam || { name: 'Home', logo: '' },
             awayTeam: decoded.d.awayTeam || { name: 'Away', logo: '' },
             // Try to find logo if name matches mock
             ...MOCK_MATCHES.find(x => x.id === decoded.d.id)
           };
           
           // If names are custom, we might not have logos, use placeholders
           if (!m.homeTeam.logo) m.homeTeam.logo = 'https://picsum.photos/seed/home/200/200';
           if (!m.awayTeam.logo) m.awayTeam.logo = 'https://picsum.photos/seed/away/200/200';
           
           setMatch(m);
           setIsLegacy(false);
        } else if (decoded.a) {
          // Legacy format with full analysis
          setImportedData({
            m: decoded.m,
            p: decoded.a.prediction,
            w: decoded.a.winProbability,
            fullAnalysis: decoded.a
          });
          const m = decoded.matchData || MOCK_MATCHES.find(x => x.id === decoded.m);
          setMatch(m);
          setIsLegacy(true);
        } else {
          // Fallback or invalid
          setImportedData(decoded);
          const m = decoded.matchData || MOCK_MATCHES.find(x => x.id === decoded.m);
          setMatch(m);
          setIsLegacy(true);
        }
      } catch (e) {
        console.error("Failed to decode share data", e);
      }
    }
  }, [searchParams]);

  const handleImport = () => {
    if (isLegacy && match && importedData?.fullAnalysis) {
      saveHistory(match, importedData.fullAnalysis);
      navigate(`/match/${match.id}`);
    } else if (importedData) {
      // New format: navigate to match detail with imported data
      navigate(`/match/${match.id || 'custom'}`, { state: { importedData } });
    }
  };

  if (!importedData || !match) {
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
                <img src={match.homeTeam.logo} alt={match.homeTeam.name} className="w-12 h-12 object-contain drop-shadow-lg rounded-full bg-white/5 p-1" />
                <span className="font-bold text-xs truncate max-w-[80px] text-center">{match.homeTeam.name}</span>
              </div>
              <div className="text-xl font-bold font-mono text-zinc-600">VS</div>
              <div className="flex flex-col items-center gap-2">
                <img src={match.awayTeam.logo} alt={match.awayTeam.name} className="w-12 h-12 object-contain drop-shadow-lg rounded-full bg-white/5 p-1" />
                <span className="font-bold text-xs truncate max-w-[80px] text-center">{match.awayTeam.name}</span>
              </div>
            </div>

            {isLegacy ? (
              <div className="w-full space-y-4 bg-black/50 p-4 rounded-xl border border-white/5">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-mono text-zinc-400">
                    <span>主胜</span>
                    <span>{importedData.w.home}%</span>
                  </div>
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${importedData.w.home}%` }}
                      transition={{ delay: 0.5, duration: 1 }}
                      className="h-full bg-emerald-500"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-mono text-zinc-400">
                    <span>客胜</span>
                    <span>{importedData.w.away}%</span>
                  </div>
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${importedData.w.away}%` }}
                      transition={{ delay: 0.7, duration: 1 }}
                      className="h-full bg-blue-500"
                    />
                  </div>
                </div>
                
                <div className="mt-4 p-3 border-l-2 border-emerald-500 bg-emerald-500/5 text-zinc-300 italic text-xs leading-relaxed w-full">
                  "{importedData.p}"
                </div>
              </div>
            ) : (
              <div className="w-full bg-zinc-900/50 p-4 rounded-xl border border-white/5 text-center">
                <p className="text-sm text-zinc-300 mb-2">
                  收到一个赛事分析配置
                </p>
                <p className="text-xs text-zinc-500">
                  包含球队信息、近期状态及自定义数据
                </p>
              </div>
            )}

            <div className="w-full mt-6 flex flex-col gap-2">
              <Button 
                className="w-full gap-2 bg-emerald-600 hover:bg-emerald-500 text-white" 
                onClick={handleImport}
                size="sm"
              >
                {isLegacy ? <Download className="w-4 h-4" /> : <BrainCircuit className="w-4 h-4" />}
                {isLegacy ? '导入并保存到我的记录' : '导入数据并开始分析'}
              </Button>
              
              <Button 
                variant="outline"
                className="w-full gap-2 border-zinc-700 text-zinc-300 hover:bg-zinc-800" 
                onClick={() => navigate('/')}
                size="sm"
              >
                <ArrowLeft className="w-4 h-4" /> 返回首页
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
