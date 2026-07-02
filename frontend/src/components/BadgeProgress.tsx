// src/components/BadgeProgress.tsx
import { useState, useEffect } from 'preact/hooks'
import SongDetailModal from './SongDetailModal'
import type { SongData, PlayerScore } from './SongCard'
import { apiUrl } from '../lib/api'
import JacketImage from './JacketImage'
import { loadSongs } from '../lib/songStore'

interface ChartInfo {
    title: string
    chart_type: string
    image_name: string
    chart_constant: number | null
    achievement: number
    fc: string | null
    sync: string | null
    sss: boolean
    fc_badge: boolean
    ap: boolean
    fdx: boolean
}

interface VersionProgress {
    version: string
    version_name: string
    badge_name: string
    has_sho: boolean
    total: number
    sss: number
    fc: number
    ap: number
    fdx: number
    difficulties: {
        BASIC: ChartInfo[]
        ADVANCED: ChartInfo[]
        EXPERT: ChartInfo[]
        MASTER: ChartInfo[]
    }
}

const BADGE_META = [
    { key: 'sss' as const,  countKey: 'sss' as const, label: '將', fullLabel: '將牌',  desc: 'SSS (100%+)', color: 'from-yellow-400 to-amber-500',  text: 'text-yellow-300'  },
    { key: 'fc_badge' as const, countKey: 'fc'  as const, label: '極', fullLabel: '極牌',  desc: 'Full Combo',  color: 'from-emerald-400 to-green-500', text: 'text-emerald-300' },
    { key: 'fdx' as const,  countKey: 'fdx' as const, label: '舞', fullLabel: '舞舞牌', desc: 'FDX/FDX+',   color: 'from-violet-400 to-purple-500', text: 'text-violet-300'  },
    { key: 'ap' as const,   countKey: 'ap'  as const, label: '神', fullLabel: '神牌',  desc: 'All Perfect', color: 'from-sky-400 to-blue-500',      text: 'text-sky-300'     },
]

const DIFF_TABS = ['BASIC', 'ADVANCED', 'EXPERT', 'MASTER'] as const
type DiffTab = typeof DIFF_TABS[number]
type BadgeMode = 'obtain' | 'confirm'
type BadgeKey = typeof BADGE_META[number]['key']
type CountKey = typeof BADGE_META[number]['countKey']
type CompletionFilter = 'all' | 'remaining' | 'done'

const DIFF_ACTIVE: Record<string, string> = {
    BASIC:    'bg-green-500 text-white border-green-400',
    ADVANCED: 'bg-yellow-500 text-white border-yellow-400',
    EXPERT:   'bg-red-500 text-white border-red-400',
    MASTER:   'bg-purple-500 text-white border-purple-400',
}

const BADGE_IMG: Record<string, string> = {
    DX:       'https://cdn.jsdelivr.net/gh/zvuc/otoge-db@master/maimai/img/chart_badge_dx.png',
    STANDARD: 'https://cdn.jsdelivr.net/gh/zvuc/otoge-db@master/maimai/img/chart_badge_std.png',
}

const BADGE_CACHE_KEY = 'maimai_badge_cache_v3'

function mergeVersionProgressItems(items: VersionProgress[]): VersionProgress[] {
    const map = new Map<string, VersionProgress>()

    for (const item of items) {
        const key = item.version === '11000' ? '10000' : item.version
        const existing = map.get(key)
        if (!existing) {
            map.set(key, {
                ...item,
                version: key,
                version_name: key === '10000' ? 'maimai / maimai PLUS' : item.version_name,
                badge_name: key === '10000' ? '真' : item.badge_name,
                difficulties: {
                    BASIC: [...item.difficulties.BASIC],
                    ADVANCED: [...item.difficulties.ADVANCED],
                    EXPERT: [...item.difficulties.EXPERT],
                    MASTER: [...item.difficulties.MASTER],
                },
            })
            continue
        }

        existing.total += item.total
        existing.sss += item.sss
        existing.fc += item.fc
        existing.ap += item.ap
        existing.fdx += item.fdx
        existing.has_sho = existing.has_sho || item.has_sho
        for (const diff of DIFF_TABS) {
            existing.difficulties[diff].push(...item.difficulties[diff])
        }
    }

    return Array.from(map.values())
}

