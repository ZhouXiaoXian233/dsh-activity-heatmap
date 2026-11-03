/**
 * Client half: a sidebar entry plus its main panel.
 * All data comes from the Host half's JSON routes on the same origin.
 */
window.__ModuleLoader__.load({
  id: 'dsh-activity-heatmap',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const BASE_URL = '/plugin/activity-heatmap'
    const DATA_URL = `${BASE_URL}/data`
    const PRICE_URL = `${BASE_URL}/prices`
    const PULSE_URL = `${BASE_URL}/pulse`

    let ctxRef = null

    // ── locale ─────────────────────────────────────────────────────────────
    const DICT = {
      zh: {
        nav: '活动',
        title: '活动热力图',
        subtitle: '一格 = 一天 · 阈值相对你自己近一年的活跃度',
        rangeAll: '全部',
        range365: '近 365 天',
        range90: '近 90 天',
        range30: '近 30 天',
        activeDays: '活跃天数',
        activeDaysSub: '有对话或调用记录',
        streak: '连续活跃',
        streakSub: '截至今天',
        tokens: 'Token 合计',
        tokensSub: '输入 {i} · 输出 {o} · 缓存 {c}',
        cost: '估算金额',
        costSub: '按当前单价表估算',
        calls: '模型调用',
        turns: '对话轮数',
        less: '少',
        more: '多',
        legendNone: '无记录',
        legendOpened: '打开未对话',
        empty: '还没有任何记录，聊一句就会点亮今天。',
        loading: '正在读取会话日志…',
        scanning: '正在回放历史会话 {done}/{total}',
        error: '读取失败',
        errorHint: '请把这段信息告诉开发者',
        byModel: '按模型统计（当前时间段）',
        model: '模型',
        colCalls: '调用',
        colInput: '输入',
        colOutput: '输出',
        colCache: '缓存',
        colCost: '估算',
        noModel: '当前时间段没有调用记录',
        unpriced: '未定价模型（按默认价估算）：',
        unpricedCount: '当前时间段有 {n} 个模型未定价',
        total: '合计',
        openedDays: '另有 {n} 天只打开过应用',
        callsUnit: '次',
        turnsUnit: '轮',
        tokensUnit: 'token',
        costUnit: '估算',
        dayUnit: '天',
        priceOpen: '价格设置',
        priceTitle: '单价设置',
        priceHint: '单位：元 / 1M tokens。未单独设置的模型使用下面的默认价（DeepSeek 官方参考价 0.2 / 2 / 3）。',
        priceColHit: '缓存命中',
        priceColMiss: '缓存未命中',
        priceColOut: '输出',
        priceDefaultRow: '默认价 · 未单独设置的模型',
        priceDetected: '已使用过的模型',
        priceEmpty: '还没有调用记录',
        priceCustom: '自定义',
        priceDefault: '默认',
        priceClear: '清除',
        priceSave: '保存',
        priceCancel: '取消',
        priceSaving: '保存中…',
        priceFailed: '保存失败',
      },
      en: {
        nav: 'Activity',
        title: 'Activity heatmap',
        subtitle: 'One cell per day · thresholds relative to your own last year',
        rangeAll: 'All',
        range365: '365d',
        range90: '90d',
        range30: '30d',
        activeDays: 'Active days',
        activeDaysSub: 'With a chat or a model call',
        streak: 'Current streak',
        streakSub: 'Up to today',
        tokens: 'Tokens',
        tokensSub: 'in {i} · out {o} · cache {c}',
        cost: 'Estimated cost',
        costSub: 'From the configured price table',
        calls: 'Model calls',
        turns: 'Turns',
        less: 'Less',
        more: 'More',
        legendNone: 'No record',
        legendOpened: 'Opened only',
        empty: 'No records yet. One message lights up today.',
        loading: 'Reading session logs…',
        scanning: 'Replaying sessions {done}/{total}',
        error: 'Failed to load',
        errorHint: 'Report this text to the developer',
        byModel: 'By model (selected range)',
        model: 'Model',
        colCalls: 'Calls',
        colInput: 'Input',
        colOutput: 'Output',
        colCache: 'Cache',
        colCost: 'Cost',
        noModel: 'No calls in this range',
        unpriced: 'Unpriced models (estimated at the default rate): ',
        unpricedCount: '{n} models in this range have no price',
        total: 'Total',
        openedDays: '{n} more days opened only',
        callsUnit: 'calls',
        turnsUnit: 'turns',
        tokensUnit: 'tokens',
        costUnit: 'est.',
        dayUnit: 'd',
        priceOpen: 'Prices',
        priceTitle: 'Price table',
        priceHint: 'CNY per 1M tokens. Models without an entry use the default below (DeepSeek official reference: 0.2 / 2 / 3).',
        priceColHit: 'Cache hit',
        priceColMiss: 'Cache miss',
        priceColOut: 'Output',
        priceDefaultRow: 'Default · every model without an entry',
        priceDetected: 'Models seen in the ledger',
        priceEmpty: 'No calls recorded yet',
        priceCustom: 'Custom',
        priceDefault: 'Default',
        priceClear: 'Clear',
        priceSave: 'Save',
        priceCancel: 'Cancel',
        priceSaving: 'Saving…',
        priceFailed: 'Save failed',
      },
    }

    function activeLang() {
      try {
        const locale = ctxRef && ctxRef.get('locale')
        const snapshot = locale && locale.getSnapshot && locale.getSnapshot()
        const id = snapshot && snapshot.active ? String(snapshot.active) : ''
        return /^zh/i.test(id) ? 'zh' : 'en'
      } catch {
        return 'zh'
      }
    }

    function makeT() {
      const dict = DICT[activeLang()] || DICT.zh
      return (key, vars) => {
        let text = dict[key] || DICT.zh[key] || key
        if (vars) {
          for (const [name, value] of Object.entries(vars)) {
            text = text.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value))
          }
        }
        return text
      }
    }

    // ── theme-aware palette ────────────────────────────────────────────────
    const RAMPS = {
      dark: ['#2b2e32', '#0b3b25', '#12603a', '#1d8a4c', '#2fc45c', '#57e878'],
      light: ['#ebedf0', '#cfeedd', '#9be9a8', '#40c463', '#2b9e4b', '#166b34'],
    }

    function detectDark() {
      try {
        const raw = getComputedStyle(document.body).backgroundColor
        const match = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(raw)
        if (!match) return true
        const luminance =
          (0.2126 * Number(match[1]) + 0.7152 * Number(match[2]) + 0.0722 * Number(match[3])) / 255
        return luminance < 0.5
      } catch {
        return true
      }
    }

    function useDark() {
      const [dark, setDark] = React.useState(detectDark)
      React.useEffect(() => {
        const update = () => setDark(detectDark())
        let observer = null
        try {
          observer = new MutationObserver(update)
          observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class', 'data-theme', 'style'],
          })
        } catch {
          /* the interval below still catches theme switches */
        }
        const timer = setInterval(update, 4000)
        return () => {
          if (observer) observer.disconnect()
          clearInterval(timer)
        }
      }, [])
      return dark
    }

    // ── formatting ─────────────────────────────────────────────────────────
    function fmtCompact(value) {
      const n = Number(value) || 0
      if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`
      if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`
      if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`
      return String(Math.round(n))
    }

    function fmtInt(value) {
      return (Number(value) || 0).toLocaleString('en-US')
    }

    function moneySymbol(currency) {
      return currency === 'CNY' ? '¥' : '$'
    }

    function fmtMoney(value, currency) {
      const n = Number(value) || 0
      if (n === 0) return `${moneySymbol(currency)}0`
      if (n < 0.01) return `${moneySymbol(currency)}${n.toFixed(4)}`
      if (n < 1) return `${moneySymbol(currency)}${n.toFixed(3)}`
      if (n < 100) return `${moneySymbol(currency)}${n.toFixed(2)}`
      return `${moneySymbol(currency)}${n.toFixed(1)}`
    }

    function parseKey(key) {
      const [y, m, d] = key.split('-').map(Number)
      return new Date(y, m - 1, d)
    }

    function keyOf(date) {
      const pad = (n) => String(n).padStart(2, '0')
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    }

    function mondayOf(date) {
      const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      const weekday = (copy.getDay() + 6) % 7
      copy.setDate(copy.getDate() - weekday)
      return copy
    }

    function shiftDays(date, days) {
      const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      copy.setDate(copy.getDate() + days)
      return copy
    }

    // ── data ───────────────────────────────────────────────────────────────
    const cache = new Map()

    async function requestJson(url, init) {
      let response
      try {
        response = await fetch(url, init || { cache: 'no-store' })
      } catch (error) {
        throw new Error(`network: ${String((error && error.message) || error)}`)
      }
      if (!response.ok) {
        const retryUrl = `${url}${url.includes('?') ? '&' : '?'}${location.search ? location.search.slice(1) : ''}`
        const second = await fetch(retryUrl, init || { cache: 'no-store' })
        if (!second.ok) throw new Error(`HTTP ${response.status} → ${second.status}`)
        return second.json()
      }
      return response.json()
    }

    function requestData(range) {
      return requestJson(`${DATA_URL}?range=${encodeURIComponent(range)}&t=${Date.now()}`)
    }

    function useActivity(range, version) {
      const cacheKey = `${range}#${version}`
      const [state, setState] = React.useState(() => {
        const hit = cache.get(cacheKey)
        return hit ? { status: 'ready', data: hit } : { status: 'loading' }
      })
      const [tick, setTick] = React.useState(0)

      React.useEffect(() => {
        let alive = true
        const load = async () => {
          try {
            const data = await requestData(range)
            if (!alive) return
            cache.set(cacheKey, data)
            setState({ status: 'ready', data })
          } catch (error) {
            if (!alive) return
            setState((prev) =>
              prev.status === 'ready'
                ? prev
                : { status: 'error', error: String((error && error.message) || error) },
            )
          }
        }
        load()
        const timer = setInterval(load, 30000)
        const onVisible = () => {
          if (document.visibilityState === 'visible') load()
        }
        document.addEventListener('visibilitychange', onVisible)
        return () => {
          alive = false
          clearInterval(timer)
          document.removeEventListener('visibilitychange', onVisible)
        }
      }, [range, cacheKey, tick])

      const scanning = Boolean(state.status === 'ready' && state.data.scanning && state.data.scanning.running)
      React.useEffect(() => {
        if (!scanning) return undefined
        const timer = setTimeout(() => setTick((n) => n + 1), 1500)
        return () => clearTimeout(timer)
      }, [scanning, state])

      return state
    }

    // ── styles ─────────────────────────────────────────────────────────────
    const CSS = `
.ahm-root { box-sizing: border-box; color: var(--dsw-alias-label-primary); font-size: 13px; }
.ahm-root * { box-sizing: border-box; }
.ahm-panel { padding: 26px 30px 40px; max-width: 1240px; }
.ahm-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.ahm-title { font-size: 22px; font-weight: 600; line-height: 1.25; margin: 0; }
.ahm-sub { margin-top: 6px; font-size: 12px; color: var(--dsw-alias-label-secondary); }
.ahm-seg { display: inline-flex; padding: 2px; gap: 2px; border-radius: 9px; background: var(--dsw-alias-bg-layer-2); border: 1px solid var(--dsw-alias-border-l1); }
.ahm-seg button { border: 0; background: transparent; color: var(--dsw-alias-label-secondary); font: inherit; font-size: 12px; padding: 5px 10px; border-radius: 7px; cursor: pointer; white-space: nowrap; }
.ahm-seg button[data-on="1"] { background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); box-shadow: 0 1px 2px rgba(0,0,0,.18); }
.ahm-cards { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-top: 20px; }
.ahm-card { border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1); border-radius: 10px; padding: 12px 14px; min-width: 0; }
.ahm-card-label { font-size: 11px; color: var(--dsw-alias-label-secondary); }
.ahm-card-value { margin-top: 6px; font-size: 22px; font-weight: 600; line-height: 1.15; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ahm-card-unit { font-size: 11px; font-weight: 400; color: var(--dsw-alias-label-secondary); margin-left: 4px; }
.ahm-card-sub { margin-top: 6px; font-size: 10.5px; color: var(--dsw-alias-label-secondary); opacity: .85; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ahm-graph { margin-top: 26px; }
.ahm-scroll { overflow-x: auto; padding-bottom: 4px; }
.ahm-window { display: flex; align-items: flex-start; }
.ahm-weekdays { display: flex; flex-direction: column; justify-content: space-between; font-size: 10px; color: var(--dsw-alias-label-secondary); padding-top: 18px; }
.ahm-weekdays span { line-height: 1; height: 10px; }
.ahm-weeks-box { position: relative; padding-top: 18px; }
.ahm-months { position: absolute; top: 0; left: 0; height: 14px; font-size: 10.5px; color: var(--dsw-alias-label-secondary); }
.ahm-months span { position: absolute; top: 0; white-space: nowrap; }
.ahm-weeks { display: flex; }
.ahm-week { display: flex; flex-direction: column; }
.ahm-cell { display: block; border-radius: 3px; cursor: default; outline: 0 solid transparent; transition: outline-color .12s ease; }
.ahm-cell[data-today="1"] { outline: 1px solid var(--dsw-alias-label-primary); }
.ahm-cell[data-future="1"] { opacity: 0; }
.ahm-cell:hover { outline: 1.5px solid var(--dsw-alias-label-primary); }
.ahm-legend { display: flex; align-items: center; gap: 6px; margin-top: 14px; font-size: 10.5px; color: var(--dsw-alias-label-secondary); }
.ahm-legend i { width: 11px; height: 11px; border-radius: 2.5px; display: block; }
.ahm-tip { position: fixed; z-index: 40; pointer-events: none; background: var(--dsw-alias-bg-overlay); color: var(--dsw-alias-label-primary); border: 1px solid var(--dsw-alias-border-l2); border-radius: 9px; padding: 9px 12px; box-shadow: 0 10px 26px rgba(0,0,0,.32); font-size: 11.5px; line-height: 1.55; max-width: 260px; }
.ahm-tip b { font-weight: 600; }
.ahm-tip .ahm-tip-cost { color: var(--dsw-alias-state-success-primary); }
.ahm-note { margin-top: 14px; font-size: 11px; color: var(--dsw-alias-label-secondary); display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.ahm-chip { border: 1px solid var(--dsw-alias-border-l1); border-radius: 6px; padding: 2px 7px; font-size: 10.5px; }
.ahm-chip[data-warn="1"] { border-color: var(--dsw-alias-state-warn-primary); color: var(--dsw-alias-state-warn-primary); }
.ahm-btn { border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); font: inherit; font-size: 11px; padding: 3px 9px; border-radius: 6px; cursor: pointer; }
.ahm-btn:hover { border-color: var(--dsw-alias-border-l2); }
.ahm-btn[data-tone="primary"] { background: var(--dsw-alias-brand-primary); border-color: transparent; color: var(--dsw-alias-label-primary-inverted); }
.ahm-btn[data-tone="primary"]:hover:not(:disabled) { background: var(--dsw-alias-button-primary-hover); border-color: transparent; }
.ahm-btn:disabled { opacity: .6; cursor: default; }
.ahm-section { margin-top: 28px; }
.ahm-section-title { font-size: 12.5px; font-weight: 600; color: var(--dsw-alias-label-secondary); margin-bottom: 10px; letter-spacing: .02em; }
.ahm-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.ahm-table th { text-align: right; font-weight: 500; color: var(--dsw-alias-label-secondary); padding: 6px 10px; border-bottom: 1px solid var(--dsw-alias-border-l1); font-size: 11px; white-space: nowrap; }
.ahm-table th:first-child, .ahm-table td:first-child { text-align: left; }
.ahm-table td { text-align: right; padding: 7px 10px; border-bottom: 1px solid var(--dsw-alias-border-l1); font-variant-numeric: tabular-nums; white-space: nowrap; }
.ahm-table tr:last-child td { border-bottom: 0; font-weight: 600; }
.ahm-model { max-width: 340px; overflow: hidden; text-overflow: ellipsis; }
.ahm-bar { height: 2px; border-radius: 2px; background: var(--dsw-alias-bg-layer-2); overflow: hidden; margin-top: 10px; }
.ahm-bar i { display: block; height: 100%; background: var(--dsw-alias-brand-primary); transition: width .3s ease; }
.ahm-empty { margin-top: 22px; padding: 32px; text-align: center; color: var(--dsw-alias-label-secondary); border: 1px dashed var(--dsw-alias-border-l1); border-radius: 10px; font-size: 12px; }
.ahm-error { margin-top: 18px; padding: 12px 14px; border: 1px solid var(--dsw-alias-state-error-primary); border-radius: 9px; font-size: 11.5px; }
.ahm-mask { position: fixed; inset: 0; z-index: 60; background: rgba(0,0,0,.45); display: flex; align-items: center; justify-content: center; padding: 24px; }
.ahm-dialog { width: min(640px, 100%); max-height: min(78vh, 720px); display: flex; flex-direction: column; background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l2); border-radius: 14px; box-shadow: 0 24px 60px rgba(0,0,0,.45); overflow: hidden; }
.ahm-dialog-head { padding: 16px 18px 10px; }
.ahm-dialog-title { font-size: 14px; font-weight: 600; }
.ahm-dialog-hint { margin-top: 6px; font-size: 11px; color: var(--dsw-alias-label-secondary); line-height: 1.6; }
.ahm-dialog-body { padding: 4px 18px 14px; overflow: auto; }
.ahm-dialog-foot { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 18px; border-top: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-2); }
.ahm-price-table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
.ahm-price-table th { text-align: right; font-weight: 500; color: var(--dsw-alias-label-secondary); font-size: 10.5px; padding: 6px 6px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.ahm-price-table th:first-child, .ahm-price-table td:first-child { text-align: left; }
.ahm-price-table td { padding: 5px 6px; border-bottom: 1px solid var(--dsw-alias-border-l1); vertical-align: middle; }
.ahm-price-table tr[data-default="1"] td { background: var(--dsw-alias-bg-layer-2); }
.ahm-input { width: 76px; padding: 4px 6px; border-radius: 6px; border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-base); color: inherit; font: inherit; font-size: 11.5px; text-align: right; }
.ahm-input:focus { outline: 1px solid var(--dsw-alias-brand-primary); }
.ahm-price-model { max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ahm-price-sub { font-size: 10px; color: var(--dsw-alias-label-secondary); margin-top: 2px; }
`

    function StyleTag() {
      return h('style', null, CSS)
    }

    // ── grid geometry ──────────────────────────────────────────────────────
    function buildWeeks(days, fromKey, toKey) {
      const index = new Map()
      for (const day of days) index.set(day.date, day)
      const start = mondayOf(parseKey(fromKey))
      const end = parseKey(toKey)
      const weeks = []
      let cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate())
      let guard = 0
      while (cursor <= end && guard < 400) {
        const column = []
        for (let row = 0; row < 7; row += 1) {
          const date = shiftDays(cursor, row)
          const key = keyOf(date)
          column.push({ key, date, row, future: date > end, day: index.get(key) || null })
        }
        weeks.push(column)
        cursor = shiftDays(cursor, 7)
        guard += 1
      }
      return weeks
    }

    function streakOf(days, todayKey) {
      const index = new Map()
      for (const day of days) index.set(day.date, day)
      let streak = 0
      let cursor = parseKey(todayKey)
      const today = index.get(todayKey)
      if (!today || !today.active) cursor = shiftDays(cursor, -1)
      for (let i = 0; i < 4000; i += 1) {
        const day = index.get(keyOf(cursor))
        if (!day || !day.active) break
        streak += 1
        cursor = shiftDays(cursor, -1)
      }
      return streak
    }

    function useMeasuredWidth() {
      const ref = React.useRef(null)
      const [width, setWidth] = React.useState(0)
      React.useEffect(() => {
        const element = ref.current
        if (!element) return undefined
        const measure = () => {
          const next = element.clientWidth || 0
          // Quantize so a drag-resize does not re-render every cell on every frame.
          setWidth(Math.round(next / 8) * 8)
        }
        measure()
        let observer = null
        try {
          observer = new ResizeObserver(measure)
          observer.observe(element)
        } catch {
          /* window resize below is the fallback */
        }
        window.addEventListener('resize', measure)
        return () => {
          if (observer) observer.disconnect()
          window.removeEventListener('resize', measure)
        }
      }, [])
      return [ref, width]
    }

    // ── tooltip ────────────────────────────────────────────────────────────
    function Tooltip({ tip, t, currency }) {
      if (!tip) return null
      const day = tip.day
      const style = {
        left: `${Math.min(tip.x + 14, (window.innerWidth || 1200) - 274)}px`,
        top: `${Math.min(tip.y + 16, (window.innerHeight || 800) - 130)}px`,
      }
      return h(
        'div',
        { className: 'ahm-tip', style },
        h('div', null, h('b', null, tip.key)),
        day && day.active
          ? h('div', null, `${t('turns')} ${day.turns} ${t('turnsUnit')} · ${t('calls')} ${day.calls} ${t('callsUnit')}`)
          : h('div', null, day && day.opened ? t('legendOpened') : t('legendNone')),
        day && day.tokens ? h('div', null, `${fmtCompact(day.tokens)} ${t('tokensUnit')} · ${fmtInt(day.tokens)}`) : null,
        day && day.cost ? h('div', { className: 'ahm-tip-cost' }, `${t('costUnit')} ${fmtMoney(day.cost, currency)}`) : null,
      )
    }

    function useTooltip() {
      const [tip, setTip] = React.useState(null)
      return {
        tip,
        show: (event, cell) => setTip({ x: event.clientX, y: event.clientY, key: cell.key, day: cell.day }),
        move: (event, cell) => setTip({ x: event.clientX, y: event.clientY, key: cell.key, day: cell.day }),
        hide: () => setTip(null),
      }
    }

    // ── heatmap ────────────────────────────────────────────────────────────
    function Heatmap({ data, ramp, t, tooltip }) {
      const [measureRef, width] = useMeasuredWidth()
      const { days, range, today } = data
      const weeks = React.useMemo(() => buildWeeks(days, range.from, range.to), [days, range.from, range.to])
      const columns = weeks.length
      const gutter = 26
      const gap = columns > 45 ? 3 : 4
      const available = Math.max(160, (width || 960) - gutter)
      const cell = Math.min(22, Math.max(8, Math.floor((available - (columns - 1) * gap) / columns)))
      const pitch = cell + gap
      const gridWidth = columns * cell + (columns - 1) * gap
      const gridHeight = 7 * cell + 6 * gap

      const months = []
      let lastMonth = null
      weeks.forEach((column, index) => {
        const first = column[0].date
        if (first.getMonth() !== lastMonth) {
          const previous = months[months.length - 1]
          if (!previous || index - previous.column >= 2) {
            months.push({ column: index, label: `${first.getMonth() + 1}月` })
          }
          lastMonth = first.getMonth()
        }
      })

      return h(
        'div',
        { className: 'ahm-graph' },
        h(
          'div',
          { className: 'ahm-scroll', ref: measureRef },
          h(
            'div',
            { className: 'ahm-window', style: { width: `${gridWidth + gutter}px`, margin: '0 auto' } },
            h(
              'div',
              { className: 'ahm-weekdays', style: { width: `${gutter}px` }, 'aria-hidden': 'true' },
              ['一', '', '三', '', '五', '', ''].map((label, index) => h('span', { key: index }, label)),
            ),
            h(
              'div',
              { className: 'ahm-weeks-box' },
              h(
                'div',
                { className: 'ahm-months' },
                months.map((month) =>
                  h('span', { key: `${month.label}-${month.column}`, style: { left: `${month.column * pitch}px` } }, month.label),
                ),
              ),
              h(
                'div',
                { className: 'ahm-weeks', style: { gap: `${gap}px`, height: `${gridHeight}px` } },
                weeks.map((column, ci) =>
                  h(
                    'div',
                    { className: 'ahm-week', key: ci, style: { gap: `${gap}px` } },
                    column.map((cellData) =>
                      h('i', {
                        key: cellData.key,
                        className: 'ahm-cell',
                        'data-today': cellData.key === today ? '1' : '0',
                        'data-future': cellData.future ? '1' : '0',
                        style: {
                          width: `${cell}px`,
                          height: `${cell}px`,
                          background: ramp[cellData.day ? cellData.day.level : 0],
                        },
                        onMouseEnter: cellData.future ? undefined : (event) => tooltip.show(event, cellData),
                        onMouseMove: cellData.future ? undefined : (event) => tooltip.move(event, cellData),
                        onMouseLeave: cellData.future ? undefined : tooltip.hide,
                      }),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
        h(
          'div',
          { className: 'ahm-legend', style: { marginLeft: `${gutter}px` } },
          h('span', null, t('less')),
          ramp.map((color, index) => h('i', { key: index, style: { background: color } })),
          h('span', null, t('more')),
        ),
      )
    }

    // ── price dialog ───────────────────────────────────────────────────────
    function PriceDialog({ open, onClose, onSaved, t }) {
      const [state, setState] = React.useState({ status: 'loading', data: null, error: null })
      const [draft, setDraft] = React.useState(null)
      const [saving, setSaving] = React.useState(false)
      const [saveError, setSaveError] = React.useState(null)

      const seeded = React.useCallback((payload) => {
        const base = payload.default || { cacheMiss: 2, cacheHit: 0.2, output: 3 }
        const rows = payload.detected || []
        const models = {}
        const custom = {}
        for (const row of rows) {
          const rate = row.custom ? row.rate : base
          models[row.modelId] = {
            cacheHit: String(rate.cacheHit),
            cacheMiss: String(rate.cacheMiss),
            output: String(rate.output),
          }
          custom[row.modelId] = Boolean(row.custom)
        }
        return {
          base: {
            cacheHit: String(base.cacheHit),
            cacheMiss: String(base.cacheMiss),
            output: String(base.output),
          },
          models,
          custom,
          rows,
        }
      }, [])

      React.useEffect(() => {
        if (!open) return undefined
        let alive = true
        setState({ status: 'loading', data: null, error: null })
        setSaveError(null)
        requestJson(`${PRICE_URL}?t=${Date.now()}`)
          .then((payload) => {
            if (!alive) return
            setState({ status: 'ready', data: payload, error: null })
            setDraft(seeded(payload))
          })
          .catch((error) => {
            if (!alive) return
            setState({ status: 'error', data: null, error: String((error && error.message) || error) })
          })
        return () => {
          alive = false
        }
      }, [open, seeded])

      React.useEffect(() => {
        if (!open) return undefined
        const onKey = (event) => {
          if (event.key === 'Escape') onClose()
        }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
      }, [open, onClose])

      if (!open) return null

      const setField = (scope, field, value) => {
        setDraft((prev) => {
          if (!prev) return prev
          if (scope === 'base') {
            return { ...prev, base: { ...prev.base, [field]: value } }
          }
          return {
            ...prev,
            custom: { ...prev.custom, [scope]: true },
            models: { ...prev.models, [scope]: { ...prev.models[scope], [field]: value } },
          }
        })
      }

      const clearModel = (modelId) => {
        setDraft((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            custom: { ...prev.custom, [modelId]: false },
            models: { ...prev.models, [modelId]: { ...prev.base } },
          }
        })
      }

      const save = async () => {
        if (!draft || saving) return
        setSaving(true)
        setSaveError(null)
        const models = {}
        for (const [modelId, row] of Object.entries(draft.models)) {
          if (!draft.custom[modelId]) continue
          models[modelId] = {
            cacheHit: Number(row.cacheHit),
            cacheMiss: Number(row.cacheMiss),
            output: Number(row.output),
          }
        }
        const body = {
          default: {
            cacheHit: Number(draft.base.cacheHit),
            cacheMiss: Number(draft.base.cacheMiss),
            output: Number(draft.base.output),
          },
          models,
        }
        try {
          const payload = await requestJson(`${PRICE_URL}?t=${Date.now()}`, {
            method: 'POST',
            cache: 'no-store',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          })
          setDraft(seeded(payload))
          cache.clear()
          if (onSaved) onSaved()
          onClose()
        } catch (error) {
          setSaveError(String((error && error.message) || error))
        } finally {
          setSaving(false)
        }
      }

      const rows = (draft && draft.rows) || []
      const fields = [
        ['cacheHit', t('priceColHit')],
        ['cacheMiss', t('priceColMiss')],
        ['output', t('priceColOut')],
      ]

      return h(
        'div',
        { className: 'ahm-mask', onMouseDown: (event) => (event.target === event.currentTarget ? onClose() : null) },
        h(
          'div',
          { className: 'ahm-dialog', role: 'dialog', 'aria-modal': 'true' },
          h(
            'div',
            { className: 'ahm-dialog-head' },
            h('div', { className: 'ahm-dialog-title' }, t('priceTitle')),
            h('div', { className: 'ahm-dialog-hint' }, t('priceHint')),
          ),
          h(
            'div',
            { className: 'ahm-dialog-body' },
            state.status === 'loading' ? h('div', { className: 'ahm-empty' }, t('loading')) : null,
            state.status === 'error'
              ? h('div', { className: 'ahm-error' }, `${t('error')}: ${state.error}`)
              : null,
            draft
              ? h(
                  'table',
                  { className: 'ahm-price-table' },
                  h(
                    'thead',
                    null,
                    h(
                      'tr',
                      null,
                      h('th', null, t('model')),
                      fields.map(([field, label]) => h('th', { key: field }, label)),
                      h('th', null, ''),
                    ),
                  ),
                  h(
                    'tbody',
                    null,
                    h(
                      'tr',
                      { 'data-default': '1' },
                      h('td', null, t('priceDefaultRow')),
                      fields.map(([field]) =>
                        h(
                          'td',
                          { key: field },
                          h('input', {
                            className: 'ahm-input',
                            type: 'number',
                            min: '0',
                            step: '0.01',
                            value: draft.base[field],
                            onChange: (event) => setField('base', field, event.target.value),
                          }),
                        ),
                      ),
                      h('td', null, ''),
                    ),
                    rows.length === 0
                      ? h(
                          'tr',
                          null,
                          h('td', { colSpan: 5, style: { color: 'var(--dsw-alias-label-secondary)', padding: '14px 6px' } }, t('priceEmpty')),
                        )
                      : rows.map((row) =>
                          h(
                            'tr',
                            { key: row.modelId },
                            h(
                              'td',
                              null,
                              h('div', { className: 'ahm-price-model', title: row.modelId }, row.modelId),
                              h(
                                'div',
                                { className: 'ahm-price-sub' },
                                `${fmtInt(row.calls)} ${t('callsUnit')} · ${fmtCompact(row.tokens)} ${t('tokensUnit')}`,
                              ),
                            ),
                            fields.map(([field]) =>
                              h(
                                'td',
                                { key: field },
                                h('input', {
                                  className: 'ahm-input',
                                  type: 'number',
                                  min: '0',
                                  step: '0.01',
                                  value: (draft.models[row.modelId] || {})[field] ?? '',
                                  onChange: (event) => setField(row.modelId, field, event.target.value),
                                }),
                              ),
                            ),
                            h(
                              'td',
                              null,
                              draft.custom[row.modelId]
                                ? h(
                                    'button',
                                    { className: 'ahm-btn', onClick: () => clearModel(row.modelId) },
                                    t('priceClear'),
                                  )
                                : h('span', { className: 'ahm-chip' }, t('priceDefault')),
                            ),
                          ),
                        ),
                  ),
                )
              : null,
            saveError ? h('div', { className: 'ahm-error' }, `${t('priceFailed')}: ${saveError}`) : null,
          ),
          h(
            'div',
            { className: 'ahm-dialog-foot' },
            h('button', { className: 'ahm-btn', onClick: onClose, disabled: saving }, t('priceCancel')),
            h('button', { className: 'ahm-btn', 'data-tone': 'primary', onClick: save, disabled: saving || !draft }, saving ? t('priceSaving') : t('priceSave')),
          ),
        ),
      )
    }

    // ── panel ──────────────────────────────────────────────────────────────
    const RANGES = ['365', '90', '30', 'all']

    function rangeLabel(key, t) {
      if (key === 'all') return t('rangeAll')
      if (key === '365') return t('range365')
      if (key === '90') return t('range90')
      return t('range30')
    }

    function StatCard({ label, value, unit, sub, tone }) {
      return h(
        'div',
        { className: 'ahm-card' },
        h('div', { className: 'ahm-card-label' }, label),
        h(
          'div',
          { className: 'ahm-card-value', style: tone ? { color: tone } : undefined },
          value,
          unit ? h('span', { className: 'ahm-card-unit' }, unit) : null,
        ),
        sub ? h('div', { className: 'ahm-card-sub', title: sub }, sub) : null,
      )
    }

    function ModelTable({ data, t }) {
      const currency = data.currency
      if (!data.models.length) return h('div', { className: 'ahm-empty' }, t('noModel'))
      const totals = data.models.reduce(
        (acc, row) => {
          acc.calls += row.calls
          acc.input += row.input
          acc.output += row.output
          acc.cache += row.cacheRead + row.cacheWrite
          acc.cost += row.cost
          return acc
        },
        { calls: 0, input: 0, output: 0, cache: 0, cost: 0 },
      )
      return h(
        'table',
        { className: 'ahm-table' },
        h(
          'thead',
          null,
          h(
            'tr',
            null,
            h('th', null, t('model')),
            h('th', null, t('colCalls')),
            h('th', null, t('colInput')),
            h('th', null, t('colOutput')),
            h('th', null, t('colCache')),
            h('th', null, t('colCost')),
          ),
        ),
        h(
          'tbody',
          null,
          data.models.map((row) =>
            h(
              'tr',
              { key: row.modelId },
              h('td', { className: 'ahm-model', title: row.modelId }, row.modelId),
              h('td', null, fmtInt(row.calls)),
              h('td', null, fmtCompact(row.input)),
              h('td', null, fmtCompact(row.output)),
              h('td', null, fmtCompact(row.cacheRead + row.cacheWrite)),
              h('td', null, fmtMoney(row.cost, currency)),
            ),
          ),
          h(
            'tr',
            null,
            h('td', null, t('total')),
            h('td', null, fmtInt(totals.calls)),
            h('td', null, fmtCompact(totals.input)),
            h('td', null, fmtCompact(totals.output)),
            h('td', null, fmtCompact(totals.cache)),
            h('td', null, fmtMoney(totals.cost, currency)),
          ),
        ),
      )
    }

    function Panel() {
      return h(Boundary, null, h(PanelBody))
    }

    function PanelBody() {
      const t = makeT()
      const dark = useDark()
      const ramp = RAMPS[dark ? 'dark' : 'light']
      const [range, setRange] = React.useState('365')
      const [version, setVersion] = React.useState(0)
      const [priceOpen, setPriceOpen] = React.useState(false)
      const state = useActivity(range, version)
      const tooltip = useTooltip()

      const body = []
      if (state.status === 'error') {
        body.push(
          h(
            'div',
            { className: 'ahm-error', key: 'error' },
            h('div', null, `${t('error')}: ${state.error}`),
            h('div', { style: { opacity: 0.7, marginTop: 4 } }, t('errorHint')),
          ),
        )
      }
      const loading = state.status === 'loading' && !state.data
      if (loading) body.push(h('div', { className: 'ahm-empty', key: 'loading' }, t('loading')))

      const data = state.data
      if (data) {
        const totals = data.totals
        const streak = streakOf(data.days, data.today)
        const currency = data.currency || 'CNY'
        body.push(
          h(
            'div',
            { className: 'ahm-cards', key: 'cards' },
            h(StatCard, { label: t('activeDays'), value: fmtInt(totals.activeDays), unit: t('dayUnit'), sub: t('activeDaysSub') }),
            h(StatCard, { label: t('streak'), value: fmtInt(streak), unit: t('dayUnit'), sub: t('streakSub') }),
            h(StatCard, {
              label: t('tokens'),
              value: fmtCompact(totals.tokens),
              sub: t('tokensSub', {
                i: fmtCompact(totals.input),
                o: fmtCompact(totals.output),
                c: fmtCompact(totals.cacheRead + totals.cacheWrite),
              }),
            }),
            h(StatCard, {
              label: t('cost'),
              value: fmtMoney(totals.cost, currency),
              sub: t('costSub'),
              tone: 'var(--dsw-alias-state-success-primary)',
            }),
          ),
        )

        if (totals.activeDays === 0 && totals.openedDays === 0) {
          body.push(h('div', { className: 'ahm-empty', key: 'empty' }, t('empty')))
        } else {
          body.push(h(Heatmap, { key: 'map', data, ramp, t, tooltip }))
        }

        const notes = []
        if (totals.openedDays) notes.push(h('span', { key: 'opened' }, t('openedDays', { n: totals.openedDays })))
        notes.push(h('span', { key: 'calls' }, `${t('calls')} ${fmtInt(totals.calls)} · ${t('turns')} ${fmtInt(totals.turns)}`))
        notes.push(
          h('button', { className: 'ahm-btn', key: 'prices', onClick: () => setPriceOpen(true) }, t('priceOpen')),
        )
        if (data.unpriced.length) {
          notes.push(
            h('span', { className: 'ahm-chip', key: 'unpriced', 'data-warn': '1' }, t('unpricedCount', { n: data.unpriced.length })),
          )
        }
        body.push(h('div', { className: 'ahm-note', key: 'notes' }, notes))

        if (data.scanning && data.scanning.running) {
          const pct = data.scanning.total ? Math.round((data.scanning.done / data.scanning.total) * 100) : 0
          body.push(
            h(
              'div',
              { key: 'scan' },
              h('div', { className: 'ahm-note' }, h('span', null, t('scanning', { done: data.scanning.done, total: data.scanning.total }))),
              h('div', { className: 'ahm-bar' }, h('i', { style: { width: `${pct}%` } })),
            ),
          )
        }

        body.push(
          h(
            'div',
            { className: 'ahm-section', key: 'models' },
            h('div', { className: 'ahm-section-title' }, t('byModel')),
            h(ModelTable, { data, t }),
          ),
        )
      }

      return h(
        'div',
        { className: 'ahm-root' },
        h(StyleTag, { key: 'style' }),
        h(
          'div',
          { className: 'ahm-panel' },
          h(
            'div',
            { className: 'ahm-head' },
            h('div', null, h('h1', { className: 'ahm-title' }, t('title')), h('div', { className: 'ahm-sub' }, t('subtitle'))),
            h(
              'div',
              { className: 'ahm-seg' },
              RANGES.map((key) =>
                h('button', { key, 'data-on': range === key ? '1' : '0', onClick: () => setRange(key) }, rangeLabel(key, t)),
              ),
            ),
          ),
          body,
        ),
        h(PriceDialog, {
          key: 'prices',
          open: priceOpen,
          onClose: () => setPriceOpen(false),
          onSaved: () => setVersion((n) => n + 1),
          t,
        }),
        h(Tooltip, { key: 'tip', tip: tooltip.tip, t, currency: (data && data.currency) || 'CNY' }),
      )
    }

    // ── error boundary ─────────────────────────────────────────────────────
    class Boundary extends React.Component {
      constructor(props) {
        super(props)
        this.state = { error: null }
      }

      static getDerivedStateFromError(error) {
        return { error }
      }

      componentDidCatch(error) {
        try {
          const text = String((error && error.message) || error).slice(0, 110)
          fetch(`${DATA_URL}?probe=panel-error-${encodeURIComponent(text)}`, { cache: 'no-store' })
        } catch {
          /* reporting is best effort */
        }
      }

      render() {
        if (this.state.error) {
          return h(
            'div',
            { className: 'ahm-root' },
            h(StyleTag, null),
            h(
              'div',
              { className: 'ahm-panel' },
              h('div', { className: 'ahm-error' }, String((this.state.error && this.state.error.message) || this.state.error)),
            ),
          )
        }
        return this.props.children
      }
    }

    // ── sidebar icon ───────────────────────────────────────────────────────
    function ActivityIcon({ size }) {
      // The icon mounts with the app shell, so it doubles as the "app opened" pulse.
      React.useEffect(() => {
        let alive = true
        const ping = () => {
          if (!alive) return
          fetch(PULSE_URL, { cache: 'no-store' }).catch(() => {})
        }
        ping()
        const timer = setInterval(ping, 300000)
        return () => {
          alive = false
          clearInterval(timer)
        }
      }, [])

      const edge = Number(size) || 18
      const cells = [
        [1, 3, 0, 4],
        [2, 4, 2, 1],
        [3, 1, 4, 3],
      ]
      const palette = ['#3a3f45', '#1d8a4c', '#2fc45c', '#57e878']
      const unit = edge / 5.2
      const glyphs = []
      for (let row = 0; row < 3; row += 1) {
        for (let col = 0; col < 4; col += 1) {
          glyphs.push(
            h('rect', {
              key: `${row}-${col}`,
              x: unit * (0.4 + col * 1.15),
              y: unit * (0.9 + row * 1.15),
              width: unit * 0.95,
              height: unit * 0.95,
              rx: unit * 0.22,
              fill: palette[cells[row][col]],
            }),
          )
        }
      }
      return h(
        'svg',
        {
          viewBox: `0 0 ${unit * 5.1} ${unit * 5.1}`,
          width: edge,
          height: edge,
          'aria-hidden': 'true',
          style: { display: 'block' },
        },
        glyphs,
      )
    }

    // ── wiring ─────────────────────────────────────────────────────────────
    return {
      inject: ['slots'],
      apply(ctx) {
        ctxRef = ctx
        const label = () => makeT()('nav')
        try {
          ctx.slots.inject('sidebar.panellist', () =>
            ctx.slots.register({ name: 'sidebar.panellist', id: 'activity-heatmap', order: 20, label }, ActivityIcon),
          )
          ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: 'activity-heatmap' }, Panel))
        } catch (error) {
          try {
            console.error('activity-heatmap: registration failed', error)
          } catch {
            /* ignore */
          }
        }
      },
    }
  },
})
