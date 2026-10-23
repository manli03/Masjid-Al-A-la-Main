package app.web.masjidala;

import androidx.core.content.FileProvider;

/** A distinct component prevents Android from aliasing the image and APK providers. */
public class UpdateFileProvider extends FileProvider {}
