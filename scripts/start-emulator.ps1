$ErrorActionPreference = 'Stop'

$sdkRoot = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { 'Y:\Android\Sdk' }
$avdRoot = if ($env:ANDROID_AVD_HOME) { $env:ANDROID_AVD_HOME } else { 'Y:\Android\Avd' }
$emulator = Join-Path $sdkRoot 'emulator\emulator.exe'
$avdName = 'Iza_Pixel_8_API_36'

if (-not (Test-Path -LiteralPath $emulator)) {
    throw "Android Emulator was not found at $emulator"
}
if (-not (Test-Path -LiteralPath (Join-Path $avdRoot "$avdName.avd"))) {
    throw "Virtual device $avdName was not found under $avdRoot"
}

$env:ANDROID_HOME = $sdkRoot
$env:ANDROID_SDK_ROOT = $sdkRoot
$env:ANDROID_AVD_HOME = $avdRoot

Start-Process -FilePath $emulator -ArgumentList @('-avd', $avdName, '-gpu', 'auto')
Write-Output "Starting $avdName. Wait for Android to reach the home screen, then run: npm run android:run"
