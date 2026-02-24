import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Scanner } from '@yudiel/react-qr-scanner';
import { ArrowLeft, QrCode } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';

export default function Scan() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const handleScan = (result: string) => {
    if (result) {
      try {
        // Expected format: http://localhost:3000/share?d=...
        const url = new URL(result);
        if (url.pathname === '/share' && url.searchParams.has('d')) {
          navigate(`/share?d=${url.searchParams.get('d')}`);
        } else {
          setError('无效的赛事分析二维码');
        }
      } catch (e) {
        setError('无效的二维码格式');
      }
    }
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans flex flex-col">
      <header className="sticky top-0 z-20 bg-black/80 backdrop-blur-md border-b border-white/10 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="h-8 w-8 rounded-full bg-zinc-900 border border-white/10">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
            <QrCode className="w-4 h-4 text-emerald-500" /> 扫描赛事二维码
          </h1>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4 max-w-md mx-auto w-full">
        <div className="w-full aspect-square max-w-sm rounded-2xl overflow-hidden border-2 border-emerald-500/50 relative shadow-2xl shadow-emerald-500/10">
          <Scanner
            onScan={(result) => handleScan(result[0].rawValue)}
            onError={(error) => console.error(error)}
          />
          
          {/* Scanning overlay */}
          <div className="absolute inset-0 pointer-events-none border-[40px] border-black/50" />
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-48 h-48 border-2 border-emerald-500 rounded-xl relative">
              <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-emerald-400 -mt-0.5 -ml-0.5" />
              <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-emerald-400 -mt-0.5 -mr-0.5" />
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-emerald-400 -mb-0.5 -ml-0.5" />
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-emerald-400 -mb-0.5 -mr-0.5" />
            </div>
          </div>
        </div>

        {error ? (
          <div className="mt-8 text-red-400 text-sm font-mono bg-red-500/10 px-4 py-2 rounded-lg border border-red-500/20">
            {error}
          </div>
        ) : (
          <div className="mt-8 text-zinc-400 text-sm font-mono text-center">
            将二维码放入框内即可扫描
          </div>
        )}
      </main>
    </div>
  );
}
