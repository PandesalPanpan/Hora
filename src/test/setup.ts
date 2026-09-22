import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { beforeEach } from 'vitest'
import { db } from '../lib/db'
import { resetToLocalOwner } from '../lib/ownership'

beforeEach(async () => {
  await db.delete()
  await db.open()
  localStorage.clear()
  resetToLocalOwner()
})
