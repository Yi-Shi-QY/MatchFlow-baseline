param(
  [ValidateSet('assembleRelease', 'bundleRelease')]
  [string]$Task = 'assembleRelease',
  [switch]$SkipWebBuild,
  [switch]$SkipCapSync,
  [switch]$Doctor,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

function Resolve-RepoRoot {
  return Split-Path -Parent $PSScriptRoot
}

function Resolve-AndroidStudioJavaHome {
  $candidates = @(
    'C:\Program Files\Android\Android Studio\jbr',
    'C:\Program Files\Android\Android Studio Preview\jbr'
  )

  foreach ($candidate in $candidates) {
    if (Test-Path (Join-Path $candidate 'bin\java.exe')) {
      return $candidate
    }
  }

  throw 'Android Studio Java 21 runtime was not found. Install Android Studio or set JAVA_HOME manually.'
}

function Resolve-GradleDistributionRoot {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RepoRoot
  )

  $wrapperPropertiesPath = Join-Path $RepoRoot 'android\gradle\wrapper\gradle-wrapper.properties'
  if (-not (Test-Path $wrapperPropertiesPath)) {
    throw "Missing gradle-wrapper.properties: $wrapperPropertiesPath"
  }

  $distributionUrlLine = Get-Content $wrapperPropertiesPath |
    Where-Object { $_ -match '^distributionUrl=' } |
    Select-Object -First 1

  if (-not $distributionUrlLine) {
    throw 'distributionUrl was not found in gradle-wrapper.properties.'
  }

  $distributionUrl = ($distributionUrlLine -replace '^distributionUrl=', '').Trim()
  $distributionArchive = [System.IO.Path]::GetFileName($distributionUrl)
  $distributionName = $distributionArchive -replace '\.zip$', ''

  $distRoot = Join-Path $env:USERPROFILE ".gradle\wrapper\dists\$distributionName"
  if (-not (Test-Path $distRoot)) {
    throw "Cached Gradle distribution was not found: $distRoot"
  }

  $gradleBat = Get-ChildItem $distRoot -Recurse -File -Filter 'gradle.bat' |
    Select-Object -First 1

  if (-not $gradleBat) {
    throw "Could not locate gradle.bat under cached distribution root: $distRoot"
  }

  return Split-Path -Parent (Split-Path -Parent $gradleBat.FullName)
}

function Resolve-GradleCommand {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RepoRoot
  )

  $distributionRoot = Resolve-GradleDistributionRoot -RepoRoot $RepoRoot
  $gradleBat = Join-Path $distributionRoot 'bin\gradle.bat'
  if (-not (Test-Path $gradleBat)) {
    throw "Gradle executable was not found: $gradleBat"
  }

  return $gradleBat
}

function Invoke-Step {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Label,
    [Parameter(Mandatory = $true)]
    [scriptblock]$Action
  )

  Write-Host "==> $Label"
  & $Action
}

$repoRoot = Resolve-RepoRoot
$androidDir = Join-Path $repoRoot 'android'
$javaHome = Resolve-AndroidStudioJavaHome
$gradleCommand = Resolve-GradleCommand -RepoRoot $repoRoot

$env:JAVA_HOME = $javaHome
$env:PATH = "$javaHome\bin;$env:PATH"

if ($Doctor) {
  Write-Host "Repo root: $repoRoot"
  Write-Host "Android dir: $androidDir"
  Write-Host "JAVA_HOME: $javaHome"
  Write-Host "Gradle: $gradleCommand"
  & (Join-Path $javaHome 'bin\java.exe') -version
  if (-not $DryRun) {
    & $gradleCommand -v
  }
  exit 0
}

if (-not $SkipWebBuild) {
  Invoke-Step -Label 'Web build (vite)' -Action {
    Set-Location $repoRoot
    npm.cmd run build
  }
}

if (-not $SkipCapSync) {
  Invoke-Step -Label 'Capacitor sync (android)' -Action {
    Set-Location $repoRoot
    npx.cmd cap sync android
  }
}

Invoke-Step -Label "Gradle $Task" -Action {
  Set-Location $androidDir
  & $gradleCommand $Task
}

$artifactPath =
  if ($Task -eq 'bundleRelease') {
    Join-Path $androidDir 'app\build\outputs\bundle\release'
  } else {
    Join-Path $androidDir 'app\build\outputs\apk\release'
  }

Write-Host ''
Write-Host "Artifacts: $artifactPath"
