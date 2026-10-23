package app.web.masjidala;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(AndroidAudio.class);
        registerPlugin(AppUpdaterPlugin.class);
        normalizeDeepLink(getIntent());
        super.onCreate(savedInstanceState);
    }

    // Use Capacitor launch URL and appUrlOpen APIs, including before JavaScript is ready.
    private void normalizeDeepLink(Intent intent) {
        if (intent == null || !intent.hasExtra("deep_link")) return;
        String link = intent.getStringExtra("deep_link");
        if (link == null || link.isEmpty()) return;
        intent.setAction(Intent.ACTION_VIEW);
        intent.setData(Uri.parse(link.startsWith("/") ? "https://masjidala.web.app" + link : link));
    }

    @Override
    protected void onNewIntent(Intent intent) {
        normalizeDeepLink(intent);
        super.onNewIntent(intent);
        setIntent(intent);
    }
}
