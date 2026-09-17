package com.izatime.tracker.updates;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import androidx.core.content.pm.PackageInfoCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name = "AppUpdate")
public class AppUpdatePlugin extends Plugin {

    private static final String UPDATE_DIRECTORY = "updates";
    private static final String DOWNLOAD_PROGRESS_EVENT = "downloadProgress";
    private static final int MAX_REDIRECTS = 5;
    private static final int BUFFER_SIZE = 32 * 1024;
    private static final int CONNECT_TIMEOUT_MS = 15_000;
    private static final int READ_TIMEOUT_MS = 60_000;
    private static final AtomicBoolean DOWNLOAD_IN_PROGRESS = new AtomicBoolean(false);

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private volatile HttpURLConnection activeConnection;

    @PluginMethod
    public void downloadApk(final PluginCall call) {
        final String url = call.getString("url");
        final String fileName = call.getString("fileName");
        final String expectedSha256 = call.getString("expectedSha256");
        final String expectedPackageId = call.getString("expectedPackageId");
        final Long expectedVersionCode = numberAsLong(call, "expectedVersionCode");

        try {
            validateDownloadArguments(url, fileName, expectedSha256, expectedPackageId, expectedVersionCode);
        } catch (UpdateException exception) {
            call.reject(exception.getMessage(), exception.code);
            return;
        }

        if (!DOWNLOAD_IN_PROGRESS.compareAndSet(false, true)) {
            call.reject("Another update is already downloading.", "DOWNLOAD_IN_PROGRESS");
            return;
        }

        try {
            executor.submit(() -> {
                try {
                    DownloadResult result = download(
                        url,
                        fileName,
                        expectedSha256,
                        expectedPackageId,
                        expectedVersionCode
                    );
                    JSObject data = new JSObject();
                    data.put("fileName", result.fileName);
                    data.put("bytes", result.bytes);
                    data.put("sha256", result.sha256);
                    call.resolve(data);
                } catch (UpdateException exception) {
                    call.reject(exception.getMessage(), exception.code);
                } catch (Exception exception) {
                    call.reject("The update download failed.", "DOWNLOAD_FAILED", exception);
                } finally {
                    DOWNLOAD_IN_PROGRESS.set(false);
                }
            });
        } catch (Exception exception) {
            DOWNLOAD_IN_PROGRESS.set(false);
            call.reject("The update download could not start.", "DOWNLOAD_FAILED", exception);
        }
    }

    @PluginMethod
    public void canInstallPackages(PluginCall call) {
        JSObject data = new JSObject();
        data.put("canInstall", canInstallPackages());
        call.resolve(data);
    }

