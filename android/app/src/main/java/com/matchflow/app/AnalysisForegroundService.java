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
  private static final String EXTRA_SCOPE = "scope";
  private static final String EXTRA_TITLE = "title";
  private static final String EXTRA_TEXT = "text";
  private static final String EXTRA_USE_WAKE_LOCK = "useWakeLock";
  private static final String EXTRA_TTL_MS = "ttlMs";
  private static final String NOTIFICATION_CHANNEL_ID = "matchflow_analysis_background";
  private static final int NOTIFICATION_ID = 10021;
  private static final long WAKE_LOCK_TIMEOUT_MS = 10 * 60 * 1000L;
  private static final String SCOPE_ANALYSIS = "analysis";
  private static final String SCOPE_AUTOMATION = "automation";
  private static final Object SLOT_LOCK = new Object();
  private static final long DEFAULT_SLOT_TTL_MS = 3 * 60 * 1000L;
  private static final long MIN_SLOT_TTL_MS = 15 * 1000L;

  private static volatile boolean running = false;

  private static final class ForegroundSlot {
    boolean active = false;
    String title;
    String text;
    boolean useWakeLock = false;
    long expiresAtEpochMs = 0L;

    ForegroundSlot(String title, String text) {
      this.title = title;
      this.text = text;
    }
  }

  private static final ForegroundSlot analysisSlot =
    new ForegroundSlot("MatchFlow analysis running", "Analysis is running in background");
  private static final ForegroundSlot automationSlot =
    new ForegroundSlot("MatchFlow automation running", "Automation is running in background");

  private NotificationManager notificationManager;
  private PowerManager.WakeLock wakeLock;
  private android.os.Handler handler;
  private Runnable expiryRunnable;

  public static Intent buildStartOrUpdateIntent(
    Context context,
    String scope,
    String title,
    String text,
    boolean useWakeLock,
    long ttlMs
  ) {
    Intent intent = new Intent(context, AnalysisForegroundService.class);
    intent.setAction(ACTION_START_OR_UPDATE);
    intent.putExtra(EXTRA_SCOPE, scope);
    intent.putExtra(EXTRA_TITLE, title);
    intent.putExtra(EXTRA_TEXT, text);
    intent.putExtra(EXTRA_USE_WAKE_LOCK, useWakeLock);
    intent.putExtra(EXTRA_TTL_MS, ttlMs);
    return intent;
  }

  public static Intent buildStopIntent(Context context, String scope) {
    Intent intent = new Intent(context, AnalysisForegroundService.class);
    intent.setAction(ACTION_STOP);
    intent.putExtra(EXTRA_SCOPE, scope);
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
    handler = new android.os.Handler(android.os.Looper.getMainLooper());
    expiryRunnable =
      new Runnable() {
        @Override
        public void run() {
          expireSlotsIfNeeded();
        }
      };
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    String action = intent != null ? intent.getAction() : ACTION_START_OR_UPDATE;
    String scope = normalizeScope(intent != null ? intent.getStringExtra(EXTRA_SCOPE) : null);

    if (ACTION_STOP.equals(action)) {
      clearSlot(scope);
      refreshForegroundState();
      return hasActiveSlot() ? START_STICKY : START_NOT_STICKY;
    }

    String defaultTitle = defaultTitleForScope(scope);
    String defaultText = defaultTextForScope(scope);
    String title = safeOrDefault(
      intent != null ? intent.getStringExtra(EXTRA_TITLE) : null,
      defaultTitle
    );
    String text = safeOrDefault(
      intent != null ? intent.getStringExtra(EXTRA_TEXT) : null,
      defaultText
    );
    boolean useWakeLock = intent != null && intent.getBooleanExtra(EXTRA_USE_WAKE_LOCK, false);
    long ttlMs = intent != null ? intent.getLongExtra(EXTRA_TTL_MS, DEFAULT_SLOT_TTL_MS) : DEFAULT_SLOT_TTL_MS;

    updateSlot(scope, title, text, useWakeLock, ttlMs);
    refreshForegroundState();
    return START_STICKY;
  }

  @Nullable
  @Override
  public IBinder onBind(Intent intent) {
    return null;
  }

  @Override
  public void onDestroy() {
    if (handler != null && expiryRunnable != null) {
      handler.removeCallbacks(expiryRunnable);
    }
    releaseWakeLock();
    running = false;
    super.onDestroy();
  }

  private void expireSlotsIfNeeded() {
    boolean didExpire = false;
    long nowMs = System.currentTimeMillis();

    synchronized (SLOT_LOCK) {
      didExpire |= expireSlotIfNeeded(analysisSlot, nowMs);
      didExpire |= expireSlotIfNeeded(automationSlot, nowMs);
    }

    if (didExpire) {
      refreshForegroundState();
    } else {
      scheduleNextExpiryCheck();
    }
  }

  private static boolean expireSlotIfNeeded(ForegroundSlot slot, long nowMs) {
    if (!slot.active) {
      return false;
    }
    if (slot.expiresAtEpochMs <= 0L) {
      return false;
    }
    if (slot.expiresAtEpochMs > nowMs) {
      return false;
    }
    slot.active = false;
    slot.useWakeLock = false;
    slot.expiresAtEpochMs = 0L;
    return true;
  }

  private void scheduleNextExpiryCheck() {
    if (handler == null || expiryRunnable == null) {
      return;
    }

    long nextDelayMs = 0L;
    long nowMs = System.currentTimeMillis();

    synchronized (SLOT_LOCK) {
      nextDelayMs = computeNextExpiryDelay(nowMs);
    }

    handler.removeCallbacks(expiryRunnable);
    if (nextDelayMs > 0L) {
      handler.postDelayed(expiryRunnable, nextDelayMs);
    }
  }

  private static long computeNextExpiryDelay(long nowMs) {
    long nextExpiryAt = 0L;
    if (analysisSlot.active && analysisSlot.expiresAtEpochMs > 0L) {
      nextExpiryAt = analysisSlot.expiresAtEpochMs;
    }
    if (automationSlot.active && automationSlot.expiresAtEpochMs > 0L) {
      nextExpiryAt =
        nextExpiryAt == 0L ? automationSlot.expiresAtEpochMs : Math.min(nextExpiryAt, automationSlot.expiresAtEpochMs);
    }
    if (nextExpiryAt == 0L) {
      return 0L;
    }
    return Math.max(1_000L, nextExpiryAt - nowMs);
  }

  private void refreshForegroundState() {
    if (!hasActiveSlot()) {
      stopServiceInternal();
      return;
    }

    String title;
    String text;
    boolean wantWakeLock;

    synchronized (SLOT_LOCK) {
      ForegroundSlot analysis = analysisSlot;
      ForegroundSlot automation = automationSlot;

      title =
        analysis.active ? analysis.title : automation.title;
      text = buildCompositeText(analysis, automation);
      wantWakeLock =
        (analysis.active && analysis.useWakeLock) || (automation.active && automation.useWakeLock);
    }

    Notification notification = buildNotification(title, text);
    startForeground(NOTIFICATION_ID, notification);
    running = true;
    ensureWakeLockState(wantWakeLock);
    scheduleNextExpiryCheck();
  }

  private static String buildCompositeText(ForegroundSlot analysis, ForegroundSlot automation) {
    String analysisText = safeOrDefault(analysis != null ? analysis.text : null, "");
    String automationText = safeOrDefault(automation != null ? automation.text : null, "");

    if (analysis.active && automation.active) {
      if (!analysisText.isEmpty() && !automationText.isEmpty()) {
        return analysisText + "\n\nAutomation:\n" + automationText;
      }
      return !analysisText.isEmpty() ? analysisText : automationText;
    }

    if (analysis.active) {
      return analysisText;
    }

    return automationText;
  }

  private static String normalizeScope(String value) {
    if (value == null) {
      return SCOPE_ANALYSIS;
    }
    String normalized = value.trim();
    if (SCOPE_AUTOMATION.equals(normalized)) {
      return SCOPE_AUTOMATION;
    }
    return SCOPE_ANALYSIS;
  }

  private static String defaultTitleForScope(String scope) {
    return SCOPE_AUTOMATION.equals(scope)
      ? "MatchFlow automation running"
      : "MatchFlow analysis running";
  }

  private static String defaultTextForScope(String scope) {
    return SCOPE_AUTOMATION.equals(scope)
      ? "Automation is running in background"
      : "Analysis is running in background";
  }

  private static ForegroundSlot slotForScope(String scope) {
    return SCOPE_AUTOMATION.equals(scope) ? automationSlot : analysisSlot;
  }

  private static void updateSlot(String scope, String title, String text, boolean useWakeLock, long ttlMs) {
    long normalizedTtlMs =
      ttlMs <= 0L
        ? DEFAULT_SLOT_TTL_MS
        : Math.max(MIN_SLOT_TTL_MS, ttlMs);
    long nowMs = System.currentTimeMillis();

    synchronized (SLOT_LOCK) {
      ForegroundSlot slot = slotForScope(scope);
      slot.active = true;
      slot.title = safeOrDefault(title, defaultTitleForScope(scope));
      slot.text = safeOrDefault(text, defaultTextForScope(scope));
      slot.useWakeLock = useWakeLock;
      slot.expiresAtEpochMs = nowMs + normalizedTtlMs;
    }
  }

  private static void clearSlot(String scope) {
    synchronized (SLOT_LOCK) {
      ForegroundSlot slot = slotForScope(scope);
      slot.active = false;
      slot.useWakeLock = false;
      slot.expiresAtEpochMs = 0L;
    }
  }

  private static boolean hasActiveSlot() {
    synchronized (SLOT_LOCK) {
      return analysisSlot.active || automationSlot.active;
    }
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

  private void ensureWakeLockState(boolean wantWakeLock) {
    if (!wantWakeLock) {
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
      "MatchFlow background execution",
      NotificationManager.IMPORTANCE_LOW
    );
    channel.setDescription("Keeps MatchFlow running while analysis or automation executes in background.");
    notificationManager.createNotificationChannel(channel);
  }

  private static String safeOrDefault(String value, String fallback) {
    if (value == null) return fallback;
    String normalized = value.trim();
    if (normalized.isEmpty()) return fallback;
    return normalized;
  }
}
