import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Scanner } from '@yudiel/react-qr-scanner';
import { ArrowLeft, QrCode, AlertCircle } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { Camera } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

export default function Scan() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isScanning, setIsScanning] = useState(true);
  const [scanSuccess, setScanSuccess] = useState(false);

  useEffect(() => {
    const requestNativePermissions = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          const permissions = await Camera.checkPermissions();
          if (permissions.camera !== 'granted') {
            const request = await Camera.requestPermissions();
            if (request.camera !== 'granted') {
              setHasPermission(false);
              setError('无法访问摄像头，请在系统设置中授予权限');
              return;
            }
          }
          setHasPermission(true);
        } catch (err) {
          console.error('Failed to request native camera permission:', err);
          // Fallback to true to let the web scanner try
          setHasPermission(true);
        }
      } else {
        // On web, the browser handles the prompt automatically when getUserMedia is called
        setHasPermission(true);
      }
    };

    requestNativePermissions();
  }, []);

  const handleScan = (result: string) => {
    if (!isScanning) return;
    
    if (result) {
      let dParam = null;
      try {
        const url = new URL(result);
        dParam = url.searchParams.get('d');
      } catch (e) {
        // Fallback if URL parsing fails
        const match = result.match(/[?&]d=([^&]+)/);
        if (match) dParam = match[1];
      }

      if (dParam) {
        setIsScanning(false);
        setScanSuccess(true);
        
        // Freeze the camera frame
        const videoEl = document.querySelector('video');
        if (videoEl) {
          videoEl.pause();
        }

        // Navigate after a short delay to show the frozen frame and success state
        setTimeout(() => {
          navigate(`/share?d=${dParam}`);
        }, 800);
      } else {
        setError('无效的赛事分析二维码');
      }
    }
  };

  const handleError = (err: unknown) => {
    console.error(err);
    if (err instanceof Error) {
      if (err.name === 'NotAllowedError' || err.message.includes('Permission denied')) {
        setHasPermission(false);
        setError('无法访问摄像头，请在系统设置中授予权限');
      } else {
        setError(err.message || '扫描出错');
      }
    } else if (typeof err === 'string') {
      setError(err);
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
        {hasPermission === null ? (
          <div className="w-full aspect-square max-w-sm rounded-2xl border-2 border-emerald-500/50 flex flex-col items-center justify-center p-6 text-center bg-zinc-900">
            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-sm text-zinc-400">正在请求摄像头权限...</p>
          </div>
        ) : hasPermission === false ? (
          <div className="w-full aspect-square max-w-sm rounded-2xl border-2 border-red-500/50 flex flex-col items-center justify-center p-6 text-center bg-red-500/5">
            <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">无摄像头权限</h3>
            <p className="text-sm text-zinc-400 mb-6">
              请在系统设置中允许应用访问摄像头，然后刷新页面重试。
            </p>
            <Button onClick={() => window.location.reload()} variant="outline" className="border-white/10">
              刷新重试
            </Button>
          </div>
        ) : (
          <div className="w-full aspect-square max-w-sm rounded-2xl overflow-hidden border-2 border-emerald-500/50 relative shadow-2xl shadow-emerald-500/10 bg-zinc-900">
            <Scanner
              onScan={(result) => {
                if (result && result.length > 0) {
                  handleScan(result[0].rawValue);
                }
              }}
              onError={handleError}
              formats={['qr_code']}
              constraints={{ facingMode: 'environment' }}
              components={{
                finder: false,
              }}
            />
            
            {/* Scanning overlay */}
            <div className={`absolute inset-0 pointer-events-none border-[40px] transition-colors duration-300 ${scanSuccess ? 'border-emerald-500/30' : 'border-black/50'}`} />
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className={`w-48 h-48 border-2 rounded-xl relative transition-colors duration-300 ${scanSuccess ? 'border-emerald-400 bg-emerald-500/20' : 'border-emerald-500'}`}>
                <div className={`absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 -mt-0.5 -ml-0.5 transition-colors duration-300 ${scanSuccess ? 'border-white' : 'border-emerald-400'}`} />
                <div className={`absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 -mt-0.5 -mr-0.5 transition-colors duration-300 ${scanSuccess ? 'border-white' : 'border-emerald-400'}`} />
                <div className={`absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 -mb-0.5 -ml-0.5 transition-colors duration-300 ${scanSuccess ? 'border-white' : 'border-emerald-400'}`} />
                <div className={`absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 -mb-0.5 -mr-0.5 transition-colors duration-300 ${scanSuccess ? 'border-white' : 'border-emerald-400'}`} />
                
                {/* Scanning line animation */}
                {!scanSuccess && (
                  <div className="absolute top-0 left-0 w-full h-0.5 bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.5)] animate-[scan_2s_ease-in-out_infinite]" />
                )}

                {/* Success Checkmark */}
                {scanSuccess && (
                  <div className="absolute inset-0 flex items-center justify-center animate-in zoom-in duration-300">
                    <div className="bg-emerald-500 rounded-full p-3 shadow-[0_0_20px_rgba(16,185,129,0.5)]">
                      <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {error ? (
          <div className="mt-8 text-red-400 text-sm font-mono bg-red-500/10 px-4 py-2 rounded-lg border border-red-500/20 max-w-sm w-full text-center">
            {error}
          </div>
        ) : scanSuccess ? (
          <div className="mt-8 text-emerald-400 text-sm font-mono text-center animate-in fade-in slide-in-from-bottom-2">
            扫描成功！正在跳转...
          </div>
        ) : (
          <div className="mt-8 text-zinc-400 text-sm font-mono text-center">
            将二维码放入框内即可扫描
          </div>
        )}
      </main>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes scan {
          0% { top: 0; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}} />
    </div>
  );
}
