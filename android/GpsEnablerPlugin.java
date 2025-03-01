package com.mjidala.prayer.plugins.gpsenabler;

import android.app.Activity;
import android.content.Context;
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

        // Create location request
        LocationRequest locationRequest = LocationRequest.create();
        locationRequest.setPriority(LocationRequest.PRIORITY_HIGH_ACCURACY);

        // Build settings request
        LocationSettingsRequest.Builder builder = new LocationSettingsRequest.Builder()
                .addLocationRequest(locationRequest);

        // Check location settings
        Task<LocationSettingsResponse> task = LocationServices.getSettingsClient(context)
                .checkLocationSettings(builder.build());

        task.addOnSuccessListener(activity, locationSettingsResponse -> {
            // GPS is already enabled
            call.resolve();
        });

        task.addOnFailureListener(activity, e -> {
            if (e instanceof com.google.android.gms.common.api.ResolvableApiException) {
                // Show the native Google Play Services dialog
                try {
                    ((com.google.android.gms.common.api.ResolvableApiException) e)
                        .startResolutionForResult(activity, REQUEST_CHECK_SETTINGS);
                } catch (Exception sendEx) {
                    call.reject("Failed to show GPS dialog");
                }
            } else {
                call.reject("Location services not available");
            }
        });
    }
}
