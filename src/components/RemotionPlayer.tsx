import React, { useCallback, useMemo, useState } from 'react';
import { Player } from '@remotion/player';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Card } from '@/src/components/ui/Card';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { TEMPLATES } from '@/src/services/remotion/templates';
import { validateAndNormalizeAnimationPayload } from '@/src/services/remotion/templateParams';
import { retryAnimationPayloadWithModel } from '@/src/services/ai/animationPipeline';

interface AnimationRetryContext {
  matchData: any;
  segmentPlan: {
    title?: string;
    animationType?: string;
  };
  analysisText: string;
}

interface RemotionPlayerProps {
  animation: any;
  retryContext?: AnimationRetryContext;
  onAnimationRepaired?: (animation: any) => void;
}

interface TemplateSceneProps {
  templateId: string;
  data: any;
  title: string;
  narration: string;
}

const PLAYER_DURATION_IN_FRAMES = 150;
const PLAYER_FPS = 30;

function TemplateScene({ templateId, data, title, narration }: TemplateSceneProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const template = TEMPLATES[templateId] || TEMPLATES['stats-comparison'];
  const VisualComponent = template.Component;

  const enter = spring({ frame, fps, config: { damping: 14 } });
  const titleOpacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const titleTranslateY = interpolate(frame, [0, 12], [-20, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const captionOpacity = interpolate(frame, [8, 24], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

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

export function RemotionPlayer({
  animation,
  retryContext,
  onAnimationRepaired,
}: RemotionPlayerProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  const resolved = useMemo(() => {
    if (!animation) return { error: 'Missing animation payload' };
    const validation = validateAndNormalizeAnimationPayload(animation, animation?.type, {
      templateId: typeof animation?.templateId === 'string' ? animation.templateId : undefined,
    });
    if (!validation.isValid) {
      return { error: `Animation params invalid: ${validation.errors.join('; ')}` };
    }
    return { payload: validation.payload };
  }, [animation]);

  const payload = 'payload' in resolved ? resolved.payload : null;
  const validationError = 'error' in resolved ? resolved.error : null;
  const validationErrors = useMemo(() => {
    if (!animation) return ['Missing animation payload'];
    const result = validateAndNormalizeAnimationPayload(animation, animation?.type, {
      templateId: typeof animation?.templateId === 'string' ? animation.templateId : undefined,
    });
    return result.errors;
  }, [animation]);
  const canRetry = Boolean(retryContext && onAnimationRepaired && animation);

  const handleRetry = useCallback(async () => {
    if (!canRetry || !retryContext || !onAnimationRepaired || !animation) return;
    setIsRetrying(true);
    setRetryError(null);

    try {
      const fixed = await retryAnimationPayloadWithModel(
        retryContext.matchData,
        retryContext.segmentPlan,
        retryContext.analysisText || '',
        animation,
        validationErrors,
      );

      if (!fixed.isValid) {
        setRetryError(fixed.errors.join('; '));
        return;
      }

      onAnimationRepaired(fixed.payload);
    } catch (error: any) {
      setRetryError(error?.message || 'Retry failed');
    } finally {
      setIsRetrying(false);
    }
  }, [canRetry, retryContext, onAnimationRepaired, animation, validationErrors]);

  if (validationError || !payload) {
    return (
      <Card className="border-red-500/30 bg-zinc-950 p-4">
        <div className="flex items-center gap-2 text-red-400 text-sm mb-2">
          <AlertCircle className="w-4 h-4" />
          <span>Animation params validation failed</span>
        </div>
        <pre className="text-[10px] text-zinc-500 font-mono whitespace-pre-wrap overflow-x-auto">
          {validationError || 'Unknown animation validation error'}
        </pre>
        {canRetry && (
          <div className="mt-3 space-y-2">
            <button
              type="button"
              className="h-7 px-2 rounded-md border border-zinc-700 bg-black/70 text-zinc-200 text-[10px] flex items-center gap-1 hover:bg-zinc-900 disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={handleRetry}
              disabled={isRetrying}
            >
              {isRetrying ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              <span>{isRetrying ? 'Retrying...' : 'Retry Animation Params'}</span>
            </button>
            {retryError && (
              <pre className="text-[10px] text-amber-400 font-mono whitespace-pre-wrap overflow-x-auto">
                {retryError}
              </pre>
            )}
          </div>
        )}
      </Card>
    );
  }

  return (
    <div className="relative rounded-xl overflow-hidden border border-zinc-800 bg-black shadow-lg">
      <Player
        component={TemplateScene}
        inputProps={{
          templateId: payload.templateId,
          data: payload.params,
          title: payload.title,
          narration: payload.narration,
        }}
        durationInFrames={PLAYER_DURATION_IN_FRAMES}
        fps={PLAYER_FPS}
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
