import React, { useMemo, useState, useEffect } from 'react';
import { Player } from '@remotion/player';
import { evaluateRemotionCode } from '@/src/utils/evaluateRemotion';
import { Card } from '@/src/components/ui/Card';
import { AlertCircle, Loader2 } from 'lucide-react';

interface RemotionPlayerProps {
  code: string;
  data: any;
  title: string;
  narration: string;
  isGenerating: boolean;
}

export function RemotionPlayer({ code, data, title, narration, isGenerating }: RemotionPlayerProps) {
  const [error, setError] = useState<string | null>(null);

  const Component = useMemo(() => {
    if (!code || isGenerating) return null;
    try {
      setError(null);
      const EvaluatedComponent = evaluateRemotionCode(code);
      if (!EvaluatedComponent) {
        throw new Error("Failed to evaluate component");
      }
      return EvaluatedComponent;
    } catch (e: any) {
      setError(e.message);
      return null;
    }
  }, [code, isGenerating]);

  if (isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-zinc-950 border border-zinc-800 rounded-xl">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-4" />
        <p className="text-sm text-zinc-400 font-mono">正在生成 Remotion 动画代码...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-500/30 bg-zinc-950 p-4">
        <div className="flex items-center gap-2 text-red-400 text-sm mb-2">
          <AlertCircle className="w-4 h-4" />
          <span>动画渲染失败</span>
        </div>
        <pre className="text-[10px] text-zinc-500 font-mono whitespace-pre-wrap overflow-x-auto">
          {error}
        </pre>
      </Card>
    );
  }

  if (!Component) {
    return null;
  }

  return (
    <div className="rounded-xl overflow-hidden border border-zinc-800 bg-black shadow-lg">
      <Player
        component={Component}
        inputProps={{ data, title, narration }}
        durationInFrames={150} // Default duration, can be adjusted
        fps={30}
        compositionWidth={1920}
        compositionHeight={1080}
        style={{
          width: '100%',
          aspectRatio: '16 / 9',
        }}
        controls
        autoPlay
        loop
      />
    </div>
  );
}
