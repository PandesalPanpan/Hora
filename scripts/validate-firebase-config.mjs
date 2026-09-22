#!/usr/bin/env node

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const expectedWebConfig = Object.freeze({
  VITE_FIREBASE_API_KEY: 'AIzaSyBbphSU9COWVq1RpNUmSHAHYy8tlw6xPr4',
  VITE_FIREBASE_AUTH_DOMAIN: 'hora-9e650.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'hora-9e650',
  VITE_FIREBASE_STORAGE_BUCKET: 'hora-9e650.firebasestorage.app',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '46789728655',
  VITE_FIREBASE_APP_ID: '1:46789728655:web:4e7d28b807dc088599d3fa',
  VITE_FIREBASE_MEASUREMENT_ID: 'G-N6C84NRRZW',
})

const defaultOptions = {
  envPath: '.env.example',
  googleServicesPath: 'android/app/google-services.json',
}

function parseOptions(args) {
  const options = { ...defaultOptions }
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--env') {
      options.envPath = args[++index]
      continue
    }
    if (arg === '--google-services') {
      options.googleServicesPath = args[++index]
      continue
    }
    throw new Error(`Unknown argument ${arg}.`)
  }
  if (!options.envPath || !options.googleServicesPath) throw new Error('Both --env and --google-services require a path.')
  return options
}

function parseEnvFile(contents, path) {
  const values = new Map()
  for (const [lineNumber, rawLine] of contents.split(/\r?\n/).entries()) {
    const line = rawLine.replace(/^\uFEFF/, '').trim()
    if (!line || line.startsWith('#')) continue
    const separator = line.indexOf('=')
    if (separator <= 0) throw new Error(`${path}:${lineNumber + 1} is not a valid environment assignment.`)
    const key = line.slice(0, separator).trim()
    const value = line.slice(separator + 1).trim()
    if (values.has(key)) throw new Error(`${path}:${lineNumber + 1} defines ${key} more than once.`)
    values.set(key, value)
  }
  return values
}

function assertWebConfig(values, path) {
  for (const [key, expectedValue] of Object.entries(expectedWebConfig)) {
    if (values.get(key) !== expectedValue) {
      throw new Error(`${key} in ${path} does not match the checked-in Hora Firebase configuration.`)
    }
  }
}

function assertAndroidConfig(services, path) {
  const projectInfo = services.project_info ?? {}
  if (projectInfo.project_id !== expectedWebConfig.VITE_FIREBASE_PROJECT_ID) {
    throw new Error(`${path} does not belong to Firebase project ${expectedWebConfig.VITE_FIREBASE_PROJECT_ID}.`)
  }
  if (String(projectInfo.project_number) !== expectedWebConfig.VITE_FIREBASE_MESSAGING_SENDER_ID) {
    throw new Error(`${path} has a project number that does not match the web Firebase configuration.`)
  }
  if (projectInfo.storage_bucket !== expectedWebConfig.VITE_FIREBASE_STORAGE_BUCKET) {
    throw new Error(`${path} has a storage bucket that does not match the web Firebase configuration.`)
  }

  const androidClient = (services.client ?? []).find(
    (client) => client.client_info?.android_client_info?.package_name === 'com.izatime.tracker',
  )
  if (!androidClient) throw new Error(`${path} does not contain the com.izatime.tracker Android client.`)
  if (!androidClient.client_info?.mobilesdk_app_id) {
    throw new Error(`${path} does not contain an Android Firebase app id for com.izatime.tracker.`)
  }
  if (!androidClient.api_key?.some((entry) => entry.current_key)) {
    throw new Error(`${path} does not contain a Firebase API key for com.izatime.tracker.`)
  }
}

async function main() {
  const options = parseOptions(process.argv.slice(2))
  const envPath = resolve(process.cwd(), options.envPath)
  const googleServicesPath = resolve(process.cwd(), options.googleServicesPath)
  const env = parseEnvFile(await readFile(envPath, 'utf8'), options.envPath)
  const services = JSON.parse(await readFile(googleServicesPath, 'utf8'))

  assertWebConfig(env, options.envPath)
  assertAndroidConfig(services, options.googleServicesPath)
  console.log(`Firebase client configuration is valid for project ${expectedWebConfig.VITE_FIREBASE_PROJECT_ID}.`)
}

main().catch((error) => {
  console.error(`Firebase configuration validation failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
