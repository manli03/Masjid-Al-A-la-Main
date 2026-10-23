package app.web.masjidala;

import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.StatFs;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.net.URL;
import java.security.MessageDigest;
import java.security.cert.X509Certificate;
import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLContext;

/** Server-hosted build metadata paired with signed APKs and digests from GitHub Releases. */
@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private JSONObject offered;
    private String verifiedFile = "";
    private volatile boolean foreground = true;

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences("app-updater", Context.MODE_PRIVATE);
    }

    private DownloadManager downloads() {
        return (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
    }

    private File directory() throws Exception {
        File base = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        if (base == null) throw new Exception("Update storage unavailable");
        File dir = new File(base, "updates");
        if (!dir.isDirectory() && !dir.mkdirs()) throw new Exception("Cannot create update directory");
        return dir;
    }

    private File apk() throws Exception { return new File(directory(), "update.apk"); }

    @SuppressWarnings("deprecation")
    private long version(PackageInfo info) {
        return Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode;
    }

    private PackageInfo installed() throws Exception {
        return getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
    }

    private void run(PluginCall call, Checked action) {
        worker.execute(() -> {
            try { action.run(); } catch (Exception e) { call.reject(e.getMessage(), e); }
        });
    }
    private interface Checked { void run() throws Exception; }

    private boolean trusted(URL url) {
        String host = url.getHost().toLowerCase(Locale.ROOT);
        return "https".equals(url.getProtocol()) && (url.getPort() == -1 || url.getPort() == 443)
            && url.getUserInfo() == null && (host.equals("api.github.com") || host.equals("github.com")
            || (host.equals("oc-manli.duckdns.org") && url.getPath().equals("/masjidala/output-metadata.json"))
            || host.equals("release-assets.githubusercontent.com")
            || host.equals("objects.githubusercontent.com"));
    }

    private JSONObject json(String address) throws Exception {
        URL url = new URL(address);
        // Explicit TLS and DNS verification: the existing ssl-skip plugin changes global defaults.
        SSLContext tls = SSLContext.getInstance("TLS");
        tls.init(null, null, null);
        for (int redirects = 0; redirects < 6; redirects++) {
            if (!trusted(url)) throw new Exception("Untrusted update URL");
            HttpsURLConnection connection = (HttpsURLConnection) url.openConnection();
            connection.setSSLSocketFactory(tls.getSocketFactory());
            connection.setHostnameVerifier((host, session) -> {
                try {
                    X509Certificate cert = (X509Certificate) session.getPeerCertificates()[0];
                    Collection<List<?>> names = cert.getSubjectAlternativeNames();
                    if (names == null) return false;
                    for (List<?> name : names) {
                        if (!Integer.valueOf(2).equals(name.get(0))) continue;
                        String dns = name.get(1).toString().toLowerCase(Locale.ROOT);
                        if (host.equalsIgnoreCase(dns)) return true;
                        if (dns.startsWith("*.") && host.indexOf('.') > 0 &&
                            host.substring(host.indexOf('.')).equalsIgnoreCase(dns.substring(1))) return true;
                    }
                } catch (Exception ignored) { /* Fail closed. */ }
                return false;
            });
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(20000);
            connection.setInstanceFollowRedirects(false);
            connection.setRequestProperty("Accept", "application/vnd.github+json");
            connection.setRequestProperty("User-Agent", "Masjid-Ala-Updater");
            connection.setRequestProperty("Cache-Control", "no-cache");
            try {
                int code = connection.getResponseCode();
                if (code == 301 || code == 302 || code == 303 || code == 307 || code == 308) {
                    url = new URL(url, connection.getHeaderField("Location"));
                    continue;
                }
                if (code != 200) throw new Exception("Update server returned HTTP " + code);
                try (InputStream input = connection.getInputStream();
                     ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                    byte[] buffer = new byte[8192];
                    int count;
                    while ((count = input.read(buffer)) != -1) {
                        output.write(buffer, 0, count);
                        if (output.size() > 2 * 1024 * 1024) throw new Exception("Release metadata too large");
                    }
                    return new JSONObject(output.toString("UTF-8"));
                }
            } finally { connection.disconnect(); }
        }
        throw new Exception("Too many update redirects");
    }

    @PluginMethod
    public void getRelease(PluginCall call) {
        run(call, () -> {
            offered = null;
            String repository = getContext().getString(R.string.update_repository);
            if (!repository.matches("[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+")) throw new Exception("Invalid release repository");
            JSONObject metadata = json(getContext().getString(R.string.update_metadata_url));
            if (!getContext().getPackageName().equals(metadata.getString("applicationId")))
                throw new Exception("Release belongs to another application");
            JSONArray elements = metadata.getJSONArray("elements");
            if (elements.length() != 1 || elements.getJSONObject(0).getJSONArray("filters").length() != 0)
                throw new Exception("Publish a single universal APK");
            JSONObject element = elements.getJSONObject(0);
            long code = element.getLong("versionCode");
            if (code <= version(installed())) { call.resolve(new JSObject()); return; }
            if (metadata.optInt("minSdkVersionForDexing", 24) > Build.VERSION.SDK_INT)
                throw new Exception("This release requires a newer Android version");
            JSONObject release = json("https://api.github.com/repos/" + repository + "/releases/latest");
            if (release.optBoolean("draft") || release.optBoolean("prerelease")) throw new Exception("Release is not stable");
            JSONArray assets = release.getJSONArray("assets");
            JSONObject apkAsset = asset(assets, element.getString("outputFile"));
            String digest = apkAsset.optString("digest");
            if (!digest.matches("sha256:[a-fA-F0-9]{64}")) throw new Exception("GitHub SHA-256 digest unavailable");
            URL url = new URL(apkAsset.getString("browser_download_url"));
            if (!trusted(url) || !url.getPath().startsWith("/" + repository + "/releases/download/"))
                throw new Exception("Unexpected APK release URL");
            long size = apkAsset.getLong("size");
            if (size <= 0) throw new Exception("Invalid APK size");
            offered = new JSONObject().put("versionCode", code).put("versionName", element.getString("versionName"))
                .put("size", size).put("notes", release.optString("body", ""))
                .put("url", url.toString()).put("sha256", digest.substring(7).toLowerCase(Locale.ROOT));
            call.resolve(new JSObject().put("release", offered));
        });
    }

    private JSONObject asset(JSONArray assets, String name) throws Exception {
        JSONObject found = null;
        for (int i = 0; i < assets.length(); i++) {
            JSONObject item = assets.getJSONObject(i);
            if (name.equals(item.getString("name"))) {
                if (found != null) throw new Exception("Duplicate release asset");
                found = item;
            }
        }
        if (found == null || !"uploaded".equals(found.optString("state")))
            throw new Exception("Missing release asset: " + name);
        return found;
    }

    @PluginMethod
    public void startDownload(PluginCall call) {
        run(call, () -> {
            if (offered == null) throw new Exception("Check for an update first");
            if (prefs().getLong("id", -1) != -1) {
                JSObject state = status();
                if (!"idle".equals(state.getString("state")) && !"failed".equals(state.getString("state")))
                    throw new Exception("An update is already downloaded or downloading");
            }
            clear();
            long size = offered.getLong("size");
            if (new StatFs(directory().getAbsolutePath()).getAvailableBytes() < size * 2 + 50 * 1024 * 1024)
                throw new Exception("Ruang storan tidak mencukupi untuk kemas kini.");
            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(offered.getString("url")))
                .setTitle("Kemas Kini Masjid A’la " + offered.getString("versionName"))
                .setMimeType("application/vnd.android.package-archive")
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE)
                .setAllowedOverRoaming(false)
                .setDestinationUri(Uri.fromFile(apk()));
            long id = downloads().enqueue(request);
            prefs().edit().putLong("id", id).putString("release", offered.toString()).remove("failure").commit();
            call.resolve();
        });
    }

    @PluginMethod
    public void getDownload(PluginCall call) { run(call, () -> call.resolve(status())); }

    private JSObject status() throws Exception {
        String saved = prefs().getString("release", null);
        if (saved == null) return new JSObject().put("state", "idle");
        JSONObject release = new JSONObject(saved);
        if (release.getLong("versionCode") <= version(installed())) {
            clear();
            return new JSObject().put("state", "idle");
        }
        JSObject result = new JSObject().put("versionCode", release.getLong("versionCode"))
            .put("versionName", release.getString("versionName"));
        String failure = prefs().getString("failure", null);
        if (failure != null) return result.put("state", "failed").put("message", failure);
        try (Cursor cursor = downloads().query(new DownloadManager.Query().setFilterById(prefs().getLong("id", -1)))) {
            if (cursor == null || !cursor.moveToFirst()) return fail(result, "Muat turun tidak ditemui. Sila cuba lagi.");
            int state = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
            result.put("bytes", cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR)))
                .put("total", release.getLong("size"));
            if (state == DownloadManager.STATUS_SUCCESSFUL) {
                String fingerprint = apk().length() + ":" + apk().lastModified();
                if (!fingerprint.equals(verifiedFile)) {
                    notifyListeners("downloadProgress", new JSObject(result.toString()).put("state", "verifying"));
                }
                try { verify(release, false); }
                catch (Exception e) { return fail(result, "Pengesahan kemas kini gagal. " + e.getMessage()); }
                return result.put("state", "ready");
            }
            if (state == DownloadManager.STATUS_FAILED) return fail(result, "Muat turun gagal. Semak Internet dan ruang storan, kemudian cuba lagi.");
            return result.put("state", state == DownloadManager.STATUS_PAUSED ? "paused" : "downloading");
        }
    }

    private JSObject fail(JSObject result, String message) throws Exception {
        downloads().remove(prefs().getLong("id", -1));
        if (apk().exists()) apk().delete();
        verifiedFile = "";
        prefs().edit().putString("failure", message).commit();
        return result.put("state", "failed").put("message", message);
    }

    @SuppressWarnings("deprecation")
    private void verify(JSONObject release, boolean force) throws Exception {
        File file = apk();
        String fingerprint = file.length() + ":" + file.lastModified();
        if (!force && fingerprint.equals(verifiedFile)) return;
        if (file.length() != release.getLong("size")) throw new Exception("Fail tidak lengkap. Sila muat turun semula.");
        MessageDigest sha = MessageDigest.getInstance("SHA-256");
        try (InputStream input = new FileInputStream(file)) {
            byte[] buffer = new byte[65536];
            int count;
            while ((count = input.read(buffer)) != -1) sha.update(buffer, 0, count);
        }
        StringBuilder hex = new StringBuilder();
        for (byte b : sha.digest()) hex.append(String.format(Locale.ROOT, "%02x", b & 0xff));
        if (!hex.toString().equals(release.getString("sha256"))) throw new Exception("Checksum fail tidak sepadan. Sila muat turun semula.");
        PackageManager pm = getContext().getPackageManager();
        int flags = Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
        PackageInfo candidate = pm.getPackageArchiveInfo(file.getAbsolutePath(), flags);
        PackageInfo current = pm.getPackageInfo(getContext().getPackageName(), flags);
        if (candidate == null || !current.packageName.equals(candidate.packageName))
            throw new Exception("Fail APK tidak sah atau bukan untuk aplikasi ini.");
        if (version(candidate) != release.getLong("versionCode") ||
            !release.getString("versionName").equals(candidate.versionName))
            throw new Exception("Versi APK " + candidate.versionName + " (" + version(candidate) +
                ") tidak sepadan dengan versi kemas kini " + release.getString("versionName") +
                " (" + release.getLong("versionCode") + "). Sila hubungi pentadbir aplikasi.");
        if (version(candidate) <= version(current)) throw new Exception("APK ini bukan versi yang lebih baharu.");
        if (candidate.applicationInfo == null || (Build.VERSION.SDK_INT >= 24 &&
            candidate.applicationInfo.minSdkVersion > Build.VERSION.SDK_INT)) throw new Exception("Versi Android peranti tidak disokong.");
        Signature[] expected = Build.VERSION.SDK_INT >= 28 ? current.signingInfo.getApkContentsSigners() : current.signatures;
        Signature[] actual = Build.VERSION.SDK_INT >= 28 ? candidate.signingInfo.getApkContentsSigners() : candidate.signatures;
        // Deliberately require the existing signing key; key rotation requires a separate migration.
        if (expected == null || actual == null || expected.length == 0 || expected.length != actual.length ||
            !Arrays.asList(actual).containsAll(Arrays.asList(expected))) throw new Exception("Sijil tandatangan APK berbeza daripada aplikasi ini. Sila hubungi pentadbir aplikasi.");
        verifiedFile = fingerprint;
    }

    private void clear() throws Exception {
        long id = prefs().getLong("id", -1);
        if (id != -1) downloads().remove(id);
        if (apk().exists()) apk().delete();
        prefs().edit().clear().commit();
        verifiedFile = "";
    }

    @PluginMethod
    public void install(PluginCall call) {
        run(call, () -> {
            if (!"ready".equals(status().getString("state"))) throw new Exception("No verified update is ready");
            if (Build.VERSION.SDK_INT >= 26 && !getContext().getPackageManager().canRequestPackageInstalls()) {
                call.resolve(new JSObject().put("permissionRequired", true));
                return;
            }
            verify(new JSONObject(prefs().getString("release", "{}")), true);
            Intent intent = UpdateInstaller.createIntent(getContext(), apk());
            getActivity().runOnUiThread(() -> {
                try {
                    if (!foreground) throw new Exception("Return to the app to install the update");
                    getActivity().startActivity(intent);
                    call.resolve(new JSObject().put("permissionRequired", false));
                } catch (Exception e) { call.reject("Cannot open Android installer", e); }
            });
        });
    }

    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                if (Build.VERSION.SDK_INT >= 26) getActivity().startActivity(new Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName())));
                call.resolve();
            } catch (Exception e) { call.reject("Cannot open installation settings", e); }
        });
    }

    @Override
    protected void handleOnPause() { foreground = false; }

    @Override
    protected void handleOnResume() { foreground = true; }

    @Override
    protected void handleOnDestroy() { worker.shutdownNow(); }
}
