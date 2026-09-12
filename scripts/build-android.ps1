$ErrorActionPreference = 'Stop'

$repositoryRoot = Split-Path $PSScriptRoot -Parent
$androidProject = Join-Path $repositoryRoot 'android'
$javaCandidates = @(
    $env:JAVA_HOME,
    'Y:\Android\jdk-21',
    'Y:\Android\android-studio\jbr'
) | Where-Object { $_ -and (Test-Path -LiteralPath (Join-Path $_ 'bin\java.exe')) }

if (-not $javaCandidates) {
    throw 'Java 17 or newer was not found. Set JAVA_HOME before building.'
}

$env:JAVA_HOME = $javaCandidates[0]
if (-not $env:ANDROID_HOME -and (Test-Path -LiteralPath 'Y:\Android\Sdk')) {
    $env:ANDROID_HOME = 'Y:\Android\Sdk'
}
if (-not $env:ANDROID_SDK_ROOT -and $env:ANDROID_HOME) {
    $env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
}
if (-not $env:GRADLE_USER_HOME -and (Test-Path -LiteralPath 'Y:\Android\Gradle')) {
    $env:GRADLE_USER_HOME = 'Y:\Android\Gradle'
}

Push-Location $androidProject
try {
    & .\gradlew.bat assembleDebug
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
    Pop-Location
}
