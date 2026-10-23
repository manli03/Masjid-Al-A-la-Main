package app.web.masjidala;

import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import androidx.core.content.FileProvider;
import java.io.File;
import java.io.InputStream;

final class UpdateInstaller {
    private UpdateInstaller() {}

    static Intent createIntent(Context context, File apk) throws Exception {
        Uri uri = FileProvider.getUriForFile(context, context.getPackageName() + ".updates", apk);
        // Read through the provider, not the raw path: a valid APK alone does not prove
        // that Android's installer will receive readable bytes from the content URI.
        try (InputStream input = context.getContentResolver().openInputStream(uri)) {
            if (input == null || input.read() == -1) {
                throw new Exception("Fail kemas kini tidak dapat dibaca oleh pemasang Android.");
            }
        }
        Intent intent = new Intent(Intent.ACTION_VIEW)
            .setDataAndType(uri, "application/vnd.android.package-archive")
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        // Propagate the temporary read grant when OEM installers forward the intent.
        intent.setClipData(ClipData.newRawUri("Kemas kini Masjid A’la", uri));
        return intent;
    }
}