    @PluginMethod
    public void openInstallSettings(final PluginCall call) {
        getBridge().executeOnMainThread(() -> {
            try {
                Intent intent;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
                } else {
                    intent = new Intent(Settings.ACTION_SECURITY_SETTINGS);
                }
                if (intent.resolveActivity(getContext().getPackageManager()) == null) {
                    intent = new Intent(Settings.ACTION_SECURITY_SETTINGS);
                }
                getActivity().startActivity(intent);
                call.resolve();
            } catch (Exception exception) {
                call.reject("Android install settings could not be opened.", "SETTINGS_UNAVAILABLE", exception);
            }
        });
    }

    @PluginMethod
    public void installApk(final PluginCall call) {
        final String fileName = call.getString("fileName");
        final String expectedPackageId = call.getString("expectedPackageId");
        final Long expectedVersionCode = numberAsLong(call, "expectedVersionCode");

        try {
            if (!canInstallPackages()) throw new UpdateException("INSTALL_PERMISSION_REQUIRED", "Allow Iza to install unknown apps first.");
            if (expectedPackageId == null || expectedVersionCode == null || expectedVersionCode < 1) {
                throw new UpdateException("INVALID_APK", "The update installation details are incomplete.");
            }
            File apk = safeUpdateFile(fileName);
            validateApk(apk, expectedPackageId, expectedVersionCode);
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apk);

            getBridge().executeOnMainThread(() -> {
                try {
                    Intent intent = new Intent(Intent.ACTION_VIEW);
                    intent.setDataAndType(uri, "application/vnd.android.package-archive");
                    intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                    if (intent.resolveActivity(getContext().getPackageManager()) == null) {
                        call.reject("Android could not find a package installer.", "INSTALLER_UNAVAILABLE");
                        return;
                    }
                    getActivity().startActivity(intent);
                    call.resolve();
                } catch (Exception exception) {
                    call.reject("Android could not open the package installer.", "INSTALLER_UNAVAILABLE", exception);
                }
            });
        } catch (UpdateException exception) {
            call.reject(exception.getMessage(), exception.code);
        } catch (Exception exception) {
            call.reject("The downloaded update could not be installed.", "INVALID_APK", exception);
        }
    }

    private boolean canInstallPackages() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.O || getContext().getPackageManager().canRequestPackageInstalls();
    }

    private DownloadResult download(
        String initialUrl,
        String fileName,
        String expectedSha256,
        String expectedPackageId,
        long expectedVersionCode
    ) throws Exception {
        File target = safeUpdateFile(fileName);
        File partialFile = new File(target.getParentFile(), target.getName() + ".part");
        deleteQuietly(partialFile);
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        long downloadedBytes = 0;
        long totalBytes = -1;
        boolean completed = false;
        String currentUrl = initialUrl;

        try {
            for (int redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
                URL url = httpsUrl(currentUrl);
                HttpURLConnection connection = (HttpURLConnection) url.openConnection();
                activeConnection = connection;
                connection.setInstanceFollowRedirects(false);
                connection.setConnectTimeout(CONNECT_TIMEOUT_MS);
                connection.setReadTimeout(READ_TIMEOUT_MS);
                connection.setRequestProperty("Accept", "application/vnd.android.package-archive,application/octet-stream");
                connection.setRequestProperty("User-Agent", "Iza-Time-Tracker-Updater");

                int status = connection.getResponseCode();
                if (status >= 300 && status < 400) {
                    String location = connection.getHeaderField("Location");
                    connection.disconnect();
                    activeConnection = null;
                    if (location == null || location.trim().isEmpty()) throw new UpdateException("DOWNLOAD_FAILED", "The update server returned an incomplete redirect.");
                    currentUrl = new URL(url, location).toString();
                    httpsUrl(currentUrl);
                    continue;
                }
                if (status < 200 || status >= 300) {
                    connection.disconnect();
                    activeConnection = null;
                    throw new UpdateException("DOWNLOAD_FAILED", "The update server returned HTTP " + status + ".");
                }

                String contentType = connection.getContentType();
                if (contentType != null && contentType.toLowerCase(Locale.US).startsWith("text/html")) {
                    connection.disconnect();
                    activeConnection = null;
                    throw new UpdateException("INVALID_APK", "The APK download returned a web page instead of an APK.");
                }
                totalBytes = connection.getContentLengthLong();
                try (InputStream input = new BufferedInputStream(connection.getInputStream());
                     OutputStream output = new BufferedOutputStream(new FileOutputStream(partialFile, false))) {
                    byte[] buffer = new byte[BUFFER_SIZE];
                    int read;
                    notifyProgress(0, totalBytes);
                    while ((read = input.read(buffer)) != -1) {
                        if (Thread.currentThread().isInterrupted()) throw new UpdateException("DOWNLOAD_FAILED", "The APK download was interrupted.");
                        output.write(buffer, 0, read);
                        digest.update(buffer, 0, read);
                        downloadedBytes += read;
                        notifyProgress(downloadedBytes, totalBytes);
                    }
                } finally {
                    connection.disconnect();
                    activeConnection = null;
                }
                completed = true;
                break;
            }
            if (!completed) throw new UpdateException("DOWNLOAD_FAILED", "The update server redirected too many times.");

            if (downloadedBytes <= 0 || !isZipFile(partialFile)) throw new UpdateException("INVALID_APK", "The downloaded file is not a valid APK archive.");
            String actualSha256 = hex(digest.digest());
            if (expectedSha256 != null && !actualSha256.equalsIgnoreCase(expectedSha256)) {
                throw new UpdateException("CHECKSUM_MISMATCH", "The downloaded APK checksum did not match the release manifest.");
            }
            validateApk(partialFile, expectedPackageId, expectedVersionCode);

            deleteQuietly(target);
            if (!partialFile.renameTo(target)) throw new UpdateException("DOWNLOAD_FAILED", "The verified APK could not be moved into the update cache.");
            notifyProgress(downloadedBytes, downloadedBytes);
            return new DownloadResult(fileName, downloadedBytes, actualSha256);
        } finally {
            activeConnection = null;
            deleteQuietly(partialFile);
        }
    }

    private void validateDownloadArguments(String url, String fileName, String expectedSha256, String expectedPackageId, Long expectedVersionCode) throws UpdateException {
        httpsUrl(url);
        if (fileName == null || !fileName.matches("^[A-Za-z0-9][A-Za-z0-9._-]{0,180}\\.apk$")) {
            throw new UpdateException("INVALID_APK", "The release did not name a safe APK asset.");
        }
        if (expectedSha256 != null && !expectedSha256.matches("^[a-fA-F0-9]{64}$")) {
            throw new UpdateException("CHECKSUM_MISMATCH", "The release checksum is invalid.");
        }
        if (expectedPackageId == null || !expectedPackageId.equals(getContext().getPackageName()) || expectedVersionCode == null || expectedVersionCode < 1) {
            throw new UpdateException("INVALID_APK", "The update package details are invalid.");
        }
    }

    private URL httpsUrl(String value) throws UpdateException {
        try {
            URL url = new URL(value);
            if (!"https".equalsIgnoreCase(url.getProtocol()) || url.getUserInfo() != null) throw new Exception();
            return url;
        } catch (Exception exception) {
            throw new UpdateException("DOWNLOAD_FAILED", "APK download URLs must use HTTPS.");
        }
    }

    private File safeUpdateFile(String fileName) throws UpdateException {
        if (fileName == null || !fileName.matches("^[A-Za-z0-9][A-Za-z0-9._-]{0,180}\\.apk$")) throw new UpdateException("INVALID_APK", "The update file name is invalid.");
        File directory = new File(getContext().getCacheDir(), UPDATE_DIRECTORY);
        if (!directory.exists() && !directory.mkdirs()) throw new UpdateException("DOWNLOAD_FAILED", "The update cache could not be created.");
        try {
            File canonicalDirectory = directory.getCanonicalFile();
            File file = new File(canonicalDirectory, fileName).getCanonicalFile();
            if (!canonicalDirectory.equals(file.getParentFile())) throw new UpdateException("INVALID_APK", "The update file path is invalid.");
            return file;
        } catch (IOException exception) {
            throw new UpdateException("INVALID_APK", "The update file path could not be verified.");
        }
    }

    private void validateApk(File apk, String expectedPackageId, long expectedVersionCode) throws UpdateException {
        if (!apk.exists() || apk.length() <= 0) throw new UpdateException("INVALID_APK", "The APK file is missing.");
        PackageManager packageManager = getContext().getPackageManager();
        PackageInfo archive = packageManager.getPackageArchiveInfo(apk.getAbsolutePath(), 0);
        if (archive == null || !expectedPackageId.equals(archive.packageName)) throw new UpdateException("INVALID_APK", "The APK is not an Iza package.");
        long archiveVersionCode = PackageInfoCompat.getLongVersionCode(archive);
        if (archiveVersionCode != expectedVersionCode) throw new UpdateException("INVALID_APK", "The APK version does not match the release manifest.");
        try {
            PackageInfo installed = packageManager.getPackageInfo(getContext().getPackageName(), 0);
            if (archiveVersionCode <= PackageInfoCompat.getLongVersionCode(installed)) throw new UpdateException("INVALID_APK", "The downloaded APK is not newer than the installed app.");
        } catch (PackageManager.NameNotFoundException exception) {
            throw new UpdateException("INVALID_APK", "The installed app package could not be verified.");
        }
    }

    private boolean isZipFile(File file) {
        try (InputStream input = new FileInputStream(file)) {
            return input.read() == 0x50 && input.read() == 0x4b && input.read() == 0x03 && input.read() == 0x04;
        } catch (Exception exception) {
            return false;
        }
    }

    private void notifyProgress(long bytesDownloaded, long totalBytes) {
        JSObject progress = new JSObject();
        progress.put("bytesDownloaded", bytesDownloaded);
        progress.put("totalBytes", totalBytes);
        progress.put("percent", totalBytes > 0 ? Math.min(100, (int) ((bytesDownloaded * 100) / totalBytes)) : -1);
        notifyListeners(DOWNLOAD_PROGRESS_EVENT, progress);
    }

    private static Long numberAsLong(PluginCall call, String key) {
        Double value = call.getDouble(key);
        return value == null || !Double.isFinite(value) || value.longValue() != value ? null : value.longValue();
    }

    private static String hex(byte[] bytes) {
        StringBuilder builder = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) builder.append(String.format(Locale.US, "%02x", value));
        return builder.toString();
    }

    private static void deleteQuietly(File file) {
        if (file != null && file.exists()) file.delete();
    }

    @Override
    protected void handleOnDestroy() {
        HttpURLConnection connection = activeConnection;
        if (connection != null) connection.disconnect();
        executor.shutdownNow();
        DOWNLOAD_IN_PROGRESS.set(false);
        super.handleOnDestroy();
    }

    private static final class DownloadResult {
        private final String fileName;
        private final long bytes;
        private final String sha256;

        private DownloadResult(String fileName, long bytes, String sha256) {
            this.fileName = fileName;
            this.bytes = bytes;
            this.sha256 = sha256;
        }
    }

    private static final class UpdateException extends Exception {
        private final String code;

        private UpdateException(String code, String message) {
            super(message);
            this.code = code;
        }
    }
}
