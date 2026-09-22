import { describe, expect, it } from 'vitest'
import { db } from '../../lib/db'
import { getCurrentOwnerId, localOwnerId, setCurrentOwnerId, userOwnerId } from '../../lib/ownership'
import { accountScopeKeys, claimUnlinkedLocalData } from './accountScope'

describe('account data scope', () => {
  it('claims anonymous local records once and keeps later accounts isolated', async () => {
    const localOwner = localOwnerId()
    await db.tasks.put({ id: 'local-task', title: 'Local note', completed: false })

    expect(await claimUnlinkedLocalData('alice')).toBe(true)
    expect(await db.tasks.get('local-task')).toMatchObject({ ownerId: userOwnerId('alice') })
    expect(localStorage.getItem(accountScopeKeys.LINKED_ACCOUNTS_KEY)).toContain('alice')

    setCurrentOwnerId(userOwnerId('alice'))
    expect(await db.tasks.where('ownerId').equals(userOwnerId('alice')).count()).toBe(1)
    expect(await db.tasks.where('ownerId').equals(localOwner).count()).toBe(0)

    expect(await claimUnlinkedLocalData('bob')).toBe(false)
    expect(await db.tasks.where('ownerId').equals(userOwnerId('bob')).count()).toBe(0)
    expect(getCurrentOwnerId()).toBe(userOwnerId('alice'))
  })
})
