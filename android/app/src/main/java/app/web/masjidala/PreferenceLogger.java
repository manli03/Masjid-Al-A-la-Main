package app.web.masjidala;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import java.io.File;
import java.util.Map;

public class PreferenceLogger {

  public static void logAllPreferences(Context context) {
    File sharedPrefsDir = new File(context.getApplicationInfo().dataDir, "shared_prefs");

    if (sharedPrefsDir.exists() && sharedPrefsDir.isDirectory()) {
      File[] files = sharedPrefsDir.listFiles((dir, name) -> name.endsWith(".xml"));

      if (files != null) {
        for (File file : files) {
          String prefName = file.getName().replace(".xml", "");
          SharedPreferences prefs = context.getSharedPreferences(prefName, Context.MODE_PRIVATE);
          Map<String, ?> allPrefs = prefs.getAll();

          Log.d("Prefs", "=== Preferences in: " + prefName + " ===");
          for (Map.Entry<String, ?> entry : allPrefs.entrySet()) {
            Log.d("Prefs", entry.getKey() + " = " + entry.getValue());
          }
        }
      } else {
        Log.d("Prefs", "No shared preferences files found.");
      }
    } else {
      Log.d("Prefs", "Shared preferences directory does not exist.");
    }
  }
}
