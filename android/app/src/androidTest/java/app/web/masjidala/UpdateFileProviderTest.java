package app.web.masjidala;

import static org.junit.Assert.*;

import android.content.Context;
import android.content.Intent;
import android.content.pm.ProviderInfo;
import android.net.Uri;
import android.os.Environment;
import androidx.core.content.FileProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class UpdateFileProviderTest {
    @Test
    public void updateAndImageProvidersHaveDifferentComponents() {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        ProviderInfo images = context.getPackageManager().resolveContentProvider(context.getPackageName() + ".fileprovider", 0);
        ProviderInfo updates = context.getPackageManager().resolveContentProvider(context.getPackageName() + ".updates", 0);
        assertNotNull(images);
        assertNotNull(updates);
        assertNotEquals("Android must register separate provider components", images.name, updates.name);
    }

    @Test
    public void installerUriReturnsTheCompleteApkBytes() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        File directory = new File(context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "updates");
        assertTrue(directory.isDirectory() || directory.mkdirs());
        File file = new File(directory, "provider-test.apk");
        byte[] expected = "PK\003\004verified APK bytes".getBytes(StandardCharsets.UTF_8);
        try {
            try (FileOutputStream output = new FileOutputStream(file)) { output.write(expected); }
            Uri uri = FileProvider.getUriForFile(context, context.getPackageName() + ".updates", file);
            Intent intent = UpdateInstaller.createIntent(context, file);
            assertEquals(uri, intent.getData());
            assertEquals(uri, intent.getClipData().getItemAt(0).getUri());
            assertEquals(Intent.FLAG_GRANT_READ_URI_PERMISSION,
                intent.getFlags() & Intent.FLAG_GRANT_READ_URI_PERMISSION);
            assertEquals("application/vnd.android.package-archive", context.getContentResolver().getType(uri));
            try (InputStream input = context.getContentResolver().openInputStream(uri)) {
                assertNotNull(input);
                byte[] actual = new byte[expected.length];
                int offset = 0;
                while (offset < actual.length) {
                    int count = input.read(actual, offset, actual.length - offset);
                    if (count == -1) break;
                    offset += count;
                }
                assertEquals(expected.length, offset);
                assertArrayEquals(expected, actual);
                assertEquals(-1, input.read());
            }
        } finally { assertTrue(file.delete()); }
    }

    @Test(expected = IllegalArgumentException.class)
    public void apkProviderDoesNotExposeOtherFiles() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        File outside = new File(context.getCacheDir(), "not-an-update.apk");
        FileProvider.getUriForFile(context, context.getPackageName() + ".updates", outside);
    }

    @Test
    public void imageSharingStillUsesItsOwnProvider() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        File image = new File(context.getCacheDir(), "provider-test.png");
        try {
            try (FileOutputStream output = new FileOutputStream(image)) { output.write(123); }
            Uri uri = FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", image);
            assertEquals("image/png", context.getContentResolver().getType(uri));
            try (InputStream input = context.getContentResolver().openInputStream(uri)) {
                assertNotNull(input);
                assertEquals(123, input.read());
            }
        } finally { assertTrue(image.delete()); }
    }
}
