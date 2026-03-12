package com.matchflow.app;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public final class AutomationSchedulerStore {
  private static final String PREFERENCES_NAME = "matchflow_automation_scheduler_v1";
  private static final String KEY_SCHEDULED_ENTRIES = "scheduled_entries";
  private static final String KEY_PENDING_WAKE_EVENTS = "pending_wake_events";
  private static final int MAX_PENDING_WAKE_EVENTS = 32;

  private AutomationSchedulerStore() {}

  public static synchronized JSONArray loadScheduledEntries(Context context) {
    return readJsonArray(context, KEY_SCHEDULED_ENTRIES);
  }

  public static synchronized void saveScheduledEntries(Context context, JSONArray entries) {
    writeJsonArray(context, KEY_SCHEDULED_ENTRIES, entries);
  }

  public static synchronized JSONArray consumePendingWakeEvents(Context context) {
    JSONArray events = readJsonArray(context, KEY_PENDING_WAKE_EVENTS);
    writeJsonArray(context, KEY_PENDING_WAKE_EVENTS, new JSONArray());
    return events;
  }

  public static synchronized void enqueuePendingWakeEvent(Context context, JSONObject event) {
    JSONArray events = readJsonArray(context, KEY_PENDING_WAKE_EVENTS);
    JSONArray next = new JSONArray();
    int startIndex = Math.max(0, events.length() - MAX_PENDING_WAKE_EVENTS + 1);

    for (int index = startIndex; index < events.length(); index += 1) {
      JSONObject existing = events.optJSONObject(index);
      if (existing != null) {
        next.put(existing);
      }
    }

    next.put(event);
    writeJsonArray(context, KEY_PENDING_WAKE_EVENTS, next);
  }

  public static synchronized void removePendingWakeEvent(
    Context context,
    String id,
    long firedAtEpochMs
  ) {
    JSONArray events = readJsonArray(context, KEY_PENDING_WAKE_EVENTS);
    JSONArray next = new JSONArray();

    for (int index = 0; index < events.length(); index += 1) {
      JSONObject event = events.optJSONObject(index);
      if (event == null) {
        continue;
      }

      String eventId = event.optString("id", "");
      long eventFiredAtEpochMs = event.optLong("firedAtEpochMs", -1L);
      if (id.equals(eventId) && firedAtEpochMs == eventFiredAtEpochMs) {
        continue;
      }

      next.put(event);
    }

    writeJsonArray(context, KEY_PENDING_WAKE_EVENTS, next);
  }

  private static JSONArray readJsonArray(Context context, String key) {
    SharedPreferences preferences = context.getSharedPreferences(
      PREFERENCES_NAME,
      Context.MODE_PRIVATE
    );
    String raw = preferences.getString(key, "[]");
    if (raw == null || raw.trim().isEmpty()) {
      return new JSONArray();
    }

    try {
      return new JSONArray(raw);
    } catch (JSONException ignored) {
      return new JSONArray();
    }
  }

  private static void writeJsonArray(Context context, String key, JSONArray entries) {
    SharedPreferences preferences = context.getSharedPreferences(
      PREFERENCES_NAME,
      Context.MODE_PRIVATE
    );
    preferences.edit().putString(key, entries.toString()).apply();
  }
}
