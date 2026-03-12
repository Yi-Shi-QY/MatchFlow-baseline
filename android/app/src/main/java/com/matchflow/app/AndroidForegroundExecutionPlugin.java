package com.matchflow.app;

import android.content.Intent;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AndroidForegroundExecution")
public class AndroidForegroundExecutionPlugin extends Plugin {
  private static final long DEFAULT_SLOT_TTL_MS = 3 * 60 * 1000L;

  @PluginMethod
  public void start(PluginCall call) {
    String scope = call.getString("scope", "analysis");
    String title = call.getString("title", "MatchFlow analysis running");
    String text = call.getString("text", "Analysis is running in background");
    boolean useWakeLock = call.getBoolean("useWakeLock", false);
    long ttlMs = call.getLong("ttlMs", DEFAULT_SLOT_TTL_MS);

    Intent intent = AnalysisForegroundService.buildStartOrUpdateIntent(
      getContext(),
      scope,
      title,
      text,
      useWakeLock,
      ttlMs
    );

    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        getContext().startForegroundService(intent);
      } else {
        getContext().startService(intent);
      }
      JSObject result = new JSObject();
      result.put("running", true);
      call.resolve(result);
    } catch (Exception ex) {
      call.reject("Failed to start Android foreground execution service", ex);
    }
  }

  @PluginMethod
  public void stop(PluginCall call) {
    String scope = call.getString("scope", "analysis");

    if (!AnalysisForegroundService.isServiceRunning()) {
      JSObject result = new JSObject();
      result.put("running", false);
      call.resolve(result);
      return;
    }

    try {
      // Use an intent so the service can keep running for other scopes (analysis vs automation).
      Intent intent = AnalysisForegroundService.buildStopIntent(getContext(), scope);
      getContext().startService(intent);
    } catch (Exception ignored) {
      // Ignore stop failures when service is not running.
    }

    JSObject result = new JSObject();
    result.put("running", AnalysisForegroundService.isServiceRunning());
    call.resolve(result);
  }

  @PluginMethod
  public void isRunning(PluginCall call) {
    JSObject result = new JSObject();
    result.put("running", AnalysisForegroundService.isServiceRunning());
    call.resolve(result);
  }
}
