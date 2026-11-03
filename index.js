/**
 * Host half of the activity heatmap.
 *
 * Reads the session logs (the only source of truth), folds model-call usage into
 * one record per local calendar day, and serves that ledger to the Client over a
 * same-origin JSON route. Nothing is written back into any session log.
 *
 * Ledger:      $DSH_HOME/storages/activity-heatmap/state.json
 * Price table: $DSH_HOME/storages/activity-heatmap/config.json   (user editable)
 */
import { mkdirSync, readFileSync, writeFileSync, renameSync, appendFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import os from 'node:os'

const NS = 'activity-heatmap'
const ROUTE = '/plugin/activity-heatmap'
const YEAR_MS = 365 * 24 * 60 * 60 * 1000

/** Reference price used until a model gets its own entry. CNY per 1M tokens, DeepSeek official. */
const DEFAULT_PRICES = {
  schema: 2,
  currency: 'CNY',
  note: 'default = DeepSeek official reference price (cache hit / cache miss / output).',
  default: { cacheMiss: 2, cacheHit: 0.2, output: 3 },
  models: {},
}

export const inject = ['webServer']

const pad = (n) => String(n).padStart(2, '0')

function dateKey(ms) {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function dayBounds(key) {
  const [y, m, d] = key.split('-').map(Number)
  const start = new Date(y, m - 1, d, 0, 0, 0, 0)
  return { start: start.getTime(), end: start.getTime() + 86400000 }
}

function emptyDay(key) {
  return {
    date: key,
    turns: 0,
    calls: 0,
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    reasoning: 0,
    opened: false,
    byModel: {},
  }
}

function emptyBucket() {
  return { calls: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0 }
}

/** Cache-hit reads are ~1/10 the price of a miss, so they count a tenth toward intensity. */
function scoreOf(day) {
  const billed =
    day.input + day.output + (day.cacheRead + day.cacheWrite) * 0.1
  return day.turns + day.calls + billed / 10000
}

function quantile(sorted, p) {
  const n = sorted.length
  if (n === 0) return 0
  if (n === 1) return sorted[0]
  const k = (n - 1) * p
  const lo = Math.floor(k)
  const hi = Math.ceil(k)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (k - lo)
}

export function apply(ctx) {
  const home = process.env.DSH_HOME || join(os.homedir(), '.dsh')
  const dir = join(home, 'storages', NS)
  const statePath = join(dir, 'state.json')
  const configPath = join(dir, 'config.json')
  const probePath = join(dir, 'probe.log')

  try {
    mkdirSync(dir, { recursive: true })
  } catch {
    /* the route still works with in-memory state */
  }

  const probe = (message) => {
    try {
      appendFileSync(probePath, `${new Date().toISOString()} ${message}\n`)
    } catch {
      /* diagnostics only */
    }
  }

  // ── durable state ────────────────────────────────────────────────────────
  function loadJson(path, fallback) {
    try {
      return JSON.parse(readFileSync(path, 'utf8'))
    } catch {
      return fallback
    }
  }

  let state = loadJson(statePath, null)
  // Bumping the version discards cursors whose semantics changed: the ledger is a
  // pure fold over session logs, so rebuilding it is always safe.
  if (!state || typeof state !== 'object' || !state.days || state.version !== 2) {
    state = { version: 2, days: {}, sessions: {} }
  }
  if (!state.sessions) state.sessions = {}

  let prices = loadJson(configPath, null)
  if (!prices || typeof prices !== 'object' || !prices.default) {
    prices = structuredClone(DEFAULT_PRICES)
    try {
      writeFileSync(configPath, JSON.stringify(prices, null, 2))
    } catch {
      /* ignore */
    }
  }
  let pricesStamp = 0
  try {
    pricesStamp = statSync(configPath).mtimeMs
  } catch {
    /* ignore */
  }

  // Migrate the placeholder default written by the first build (output 8) to the
  // official reference price, without touching a table the user has edited.
  if (!prices.schema) {
    const bare = !prices.models || Object.keys(prices.models).length === 0
    const current = prices.default || {}
    const legacyDefault =
      Number(current.cacheMiss) === 2 && Number(current.cacheHit) === 0.2 && Number(current.output) === 8
    if (bare && legacyDefault) prices = structuredClone(DEFAULT_PRICES)
    prices.schema = 2
    try {
      writeFileSync(configPath, JSON.stringify(prices, null, 2))
      pricesStamp = statSync(configPath).mtimeMs
    } catch {
      /* ignore */
    }
  }

  /** Re-read the price table when the file changes, so edits apply without a restart. */
  function refreshPrices() {
    try {
      const stamp = statSync(configPath).mtimeMs
      if (stamp === pricesStamp) return
      pricesStamp = stamp
      const next = loadJson(configPath, null)
      if (next && typeof next === 'object' && next.default) prices = next
    } catch {
      /* keep the last good table */
    }
  }

  let flushTimer = null
  function scheduleFlush() {
    if (flushTimer) return
    flushTimer = setTimeout(() => {
      flushTimer = null
      flush()
    }, 800)
    if (typeof flushTimer.unref === 'function') flushTimer.unref()
  }

  function flush() {
    try {
      const tmp = `${statePath}.tmp`
      writeFileSync(tmp, JSON.stringify(state))
      renameSync(tmp, statePath)
    } catch (error) {
      probe(`flush failed ${String(error && error.message)}`)
    }
  }

  ctx.effect(() => () => {
    if (flushTimer) clearTimeout(flushTimer)
    flush()
  })

  // ── folding ──────────────────────────────────────────────────────────────
  function dayFor(key) {
    let day = state.days[key]
    if (!day) {
      day = emptyDay(key)
      state.days[key] = day
    }
    return day
  }

  function foldEvent(event) {
    if (!event || typeof event.time !== 'number') return false
    const key = dateKey(event.time)
    if (event.type === 'user/message') {
      const day = dayFor(key)
      day.turns += 1
      day.opened = true
      scheduleFlush()
      return true
    }
    if (event.type !== 'assistant/message') return false
    const data = event.data || {}
    const usage = data.usage
    if (!usage) return false
    const source = (data.message && data.message.source) || {}
    const modelId = `${source.provider || 'unknown'}:${source.model || 'unknown'}`
    const day = dayFor(key)
    day.opened = true
    day.calls += 1
    const bucket = day.byModel[modelId] || (day.byModel[modelId] = emptyBucket())
    bucket.calls += 1
    const fields = [
      ['input', 'inputTokens'],
      ['output', 'outputTokens'],
      ['cacheRead', 'cacheReadTokens'],
      ['cacheWrite', 'cacheWriteTokens'],
      ['reasoning', 'reasoningTokens'],
    ]
    for (const [field, source2] of fields) {
      const value = Number(usage[source2]) || 0
      if (!value) continue
      day[field] += value
      bucket[field] += value
    }
    scheduleFlush()
    return true
  }

  /** Fold one session's log, skipping inherited (fork-seeded) events and anything already counted. */
  function foldSession(sessionId, snapshot) {
    const inherited = Number(snapshot.inheritedEventCount) || 0
    const cursor = state.sessions[sessionId]
    const floor = cursor && cursor.scannedSeq >= 0 ? cursor.scannedSeq : inherited - 1
    let maxSeq = floor
    const events = Array.isArray(snapshot.events) ? snapshot.events : []
    for (const event of events) {
      const seq = Number(event.seq)
      if (!Number.isFinite(seq) || seq <= floor) continue
      foldEvent(event)
      if (seq > maxSeq) maxSeq = seq
    }
    state.sessions[sessionId] = { scannedSeq: maxSeq, inherited }
    return maxSeq - floor
  }

  // ── live feed ────────────────────────────────────────────────────────────
  // Events that arrive before the first scan finishes are queued instead of
  // folded: folding one would advance the session cursor past events the scan
  // has not read yet, and those events would then be skipped for good.
  let armed = false
  const queued = []

  function foldLive(sessionId, event) {
    const seq = Number(event.seq)
    const cursor = state.sessions[sessionId]
    if (!cursor) {
      // A session first seen live starts at its own beginning, so covering seq - 1
      // loses nothing; a later scan of the same session still fills any gap.
      state.sessions[sessionId] = { scannedSeq: Number.isFinite(seq) ? seq - 1 : -1, inherited: 0 }
    } else if (Number.isFinite(seq) && seq <= cursor.scannedSeq) {
      return
    } else if (Number.isFinite(seq)) {
      cursor.scannedSeq = seq
    }
    foldEvent(event)
  }

  ctx.effect(() =>
    ctx.on('session/event', (session, event) => {
      const sessionId = session && session.id
      if (!sessionId || !event) return
      if (!armed) {
        if (queued.length < 4000) queued.push([sessionId, event])
        return
      }
      foldLive(sessionId, event)
    }),
  )

  // The client mounts with the app shell, so a request is our "app was opened" signal.
  function markOpened() {
    const key = dateKey(Date.now())
    const day = dayFor(key)
    if (!day.opened) {
      day.opened = true
      scheduleFlush()
    }
  }

  // ── backfill ─────────────────────────────────────────────────────────────
  const scanning = { running: false, done: 0, total: 0, startedAt: 0, error: null }
  let scannedOnce = false

  function armLive() {
    armed = true
    for (const [sessionId, event] of queued.splice(0)) foldLive(sessionId, event)
    flush()
  }

  async function ensureBackfill() {
    if (scanning.running || scannedOnce) return
    const query = ctx.get('sessionQuery')
    if (!query || typeof query.listSessions !== 'function') {
      scanning.error = 'sessionQuery unavailable'
      scannedOnce = true
      armLive()
      return
    }
    scanning.running = true
    scanning.startedAt = Date.now()
    try {
      const records = await query.listSessions()
      scanning.total = records.length
      scanning.done = 0
      for (const record of records) {
        const sessionId = record && record.header && record.header.id
        if (!sessionId) {
          scanning.done += 1
          continue
        }
        try {
          const snapshot = await query.readSession(sessionId)
          foldSession(sessionId, snapshot)
        } catch {
          /* an unreadable session must not stop the scan */
        }
        scanning.done += 1
        await new Promise((resolve) => setTimeout(resolve, 15))
      }
      scanning.error = null
    } catch (error) {
      scanning.error = String((error && error.message) || error)
    } finally {
      scanning.running = false
      scannedOnce = true
      armLive()
      probe(`backfill done ${scanning.done}/${scanning.total} ${scanning.error || ''}`)
    }
  }

  // ── pricing ──────────────────────────────────────────────────────────────
  function priceFor(modelId) {
    const entry = (prices.models && prices.models[modelId]) || prices.default
    return {
      cacheMiss: Number(entry.cacheMiss) || 0,
      cacheHit: Number(entry.cacheHit) || 0,
      output: Number(entry.output) || 0,
      reasoning: Number(entry.reasoning) || 0,
    }
  }

  function costOfBucket(bucket, price) {
    const value =
      bucket.input * price.cacheMiss +
      bucket.cacheRead * price.cacheHit +
      bucket.cacheWrite * price.cacheHit +
      bucket.output * price.output +
      bucket.reasoning * price.reasoning
    return Number.isFinite(value) && value > 0 ? value / 1e6 : 0
  }

  // ── aggregation ──────────────────────────────────────────────────────────
  function summarize(fromKey, toKey) {
    const fromMs = dayBounds(fromKey).start
    const toMs = dayBounds(toKey).end

    const days = []
    const totals = {
      activeDays: 0,
      openedDays: 0,
      turns: 0,
      calls: 0,
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      reasoning: 0,
      tokens: 0,
      cost: 0,
    }
    const byModel = new Map()
    const unpriced = new Set()

    for (const [key, day] of Object.entries(state.days)) {
      const { start } = dayBounds(key)
      if (start < fromMs || start >= toMs) continue

      const cost = Object.entries(day.byModel).reduce((sum, [modelId, bucket]) => {
        if (!(prices.models && prices.models[modelId])) unpriced.add(modelId)
        const modelCost = costOfBucket(bucket, priceFor(modelId))
        const entry = byModel.get(modelId) || { modelId, ...emptyBucket(), cost: 0 }
        for (const field of ['calls', 'input', 'output', 'cacheRead', 'cacheWrite', 'reasoning']) {
          entry[field] += bucket[field] || 0
        }
        entry.cost += modelCost
        byModel.set(modelId, entry)
        return sum + modelCost
      }, 0)

      const tokens = day.input + day.output + day.cacheRead + day.cacheWrite + day.reasoning
      const score = scoreOf(day)
      const active = day.calls > 0 || day.turns > 0
      days.push({
        date: key,
        turns: day.turns,
        calls: day.calls,
        input: day.input,
        output: day.output,
        cacheRead: day.cacheRead,
        cacheWrite: day.cacheWrite,
        reasoning: day.reasoning,
        tokens,
        cost,
        score,
        active,
        opened: Boolean(day.opened || active),
      })

      if (active) {
        totals.activeDays += 1
        totals.turns += day.turns
        totals.calls += day.calls
        totals.input += day.input
        totals.output += day.output
        totals.cacheRead += day.cacheRead
        totals.cacheWrite += day.cacheWrite
        totals.reasoning += day.reasoning
        totals.tokens += tokens
        totals.cost += cost
      } else if (day.opened) {
        totals.openedDays += 1
      }
    }

    days.sort((a, b) => (a.date < b.date ? -1 : 1))

    return {
      days,
      totals,
      models: [...byModel.values()].sort((a, b) => b.cost - a.cost || b.tokens - a.tokens),
      unpriced: [...unpriced].sort(),
    }
  }

  /** Thresholds describe "your own last 365 days", never the selected range. */
  function thresholds() {
    const now = Date.now()
    const from = now - YEAR_MS
    const scores = []
    for (const [key, day] of Object.entries(state.days)) {
      const { start } = dayBounds(key)
      if (start < from) continue
      if (!(day.calls > 0 || day.turns > 0)) continue
      scores.push(scoreOf(day))
    }
    scores.sort((a, b) => a - b)
    const activeDays = scores.length
    const max = activeDays ? scores[activeDays - 1] : 0
    let mode = 'quantile'
    let cuts
    if (activeDays >= 4) {
      cuts = [quantile(scores, 0.25), quantile(scores, 0.5), quantile(scores, 0.75)]
    } else {
      mode = 'linear'
      cuts = [max * 0.25, max * 0.55, max * 0.8]
    }
    return { activeDays, mode, cuts, max, windowDays: 365 }
  }

  function levelOf(score, cut, day) {
    if (!day.active) return day.opened ? 1 : 0
    if (score <= cut[0]) return 2
    if (score <= cut[1]) return 3
    if (score <= cut[2]) return 4
    return 5
  }

  function rangeOf(rangeParam) {
    const todayKey = dateKey(Date.now())
    const { end } = dayBounds(todayKey)
    const keys = Object.keys(state.days).sort()
    const firstKey = keys.length ? keys[0] : todayKey
    if (rangeParam === 'all') {
      // Keep at least 26 weeks on screen so a short history still reads as a grid.
      const floor = Math.max(dayBounds(firstKey).start, Date.now() - 26 * 7 * 86400000)
      return { from: dateKey(floor), to: todayKey, end }
    }
    const days = Number(rangeParam) > 0 ? Number(rangeParam) : 365
    return { from: dateKey(Date.now() - (days - 1) * 86400000), to: todayKey, end }
  }

  function buildPayload(rangeParam) {
    refreshPrices()
    const range = rangeOf(rangeParam)
    const summary = summarize(range.from, range.to)
    const cut = thresholds()
    for (const day of summary.days) day.level = levelOf(day.score, cut.cuts, day)
    return {
      ok: true,
      today: dateKey(Date.now()),
      currency: prices.currency || 'CNY',
      range: { from: range.from, to: range.to, key: rangeParam || 'all' },
      days: summary.days,
      totals: summary.totals,
      models: summary.models,
      unpriced: summary.unpriced,
      thresholds: cut,
      prices: {
        default: prices.default,
        models: prices.models || {},
        configPath,
      },
      scanning: { running: scanning.running, done: scanning.done, total: scanning.total, error: scanning.error },
      ledgerDays: Object.keys(state.days).length,
      configPath,
    }
  }

  // ── price table surface ──────────────────────────────────────────────────
  function sanitizeRate(input) {
    if (!input || typeof input !== 'object') return null
    const read = (name) => {
      const value = Number(input[name])
      return Number.isFinite(value) && value >= 0 && value <= 1e6 ? value : undefined
    }
    const cacheMiss = read('cacheMiss')
    const cacheHit = read('cacheHit')
    const output = read('output')
    if (cacheMiss === undefined && cacheHit === undefined && output === undefined) return null
    const base = { cacheMiss: 2, cacheHit: 0.2, output: 3 }
    return {
      cacheMiss: cacheMiss === undefined ? base.cacheMiss : cacheMiss,
      cacheHit: cacheHit === undefined ? base.cacheHit : cacheHit,
      output: output === undefined ? base.output : output,
    }
  }

  function detectedModels() {
    const map = new Map()
    for (const day of Object.values(state.days)) {
      for (const [modelId, bucket] of Object.entries(day.byModel)) {
        const entry = map.get(modelId) || { modelId, calls: 0, tokens: 0 }
        entry.calls += bucket.calls || 0
        entry.tokens +=
          (bucket.input || 0) +
          (bucket.output || 0) +
          (bucket.cacheRead || 0) +
          (bucket.cacheWrite || 0) +
          (bucket.reasoning || 0)
        map.set(modelId, entry)
      }
    }
    return [...map.values()].sort((a, b) => b.calls - a.calls)
  }

  function pricePayload() {
    refreshPrices()
    const custom = prices.models && typeof prices.models === 'object' ? prices.models : {}
    const detected = detectedModels().map((entry) => ({
      ...entry,
      custom: Boolean(custom[entry.modelId]),
      rate: priceFor(entry.modelId),
    }))
    return {
      ok: true,
      currency: prices.currency || 'CNY',
      default: prices.default,
      models: custom,
      detected,
      configPath,
    }
  }

  function savePrices(body) {
    const next = {
      schema: 2,
      currency: prices.currency || 'CNY',
      note: DEFAULT_PRICES.note,
      default: prices.default,
      models: {},
    }
    const nextDefault = sanitizeRate(body && body.default)
    if (nextDefault) next.default = nextDefault
    const incoming = body && body.models && typeof body.models === 'object' ? body.models : {}
    for (const [modelId, rate] of Object.entries(incoming)) {
      if (typeof modelId !== 'string' || !modelId || modelId.length > 200) continue
      const clean = sanitizeRate(rate)
      if (clean) next.models[modelId] = clean
    }
    writeFileSync(configPath, JSON.stringify(next, null, 2))
    prices = next
    try {
      pricesStamp = statSync(configPath).mtimeMs
    } catch {
      /* ignore */
    }
    probe(`prices saved models=${Object.keys(next.models).length}`)
  }

  function readBody(req) {
    return new Promise((resolve, reject) => {
      const chunks = []
      let size = 0
      req.on('data', (chunk) => {
        size += chunk.length
        if (size > 256 * 1024) {
          reject(new Error('body too large'))
          req.destroy()
          return
        }
        chunks.push(chunk)
      })
      req.on('end', () => {
        try {
          const text = Buffer.concat(chunks).toString('utf8')
          resolve(text ? JSON.parse(text) : {})
        } catch (error) {
          reject(error)
        }
      })
      req.on('error', reject)
    })
  }

  // ── HTTP surface ─────────────────────────────────────────────────────────
  let lastDump = 0
  const sendJson = (res, status, body) => {
    res.statusCode = status
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.setHeader('cache-control', 'no-store')
    res.end(JSON.stringify(body))
  }

  ctx.effect(() =>
    ctx.webServer.register({
      kind: 'prefix',
      path: ROUTE,
      handler: async (req, res) => {
        const url = new URL(req.url || '/', 'http://localhost')
        probe(`hit ${req.method || 'GET'} ${url.pathname}${url.search ? url.search.slice(0, 160) : ''}`)
        if (!url.pathname.startsWith(ROUTE)) {
          res.statusCode = 404
          res.end('not found')
          return
        }
        markOpened()
        const tail = url.pathname.slice(ROUTE.length).replace(/\/$/, '')

        if (tail === '/pulse') {
          sendJson(res, 200, { ok: true, today: dateKey(Date.now()) })
          return
        }

        ensureBackfill()

        if (tail === '/data') {
          let payload
          try {
            payload = buildPayload(url.searchParams.get('range') || '365')
          } catch (error) {
            sendJson(res, 500, { ok: false, error: String((error && error.message) || error) })
            return
          }
          // Diagnostics: a throttled copy of exactly what the Client received.
          if (Date.now() - lastDump > 20000) {
            lastDump = Date.now()
            try {
              writeFileSync(join(dir, 'last-payload.json'), JSON.stringify(payload))
            } catch {
              /* diagnostics only */
            }
          }
          sendJson(res, 200, payload)
          return
        }

        if (tail === '/prices') {
          if (req.method === 'POST') {
            try {
              const body = await readBody(req)
              savePrices(body)
              sendJson(res, 200, pricePayload())
            } catch (error) {
              sendJson(res, 400, { ok: false, error: String((error && error.message) || error) })
            }
            return
          }
          sendJson(res, 200, pricePayload())
          return
        }

        res.statusCode = 404
        res.end('not found')
      },
    }),
  )

  probe(`ready v2 route=${ROUTE} ledgerDays=${Object.keys(state.days).length}`)
}
