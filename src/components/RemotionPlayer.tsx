import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Player } from '@remotion/player';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Card } from '@/src/components/ui/Card';
import { AlertCircle, Download, Loader2 } from 'lucide-react';
import { TEMPLATES } from '@/src/services/remotion/templates';
import { validateAndNormalizeAnimationPayload } from '@/src/services/remotion/templateParams';
import { useTranslation } from 'react-i18next';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

interface RemotionPlayerProps {
  animation: any;
}

interface TemplateSceneProps {
  templateId: string;
  data: any;
  title: string;
  narration: string;
}

const PLAYER_DURATION_IN_FRAMES = 150;
const PLAYER_FPS = 30;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeFileName(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, '_').trim() || 'animation';
}

function getSupportedVideoMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  const found = candidates.find((mime) => MediaRecorder.isTypeSupported(mime));
  return found || '';
}

function pickCaptureTarget(root: HTMLElement): (HTMLCanvasElement | HTMLVideoElement) | null {
  const nodes = Array.from(root.querySelectorAll('canvas, video')) as Array<
    HTMLCanvasElement | HTMLVideoElement
  >;
  if (nodes.length === 0) return null;
  return nodes.sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight)[0];
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const value = typeof reader.result === 'string' ? reader.result : '';
      const base64 = value.includes(',') ? value.split(',')[1] : value;
      if (!base64) {
        reject(new Error('Failed to encode video blob.'));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to read blob.'));
    reader.readAsDataURL(blob);
  });
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
  const { t } = useTranslation();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<any>(null);
  const [isRecording, setIsRecording] = useState(false);

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

  const handleDownloadVideo = useCallback(async () => {
    if (isRecording) return;
    if (!wrapperRef.current) return;

    if (typeof MediaRecorder === 'undefined') {
      alert(t('match.download_video_unsupported'));
      return;
    }

    let tracks: MediaStreamTrack[] = [];
    setIsRecording(true);
    try {
      if (playerRef.current?.pause) {
        playerRef.current.pause();
      }
      if (playerRef.current?.seekTo) {
        playerRef.current.seekTo(0);
      }
      await sleep(120);

      const target = pickCaptureTarget(wrapperRef.current);
      if (!target || typeof (target as any).captureStream !== 'function') {
        throw new Error(t('match.download_video_unsupported'));
      }

      const stream = (target as any).captureStream(PLAYER_FPS) as MediaStream;
      tracks = stream.getTracks();
      const mimeType = getSupportedVideoMimeType();
      const chunks: BlobPart[] = [];

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      const waitForStop = new Promise<void>((resolve, reject) => {
        recorder.onstop = () => resolve();
        recorder.onerror = (event: any) => reject(event?.error || new Error('MediaRecorder error'));
      });

      recorder.start(200);
      if (playerRef.current?.play) {
        playerRef.current.play();
      }

      const durationMs = (PLAYER_DURATION_IN_FRAMES / PLAYER_FPS) * 1000;
      await sleep(durationMs + 280);

      if (recorder.state !== 'inactive') {
        recorder.stop();
      }
      await waitForStop;
      if (playerRef.current?.pause) {
        playerRef.current.pause();
      }

      const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
      const extension = (mimeType || 'video/webm').includes('mp4') ? 'mp4' : 'webm';
      const fileName = `${sanitizeFileName(payload.title || 'animation')}_${Date.now()}.${extension}`;

      if (Capacitor.isNativePlatform()) {
        const base64 = await blobToBase64(blob);
        const result = await Filesystem.writeFile({
          path: fileName,
          data: base64,
          directory: Directory.Cache,
        });
        await Share.share({
          title: t('match.download_video'),
          text: t('match.download_video'),
          url: result.uri,
          dialogTitle: t('match.download_video'),
        });
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Failed to export animation video:', error);
      alert(`${t('match.download_video_failed')}: ${error?.message || t('match.export_unknown_error')}`);
    } finally {
      tracks.forEach((track) => track.stop());
      setIsRecording(false);
    }
  }, [isRecording, payload.title, t]);

  return (
    <div ref={wrapperRef} className="relative rounded-xl overflow-hidden border border-zinc-800 bg-black shadow-lg">
      <button
        type="button"
        className="absolute right-2 top-2 z-10 h-7 px-2 rounded-md border border-zinc-700 bg-black/70 text-zinc-200 text-[10px] flex items-center gap-1 hover:bg-zinc-900 disabled:opacity-60 disabled:cursor-not-allowed"
        onClick={handleDownloadVideo}
        disabled={isRecording}
        title={t('match.download_video')}
      >
        {isRecording ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
        <span>{isRecording ? t('match.downloading_video') : t('match.download_video')}</span>
      </button>
      <Player
        ref={playerRef}
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
