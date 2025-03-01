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

  @Override
  protected void onActivityResult(int requestCode, int resultCode, Intent data) {
    super.onActivityResult(requestCode, resultCode, data);

    if (requestCode == GpsEnablerPlugin.REQUEST_CHECK_SETTINGS) {
      if (resultCode == Activity.RESULT_OK) {
        // GPS enabled
        if (bridge != null) {
          bridge.triggerWindowJSEvent("onGpsEnabled");
        }
      } else {
        // GPS not enabled
        if (bridge != null) {
          bridge.triggerWindowJSEvent("onGpsDisabled");
        }
      }
    }
  }
}