function getCachedBadge(): VersionProgress[] | null {
    try {
        const c = sessionStorage.getItem(BADGE_CACHE_KEY)
        if (!c) return null
        const data = JSON.parse(c)
        if (!Array.isArray(data) || !data[0]?.difficulties) return null
        return data
    } catch { return null }
}
function setCachedBadge(d: VersionProgress[]) {
    try { sessionStorage.setItem(BADGE_CACHE_KEY, JSON.stringify(d)) } catch {}
}

function ProgressBar({ value, total, colorClass }: { value: number, total: number, colorClass: string }) {
    const pct = total > 0 ? Math.round((value / total) * 100) : 0
    return (
        <div class="flex items-center gap-2">
            <div class="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div class={`h-full rounded-full bg-gradient-to-r ${colorClass} transition-all duration-500`} style={{ width: `${pct}%` }} />
            </div>
            <span class="text-xs font-mono text-gray-400 w-8 text-right">{pct}%</span>
        </div>
    )
}

export default function BadgeProgress() {
    const [data, setData] = useState<VersionProgress[]>([])
    const [loading, setLoading] = useState(true)
    const [mode, setMode] = useState<BadgeMode>('obtain')
    const [expandedVersion, setExpandedVersion] = useState<string | null>(null)
    const [diffTab, setDiffTab] = useState<Record<string, DiffTab>>({})
    const [selectedSong, setSelectedSong] = useState<SongData | null>(null)
    const [playerScores, setPlayerScores] = useState<PlayerScore[]>([])
    const [allSongs, setAllSongs] = useState<SongData[]>([])
    const [minConstant, setMinConstant] = useState('')
    const [maxConstant, setMaxConstant] = useState('')
    const [completionFilter, setCompletionFilter] = useState<CompletionFilter>('all')
    const [selectedBadgeKeys, setSelectedBadgeKeys] = useState<BadgeKey[]>(BADGE_META.map(badge => badge.key))

    useEffect(() => {
        const token = localStorage.getItem('maimai_sync_token')
        if (!token) { setLoading(false); return }

        loadSongs().then(setAllSongs).catch(console.error)

        fetch(apiUrl('/api/scores/all'), { headers: { 'Authorization': `Bearer ${token}` } })
            .then(r => r.json()).then(d => { if (Array.isArray(d)) setPlayerScores(d) }).catch(console.error)

        const cachedBadge = getCachedBadge()
        if (cachedBadge) {
            setData(cachedBadge)
            setLoading(false)
            return
        }
        fetch(apiUrl('/api/badge-progress'), { headers: { 'Authorization': `Bearer ${token}` } })
            .then(r => r.json())
            .then(d => {
                if (Array.isArray(d)) {
                    const merged = mergeVersionProgressItems(d)
                    setData(merged)
                    setCachedBadge(merged)
                }
            })
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [])

    const openSong = (chart: ChartInfo) => {
        const song = allSongs.find(s => s.title === chart.title && s.chart_type === chart.chart_type)
        if (song) setSelectedSong(song)
    }

    const getDiffTab = (ver: string): DiffTab => diffTab[ver] ?? 'MASTER'

    const chartMatchesConstant = (chart: ChartInfo) => {
        const cc = Number(chart.chart_constant)
        const min = minConstant.trim() ? Number(minConstant) : null
        const max = maxConstant.trim() ? Number(maxConstant) : null
        if (!Number.isFinite(cc)) return false
        if (min !== null && Number.isFinite(min) && cc < min) return false
        if (max !== null && Number.isFinite(max) && cc > max) return false
        return true
    }

    const getChartsForMode = (ver: VersionProgress) => {
        const charts = mode === 'obtain'
            ? DIFF_TABS.flatMap(diff => ver.difficulties[diff] ?? [])
            : ver.difficulties.MASTER
        return charts.filter(chartMatchesConstant)
    }

    const getBadgeCount = (charts: ChartInfo[], key: BadgeKey) => charts.filter(chart => Boolean(chart[key])).length
    const getBadgeTotal = (charts: ChartInfo[]) => charts.length

    const getApplicableBadges = (ver: VersionProgress) => BADGE_META.filter(badge => badge.key !== 'sss' || ver.has_sho)

    const getSelectedBadges = (ver: VersionProgress) => {
        const applicable = getApplicableBadges(ver)
        const selected = applicable.filter(badge => selectedBadgeKeys.includes(badge.key))
        return selected.length > 0 ? selected : applicable
    }

    const toggleBadgeKey = (key: BadgeKey) => {
        setSelectedBadgeKeys(prev => (
            prev.includes(key)
                ? prev.filter(item => item !== key)
                : [...prev, key]
        ))
    }

    const isChartDone = (chart: ChartInfo, ver: VersionProgress) => {
        const badges = getSelectedBadges(ver)
        return badges.every(badge => Boolean(chart[badge.key as keyof ChartInfo]))
    }

    const filterByCompletion = (charts: ChartInfo[], ver: VersionProgress) => {
        if (completionFilter === 'all') return charts
        return charts.filter(chart => {
            const done = isChartDone(chart, ver)
            return completionFilter === 'done' ? done : !done
        })
    }

    if (loading) return <div class="text-center py-20 text-gray-400">載入中...</div>
    if (data.length === 0) return <div class="text-center py-20 text-gray-400">沒有資料，請先同步成績</div>

    const versions = [...data].filter(v => v.total > 0).reverse()

    return (
        <div class="max-w-4xl mx-auto px-1 py-4 sm:p-4 space-y-3">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
                <div class="flex items-center gap-2">
                    <span class="text-xs font-bold text-gray-500">定數</span>
                    <input
                        type="number"
                        step="0.1"
                        value={minConstant}
                        onInput={(e) => setMinConstant(e.currentTarget.value)}
                        placeholder="Min"
                        class="w-20 rounded-lg border border-gray-700 bg-gray-900 px-2 py-1.5 text-sm font-mono text-white outline-none focus:border-yellow-400"
                    />
                    <span class="text-gray-600">~</span>
                    <input
                        type="number"
                        step="0.1"
                        value={maxConstant}
                        onInput={(e) => setMaxConstant(e.currentTarget.value)}
                        placeholder="Max"
                        class="w-20 rounded-lg border border-gray-700 bg-gray-900 px-2 py-1.5 text-sm font-mono text-white outline-none focus:border-yellow-400"
                    />
                </div>
                <div class="grid grid-cols-2 rounded-lg border border-gray-700 bg-gray-900 p-1 sm:inline-flex sm:self-auto">
                    <button
                        type="button"
                        onClick={() => setMode('obtain')}
                        class={`px-3 py-2 sm:py-1.5 rounded-md text-sm font-bold transition-colors ${mode === 'obtain' ? 'bg-yellow-400 text-gray-950' : 'text-gray-400 hover:text-white'}`}
                    >
                        獲得牌子
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode('confirm')}
                        class={`px-3 py-2 sm:py-1.5 rounded-md text-sm font-bold transition-colors ${mode === 'confirm' ? 'bg-yellow-400 text-gray-950' : 'text-gray-400 hover:text-white'}`}
                    >
                        確認牌子
                    </button>
                </div>
            </div>

            {versions.map(ver => {
                const isExpanded = expandedVersion === ver.version
                const currentDiff = mode === 'confirm' ? 'MASTER' : getDiffTab(ver.version)
                const charts = filterByCompletion((ver.difficulties[currentDiff] ?? []).filter(chartMatchesConstant), ver)
                const modeCharts = getChartsForMode(ver)
                const badgeTotal = getBadgeTotal(modeCharts)
                const unfilteredTotal = mode === 'obtain' ? ver.total : ver.difficulties.MASTER.length
                const applicableBadges = getApplicableBadges(ver)

                return (
                    <div key={ver.version} class="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">

                        {/* 版本標題列 */}
                        <div
                            class="flex items-start justify-between gap-3 p-4 cursor-pointer hover:bg-gray-700/30 transition-colors"
                            onClick={() => setExpandedVersion(isExpanded ? null : ver.version)}
                        >
                        <div class="min-w-0 flex-1">
                            <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                                <span class="text-white font-black text-lg leading-tight">{ver.version_name}</span>
                                {ver.badge_name && (
                                    <span class="text-gray-400 text-sm font-bold">{ver.badge_name}</span>
                                )}
                                <span class="text-gray-500 text-xs">
                                    {badgeTotal}{badgeTotal !== unfilteredTotal ? `/${unfilteredTotal}` : ''} 譜面
                                </span>
                            </div>
                        </div>
                            <div class="flex shrink-0 items-center gap-1 sm:gap-2">
                                {applicableBadges.map(b => {
                                    const count = getBadgeCount(modeCharts, b.key)
                                    const done = count === badgeTotal
                                    return (
                                        <div key={b.key}
                                            class={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black leading-none transition-all ${
                                                done ? `bg-gradient-to-br ${b.color} text-white shadow-lg` : 'bg-gray-700 text-gray-500'
                                            }`}
                                            title={`${b.fullLabel} ${count}/${badgeTotal}`}
                                        >
                                            {b.label}
                                        </div>
                                    )
                                })}
                                <span class="text-gray-500 text-xs ml-0.5 sm:ml-1">{isExpanded ? '▲' : '▼'}</span>
                            </div>
                        </div>

                        {/* 展開內容 */}
                        {isExpanded && (
                            <div class="border-t border-gray-700">

                                {/* 四個進度條（純顯示） */}
                                <div class="p-4 space-y-2.5">
                                {applicableBadges.map(b => {
                                        const count = getBadgeCount(modeCharts, b.key)
                                        const done = count === badgeTotal
                                        return (
                                            <div key={b.key} class="flex items-center gap-3">
                                                <span class={`w-14 text-xs font-black bg-gradient-to-r ${b.color} bg-clip-text text-transparent shrink-0`}>
                                                    {b.fullLabel}
                                                </span>
                                                <div class="flex-1">
                                                    <ProgressBar value={count} total={badgeTotal} colorClass={b.color} />
                                                </div>
                                                <span class={`text-xs font-mono w-16 text-right shrink-0 ${done ? b.text : 'text-gray-500'}`}>
                                                    {count}/{badgeTotal}
                                                </span>
                                                {done && <span class="text-xs shrink-0">✅</span>}
                                            </div>
                                        )
                                    })}
                                </div>

                                {/* 難度 tab */}
                                {mode === 'obtain' ? (
                                <div class="flex gap-1.5 px-4 py-3 flex-wrap border-t border-gray-700/50">
                                    {DIFF_TABS.map(d => (
                                        <button
                                            key={d}
                                            onClick={() => setDiffTab(prev => ({ ...prev, [ver.version]: d }))}
                                            class={`px-3 py-1 rounded text-xs font-bold border transition-colors ${
                                                currentDiff === d
                                                    ? DIFF_ACTIVE[d]
                                                    : 'bg-gray-700 border-transparent text-gray-400 hover:text-white'
                                            }`}
                                        >
                                            {d}
                                        </button>
                                    ))}
                                    <span class="text-gray-600 text-[10px] self-center">{charts.length} 筆</span>
                                </div>
                                ) : (
                                <div class="flex gap-1.5 px-4 py-3 flex-wrap border-t border-gray-700/50">
                                    <span class="px-3 py-1 rounded text-xs font-bold border bg-purple-500 text-white border-purple-400">MASTER</span>
                                    <span class="text-gray-600 text-[10px] self-center">{charts.length} 筆</span>
                                </div>
                                )}

                                <div class="flex items-start justify-between gap-3 px-4 pb-3 flex-wrap">
                                <div class="flex gap-1.5 flex-wrap">
                                    {([
                                        { key: 'all', label: '全部' },
                                        { key: 'remaining', label: '剩餘' },
                                        { key: 'done', label: '已完成' },
                                    ] as { key: CompletionFilter, label: string }[]).map(item => (
                                        <button
                                            key={item.key}
                                            type="button"
                                            onClick={() => setCompletionFilter(item.key)}
                                            class={`px-3 py-1 rounded text-xs font-bold border transition-colors ${
                                                completionFilter === item.key
                                                    ? 'bg-yellow-400 text-gray-950 border-yellow-300'
                                                    : 'bg-gray-700 border-transparent text-gray-400 hover:text-white'
                                            }`}
                                        >
                                            {item.label}
                                        </button>
                                    ))}
                                </div>
                                <div class="flex gap-1.5 flex-wrap justify-end">
                                    {applicableBadges.map(badge => {
                                        const selected = selectedBadgeKeys.includes(badge.key)
                                        return (
                                            <button
                                                key={badge.key}
                                                type="button"
                                                onClick={() => toggleBadgeKey(badge.key)}
                                                class={`px-2.5 py-1 rounded text-xs font-black border transition-colors ${
                                                    selected
                                                        ? `bg-gradient-to-r ${badge.color} text-white border-white/20`
                                                        : 'bg-gray-700 border-transparent text-gray-500 hover:text-white'
                                                }`}
                                                title={badge.fullLabel}
                                            >
                                                {badge.label}
                                            </button>
                                        )
                                    })}
                                </div>
                                </div>

                                {/* 歌曲列表 */}
                                <div class="max-h-96 overflow-y-auto border-t border-gray-700/50">
                                    {charts.map((chart, idx) => (
                                        <div
                                            key={idx}
                                            class="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-700/50 border-b border-gray-700/30 last:border-0 cursor-pointer transition-colors"
                                            onClick={() => openSong(chart)}
                                        >
                                            <div class="relative w-10 h-10 shrink-0 rounded overflow-hidden bg-gray-700">
                                                <JacketImage imageName={chart.image_name} title={chart.title} />
                                                <div class="absolute top-0 left-0">
                                                    <img src={BADGE_IMG[chart.chart_type] ?? BADGE_IMG.STANDARD} alt="" class="h-3" />
                                                </div>
                                            </div>

                                            <div class="flex-1 min-w-0">
                                                <span class="text-white text-xs font-bold truncate block">{chart.title}</span>
                                                {chart.achievement > 0 && (
                                                    <span class="text-gray-500 text-[10px] font-mono">
                                                        {chart.achievement.toFixed(4)}%
                                                    </span>
                                                )}
                                                {chart.chart_constant != null && (
                                                    <span class="ml-2 text-gray-600 text-[10px] font-mono">
                                                        {Number(chart.chart_constant).toFixed(1)}
                                                    </span>
                                                )}
                                            </div>

                                            {/* 四個牌子狀態 */}
                                            <div class="flex items-center gap-1 shrink-0">
                                                {BADGE_META.map(b => {
                                                    const achieved = chart[b.key as keyof ChartInfo] as boolean
                                                    return (
                                                        <span
                                                            key={b.key}
                                                            class={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black ${
                                                                achieved
                                                                    ? `bg-gradient-to-br ${b.color} text-white`
                                                                    : 'bg-gray-700 text-gray-600'
                                                            }`}
                                                            title={b.fullLabel}
                                                        >
                                                            {b.label}
                                                        </span>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                    {charts.length === 0 && (
                                        <div class="text-center py-6 text-gray-600 text-xs">沒有譜面資料</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )
            })}

            {selectedSong && (
                <SongDetailModal song={selectedSong} playerScores={playerScores} onClose={() => setSelectedSong(null)} />
            )}
        </div>
    )
}
