package com.mjidala.prayer;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.mjidala.prayer.plugins.gpsenabler.GpsEnablerPlugin;

public class MainActivity extends BridgeActivity {

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    registerPlugin(GpsEnablerPlugin.class);
  }
}
