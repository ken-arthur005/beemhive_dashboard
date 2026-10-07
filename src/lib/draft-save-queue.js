// Framework-independent serialized CAS queue. Revisions are server-authoritative.
const clone = value => structuredClone(value)
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

export function profileDraft(profile) {
  return {
    name: profile.name ?? '', title: profile.title ?? '', bio: profile.bio ?? '',
    links: Array.isArray(profile.links) ? profile.links.map((link, index) => ({ ...link, id: typeof link.id === 'string' ? link.id : `legacy-${index}` })) : [], show_save_contact: profile.show_save_contact ?? true,
    background: profile.background ?? null, photo_asset_id: profile.photo_asset_id ?? null,
  }
}

// Keep locally changed fields; refresh untouched fields from the server.
function reconcile(base, local, remote) {
  return Object.fromEntries(Object.keys(remote).map(key => [
    key, same(base[key], local[key]) ? clone(remote[key]) : clone(local[key]),
  ]))
}

export function createDraftSaveQueue({ profile, save, reload, onChange = () => {}, delay = 2000 }) {
  let acknowledged = clone(profile)
  let base = profileDraft(profile)
  let draft = clone(base)
  let timer = null
  let running = null
  let disposed = false
  let error = null
  let conflict = false
  let generation = 0
  let savedGeneration = 0

  function state() {
    return {
      draft: clone(draft), profile: clone(acknowledged), revision: acknowledged.revision,
      dirty: generation !== savedGeneration, saving: Boolean(running), error, conflict,
    }
  }
  function notify() { if (!disposed) onChange(state()) }
  function cancelDebounce() { clearTimeout(timer); timer = null }

  async function refresh() {
    cancelDebounce()
    conflict = true
    generation += 1
    try {
      const remote = await reload()
      if (disposed) throw new Error('Draft editor has closed.')
      if (BigInt(remote.revision) < BigInt(acknowledged.revision)) throw new Error('The server returned an older revision. Reload again before saving.')
      draft = reconcile(base, draft, profileDraft(remote))
      acknowledged = clone(remote)
      base = profileDraft(remote)
      error = new Error('Another session changed your draft. Your pending edits have been retained. Review them, then save again.')
      error.status = 409
      notify()
      return error
    } catch (failure) {
      error = failure
      notify()
      throw failure
    }
  }

  async function drain() {
    if (disposed) throw new Error('Draft editor has closed.')
    while (!disposed && generation !== savedGeneration) {
      const sentGeneration = generation
      const sentDraft = clone(draft)
      const expectedRevision = acknowledged.revision
      try {
        const result = await save({ expectedRevision, draft: sentDraft })
        if (disposed) throw new Error('Draft editor has closed.')
        if (BigInt(result.revision) <= BigInt(expectedRevision)) {
          throw new Error('The server returned a stale draft revision. Your edits are still unsaved.')
        }
        const remote = profileDraft(result)
        draft = reconcile(sentDraft, draft, remote)
        acknowledged = clone(result)
        base = remote
        savedGeneration = sentGeneration
        notify()
      } catch (failure) {
        if (disposed) throw failure
        cancelDebounce()
        if (failure.status === 409) {
          throw await refresh()
        }
        error = failure
        throw failure
      }
    }
    if (disposed) throw new Error('Draft editor has closed.')
    return clone(acknowledged)
  }

  function flush() {
    cancelDebounce()
    if (disposed) return Promise.reject(new Error('Draft editor has closed.'))
    if (running) return running
    error = null
    conflict = false
    // Assign the promise before drain begins so subscribers always see saving=true.
    running = Promise.resolve().then(drain).catch(failure => {
      if (!disposed) error = failure
      throw failure
    }).finally(() => { running = null; notify() })
    notify()
    return running
  }

  function update(patch) {
    if (disposed) return
    draft = { ...draft, ...clone(patch) }
    generation += 1
    cancelDebounce()
    // A conflict requires explicit review/retry, not an automatic overwrite.
    if (!conflict) timer = setTimeout(() => { flush().catch(() => {}) }, delay)
    notify()
  }

  return {
    update, flush, refresh, getState: state,
    dispose() { disposed = true; cancelDebounce() },
  }
}
