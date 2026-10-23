package app.web.masjidala;

import static org.junit.Assert.*;

import android.util.Log;
import android.os.SystemClock;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONObject;
import org.junit.Assume;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Opt-in smoke check using Android's actual TLS stack; requires Internet access. */
@RunWith(AndroidJUnit4.class)
public class UpdaterEndpointDiagnosticTest {
    @Test
    public void freshBaselineLaunchShowsAnUpdateOffer() throws Exception {
        Assume.assumeTrue("Use -e updaterStartup true with a lower-version baseline",
            "true".equals(InstrumentationRegistry.getArguments().getString("updaterStartup")));
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            String lastDom = "";
            for (int attempt = 0; attempt < 15; attempt++) {
                SystemClock.sleep(1000);
                CountDownLatch done = new CountDownLatch(1);
                AtomicReference<String> dom = new AtomicReference<>("");
                scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(
                    "JSON.stringify({text:document.body.innerText,dialogs:document.querySelectorAll('ion-alert').length})",
                    result -> { dom.set(result); done.countDown(); }));
                assertTrue("WebView callback timed out", done.await(5, TimeUnit.SECONDS));
                lastDom = dom.get();
                if (lastDom.contains("Kemas Kini Aplikasi Tersedia")) return;
            }
            Log.i("UpdaterDiagnostic", "Last startup DOM: " + lastDom);
            fail("No update offer appeared within 15 seconds; see Chromium updater logs");
        }
    }

    @Test
    public void liveMetadataAndGitHubAreReachable() throws Exception {
        Assume.assumeTrue("Use -e updaterLive true for the live endpoint check",
            "true".equals(InstrumentationRegistry.getArguments().getString("updaterLive")));
        AppUpdaterPlugin plugin = new AppUpdaterPlugin();
        Method json = AppUpdaterPlugin.class.getDeclaredMethod("json", String.class);
        json.setAccessible(true);
        try {
            JSONObject metadata = (JSONObject) json.invoke(plugin,
                "https://oc-manli.duckdns.org/masjidala/output-metadata.json");
            JSONObject release = (JSONObject) json.invoke(plugin,
                "https://api.github.com/repos/manli03/Masjid-Al-A-la-Main/releases/latest");
            assertEquals("app.web.masjidala", metadata.getString("applicationId"));
            assertFalse(release.getBoolean("draft"));
            assertFalse(release.getBoolean("prerelease"));
            JSONObject version = metadata.getJSONArray("elements").getJSONObject(0);
            Log.i("UpdaterDiagnostic", "Metadata version=" + version.getString("versionName") +
                " code=" + version.getLong("versionCode") + " GitHub tag=" + release.getString("tag_name"));
            assertTrue(release.getJSONArray("assets").length() > 0);
        } catch (InvocationTargetException error) {
            throw new Exception("Android updater endpoint failed: " + error.getCause(), error.getCause());
        }
    }
}
