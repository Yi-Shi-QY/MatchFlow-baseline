package com.matchflow.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.HashSet;
import java.util.Iterator;
import java.util.Set;

@CapacitorPlugin(name = "AutomationScheduler")
public class AutomationSchedulerPlugin extends Plugin {
  public static final String ACTION_AUTOMATION_WAKE_BROADCAST =
    "com.matchflow.app.action.AUTOMATION_WAKE";
  public static final String EXTRA_SCHEDULE_ID = "scheduleId";
  public static final String EXTRA_SCHEDULE_KIND = "scheduleKind";
  public static final String EXTRA_SOURCE_ID = "sourceId";
  public static final String EXTRA_TITLE = "title";
  public static final String EXTRA_DOMAIN_ID = "domainId";
  public static final String EXTRA_ROUTE = "route";
  public static final String EXTRA_TRIGGER_AT_EPOCH_MS = "triggerAtEpochMs";
  public static final String EXTRA_FIRED_AT_EPOCH_MS = "firedAtEpochMs";
  private static final String EVENT_AUTOMATION_WAKE = "automationWake";
  private static final long MIN_TRIGGER_LEAD_MS = 1_000L;

  private BroadcastReceiver wakeReceiver;

  @Override
  public void load() {
    wakeReceiver =
      new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
          JSObject payload = buildWakePayload(intent);
          String id = payload.optString("id", "");
          long firedAtEpochMs = payload.optLong("firedAtEpochMs", -1L);

          if (!id.isEmpty() && firedAtEpochMs >= 0L) {
            AutomationSchedulerStore.removePendingWakeEvent(
              context,
              id,
              firedAtEpochMs
            );
          }

          notifyListeners(EVENT_AUTOMATION_WAKE, payload, true);
        }
      };

    IntentFilter filter = new IntentFilter(ACTION_AUTOMATION_WAKE_BROADCAST);
    ContextCompat.registerReceiver(
      getContext(),
      wakeReceiver,
      filter,
      ContextCompat.RECEIVER_NOT_EXPORTED
    );
  }

  @Override
  protected void handleOnDestroy() {
    if (wakeReceiver != null) {
      try {
        getContext().unregisterReceiver(wakeReceiver);
      } catch (IllegalArgumentException ignored) {
        // Ignore already-unregistered receiver teardown.
      }
      wakeReceiver = null;
    }
    super.handleOnDestroy();
  }

  @PluginMethod
  public void getCapabilities(PluginCall call) {
    AlarmManager alarmManager = getAlarmManager();
    JSObject result = new JSObject();
    result.put("supported", alarmManager != null);
    result.put("platform", "android");
    result.put("durableHost", true);
    result.put("canScheduleExactAlarms", canScheduleExactAlarms(alarmManager));
    result.put(
      "exactAlarmPermissionState",
      resolveExactAlarmPermissionState(alarmManager)
    );
    call.resolve(result);
  }

  @PluginMethod
  public void replaceSchedules(PluginCall call) {
    JSArray inputEntries = call.getArray("entries");
    if (inputEntries == null) {
      inputEntries = new JSArray();
    }

    int cancelledCount = cancelStoredSchedules();
    JSONArray scheduledEntries = new JSONArray();
    int scheduledCount = 0;

    for (int index = 0; index < inputEntries.length(); index += 1) {
      JSONObject rawEntry = inputEntries.optJSONObject(index);
      JSONObject normalizedEntry = normalizeScheduleEntry(rawEntry);
      if (normalizedEntry == null) {
        continue;
      }

      if (scheduleEntry(normalizedEntry)) {
        scheduledEntries.put(normalizedEntry);
        scheduledCount += 1;
      }
    }

    AutomationSchedulerStore.saveScheduledEntries(getContext(), scheduledEntries);

    JSObject result = new JSObject();
    result.put("scheduledCount", scheduledCount);
    result.put("cancelledCount", cancelledCount);
    call.resolve(result);
  }

  @PluginMethod
  public void cancelSchedules(PluginCall call) {
    JSArray ids = call.getArray("ids");
    Set<String> cancelledIds = new HashSet<>();

    if (ids != null) {
      for (int index = 0; index < ids.length(); index += 1) {
        String id = safeString(ids.optString(index, ""));
        if (!id.isEmpty()) {
          cancelledIds.add(id);
        }
      }
    }

    if (cancelledIds.isEmpty()) {
      JSObject result = new JSObject();
      result.put("cancelledCount", 0);
      call.resolve(result);
      return;
    }

    JSONArray current = AutomationSchedulerStore.loadScheduledEntries(getContext());
    JSONArray next = new JSONArray();
    int cancelledCount = 0;

    for (int index = 0; index < current.length(); index += 1) {
      JSONObject entry = current.optJSONObject(index);
      if (entry == null) {
        continue;
      }

      String id = safeString(entry.optString("id", ""));
      if (cancelledIds.contains(id)) {
        cancelEntry(entry);
        cancelledCount += 1;
        continue;
      }

      next.put(entry);
    }

    AutomationSchedulerStore.saveScheduledEntries(getContext(), next);

    JSObject result = new JSObject();
    result.put("cancelledCount", cancelledCount);
    call.resolve(result);
  }

  @PluginMethod
  public void cancelAll(PluginCall call) {
    int cancelledCount = cancelStoredSchedules();

    JSObject result = new JSObject();
    result.put("cancelledCount", cancelledCount);
    call.resolve(result);
  }

  @PluginMethod
  public void listSchedules(PluginCall call) {
    JSONArray scheduledEntries = AutomationSchedulerStore.loadScheduledEntries(getContext());
    JSObject result = new JSObject();
    result.put("entries", toJSArray(scheduledEntries));
    call.resolve(result);
  }

  @PluginMethod
  public void consumePendingWakeEvents(PluginCall call) {
    JSONArray events = AutomationSchedulerStore.consumePendingWakeEvents(getContext());
    JSObject result = new JSObject();
    result.put("events", toJSArray(events));
    call.resolve(result);
  }

  private int cancelStoredSchedules() {
    JSONArray current = AutomationSchedulerStore.loadScheduledEntries(getContext());
    int cancelledCount = 0;

    for (int index = 0; index < current.length(); index += 1) {
      JSONObject entry = current.optJSONObject(index);
      if (entry == null) {
        continue;
      }

      cancelEntry(entry);
      cancelledCount += 1;
    }

    AutomationSchedulerStore.saveScheduledEntries(getContext(), new JSONArray());
    return cancelledCount;
  }

  private JSONObject normalizeScheduleEntry(JSONObject rawEntry) {
    if (rawEntry == null) {
      return null;
    }

    String id = safeString(rawEntry.optString("id", ""));
    String kind = safeString(rawEntry.optString("kind", ""));
    String sourceId = safeString(rawEntry.optString("sourceId", ""));
    String title = safeString(rawEntry.optString("title", ""));
    String domainId = safeString(rawEntry.optString("domainId", ""));
    String route = safeString(rawEntry.optString("route", ""));
    long triggerAtEpochMs = rawEntry.optLong("triggerAtEpochMs", -1L);

    if (
      id.isEmpty() ||
      kind.isEmpty() ||
      sourceId.isEmpty() ||
      title.isEmpty() ||
      domainId.isEmpty() ||
      route.isEmpty() ||
      triggerAtEpochMs <= 0L
    ) {
      return null;
    }

    JSONObject normalizedEntry = new JSONObject();
    try {
      normalizedEntry.put("id", id);
      normalizedEntry.put("kind", kind);
      normalizedEntry.put("sourceId", sourceId);
      normalizedEntry.put("title", title);
      normalizedEntry.put("domainId", domainId);
      normalizedEntry.put("route", route);
      normalizedEntry.put(
        "triggerAtEpochMs",
        Math.max(triggerAtEpochMs, System.currentTimeMillis() + MIN_TRIGGER_LEAD_MS)
      );
    } catch (JSONException ignored) {
      return null;
    }

    return normalizedEntry;
  }

  private boolean scheduleEntry(JSONObject entry) {
    AlarmManager alarmManager = getAlarmManager();
    if (alarmManager == null) {
      return false;
    }

    PendingIntent pendingIntent = buildPendingIntent(entry);
    if (pendingIntent == null) {
      return false;
    }

    long triggerAtEpochMs = entry.optLong("triggerAtEpochMs", -1L);
    if (triggerAtEpochMs <= 0L) {
      return false;
    }

    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        if (canScheduleExactAlarms(alarmManager)) {
          alarmManager.setExactAndAllowWhileIdle(
            AlarmManager.RTC_WAKEUP,
            triggerAtEpochMs,
            pendingIntent
          );
        } else {
          alarmManager.setAndAllowWhileIdle(
            AlarmManager.RTC_WAKEUP,
            triggerAtEpochMs,
            pendingIntent
          );
        }
      } else if (canScheduleExactAlarms(alarmManager)) {
        alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAtEpochMs, pendingIntent);
      } else {
        alarmManager.set(AlarmManager.RTC_WAKEUP, triggerAtEpochMs, pendingIntent);
      }
      return true;
    } catch (SecurityException ex) {
      return false;
    }
  }

  private void cancelEntry(JSONObject entry) {
    AlarmManager alarmManager = getAlarmManager();
    PendingIntent pendingIntent = buildPendingIntent(entry);
    if (alarmManager == null || pendingIntent == null) {
      return;
    }
    alarmManager.cancel(pendingIntent);
    pendingIntent.cancel();
  }

  private PendingIntent buildPendingIntent(JSONObject entry) {
    String id = safeString(entry.optString("id", ""));
    if (id.isEmpty()) {
      return null;
    }

    Intent intent = new Intent(getContext(), AutomationAlarmReceiver.class);
    intent.putExtra(EXTRA_SCHEDULE_ID, id);
    intent.putExtra(EXTRA_SCHEDULE_KIND, safeString(entry.optString("kind", "")));
    intent.putExtra(EXTRA_SOURCE_ID, safeString(entry.optString("sourceId", "")));
    intent.putExtra(EXTRA_TITLE, safeString(entry.optString("title", "")));
    intent.putExtra(EXTRA_DOMAIN_ID, safeString(entry.optString("domainId", "")));
    intent.putExtra(EXTRA_ROUTE, safeString(entry.optString("route", "")));
    intent.putExtra(EXTRA_TRIGGER_AT_EPOCH_MS, entry.optLong("triggerAtEpochMs", -1L));

    int requestCode = stableRequestCode(id);
    int flags = PendingIntent.FLAG_UPDATE_CURRENT;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      flags |= PendingIntent.FLAG_IMMUTABLE;
    }

    return PendingIntent.getBroadcast(
      getContext(),
      requestCode,
      intent,
      flags
    );
  }

  private AlarmManager getAlarmManager() {
    return (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
  }

  private boolean canScheduleExactAlarms(AlarmManager alarmManager) {
    if (alarmManager == null) {
      return false;
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      return alarmManager.canScheduleExactAlarms();
    }

    return true;
  }

  private String resolveExactAlarmPermissionState(AlarmManager alarmManager) {
    if (alarmManager == null) {
      return "unsupported";
    }

    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
      return "not_required";
    }

    return alarmManager.canScheduleExactAlarms() ? "granted" : "denied";
  }

  private JSObject buildWakePayload(Intent intent) {
    JSObject payload = new JSObject();
    payload.put("id", safeString(intent.getStringExtra(EXTRA_SCHEDULE_ID)));
    payload.put("kind", safeString(intent.getStringExtra(EXTRA_SCHEDULE_KIND)));
    payload.put("sourceId", safeString(intent.getStringExtra(EXTRA_SOURCE_ID)));
    payload.put("title", safeString(intent.getStringExtra(EXTRA_TITLE)));
    payload.put("domainId", safeString(intent.getStringExtra(EXTRA_DOMAIN_ID)));
    payload.put("route", safeString(intent.getStringExtra(EXTRA_ROUTE)));
    payload.put(
      "triggerAtEpochMs",
      intent.getLongExtra(EXTRA_TRIGGER_AT_EPOCH_MS, -1L)
    );
    payload.put(
      "firedAtEpochMs",
      intent.getLongExtra(EXTRA_FIRED_AT_EPOCH_MS, -1L)
    );
    return payload;
  }

  private JSArray toJSArray(JSONArray source) {
    JSArray result = new JSArray();
    if (source == null) {
      return result;
    }

    for (int index = 0; index < source.length(); index += 1) {
      Object value = source.opt(index);
      if (value instanceof JSONObject) {
        result.put(toJSObject((JSONObject) value));
      } else if (value instanceof JSONArray) {
        result.put(toJSArray((JSONArray) value));
      } else {
        result.put(value);
      }
    }
    return result;
  }

  private JSObject toJSObject(JSONObject source) {
    JSObject result = new JSObject();
    if (source == null) {
      return result;
    }

    Iterator<String> keys = source.keys();
    while (keys.hasNext()) {
      String key = keys.next();
      Object value = source.opt(key);
      if (value instanceof JSONObject) {
        result.put(key, toJSObject((JSONObject) value));
      } else if (value instanceof JSONArray) {
        result.put(key, toJSArray((JSONArray) value));
      } else {
        result.put(key, value);
      }
    }

    return result;
  }

  private static String safeString(String value) {
    if (value == null) {
      return "";
    }
    return value.trim();
  }

  private static int stableRequestCode(String id) {
    return Math.abs(id.hashCode() == Integer.MIN_VALUE ? 0 : id.hashCode());
  }
}
