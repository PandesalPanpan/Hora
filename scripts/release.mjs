#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const githubRepository = 'PandesalPanpan/Hora'
const requiredSecrets = [
  'ANDROID_KEYSTORE_BASE64',
  'ANDROID_KEYSTORE_PASSWORD',
  'ANDROID_KEY_ALIAS',
  'ANDROID_KEY_PASSWORD',
]

function executable(command) {
  if (process.platform === 'win32' && command === 'npm') return 'npm.cmd'
  return command
}

function run(command, args, options = {}) {
  const result = spawnSync(executable(command), args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
    windowsHide: true,
    shell: process.platform === 'win32' && command === 'npm',
  })
  if (result.error) throw new Error(`Could not run ${command}: ${result.error.message}`)
  if (result.status !== 0) {
    const details = options.capture ? `${result.stdout ?? ''}${result.stderr ?? ''}`.trim() : ''
    throw new Error(`${command} ${args.join(' ')} failed${details ? `: ${details}` : '.'}`)
  }
  return options.capture ? String(result.stdout ?? '').trim() : ''
}

function runAllowFailure(command, args) {
  const result = spawnSync(executable(command), args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: 'pipe',
    windowsHide: true,
  })
  if (result.error) throw new Error(`Could not run ${command}: ${result.error.message}`)
  return {
    status: result.status ?? 1,
    stdout: String(result.stdout ?? '').trim(),
    stderr: String(result.stderr ?? '').trim(),
  }
}

function usage() {
  console.log(`Usage:
  npm run release:doctor
  npm run release -- release --initial --dry-run
  npm run release -- release --initial
  npm run release -- release --version 0.2.0 --version-code 2 [--dry-run]

The release command must run from a clean main branch. It updates package metadata,
runs the web checks, commits the release version, creates v<version>, and pushes the
commit and tag so GitHub Actions can build and publish the signed APK.`)
}

function parseArgs() {
  const values = { command: process.argv[2] ?? 'help', version: null, versionCode: null, dryRun: false, initial: false }
  const args = process.argv.slice(3)
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--dry-run') {
      values.dryRun = true
      continue
    }
    if (arg === '--initial') {
      values.initial = true
      continue
    }
    if (arg === '--version' || arg === '--version-code') {
      const value = args[index + 1]
      if (!value) throw new Error(`${arg} requires a value.`)
      values[arg === '--version' ? 'version' : 'versionCode'] = value
      index += 1
      continue
    }
    throw new Error(`Unknown argument ${arg}.`)
  }
  return values
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

function validateReleaseVersion(version, versionCode, currentVersion, currentVersionCode, initial) {
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`Version ${version} is not a supported semantic version.`)
  }
  if (!/^\d+$/.test(versionCode)) throw new Error(`Version code ${versionCode} must be a positive integer.`)
  const nextVersionCode = Number(versionCode)
  if (!Number.isSafeInteger(nextVersionCode) || nextVersionCode < 1) throw new Error(`Version code ${versionCode} must be a positive safe integer.`)
  const isCurrentVersion = version === currentVersion && nextVersionCode === currentVersionCode
  // A prior run may have prepared this exact metadata before failing its checks;
  // ensureTagDoesNotExist below still prevents publishing the pair twice.
  if (nextVersionCode <= currentVersionCode && !isCurrentVersion) {
    throw new Error(`Version code ${nextVersionCode} must be greater than the current version code ${currentVersionCode}.`)
  }
  if (initial && !isCurrentVersion) throw new Error(`The initial release must use the current package version ${currentVersion} and version code ${currentVersionCode}.`)
  return nextVersionCode
}

function ensureCleanMainBranch() {
  const status = run('git', ['status', '--porcelain=v1'], { capture: true })
  if (status) {
    throw new Error(`The working tree is not clean. Commit or stash these changes before releasing:\n${status}`)
  }
  const branch = run('git', ['branch', '--show-current'], { capture: true })
  if (branch !== 'main') throw new Error(`Releases must be cut from main; current branch is ${branch || '(detached HEAD)'}.`)
}

function ensureTagDoesNotExist(tag) {
  const local = runAllowFailure('git', ['rev-parse', '--verify', '--quiet', `refs/tags/${tag}`])
  if (local.status === 0) throw new Error(`Tag ${tag} already exists locally.`)
  if (local.status !== 1) throw new Error(`Could not inspect local tag ${tag}: ${local.stderr || local.stdout}`)

  const remote = runAllowFailure('git', ['ls-remote', '--exit-code', '--tags', 'origin', `refs/tags/${tag}`])
  if (remote.status === 0) throw new Error(`Tag ${tag} already exists on origin.`)
  if (remote.status !== 2) throw new Error(`Could not inspect origin for tag ${tag}: ${remote.stderr || remote.stdout}`)
}

