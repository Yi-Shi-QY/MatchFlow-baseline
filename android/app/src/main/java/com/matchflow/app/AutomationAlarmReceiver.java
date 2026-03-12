package com.matchflow.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import org.json.JSONException;
import org.json.JSONObject;

public class AutomationAlarmReceiver extends BroadcastReceiver {
  private static final long HOST_SLOT_TTL_MS = 5 * 60 * 1000L;

  @Override
  public void onReceive(Context context, Intent intent) {
    long firedAtEpochMs = System.currentTimeMillis();
    JSONObject wakeEvent = new JSONObject();

    // Be aggressive about keeping the process alive while the JS runtime wakes up.
    // This scope will be refreshed by the JS-side automation host once the webview is ready,
    // otherwise it will auto-expire via TTL.
    try {
      String scheduleKind = safeString(intent.getStringExtra(AutomationSchedulerPlugin.EXTRA_SCHEDULE_KIND));
      String scheduleTitle = safeString(intent.getStringExtra(AutomationSchedulerPlugin.EXTRA_TITLE));
      String title = "MatchFlow automation running";
      String text = "Triggered by schedule.";
      if (!scheduleKind.isEmpty() || !scheduleTitle.isEmpty()) {
        text =
          (scheduleKind.isEmpty() ? "" : ("Wake: " + scheduleKind)) +
          (scheduleKind.isEmpty() || scheduleTitle.isEmpty() ? "" : "\n") +
          (scheduleTitle.isEmpty() ? "" : ("Task: " + scheduleTitle));
      }

      Intent hostIntent = AnalysisForegroundService.buildStartOrUpdateIntent(
        context,
        "automation",
        title,
        text,
        true,
        HOST_SLOT_TTL_MS
      );

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(hostIntent);
      } else {
        context.startService(hostIntent);
      }
    } catch (Exception ignored) {
      // Ignore foreground host failures (e.g. OEM restrictions) and continue to enqueue the wake event.
    }

    try {
      wakeEvent.put("id", safeString(intent.getStringExtra(AutomationSchedulerPlugin.EXTRA_SCHEDULE_ID)));
      wakeEvent.put("kind", safeString(intent.getStringExtra(AutomationSchedulerPlugin.EXTRA_SCHEDULE_KIND)));
      wakeEvent.put("sourceId", safeString(intent.getStringExtra(AutomationSchedulerPlugin.EXTRA_SOURCE_ID)));
      wakeEvent.put("title", safeString(intent.getStringExtra(AutomationSchedulerPlugin.EXTRA_TITLE)));
      wakeEvent.put("domainId", safeString(intent.getStringExtra(AutomationSchedulerPlugin.EXTRA_DOMAIN_ID)));
      wakeEvent.put("route", safeString(intent.getStringExtra(AutomationSchedulerPlugin.EXTRA_ROUTE)));
      wakeEvent.put(
        "triggerAtEpochMs",
        intent.getLongExtra(AutomationSchedulerPlugin.EXTRA_TRIGGER_AT_EPOCH_MS, -1L)
      );
      wakeEvent.put("firedAtEpochMs", firedAtEpochMs);
    } catch (JSONException ignored) {
      return;
    }

    AutomationSchedulerStore.enqueuePendingWakeEvent(context, wakeEvent);

    Intent wakeBroadcast = new Intent(AutomationSchedulerPlugin.ACTION_AUTOMATION_WAKE_BROADCAST);
    wakeBroadcast.setPackage(context.getPackageName());
    wakeBroadcast.putExtra(
      AutomationSchedulerPlugin.EXTRA_SCHEDULE_ID,
      wakeEvent.optString("id", "")
    );
    wakeBroadcast.putExtra(
      AutomationSchedulerPlugin.EXTRA_SCHEDULE_KIND,
      wakeEvent.optString("kind", "")
    );
    wakeBroadcast.putExtra(
      AutomationSchedulerPlugin.EXTRA_SOURCE_ID,
      wakeEvent.optString("sourceId", "")
    );
    wakeBroadcast.putExtra(
      AutomationSchedulerPlugin.EXTRA_TITLE,
      wakeEvent.optString("title", "")
    );
    wakeBroadcast.putExtra(
      AutomationSchedulerPlugin.EXTRA_DOMAIN_ID,
      wakeEvent.optString("domainId", "")
    );
    wakeBroadcast.putExtra(
      AutomationSchedulerPlugin.EXTRA_ROUTE,
      wakeEvent.optString("route", "")
    );
    wakeBroadcast.putExtra(
      AutomationSchedulerPlugin.EXTRA_TRIGGER_AT_EPOCH_MS,
      wakeEvent.optLong("triggerAtEpochMs", -1L)
    );
    wakeBroadcast.putExtra(
      AutomationSchedulerPlugin.EXTRA_FIRED_AT_EPOCH_MS,
      firedAtEpochMs
    );
    context.sendBroadcast(wakeBroadcast);
  }

  private static String safeString(String value) {
    if (value == null) {
      return "";
    }
    return value.trim();
  }
}
