import { Capacitor, registerPlugin } from '@capacitor/core';

interface AndroidForegroundExecutionPlugin {
  start(options: {
    title: string;
    text: string;
    useWakeLock?: boolean;
    scope?: 'analysis' | 'automation';
    ttlMs?: number;
  }): Promise<{ running: boolean }>;
  stop(options?: { scope?: 'analysis' | 'automation' }): Promise<{ running: boolean }>;
  isRunning(): Promise<{ running: boolean }>;
}

const AndroidForegroundExecution = registerPlugin<AndroidForegroundExecutionPlugin>(
  'AndroidForegroundExecution',
);

function isNativeAndroid(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export interface AndroidForegroundExecutionStatusInput {
  title: string;
  text: string;
  useWakeLock: boolean;
}

export async function startOrUpdateAndroidForegroundExecution(
  input: AndroidForegroundExecutionStatusInput,
  options?: { scope?: 'analysis' | 'automation'; ttlMs?: number },
): Promise<boolean> {
  if (!isNativeAndroid()) return false;
  try {
    await AndroidForegroundExecution.start({
      title: input.title,
      text: input.text,
      useWakeLock: input.useWakeLock,
      scope: options?.scope || 'analysis',
      ttlMs: options?.ttlMs,
    });
    return true;
  } catch (error) {
    console.warn('Failed to start/update Android foreground execution service', error);
    return false;
  }
}

export async function stopAndroidForegroundExecution(
  scope: 'analysis' | 'automation' = 'analysis',
): Promise<boolean> {
  if (!isNativeAndroid()) return false;
  try {
    await AndroidForegroundExecution.stop({ scope });
    return true;
  } catch (error) {
    console.warn('Failed to stop Android foreground execution service', error);
    return false;
  }
}