function ensureGitHubAuth() {
  const auth = runAllowFailure('gh', ['auth', 'status'])
  if (auth.status !== 0) throw new Error('GitHub CLI is not authenticated. Run `gh auth login` once, then retry.')
}

function ensureGitHubSecrets() {
  const secretOutput = run('gh', ['secret', 'list', '--repo', githubRepository, '--json', 'name', '--jq', '.[].name'], { capture: true })
  const available = new Set(secretOutput.split(/\r?\n/).filter(Boolean))
  const missing = requiredSecrets.filter((secret) => !available.has(secret))
  if (missing.length > 0) throw new Error(`Missing GitHub Actions secret(s): ${missing.join(', ')}. See docs/ANDROID_UPDATES.md.`)
}

function verifyRepository() {
  const actual = run('gh', ['repo', 'view', githubRepository, '--json', 'nameWithOwner', '--jq', '.nameWithOwner'], { capture: true })
  if (actual !== githubRepository) throw new Error(`GitHub CLI resolved ${actual}, expected ${githubRepository}.`)
}

function doctor() {
  ensureGitHubAuth()
  verifyRepository()
  ensureGitHubSecrets()
  console.log(`GitHub CLI is authenticated and ${githubRepository} has all release secrets.`)
}

async function updateVersionMetadata(version, versionCode) {
  const packagePath = resolve(repositoryRoot, 'package.json')
  const lockPath = resolve(repositoryRoot, 'package-lock.json')
  const packageJson = await readJson(packagePath)
  const packageLock = await readJson(lockPath)
  if (packageLock.version !== packageJson.version || packageLock.packages?.['']?.version !== packageJson.version) {
    throw new Error('package.json and package-lock.json are already out of sync; repair them before releasing.')
  }
  packageJson.version = version
  packageJson.androidVersionCode = versionCode
  packageLock.version = version
  if (!packageLock.packages?.['']) throw new Error('package-lock.json has no root package entry.')
  packageLock.packages[''].version = version
  await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8')
  await writeFile(lockPath, `${JSON.stringify(packageLock, null, 2)}\n`, 'utf8')
}

function runQualityChecks() {
  console.log('Running tests…')
  run('npm', ['test', '--', '--run'])
  console.log('Running lint…')
  run('npm', ['run', 'lint'])
  console.log('Building web assets…')
  run('npm', ['run', 'build'])
  run('git', ['diff', '--check'])
}

async function release(options) {
  const packageJson = await readJson(resolve(repositoryRoot, 'package.json'))
  const version = options.initial ? packageJson.version : options.version
  const versionCode = options.initial ? String(packageJson.androidVersionCode) : options.versionCode
  if (!version || !versionCode) throw new Error('Release requires --version and --version-code, unless --initial is used.')
  const nextVersionCode = validateReleaseVersion(version, versionCode, packageJson.version, Number(packageJson.androidVersionCode), options.initial)
  const tag = `v${version}`

  ensureGitHubAuth()
  verifyRepository()
  ensureGitHubSecrets()
  ensureCleanMainBranch()
  ensureTagDoesNotExist(tag)

  if (options.dryRun) {
    console.log(`Dry run: would release ${tag} with Android version code ${nextVersionCode}${options.initial ? ' as the initial release' : ''}.`)
    return
  }

  const metadataNeedsUpdate = packageJson.version !== version || Number(packageJson.androidVersionCode) !== nextVersionCode
  if (metadataNeedsUpdate) await updateVersionMetadata(version, nextVersionCode)
  runQualityChecks()
  if (metadataNeedsUpdate) {
    run('git', ['add', 'package.json', 'package-lock.json'])
    run('git', ['commit', '-m', `chore: release ${tag}`])
  }
  run('git', ['tag', '--annotate', tag, '--message', `Iza ${version}`])
  run('git', ['push', 'origin', 'HEAD:main'])
  run('git', ['push', 'origin', tag])
  console.log(`Release ${tag} queued. GitHub Actions will build and publish the signed APK.`)
  console.log(`Watch it with: gh run list --repo ${githubRepository} --workflow android-release.yml`)
}

async function main() {
  const options = parseArgs()
  if (options.command === 'help' || options.command === '--help' || options.command === '-h') {
    usage()
    return
  }
  if (options.command === 'doctor') {
    doctor()
    return
  }
  if (options.command !== 'release') throw new Error(`Unknown command ${options.command}.`)
  await release(options)
}

main().catch((error) => {
  console.error(`Release stopped: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
