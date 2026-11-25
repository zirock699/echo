import {repairRollingCaptionLessons} from './import-transcript.mjs';
import {restoreOriginalPlayback} from './playback-recovery.mjs';
import {migrateLibrary} from './courses.mjs';
import {uid} from './transcript.mjs';
import {validateSnapshot} from './snapshot.mjs';
import {mediaReferences, queueUnreferencedMedia} from './library-mutations.mjs';
import {MAX_STATE_BYTES} from './sync-limits.mjs';
import {cacheKey, deviceCache, draftKey, sameDraftVersion} from './device-cache.mjs';

const OWNER_HEADER = 'x-echo-owner';
const OWNER_KEY = /^[a-f0-9]{64}$/;
const CACHE_WAIT_MS = 2500;
const CHECKPOINT_SYNC_MS = 15000;
const CAPACITY_CODES = new Set(['state-too-large', 'storage-too-large', 'state-count-limit']);
const SAVE_ERROR_CODES = new Set([...CAPACITY_CODES, 'media-retired', 'invalid-state']);
const encoder = new TextEncoder();

export function initialData(){return {schemaVersion:2,courses:[],categories:[],tags:[],lessons:[],collections:[],sessions:[],preferences:{originalPlaybackVersion:1,theme:'dark',mode:'continuous',speed:1,grouping:'original',leadIn:0,pauseType:'duration',fixedPause:4,multiplier:1.5,showText:true,showIPA:false,wakeLock:false,reduceMotion:false,startupLesson:'recent'},lastLessonId:null};}
function loadedData(raw) {
  if (!raw) return initialData();
  validateSnapshot(raw);
  const defaults = initialData();
  return {
    ...defaults, ...raw,
    lessons: raw.lessons.map(lesson => ({
      ...lesson, title: lesson.title ?? 'Untitled lesson',
      phrases: lesson.phrases ?? [], statuses: lesson.statuses ?? {},
      progress: {...lesson.progress, position: lesson.progress?.position ?? 0, coverage: lesson.progress?.coverage ?? []},
    })),
    sessions: raw.sessions.map(session => ({...session, coveredIds: session.coveredIds ?? [], activeSeconds: session.activeSeconds ?? 0})),
    preferences: {...defaults.preferences, ...raw.preferences,
      originalPlaybackVersion: raw.preferences.originalPlaybackVersion || 0},
  };
}

class CacheTimeout extends Error {}
async function accessCache(operation) {
  let deadline;
  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise((_, reject) => { deadline = setTimeout(() => reject(new CacheTimeout('Device storage did not respond.')), CACHE_WAIT_MS); }),
    ]);
  } finally { clearTimeout(deadline); }
}
async function snapshotFingerprint(snapshot) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(snapshot));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
function cachedSaveError(value) {
  if (!SAVE_ERROR_CODES.has(value?.code) || !OWNER_KEY.test(value?.fingerprint || '')) return null;
  return {code: value.code, fingerprint: value.fingerprint};
}
const serializeState = (revision, data) => JSON.stringify({expectedRevision: revision, data});
const signedOut = response => response.status === 401 || response.status === 403 ||
  response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400);
function portableData(data) {
  const {pendingAudioDeletes, _retiredMedia, ...portable} = data;
  return portable;
}
const exportData = data => JSON.stringify({app:'Echo Studio', version:1, exportedAt:new Date().toISOString(), data:portableData(data)}, null, 2);

function validDeviceDraft(record, owner) {
  try {
    if (record?.pending !== true || record.owner !== owner || !Number.isSafeInteger(record.revision) || record.revision < 0) return false;
    validateSnapshot(record.data);
    return true;
  } catch { return false; }
}

function sameDeviceDraftContent(current, previous) {
  if (!previous || previous.owner !== current.owner || previous.revision !== current.revision) return false;
  if (current.token && current.token === previous.token) return true;
  return previous.saveError?.code === current.saveError?.code &&
    previous.saveError?.fingerprint === current.saveError?.fingerprint &&
    JSON.stringify(previous.data) === JSON.stringify(current.data);
}

