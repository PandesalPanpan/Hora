import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const args = new Map()
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index]
  const value = process.argv[index + 1]
  if (key?.startsWith('--') && value) args.set(key.slice(2), value)
}

const output = args.get('output')
const apk = args.get('apk')
const sha256 = args.get('sha256')
if (!output || !apk || !sha256) throw new Error('Usage: node scripts/create-update-manifest.mjs --output <path> --apk <asset-name> --sha256 <sha256>')
if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,180}\.apk$/i.test(apk)) throw new Error('The APK asset name is not safe.')
if (!/^[a-f0-9]{64}$/i.test(sha256)) throw new Error('The SHA-256 checksum is invalid.')

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
if (!Number.isSafeInteger(packageJson.androidVersionCode) || packageJson.androidVersionCode < 1) throw new Error('package.json must define a positive androidVersionCode.')
if (typeof packageJson.version !== 'string' || !packageJson.version.trim()) throw new Error('package.json must define a version.')

const manifest = {
  versionCode: packageJson.androidVersionCode,
  versionName: packageJson.version,
  apk,
  sha256: sha256.toLowerCase(),
}
await mkdir(dirname(output), { recursive: true })
await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
