package com.mjidala.prayer.plugins.gpsenabler;

import android.app.Activity;
import android.content.Context;
import android.location.LocationManager;
import android.util.Log;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.LocationSettingsRequest;
import com.google.android.gms.location.LocationSettingsResponse;
import com.google.android.gms.tasks.Task;

@CapacitorPlugin(name = "GpsEnabler")
public class GpsEnablerPlugin extends Plugin {

    public static final int REQUEST_CHECK_SETTINGS = 1001;

  @PluginMethod
  public void showGpsDialog(PluginCall call) {
    Activity activity = getActivity();
    Context context = getContext();

    Log.d("GpsEnablerPlugin", "showGpsDialog() called");

    // Create location request with the new builder method
    LocationRequest locationRequest = new LocationRequest.Builder(
      LocationRequest.PRIORITY_HIGH_ACCURACY, 10000)
      .build();

    LocationSettingsRequest.Builder builder = new LocationSettingsRequest.Builder()
      .addLocationRequest(locationRequest)
      .setAlwaysShow(true); // Force GPS dialog to appear

    Task<LocationSettingsResponse> task = LocationServices.getSettingsClient(context)
      .checkLocationSettings(builder.build());

    task.addOnSuccessListener(activity, locationSettingsResponse -> {
      Log.d("GpsEnablerPlugin", "GPS already enabled");
      call.resolve();
    });

    task.addOnFailureListener(activity, e -> {
      if (e instanceof com.google.android.gms.common.api.ResolvableApiException) {
        Log.d("GpsEnablerPlugin", "Showing GPS dialog");
        try {
          ((com.google.android.gms.common.api.ResolvableApiException) e)
            .startResolutionForResult(activity, REQUEST_CHECK_SETTINGS);
          call.resolve();
        } catch (Exception sendEx) {
          call.reject("Failed to show GPS dialog: " + sendEx.getMessage());
        }
      } else {
        call.reject("Location services not available");
      }
    });
  }


  @PluginMethod
    public void isGpsEnabled(PluginCall call) {
        Context context = getContext();
        Log.d("GpsEnablerPlugin", "isGpsEnabled() called");

        LocationManager locationManager = (LocationManager) context.getSystemService(Context.LOCATION_SERVICE);
        boolean isGpsEnabled = locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER);

        if (isGpsEnabled) {
          Log.d("GpsEnablerPlugin", "gps enabled");
          bridge.triggerWindowJSEvent("onGpsEnabled");
        } else {
          Log.d("GpsEnablerPlugin", "gps disabled");
          bridge.triggerWindowJSEvent("onGpsDisabled");
        }
    }
}
