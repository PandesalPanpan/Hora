import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { beforeEach } from 'vitest'
import { db } from '../lib/db'

beforeEach(async () => {
  await db.delete()
  await db.open()
  localStorage.clear()
})