export class Store {
  constructor({cache = deviceCache} = {}) {
    this.cache = cache;
    this.data = initialData();
    this.revision = 0;
    this.mode = 'checking';
    this.pending = false;
    this.seq = 0;
    this.conflict = null;
    this.onChange = () => {};
    this.timer = null;
    this.flushAt = null;
    this.checkpointAt = null;
    this.saving = null;
    this.savingSequence = null;
    this.connection = null;
    this.retryDelay = 2000;
    this.owner = null;
    this.authenticated = false;
    this.generation = 0;
    this.ownerAbort = new AbortController();
    this.suspended = new Map();
    this.preserveCache = false;
    this.cacheStatus = 'pending';
    this.cacheWrites = new Map();
    this.cacheVersion = 0;
    this.saveError = null;
    this.writer = this.cache.list ? crypto.randomUUID() : null;
    this.draftRecords = new Map();
    this.deviceDraftOccurrence = 0;
    this.draftMedia = null;
    this.deviceRead = 0;
    this.reviewedDrafts = new Map();
    this.adoptedDrafts = new Map();
    this.adoptedSequence = null;
    this.deviceReviewRequired = false;
    this.deviceChoice = null;
  }

  migrate(){const missing=new Set(this.data.lessons.filter(l=>l.importedAt&&!l.phrases?.length&&l.source).map(l=>l.id));migrateLibrary(this.data);const repaired=repairRollingCaptionLessons(this.data),recovered=restoreOriginalPlayback(this.data);if(repaired||recovered||this.data.lessons.some(l=>missing.has(l.id)&&l.phrases?.length)){this.pending=true;this.seq++;}}

