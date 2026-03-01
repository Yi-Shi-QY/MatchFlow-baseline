import React, { useMemo } from 'react';
import { Player } from '@remotion/player';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Card } from '@/src/components/ui/Card';
import { AlertCircle } from 'lucide-react';
import { TEMPLATES } from '@/src/services/remotion/templates';
import { validateAndNormalizeAnimationPayload } from '@/src/services/remotion/templateParams';

interface RemotionPlayerProps {
  animation: any;
}

interface TemplateSceneProps {
  templateId: string;
  data: any;
  title: string;
  narration: string;
}

function TemplateScene({ templateId, data, title, narration }: TemplateSceneProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const template = TEMPLATES[templateId] || TEMPLATES['stats-comparison'];
  const VisualComponent = template.Component;

  const enter = spring({ frame, fps, config: { damping: 14 } });
  const titleOpacity = interpolate(frame, [0, 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const titleTranslateY = interpolate(frame, [0, 12], [-20, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const captionOpacity = interpolate(frame, [8, 24], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: '#09090b', color: '#fff' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          padding: '140px 60px 180px 60px',
          transform: `scale(${enter})`,
          transformOrigin: 'center center',
        }}
      >
        <VisualComponent data={data} />
      </div>

      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          padding: '30px 40px',
          background: 'linear-gradient(180deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0) 100%)',
          opacity: titleOpacity,
          transform: `translateY(${titleTranslateY}px)`,
        }}
      >
        <div style={{ fontSize: '54px', fontWeight: 700, lineHeight: 1.15 }}>
          {title || 'Data Visualization'}
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: '24px 32px 30px 32px',
          background: 'linear-gradient(0deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 100%)',
          opacity: captionOpacity,
        }}
      >
        <div
          style={{
            fontSize: '30px',
            lineHeight: 1.35,
            color: '#e4e4e7',
            maxWidth: '92%',
          }}
        >
          {narration || ''}
        </div>
      </div>
    </AbsoluteFill>
  );
}

export function RemotionPlayer({ animation }: RemotionPlayerProps) {
  const resolved = useMemo(() => {
    if (!animation) return { error: 'Missing animation payload' };
    const validation = validateAndNormalizeAnimationPayload(animation, animation?.type);
    if (!validation.isValid) {
      return { error: `Animation params invalid: ${validation.errors.join('; ')}` };
    }
    return { payload: validation.payload };
  }, [animation]);

  if ('error' in resolved) {
    return (
      <Card className="border-red-500/30 bg-zinc-950 p-4">
        <div className="flex items-center gap-2 text-red-400 text-sm mb-2">
          <AlertCircle className="w-4 h-4" />
          <span>动画参数校验失败</span>
        </div>
        <pre className="text-[10px] text-zinc-500 font-mono whitespace-pre-wrap overflow-x-auto">
          {resolved.error}
        </pre>
      </Card>
    );
  }

  const { payload } = resolved;

  return (
    <div className="rounded-xl overflow-hidden border border-zinc-800 bg-black shadow-lg">
      <Player
        component={TemplateScene}
        inputProps={{
          templateId: payload.templateId,
          data: payload.params,
          title: payload.title,
          narration: payload.narration,
        }}
        durationInFrames={150}
        fps={30}
        compositionWidth={1080}
        compositionHeight={1080}
        style={{
          width: '100%',
          aspectRatio: '1 / 1',
          maxHeight: '600px',
          margin: '0 auto',
        }}
        controls
        autoPlay
        loop
      />
    </div>
  );
}
