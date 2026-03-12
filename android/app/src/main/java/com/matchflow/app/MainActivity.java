package com.matchflow.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(AndroidForegroundExecutionPlugin.class);
    registerPlugin(AutomationSchedulerPlugin.class);
    super.onCreate(savedInstanceState);
  }
}
