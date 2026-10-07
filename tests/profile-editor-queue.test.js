import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDraftSaveQueue, profileDraft } from '../src/lib/draft-save-queue.js'

const initial = {
  revision: 3, name: 'Kofi', title: 'Designer', bio: '', links: [],
  background: null, show_save_contact: true, photo_asset_id: null,
}
function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const conflictError = () => Object.assign(new Error('Revision conflict'), { status: 409 })

describe('private draft CAS queue', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('debounces edits and sends the latest full draft with its acknowledged revision', async () => {
    const save = vi.fn(async ({ draft, expectedRevision }) => ({ ...draft, revision: expectedRevision + 1 }))
    const queue = createDraftSaveQueue({ profile: initial, save })
    queue.update({ name: 'Ama' })
    await vi.advanceTimersByTimeAsync(1500)
    queue.update({ title: 'Director', show_save_contact: false, background: '#000000' })
    await vi.advanceTimersByTimeAsync(1999)
    expect(save).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(save).toHaveBeenCalledExactlyOnceWith({ expectedRevision: 3, draft: { ...profileDraft(initial), name: 'Ama', title: 'Director', show_save_contact: false, background: '#000000' } })
    expect(queue.getState()).toMatchObject({ dirty: false, revision: 4 })
  })

  it('serializes saves and keeps newer edits dirty while an older request completes', async () => {
    const first = deferred(), second = deferred()
    const save = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const queue = createDraftSaveQueue({ profile: initial, save })
    queue.update({ name: 'Ama' })
    const flush = queue.flush()
    await Promise.resolve()
    queue.update({ name: 'Akua', bio: 'Newer edit' })
    expect(queue.flush()).toBe(flush)
    expect(save).toHaveBeenCalledTimes(1)
    first.resolve({ ...profileDraft(initial), name: 'Ama', revision: 4 })
    await Promise.resolve()
    expect(queue.getState()).toMatchObject({ dirty: true, saving: true, revision: 4, draft: { name: 'Akua', bio: 'Newer edit' } })
    expect(save).toHaveBeenLastCalledWith({ expectedRevision: 4, draft: { ...profileDraft(initial), name: 'Akua', bio: 'Newer edit' } })
    second.resolve({ ...profileDraft(initial), name: 'Akua', bio: 'Newer edit', revision: 5 })
    await expect(flush).resolves.toMatchObject({ revision: 5 })
    expect(queue.getState().dirty).toBe(false)
  })

  it('manual flush cancels debounce and supplies the latest revision to publication', async () => {
    const save = vi.fn(async ({ draft, expectedRevision }) => ({ ...draft, revision: expectedRevision + 1 }))
    const publish = vi.fn()
    const queue = createDraftSaveQueue({ profile: initial, save })
    queue.update({ bio: 'Ready to publish', photo_asset_id: 'immutable-media-id' })
    const result = await queue.flush()
    publish({ revision: result.revision })
    await vi.advanceTimersByTimeAsync(3000)
    expect(save).toHaveBeenCalledTimes(1)
    expect(publish).toHaveBeenCalledWith({ revision: 4 })
    expect(save.mock.calls[0][0].draft.photo_asset_id).toBe('immutable-media-id')
    expect(save.mock.calls[0][0].draft).not.toHaveProperty('photo_url')
  })

  it('reloads a 409, reconciles untouched fields, retains edits made during reload and requires explicit retry', async () => {
    const remote = deferred()
    const save = vi.fn().mockRejectedValueOnce(conflictError()).mockImplementation(async ({ draft, expectedRevision }) => ({ ...draft, revision: expectedRevision + 1 }))
    const reload = vi.fn(() => remote.promise)
    const queue = createDraftSaveQueue({ profile: initial, save, reload })
    queue.update({ name: 'Local name' })
    const flush = queue.flush()
    const rejected = expect(flush).rejects.toMatchObject({ status: 409 })
    await Promise.resolve()
    await Promise.resolve()
    queue.update({ bio: 'Typed during reload' })
    remote.resolve({ ...initial, revision: 7, title: 'Remote title', name: 'Remote name' })
    await rejected
    expect(queue.getState()).toMatchObject({ revision: 7, dirty: true, conflict: true, draft: { name: 'Local name', title: 'Remote title', bio: 'Typed during reload' } })
    await vi.advanceTimersByTimeAsync(5000)
    expect(save).toHaveBeenCalledTimes(1)
    queue.update({ bio: 'Reviewed' })
    await vi.advanceTimersByTimeAsync(5000)
    expect(save).toHaveBeenCalledTimes(1)
    await queue.flush()
    expect(save).toHaveBeenLastCalledWith({ expectedRevision: 7, draft: { ...profileDraft(initial), name: 'Local name', title: 'Remote title', bio: 'Reviewed' } })
    expect(queue.getState()).toMatchObject({ revision: 8, dirty: false, conflict: false })
  })

  it('preserves edits on a failed reload and retries using a new server revision', async () => {
    const reload = vi.fn().mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce({ ...initial, revision: 8 })
    const save = vi.fn().mockRejectedValueOnce(conflictError()).mockRejectedValueOnce(conflictError()).mockImplementation(async ({ draft }) => ({ ...draft, revision: 9 }))
    const queue = createDraftSaveQueue({ profile: initial, save, reload })
    queue.update({ name: 'Retained' })
    await expect(queue.flush()).rejects.toThrow('Offline')
    expect(queue.getState()).toMatchObject({ dirty: true, draft: { name: 'Retained' } })
    await expect(queue.flush()).rejects.toMatchObject({ status: 409 })
    await queue.flush()
    expect(save).toHaveBeenLastCalledWith({ expectedRevision: 8, draft: { ...profileDraft(initial), name: 'Retained' } })
  })

  it('rejects stale save acknowledgements without advancing revision or clearing dirty edits', async () => {
    const save = vi.fn(async ({ draft }) => ({ ...draft, revision: 2 }))
    const queue = createDraftSaveQueue({ profile: initial, save })
    queue.update({ title: 'Pending' })
    await expect(queue.flush()).rejects.toThrow('stale draft revision')
    expect(queue.getState()).toMatchObject({ dirty: true, revision: 3, draft: { title: 'Pending' } })
  })

  it('does not clear a newer edit when a request fails; manual retry sends that edit', async () => {
    const request = deferred()
    const save = vi.fn().mockReturnValueOnce(request.promise).mockImplementation(async ({ draft }) => ({ ...draft, revision: 4 }))
    const queue = createDraftSaveQueue({ profile: initial, save })
    queue.update({ name: 'First' })
    const flush = queue.flush()
    const rejected = expect(flush).rejects.toThrow('Offline')
    await Promise.resolve()
    queue.update({ name: 'Latest' })
    request.reject(new Error('Offline'))
    await rejected
    expect(queue.getState()).toMatchObject({ dirty: true, draft: { name: 'Latest' } })
    await queue.flush()
    expect(save).toHaveBeenLastCalledWith({ expectedRevision: 3, draft: { ...profileDraft(initial), name: 'Latest' } })
  })

  it('cancels debounce on unmount and ignores an in-flight completion without permitting publication', async () => {
    const pending = deferred()
    const onChange = vi.fn()
    const save = vi.fn(() => pending.promise)
    const queue = createDraftSaveQueue({ profile: initial, save, onChange })
    queue.update({ name: 'Unsaved' })
    queue.dispose()
    await vi.advanceTimersByTimeAsync(5000)
    expect(save).not.toHaveBeenCalled()
    const active = createDraftSaveQueue({ profile: initial, save, onChange })
    active.update({ name: 'In flight' })
    const flush = active.flush()
    const rejected = expect(flush).rejects.toThrow('closed')
    await Promise.resolve()
    active.dispose()
    onChange.mockClear()
    pending.resolve({ ...initial, revision: 4 })
    await rejected
    expect(onChange).not.toHaveBeenCalled()
    expect(active.getState()).toMatchObject({ dirty: true, revision: 3 })
  })

  it('handles a publish-time conflict even when the local draft had no unsaved edits', async () => {
    const reload = vi.fn(async () => ({ ...initial, name: 'Changed elsewhere', revision: 6 }))
    const queue = createDraftSaveQueue({ profile: initial, save: vi.fn(), reload })
    await queue.refresh()
    expect(queue.getState()).toMatchObject({ dirty: true, conflict: true, revision: 6, draft: { name: 'Changed elsewhere' } })
  })

  it('cancels a newer debounce when an in-flight save conflicts, so review cannot be bypassed', async () => {
    const pending = deferred()
    const save = vi.fn(() => pending.promise)
    const reload = vi.fn(async () => ({ ...initial, revision: 6 }))
    const queue = createDraftSaveQueue({ profile: initial, save, reload })
    queue.update({ name: 'First' })
    const flush = queue.flush()
    const rejected = expect(flush).rejects.toMatchObject({ status: 409 })
    await Promise.resolve()
    queue.update({ name: 'Latest' })
    pending.reject(conflictError())
    await rejected
    await vi.advanceTimersByTimeAsync(5000)
    expect(save).toHaveBeenCalledTimes(1)
    expect(queue.getState()).toMatchObject({ dirty: true, conflict: true, draft: { name: 'Latest' } })
  })

  it('rejects a queued flush disposed before it starts', async () => {
    const save = vi.fn()
    const queue = createDraftSaveQueue({ profile: initial, save })
    queue.update({ name: 'Never sent' })
    const flush = queue.flush()
    queue.dispose()
    await expect(flush).rejects.toThrow('closed')
    expect(save).not.toHaveBeenCalled()
  })

  it('keeps a clean draft reviewable when a publish-time reload fails', async () => {
    const queue = createDraftSaveQueue({ profile: initial, save: vi.fn(), reload: vi.fn().mockRejectedValue(new Error('Offline')) })
    await expect(queue.refresh()).rejects.toThrow('Offline')
    expect(queue.getState()).toMatchObject({ dirty: true, conflict: true, draft: profileDraft(initial) })
    expect(queue.getState().error.message).toBe('Offline')
  })

  it('preserves string bigint revisions beyond Number precision and snapshots caller-owned arrays', async () => {
    const large = '9007199254740993'
    const next = '9007199254740994'
    const request = deferred()
    const save = vi.fn(() => request.promise)
    const queue = createDraftSaveQueue({ profile: { ...initial, revision: large }, save })
    const links = [{ id: 'contact', type: 'email', url: 'ama@example.com' }]
    queue.update({ links })
    links[0].url = 'mutated@example.com'
    const flush = queue.flush()
    await Promise.resolve()
    expect(save.mock.calls[0][0]).toMatchObject({ expectedRevision: large, draft: { links: [{ url: 'ama@example.com' }] } })
    request.resolve({ ...profileDraft(initial), links: [{ id: 'contact', type: 'email', url: 'ama@example.com' }], revision: next })
    await expect(flush).resolves.toMatchObject({ revision: next })
    expect(queue.getState()).toMatchObject({ revision: next, dirty: false })
  })
})