  #scheduleFlush(delay) {
    const now = Date.now();
    // Debounce ordinary edits without postponing a flush that is already due.
    if (this.flushAt === null || this.flushAt > now) this.flushAt = now + delay;
    this.#armFlush();
  }

  #armFlush() {
    clearTimeout(this.timer);
    this.timer = null;
    if (this.saving || !this.authenticated || !this.pending || this.deviceReviewRequired || this.deviceChoice) return;
    const nextWrite = this.flushAt ?? Infinity;
    const nextCheckpoint = this.checkpointAt ?? Infinity;
    const next = this.mode === 'cloud' ? Math.min(nextWrite, nextCheckpoint) :
      this.mode === 'offline' ? nextWrite : Infinity;
    if (!Number.isFinite(next)) return;
    this.timer = setTimeout(() => this.#send(false), Math.max(0, next - Date.now()));
  }

  #clearFlushSchedule() {
    clearTimeout(this.timer);
    this.timer = null;
    this.flushAt = null;
    this.checkpointAt = null;
  }

  resetOwner() {
    // Keep pending work for reauthentication even if browser storage failed.
    if (this.owner && this.pending) this.suspended.set(this.owner, structuredClone(this.cacheSnapshot()));
    this.#clearFlushSchedule();
    this.ownerAbort.abort();
    this.ownerAbort = new AbortController();
    this.generation++;
    this.owner = null;
    this.authenticated = false;
    this.data = initialData();
    this.revision = 0;
    this.pending = false;
    this.conflict = null;
    this.seq = 0;
    this.saving = null;
    this.savingSequence = null;
    this.retryDelay = 2000;
    this.preserveCache = false;
    this.cacheStatus = 'pending';
    this.saveError = null;
    this.draftRecords.clear();
    this.draftMedia = null;
    this.reviewedDrafts.clear();
    this.adoptedDrafts.clear();
    this.adoptedSequence = null;
    this.deviceReviewRequired = false;
    this.deviceChoice = null;
    this.mode = 'locked';
    this.onChange();
  }

  init() {
    return this.connect();
  }

  async connect() {
    if (this.connection) return this.connection;
    const connection = this.#connect();
    this.connection = connection;
    try { await connection; } finally { if (this.connection === connection) this.connection = null; }
  }

  async #connect() {
    const requestGeneration = this.generation;
    const requestedRevision = this.revision;
    let response;
    try {
      response = await fetch('/api/state', {headers: {Accept: 'application/json'}, cache: 'no-store',
        redirect: 'manual', signal: AbortSignal.timeout(5000)});
    } catch {
      if (requestGeneration === this.generation) {
        this.connectionUnavailable();
        await this.refreshDeviceDrafts();
      }
      return;
    }
    if (requestGeneration !== this.generation) return;
    const owner = response.headers.get(OWNER_HEADER);
    if (signedOut(response) || (response.ok && !OWNER_KEY.test(owner || ''))) {
      this.resetOwner();
      return;
    }
    if (!response.ok) {
      if (owner && owner !== this.owner) this.resetOwner();
      else {
        this.connectionUnavailable();
        await this.refreshDeviceDrafts();
      }
      return;
    }
    const switched = this.owner !== owner;
    if (switched && this.owner) this.resetOwner();
    const generation = this.generation;
    let remote;
    try {
      remote = await response.json();
      if (!Number.isSafeInteger(remote.revision) || remote.revision < 0) throw Error('Invalid revision');
      if (remote.data !== null) validateSnapshot(remote.data);
    } catch {
      this.connectionUnavailable();
      return;
    }
    if (!switched) await this.saving;
    if (generation !== this.generation ||
        (!switched && this.revision !== requestedRevision && remote.revision < this.revision)) return;
    const devices = this.writer ? await this.#readDeviceDrafts(owner) : null;
    if (generation !== this.generation ||
        (!switched && this.revision !== requestedRevision && remote.revision < this.revision)) return;
    if (devices && remote.data !== null) this.#dropLandedDrafts(devices, remote);
    if (switched) {
      // Never read the unbound v1 `state` entry. It may belong to another owner.
      let cached = this.suspended.get(owner);
      let preserveCache = false;
      try {
        if (this.writer) {
          cached ||= this.#recoverDeviceDrafts(owner, remote.revision, devices);
        } else {
          cached ||= await accessCache(() => this.cache.get(cacheKey(owner)));
        }
      }
      catch { preserveCache = true; }
      if (generation !== this.generation) return;
      this.preserveCache = preserveCache;
      if (cached?.pending) {
        try {
          if (cached.owner !== owner || !cached.data || !Number.isSafeInteger(cached.revision) || cached.revision < 0)
            throw Error('Invalid saved library metadata');
          const pendingData = loadedData(cached.data);
          const failure = cachedSaveError(cached.saveError);
          const unchanged = failure && failure.fingerprint === await snapshotFingerprint(serializeState(cached.revision, cached.data));
          if (generation !== this.generation) return;
          this.data = pendingData;
          this.revision = cached.revision;
          this.pending = true;
          this.saveError = unchanged ? failure : null;
        } catch {
          // Keep a malformed pending snapshot separate when the current
          // server copy replaces the cache. Its contents are never rendered.
          let preserveCache = false;
          try { await accessCache(() => this.cache.set(`${cacheKey(owner)}:unreadable:${crypto.randomUUID()}`, cached)); }
          catch { preserveCache = true; }
          if (generation !== this.generation) return;
          this.preserveCache = preserveCache;
        }
      }
      this.suspended.delete(owner);
      this.owner = owner;
      this.generation++;
    }
    this.authenticated = true;
    const hadDeviceCopies = this.draftRecords.size > 0;
    if (devices) this.#installDeviceDrafts(devices);
    if (!switched && remote.revision === this.revision &&
        ['cloud', 'offline', 'conflict', 'rejected'].includes(this.mode)) {
      if (devices?.size || hadDeviceCopies) {
        this.#armFlush();
        this.onChange();
      }
      return;
    }
    let acceptedData;
    if (this.pending && remote.data !== null && remote.revision === this.revision + 1) {
      const cloudData = loadedData(remote.data);
      // A reload can interrupt the acknowledgement after the write commits.
      // Clear pending only when the verified cloud copy contains the entire snapshot.
      if (JSON.stringify(cloudData) === JSON.stringify(this.data)) {
        acceptedData = this.data;
        this.pending = false;
        this.saveError = null;
        this.retryDelay = 2000;
        this.#clearFlushSchedule();
        this.#removeAdoptedDrafts();
      }
    }
    if (this.pending && remote.revision !== this.revision) {
      this.conflict = remote;
      this.mode = 'conflict';
    } else {
      this.conflict = null;
      this.mode = switched && this.pending && this.saveError ? 'rejected' : 'cloud';
      if (!this.pending && (switched || remote.revision !== this.revision)) {
        this.data = acceptedData ?? loadedData(remote.data);
        this.revision = remote.revision;
      }
    }
    this.migrate();
    this.#updateDeviceReview();
    this.saveCache();
    this.onChange();
    if (this.pending && this.mode === 'cloud') this.#scheduleFlush(0);
    else this.#armFlush();
  }

  connectionUnavailable() {
    // A fresh or signed-out tab has no way to prove who owns a local copy.
    // Only a still-open, previously verified session can continue offline.
    if (!this.authenticated) this.mode = 'locked';
    else if (!['offline', 'conflict', 'rejected'].includes(this.mode)) this.mode = 'local';
    this.#armFlush();
    this.onChange();
  }

  async #readDeviceDrafts(owner, complete = false) {
    const read = ++this.deviceRead;
    try {
      const copies = await accessCache(() => this.cache.list(owner));
      if (read !== this.deviceRead) return null;
      const valid = new Map([...copies].filter(([, record]) => validDeviceDraft(record, owner)));
      return complete && valid.size !== copies.size ? null : valid;
    } catch { return null; }
  }

  #recoverDeviceDrafts(owner, revision, drafts) {
    if (!drafts?.size) return null;
    const compatible = [...drafts].filter(([id, record]) => record.revision === revision || id === cacheKey(owner));
    if (!compatible.length) return null;
    const record = (compatible.find(([, copy]) => cachedSaveError(copy.saveError)) ?? compatible[0])[1];
    if (drafts.size > 1) {
      // A reload can find both the selected source and the new tab's
      // durable copy before account acknowledgement. They must fully agree.
      const payload = serializeState(record.revision, loadedData(record.data));
      for (const copy of drafts.values()) {
        if (copy !== record && serializeState(copy.revision, loadedData(copy.data)) !== payload) return null;
      }
    }
    this.adoptedDrafts = new Map(drafts);
    this.adoptedSequence = this.seq;
    return record;
  }

  #dropLandedDrafts(drafts, remote) {
    const received = [...drafts].filter(([, record]) => record.revision + 1 === remote.revision);
    if (!received.length) return;
    const cloud = JSON.stringify(loadedData(remote.data));
    for (const [id, record] of received) {
      if (JSON.stringify(loadedData(record.data)) !== cloud) continue;
      drafts.delete(id);
      // A comparison happens again in the write transaction in case an
      // outstanding tab has since put a newer checkpoint at the same key.
      this.cache.remove(id, record).catch(() => {});
    }
  }

  #installDeviceDrafts(drafts) {
    drafts.delete(draftKey(this.owner, this.writer));
    for (const [id, record] of this.adoptedDrafts) {
      if (sameDraftVersion(drafts.get(id), record)) drafts.delete(id);
    }
    this.#replaceDeviceDrafts(drafts);
    for (const id of this.reviewedDrafts.keys()) {
      if (!drafts.has(id)) this.reviewedDrafts.delete(id);
    }
    this.#updateDeviceReview();
  }

  #replaceDeviceDrafts(drafts) {
    if (drafts.size !== this.draftRecords.size ||
        [...drafts].some(([id, record]) => !sameDeviceDraftContent(record, this.draftRecords.get(id)))) {
      this.deviceDraftOccurrence++;
      this.draftMedia = null;
    }
    this.draftRecords = drafts;
  }

  #updateDeviceReview() {
    this.deviceReviewRequired = (this.pending || this.draftRecords.size > 1) &&
      [...this.draftRecords].some(([id, record]) => !sameDraftVersion(record, this.reviewedDrafts.get(id)));
  }

  async refreshDeviceDrafts({complete = false} = {}) {
    if (!this.writer || !this.authenticated) return false;
    const generation = this.generation;
    const writer = this.writer;
    const copies = await this.#readDeviceDrafts(this.owner, complete);
    if (!copies || generation !== this.generation || writer !== this.writer) return false;
    this.#installDeviceDrafts(copies);
    this.#armFlush();
    this.onChange();
    return true;
  }

  get deviceDrafts() {
    return [...this.draftRecords].map(([id, {data, revision, savedAt}]) => {
      const lesson = data.lessons.find(lesson => lesson.id === data.lastLessonId) ??
        data.lessons.reduce((recent, lesson) => (lesson.progress?.updatedAt ?? 0) > (recent?.progress?.updatedAt ?? -1) ? lesson : recent, null);
      return {id, savedAt: Number.isFinite(savedAt) ? savedAt : null, revision,
        lessons: data.lessons.length, collections: data.collections.length, sessions: data.sessions.length,
        position: lesson?.progress?.position ?? null, title: lesson?.title ?? '', theme: data.preferences.theme ?? ''};
    }).sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0));
  }

  exportDeviceDraft(id) {
    const record = this.draftRecords.get(id);
    return this.authenticated && record ? exportData(record.data) : null;
  }

  deviceDraftMediaReferences() {
    if (this.draftMedia) return this.draftMedia;
    const paths = new Set();
    for (const {data} of this.draftRecords.values()) {
      for (const path of mediaReferences(data)) paths.add(path);
    }
    this.draftMedia = paths;
    return paths;
  }

  keepWorkingCopy() {
    if (!this.authenticated || this.deviceChoice) return false;
    this.reviewedDrafts = new Map(this.draftRecords);
    this.#updateDeviceReview();
    if (this.pending && this.mode === 'cloud') this.#scheduleFlush(0);
    else this.#armFlush();
    this.onChange();
    return true;
  }

  async useDeviceDraft(id) {
    const reviewed = this.draftRecords.get(id);
    if (!this.authenticated || !reviewed || this.deviceChoice) return false;
    const generation = this.generation;
    const choice = {};
    this.deviceChoice = choice;
    this.#armFlush();
    try {
      await this.saving;
      await this.connection;
      if (generation !== this.generation) return false;
      const sequence = this.seq;
      const workingId = draftKey(this.owner, this.writer);
      let working;
      if (this.pending) {
        await accessCache(() => this.saveCache());
        if (this.cacheStatus !== 'saved') return false;
        working = await accessCache(() => this.cache.get(workingId));
        if (!validDeviceDraft(working, reviewed.owner)) {
          if (this.adoptedSequence !== sequence || !this.adoptedDrafts.size) return false;
          working = null;
        }
      }
      const record = await accessCache(() => this.cache.get(id));
      if (!sameDraftVersion(record, reviewed)) {
        await this.refreshDeviceDrafts();
        return false;
      }
      const data = loadedData(record.data);
      const cachedError = cachedSaveError(record.saveError);
      const unchangedError = cachedError &&
        cachedError.fingerprint === await snapshotFingerprint(serializeState(record.revision, record.data));
      if (generation !== this.generation || sequence !== this.seq) return false;
      // The prior tab copy keeps its own keys and can still be reviewed.
      const alternatives = new Map(this.draftRecords);
      if (working) alternatives.set(workingId, working);
      for (const [sourceId, source] of this.adoptedDrafts) alternatives.set(sourceId, source);
      this.writer = crypto.randomUUID();
      this.reviewedDrafts = new Map(alternatives);
      this.adoptedDrafts = new Map([[id, record]]);
      alternatives.delete(id);
      this.#replaceDeviceDrafts(alternatives);
      this.data = data;
      this.revision = record.revision;
      this.pending = true;
      this.seq++;
      this.adoptedSequence = this.seq;
      this.saveError = unchangedError ? cachedError : null;
      this.mode = this.saveError ? 'rejected' : 'local';
      this.conflict = null;
      this.#clearFlushSchedule();
      this.#updateDeviceReview();
      this.saveCache();
      this.onChange();
      await this.connect();
      return generation === this.generation;
    } catch { return false; }
    finally {
      if (this.deviceChoice === choice) {
        this.deviceChoice = null;
        this.#armFlush();
      }
    }
  }

  async discardDeviceDraft(id) {
    const reviewed = this.draftRecords.get(id);
    if (!this.authenticated || !reviewed) return false;
    const generation = this.generation;
    try {
      const removed = await accessCache(() => this.cache.remove(id, reviewed));
      if (generation !== this.generation) return false;
      await this.refreshDeviceDrafts();
      return generation === this.generation && removed;
    } catch { return false; }
  }

  #removeAdoptedDrafts() {
    for (const [id, record] of this.adoptedDrafts) this.cache.remove(id, record).catch(() => {});
    this.adoptedDrafts.clear();
    this.adoptedSequence = null;
  }

  cacheSnapshot() {
    return {owner: this.owner, data: this.data, revision: this.revision, pending: this.pending, saveError: this.saveError};
  }

  saveCache() {
    const owner = this.owner;
    if (!owner) return;
    if (this.preserveCache) { this.cacheStatus = 'unavailable'; return; }
    const active = this.cacheWrites.get(owner);
    this.cacheStatus = active?.timedOutGeneration === this.generation ? 'unavailable' : 'pending';
    this.cacheVersion++;
    // Serialize an owner's local writes. Bursts only need the newest
    // snapshot after the current transaction, even if the owner changes.
    if (active) return active.write;
    const lease = {timedOutGeneration: null};
    const write = this.#writeCache(owner, lease);
    lease.write = write;
    this.cacheWrites.set(owner, lease);
    write.then(() => {
      this.cacheWrites.delete(owner);
      if (owner === this.owner && this.cacheStatus === 'pending') this.saveCache();
    });
    return write;
  }

  async #writeDeviceCopy(key, snapshot, sources) {
    if (!snapshot.pending) return this.cache.remove(key);
    for (const [id, reviewed] of sources) {
      if (reviewed.revision !== snapshot.revision) continue;
      const previous = cachedSaveError(reviewed.saveError);
      if (previous?.code !== snapshot.saveError?.code || previous?.fingerprint !== snapshot.saveError?.fingerprint) continue;
      const current = await this.cache.get(id).catch(() => null);
      if (sameDraftVersion(current, reviewed)) return;
    }
    return this.cache.set(key, {...snapshot, token:crypto.randomUUID(), savedAt:Date.now()});
  }

  async #writeCache(owner, lease) {
    while (owner === this.owner && !this.preserveCache) {
      const generation = this.generation;
      const version = this.cacheVersion;
      let status = 'saved';
      let transaction;
      try {
        const snapshot = structuredClone(this.cacheSnapshot());
        const key = this.writer ? draftKey(owner, this.writer) : cacheKey(owner);
        const sources = this.adoptedSequence === this.seq ? [...this.adoptedDrafts] : [];
        const write = this.writer ? () => this.#writeDeviceCopy(key, snapshot, sources) : () => this.cache.set(key, snapshot);
        transaction = Promise.resolve().then(write);
        await accessCache(() => transaction);
      }
      catch (error) {
        status = 'unavailable';
        if (error instanceof CacheTimeout) {
          lease.timedOutGeneration = generation;
          if (generation === this.generation) {
            this.cacheStatus = status;
            this.onChange();
          }
          // Keep the write lease until this transaction actually settles so
          // a late put cannot overwrite a newer snapshot of the same owner.
          status = await transaction.then(() => 'saved', () => 'unavailable');
          lease.timedOutGeneration = null;
        }
      }
      if (owner !== this.owner) return;
      if (generation !== this.generation || version !== this.cacheVersion) continue;
      this.cacheStatus = status;
      this.onChange();
      return;
    }
  }

  mutate(fn) {
    this.#change(fn, false);
  }

  checkpoint(fn) {
    this.#change(fn, true);
  }

  #change(fn, progressOnly) {
    if (!this.authenticated) throw Error('Sign in before changing a library.');
    fn(this.data);
    if (!progressOnly) {
      if (this.mode === 'rejected' && !CAPACITY_CODES.has(this.saveError?.code)) this.mode = 'cloud';
      this.migrate();
    }
    this.seq++;
    this.pending = true;
    this.#updateDeviceReview();
    this.saveCache();
    if (progressOnly) {
      if (this.checkpointAt === null) {
        this.checkpointAt = Date.now() + CHECKPOINT_SYNC_MS;
        this.#armFlush();
      }
    } else if (this.mode === 'cloud' || (this.mode === 'offline' && this.saving)) {
      this.#scheduleFlush(1000);
    }
    this.onChange();
  }

  async ownedFetch(path, init = {}, expectedOwner = this.owner) {
    if (!expectedOwner || !this.authenticated || expectedOwner !== this.owner) throw Error('The library account is not verified.');
    if (path !== '/api/state' && !/^\/api\/audio(?:\/[A-Za-z0-9_-]+)?$/.test(path)) throw Error('Invalid library request.');
    const generation = this.generation;
    const headers = new Headers(init.headers);
    headers.set(OWNER_HEADER, expectedOwner);
    const ownerSignal = this.ownerAbort.signal;
    const signal = init.signal ? AbortSignal.any([init.signal, ownerSignal]) : ownerSignal;
    const response = await fetch(path, {...init, headers, signal, redirect: 'manual'});
    if (generation !== this.generation) throw Error('The library account changed.');
    const receivedOwner = response.headers.get(OWNER_HEADER);
    if (signedOut(response) || response.status === 412 || (receivedOwner && receivedOwner !== expectedOwner)) {
      const connection = this.connection;
      this.resetOwner();
      if (!signedOut(response)) Promise.resolve(connection).then(() => this.connect());
      throw Error('The library account changed.');
    }
    if (!receivedOwner) {
      // A gateway can reject a large body before the Worker attaches its
      // owner header. This carries no authenticated response data.
      if (path === '/api/state' && init.method === 'PUT' && response.status === 413) return response;
      if (response.status < 500) this.resetOwner();
      throw Error('The library account could not be verified.');
    }
    return response;
  }

  async flush() {
    if (!this.saving || this.seq === this.savingSequence) return this.#send(false);
    const generation = this.generation;
    this.#scheduleFlush(0);
    await this.saving;
    if (generation === this.generation && this.mode === 'cloud') return this.#send(false);
  }

  async #send(retryRejected) {
    if (this.saving) return this.saving;
    if (!this.pending || !this.authenticated || this.deviceReviewRequired || this.deviceChoice ||
        !(['cloud', 'offline'].includes(this.mode) || (retryRejected && this.mode === 'rejected'))) return;
    this.#clearFlushSchedule();
    this.savingSequence = this.seq;
    const operation = this.#flush();
    this.saving = operation;
    try { await operation; } finally {
      if (this.saving === operation) {
        this.saving = null;
        this.savingSequence = null;
        this.#armFlush();
      }
    }
  }

  async #rejectSave(code, snapshot, generation, sequence, fingerprint) {
    const rejected = {code, fingerprint: fingerprint ?? await snapshotFingerprint(snapshot)};
    if (generation !== this.generation) return;
    // If edits arrived while the request was in flight, let the newer
    // payload run once without stamping it with the old failure. A no-op
    // edit still has the same body and remains blocked.
    const unchanged = this.seq === sequence || serializeState(this.revision, this.data) === snapshot;
    this.saveError = unchanged ? rejected : null;
    this.mode = unchanged ? 'rejected' : 'cloud';
    this.retryDelay = 2000;
  }

  async #flush() {
    const owner = this.owner;
    const generation = this.generation;
    if (this.writer && this.data.pendingAudioDeletes?.length) {
      // Recording retirement in D1 is irreversible. A sibling tab can
      // have saved a pending reference since our last owner verification.
      const drafts = await this.#readDeviceDrafts(owner, true);
      if (generation !== this.generation) return;
      if (drafts) this.#installDeviceDrafts(drafts);
      if (this.deviceReviewRequired || this.deviceChoice) {
        this.onChange();
        return;
      }
      const referenced = this.deviceDraftMediaReferences();
      const safe = drafts ? (this.data.pendingAudioDeletes || []).filter(path => !referenced.has(path)) : [];
      if (safe.length) this.data.pendingAudioDeletes = safe;
      else delete this.data.pendingAudioDeletes;
    }
    const sequence = this.seq;
    this.savingSequence = sequence;
    const sentRetirements = new Set(this.data.pendingAudioDeletes || []);
    const snapshot = serializeState(this.revision, this.data);
    let fingerprint;
    try {
      if (this.saveError) {
        fingerprint = await snapshotFingerprint(snapshot);
        if (generation !== this.generation) return;
      }
      if (fingerprint && fingerprint === this.saveError?.fingerprint) {
        this.mode = this.seq === sequence ? 'rejected' : 'cloud';
      } else if (encoder.encode(snapshot).byteLength > MAX_STATE_BYTES) {
        await this.#rejectSave('state-too-large', snapshot, generation, sequence, fingerprint);
      } else {
        if (this.mode === 'rejected') this.mode = 'cloud';
        this.saveError = null;
        const response = await this.ownedFetch('/api/state', {method: 'PUT', headers: {'Content-Type': 'application/json'},
          body: snapshot, signal: AbortSignal.timeout(12000)}, owner);
        if ([400, 413, 422].includes(response.status)) {
          const result = response.headers.has(OWNER_HEADER) ? await response.json().catch(() => null) : null;
          const code = response.status === 413 ? (CAPACITY_CODES.has(result?.code) ? result.code : 'state-too-large') :
            result?.code === 'media-retired' ? 'media-retired' : 'invalid-state';
          if (generation === this.generation) await this.#rejectSave(code, snapshot, generation, sequence, fingerprint);
        } else {
          if (!response.ok && response.status !== 409) throw Error(`Save failed: ${response.status}`);
          const result = await response.json();
          if (generation !== this.generation) return;
          if (!Number.isSafeInteger(result.revision) || result.revision < 0) throw Error('Invalid revision');
          if (response.status === 409) {
            if (result.data !== null) validateSnapshot(result.data);
            this.conflict = result;
            this.mode = 'conflict';
          } else {
            this.revision = result.revision;
            this.pending = this.seq !== sequence;
            if (Array.isArray(result.pendingAudioDeletes)) {
              const newer = (this.data.pendingAudioDeletes || []).filter(url => !sentRetirements.has(url));
              this.data.pendingAudioDeletes = newer;
              queueUnreferencedMedia(this.data, result.pendingAudioDeletes);
            }
            this.mode = 'cloud';
            this.saveError = null;
            this.retryDelay = 2000;
            this.#removeAdoptedDrafts();
          }
        }
      }
    } catch {
      if (generation === this.generation) this.mode = 'offline';
    }
    if (generation !== this.generation) return;
    this.migrate();
    this.#updateDeviceReview();
    this.saveCache();
    this.onChange();
    if (this.pending && this.mode === 'cloud' && (this.flushAt !== null || this.checkpointAt === null)) {
      // Preserve the prompt follow-up for edits while a save was in progress.
      this.flushAt = Math.min(this.flushAt ?? Infinity, Date.now() + 150);
    }
    else if (this.pending && this.mode === 'offline') {
      this.flushAt = Date.now() + this.retryDelay;
      this.retryDelay = Math.min(30000, this.retryDelay * 2);
    }
  }

  async retry() {
    if (['local', 'locked', 'checking'].includes(this.mode)) return this.connect();
    return this.#send(true);
  }

  resolveConflict(keepLocal) {
    if (!this.authenticated || !this.conflict) return;
    const {revision, data} = this.conflict;
    this.revision = revision;
    this.mode = 'cloud';
    this.conflict = null;
    this.saveError = null;
    if (keepLocal) {
      this.pending = true;
      this.flush();
    } else {
      this.#clearFlushSchedule();
      this.data = loadedData(data);
      this.pending = false;
      this.#removeAdoptedDrafts();
      this.migrate();
      this.#updateDeviceReview();
      this.saveCache();
      this.onChange();
      if (this.pending) this.#scheduleFlush(0);
    }
  }

  export(){return exportData(this.data);}
  restore(raw) {
    const backup = JSON.parse(raw);
    if (backup?.app !== 'Echo Studio' || !backup.data || typeof backup.data !== 'object' || Array.isArray(backup.data)) throw Error('This is not a valid Echo Studio export.');
    const restored = loadedData(portableData(backup.data));
    this.mutate(() => { this.data = restored; });
  }
}
export const createLesson=(videoId,title,source,format,segments,phrases,grouping,offset=0,speaker='')=>({id:uid(),videoId,title,speaker,source,format,segments,phrases,grouping,offset,duration:null,createdAt:Date.now(),updatedAt:Date.now(),favourite:false,statuses:{},progress:{position:0,phraseId:phrases[0]?.id||null,coverage:[],updatedAt:0},revisions:[],ipaOverrides:{}});
