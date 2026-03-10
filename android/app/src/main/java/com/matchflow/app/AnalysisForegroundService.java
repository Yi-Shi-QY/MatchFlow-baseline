package com.matchflow.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

public class AnalysisForegroundService extends Service {
  private static final String ACTION_START_OR_UPDATE = "com.matchflow.app.action.START_OR_UPDATE_FOREGROUND_EXECUTION";
  private static final String ACTION_STOP = "com.matchflow.app.action.STOP_FOREGROUND_EXECUTION";
  private static final String EXTRA_TITLE = "title";
  private static final String EXTRA_TEXT = "text";
  private static final String EXTRA_USE_WAKE_LOCK = "useWakeLock";
  private static final String NOTIFICATION_CHANNEL_ID = "matchflow_analysis_background";
  private static final int NOTIFICATION_ID = 10021;
  private static final long WAKE_LOCK_TIMEOUT_MS = 10 * 60 * 1000L;

  private static volatile boolean running = false;

  private NotificationManager notificationManager;
  private PowerManager.WakeLock wakeLock;
  private String notificationTitle = "MatchFlow analysis running";
  private String notificationText = "Analysis is running in background";
  private boolean useWakeLock = false;

  public static Intent buildStartOrUpdateIntent(
    Context context,
    String title,
    String text,
    boolean useWakeLock
  ) {
    Intent intent = new Intent(context, AnalysisForegroundService.class);
    intent.setAction(ACTION_START_OR_UPDATE);
    intent.putExtra(EXTRA_TITLE, title);
    intent.putExtra(EXTRA_TEXT, text);
    intent.putExtra(EXTRA_USE_WAKE_LOCK, useWakeLock);
    return intent;
  }

  public static Intent buildStopIntent(Context context) {
    Intent intent = new Intent(context, AnalysisForegroundService.class);
    intent.setAction(ACTION_STOP);
    return intent;
  }

  public static boolean isServiceRunning() {
    return running;
  }

  @Override
  public void onCreate() {
    super.onCreate();
    notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
    ensureNotificationChannel();
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    String action = intent != null ? intent.getAction() : ACTION_START_OR_UPDATE;
    if (ACTION_STOP.equals(action)) {
      stopServiceInternal();
      return START_NOT_STICKY;
    }

    notificationTitle = safeOrDefault(
      intent != null ? intent.getStringExtra(EXTRA_TITLE) : null,
      "MatchFlow analysis running"
    );
    notificationText = safeOrDefault(
      intent != null ? intent.getStringExtra(EXTRA_TEXT) : null,
      "Analysis is running in background"
    );
    useWakeLock = intent != null && intent.getBooleanExtra(EXTRA_USE_WAKE_LOCK, false);

    Notification notification = buildNotification(notificationTitle, notificationText);
    startForeground(NOTIFICATION_ID, notification);
    running = true;
    ensureWakeLockState();
    return START_STICKY;
  }

  @Nullable
  @Override
  public IBinder onBind(Intent intent) {
    return null;
  }

  @Override
  public void onDestroy() {
    releaseWakeLock();
    running = false;
    super.onDestroy();
  }

  private void stopServiceInternal() {
    releaseWakeLock();
    running = false;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      stopForeground(STOP_FOREGROUND_REMOVE);
    } else {
      stopForeground(true);
    }
    stopSelf();
  }

  private void ensureWakeLockState() {
    if (!useWakeLock) {
      releaseWakeLock();
      return;
    }

    if (wakeLock == null) {
      PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
      if (powerManager != null) {
        wakeLock = powerManager.newWakeLock(
          PowerManager.PARTIAL_WAKE_LOCK,
          "MatchFlow:AnalysisForegroundWakeLock"
        );
        wakeLock.setReferenceCounted(false);
      }
    }

    if (wakeLock != null) {
      if (wakeLock.isHeld()) {
        wakeLock.release();
      }
      wakeLock.acquire(WAKE_LOCK_TIMEOUT_MS);
    }
  }

  private void releaseWakeLock() {
    if (wakeLock != null && wakeLock.isHeld()) {
      wakeLock.release();
    }
  }

  private Notification buildNotification(String title, String text) {
    Intent openAppIntent = new Intent(this, MainActivity.class);
    openAppIntent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
    PendingIntent pendingIntent = PendingIntent.getActivity(
      this,
      0,
      openAppIntent,
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
        ? PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        : PendingIntent.FLAG_UPDATE_CURRENT
    );

    return new NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
      .setContentTitle(title)
      .setContentText(text)
      .setStyle(new NotificationCompat.BigTextStyle().bigText(text))
      .setSmallIcon(R.mipmap.ic_launcher)
      .setOnlyAlertOnce(true)
      .setOngoing(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setCategory(NotificationCompat.CATEGORY_SERVICE)
      .setContentIntent(pendingIntent)
      .build();
  }

  private void ensureNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || notificationManager == null) {
      return;
    }
    NotificationChannel channel = new NotificationChannel(
      NOTIFICATION_CHANNEL_ID,
      "MatchFlow background analysis",
      NotificationManager.IMPORTANCE_LOW
    );
    channel.setDescription("Keeps analysis execution alive while app is in background.");
    notificationManager.createNotificationChannel(channel);
  }

  private static String safeOrDefault(String value, String fallback) {
    if (value == null) return fallback;
    String normalized = value.trim();
    if (normalized.isEmpty()) return fallback;
    return normalized;
  }
}
