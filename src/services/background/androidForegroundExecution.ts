import { Capacitor, registerPlugin } from '@capacitor/core';

interface AndroidForegroundExecutionPlugin {
  start(options: {
    title: string;
    text: string;
    useWakeLock?: boolean;
  }): Promise<{ running: boolean }>;
  stop(): Promise<{ running: boolean }>;
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
): Promise<boolean> {
  if (!isNativeAndroid()) return false;
  try {
    await AndroidForegroundExecution.start({
      title: input.title,
      text: input.text,
      useWakeLock: input.useWakeLock,
    });
    return true;
  } catch (error) {
    console.warn('Failed to start/update Android foreground execution service', error);
    return false;
  }
}

export async function stopAndroidForegroundExecution(): Promise<boolean> {
  if (!isNativeAndroid()) return false;
  try {
    await AndroidForegroundExecution.stop();
    return true;
  } catch (error) {
    console.warn('Failed to stop Android foreground execution service', error);
    return false;
  }
}
