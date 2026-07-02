// src/components/FriendB50.tsx
import { useEffect, useState } from 'preact/hooks'
import { apiUrl } from '../lib/api'
import JacketImage from './JacketImage'
import { getRank as getRankText } from '@o-mai/shared'

interface Score {
    id: string
    title: string
    difficulty: string
    chart_type: string
    level: string
    achievement: number
    chart_constant: number
    rating: number
    fc: string | null
    sync: string | null
    image_name: string
}

interface B50Data {
    totalRating: number
    newScores: Score[]
    oldScores: Score[]
}

interface AllScore {
    title: string
    chart_type: string
    difficulty: string
    achievement: number
    fc: string | null
    sync: string | null
    image_name: string
}

interface VersionProgress {
    version: string
    version_name: string
    total: number
    sss: number
    fc: number
    ap: number
    app: number
}

const DIFF_BG: Record<string, string> = {
    BASIC:    'bg-green-500 text-white',
    ADVANCED: 'bg-yellow-500 text-white',
    EXPERT:   'bg-red-500 text-white',
    MASTER:   'bg-purple-500 text-white',
    REMASTER: 'bg-purple-200 text-purple-900',
}

const DIFF_FILTER: Record<string, string> = {
    BASIC:    'bg-green-500',
    ADVANCED: 'bg-yellow-500',
    EXPERT:   'bg-red-500',
    MASTER:   'bg-purple-500',
    REMASTER: 'bg-purple-200',
}

const FC_STYLES: Record<string, { bg: string, text: string, label: string }> = {
    fc:  { bg: 'bg-emerald-500', text: 'text-white',       label: 'FC'  },
    fcp: { bg: 'bg-emerald-300', text: 'text-white', label: 'FC+' },
    ap:  { bg: 'bg-amber-400',   text: 'text-white',       label: 'AP'  },
    app: { bg: 'bg-amber-200',   text: 'text-white',   label: 'AP+' },
}

const SYNC_STYLES: Record<string, { bg: string, text: string, label: string }> = {
    fs:   { bg: 'bg-sky-500',    text: 'text-white',      label: 'FS'   },
    fsp:  { bg: 'bg-sky-300',    text: 'text-white',    label: 'FS+'  },
    fdx:  { bg: 'bg-violet-500', text: 'text-white',      label: 'FDX'  },
    fdxp: { bg: 'bg-violet-300', text: 'text-white', label: 'FDX+' },
}

const BADGE_URL: Record<string, string> = {
    DX:       'https://cdn.jsdelivr.net/gh/zvuc/otoge-db@master/maimai/img/chart_badge_dx.png',
    STANDARD: 'https://cdn.jsdelivr.net/gh/zvuc/otoge-db@master/maimai/img/chart_badge_std.png',
}

const BADGE_META = [
    { key: 'sss' as const, label: '將牌',  color: 'from-yellow-400 to-amber-500',  },
    { key: 'fc'  as const, label: '極牌',  color: 'from-emerald-400 to-green-500', },
    { key: 'ap'  as const, label: '神牌',  color: 'from-sky-400 to-blue-500',      },
    { key: 'app' as const, label: '舞舞牌', color: 'from-violet-400 to-purple-500', },
]

export default function FriendB50() {
    const [friendId, setFriendId] = useState<string>('')
    const [tab, setTab] = useState<'b50' | 'scores' | 'badge'>('b50')
    const [b50, setB50] = useState<B50Data | null>(null)
    const [scores, setScores] = useState<AllScore[] | null>(null)
    const [badge, setBadge] = useState<VersionProgress[] | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [diffFilter, setDiffFilter] = useState('ALL')

    // 從 URL query string 讀取 friendId
    useEffect(() => {
        const id = new URLSearchParams(window.location.search).get('id') ?? ''
        setFriendId(id)
    }, [])

    useEffect(() => {
        if (!friendId) return
        const token = localStorage.getItem('maimai_sync_token')
        if (!token) { setError('請先登入'); return }
        fetch(apiUrl(`/api/friends/${friendId}/b50`), {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(r => r.json())
        .then(d => { if (d.error) setError(d.error); else setB50(d) })
        .catch(() => setError('載入失敗'))
    }, [friendId])

    useEffect(() => {
        if (!friendId) return
        const token = localStorage.getItem('maimai_sync_token')
        if (!token) return
        const headers = { 'Authorization': `Bearer ${token}` }
        if (tab === 'scores' && !scores) {
            fetch(apiUrl(`/api/friends/${friendId}/scores`), { headers })
            .then(r => r.json()).then(d => { if (Array.isArray(d)) setScores(d) })
        }
        if (tab === 'badge' && !badge) {
            fetch(apiUrl(`/api/friends/${friendId}/badge`), { headers })
            .then(r => r.json()).then(d => { if (Array.isArray(d)) setBadge(d) })
        }
    }, [tab, friendId])

    if (error) return <div class="text-center py-20 text-gray-400">{error}</div>
    if (!friendId) return <div class="text-center py-20 text-gray-400">載入中...</div>

    const renderB50Section = (list: Score[], title: string) => (
        <div class="mb-12">
        <h2 class="text-xl font-bold mb-4 text-white border-l-4 border-yellow-400 pl-3">{title}</h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {list.map((s, i) => {
            const fcStyle = s.fc ? FC_STYLES[s.fc] : null
            const syncStyle = s.sync ? SYNC_STYLES[s.sync] : null
            return (
                <div key={s.id} class="flex flex-col bg-gray-900 rounded-md overflow-hidden border border-gray-700">
                <div class="relative w-full aspect-square bg-gray-800">
                <JacketImage imageName={s.image_name} title={s.title} />
                <div class="absolute top-1 left-1"><img src={BADGE_URL[s.chart_type] ?? BADGE_URL.STANDARD} class="h-4" /></div>
                <div class="absolute top-1 right-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-gradient-to-r from-yellow-400 to-yellow-600 text-white leading-none">{getRankText(s.achievement)}</div>
                <div class="absolute bottom-1 left-1 text-xs font-black italic text-white drop-shadow-[0_2px_2px_rgba(0,0,0,1)]">#{i+1}</div>
                <div class="absolute bottom-1 right-1 flex flex-col items-end gap-0.5">
                {fcStyle && <span class={`px-1.5 py-0.5 rounded text-[9px] font-bold leading-none ${fcStyle.bg} ${fcStyle.text}`}>{fcStyle.label}</span>}
                {syncStyle && <span class={`px-1.5 py-0.5 rounded text-[9px] font-bold leading-none ${syncStyle.bg} ${syncStyle.text}`}>{syncStyle.label}</span>}
                </div>
                </div>
                <div class={`flex justify-between px-2 py-1 text-[11px] font-bold ${DIFF_BG[s.difficulty]}`}>
                <span>{s.rating}</span><span class="bg-white/20 px-1 rounded">{s.chart_constant.toFixed(1)}</span>
                </div>
                <div class="px-2 py-1.5 bg-[#174676] text-center text-[11px] font-bold text-white truncate">{s.title}</div>
                <div class="flex justify-between px-2 py-1 bg-[#09223e] text-[10px] text-gray-200">
                <span class="font-mono">{s.achievement.toFixed(4)}%</span>
                <span class="font-bold text-yellow-400">{getRankText(s.achievement)}</span>
                </div>
                </div>
            )
        })}
        </div>
        </div>
    )

    const filteredScores = scores?.filter(s => diffFilter === 'ALL' || s.difficulty === diffFilter) ?? []

    return (
        <div class="max-w-7xl mx-auto p-4">
        <div class="mb-6">
        <a href="/friends" class="text-gray-400 hover:text-white text-sm transition-colors">← 返回好友列表</a>
        </div>

        <div class="flex gap-2 border-b border-gray-700 mb-6">
        {([
            { key: 'b50',    label: 'B50 榜單' },
            { key: 'scores', label: '全部成績' },
            { key: 'badge',  label: '牌子進度' },
        ] as { key: typeof tab, label: string }[]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
            class={`px-4 py-2 text-sm font-bold border-b-2 transition-colors -mb-px ${
                tab === t.key ? 'border-yellow-400 text-white' : 'border-transparent text-gray-400 hover:text-white'
            }`}>{t.label}</button>
        ))}
        </div>

        {/* B50 */}
        {tab === 'b50' && (
            !b50 ? <div class="text-center py-20 text-gray-400">載入中...</div> :
            <>
            <div class="mb-10 p-6 bg-gray-800/50 rounded-xl text-center border border-gray-700/50">
            <div class="text-gray-400 text-sm tracking-widest uppercase mb-1">DX Rating</div>
            <div class="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-yellow-300 to-yellow-600">{b50.totalRating}</div>
            </div>
            {renderB50Section(b50.newScores, `NEW (${b50.newScores.length})`)}
            {renderB50Section(b50.oldScores, `OTHERS (${b50.oldScores.length})`)}
            </>
        )}

        {/* 全部成績 */}
        {tab === 'scores' && (
            !scores ? <div class="text-center py-20 text-gray-400">載入中...</div> :
            <div class="space-y-4">
            <div class="flex gap-2 flex-wrap">
            {['ALL', 'BASIC', 'ADVANCED', 'EXPERT', 'MASTER', 'REMASTER'].map(d => (
                <button key={d} onClick={() => setDiffFilter(d)}
                class={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                    diffFilter === d
                    ? d === 'ALL' ? 'bg-gray-600 border-gray-500 text-white' : `${DIFF_FILTER[d]} border-transparent text-white`
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
                }`}>{d === 'ALL' ? '全部' : d === 'REMASTER' ? 'Re:MAS' : d}</button>
            ))}
            <span class="text-gray-500 text-xs self-center">{filteredScores.length} 筆</span>
            </div>
            <div class="space-y-2">
            {filteredScores.map((s, i) => {
                const fcStyle = s.fc ? FC_STYLES[s.fc] : null
                const syncStyle = s.sync ? SYNC_STYLES[s.sync] : null
                return (
                    <div key={i} class="flex items-center gap-3 p-3 bg-gray-800 rounded-xl border border-gray-700">
                    <div class="relative w-12 h-12 shrink-0 rounded-lg overflow-hidden bg-gray-700">
                    <JacketImage imageName={s.image_name} title={s.title} />
                    <div class="absolute top-0 left-0"><img src={BADGE_URL[s.chart_type] ?? BADGE_URL.STANDARD} class="h-3" /></div>
                    </div>
                    <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1.5 flex-wrap">
                    <span class={`px-1.5 py-0.5 rounded text-[9px] font-bold text-white ${DIFF_FILTER[s.difficulty] ?? 'bg-gray-600'}`}>{s.difficulty}</span>
                    <span class="text-white text-sm font-bold truncate">{s.title}</span>
                    </div>
                    <div class="flex gap-1.5 mt-0.5 flex-wrap">
                    {fcStyle && <span class={`px-1.5 py-0.5 rounded text-[9px] font-bold ${fcStyle.bg} ${fcStyle.text}`}>{fcStyle.label}</span>}
                    {syncStyle && <span class={`px-1.5 py-0.5 rounded text-[9px] font-bold ${syncStyle.bg} ${syncStyle.text}`}>{syncStyle.label}</span>}
                    </div>
                    </div>
                    <div class="text-right shrink-0">
                    <div class="text-sm font-mono font-bold text-yellow-400">{s.achievement.toFixed(4)}%</div>
                    <div class="text-xs text-gray-400">{getRankText(s.achievement)}</div>
                    </div>
                    </div>
                )
            })}
            </div>
            </div>
        )}

        {/* 牌子進度 */}
        {tab === 'badge' && (
            !badge ? <div class="text-center py-20 text-gray-400">載入中...</div> :
            <div class="space-y-3">
            {[...badge].filter(v => v.total > 0).reverse().map(ver => (
                <div key={ver.version} class="p-4 bg-gray-800 rounded-xl border border-gray-700">
                <div class="flex items-center justify-between mb-3">
                <span class="text-white font-black">{ver.version_name}</span>
                <span class="text-gray-500 text-xs">{ver.total} 譜面</span>
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {BADGE_META.map(b => {
                    const count = ver[b.key]
                    const pct = Math.round((count / ver.total) * 100)
                    return (
                        <div key={b.key} class="space-y-1">
                        <div class="flex justify-between text-xs">
                        <span class={`font-bold bg-gradient-to-r ${b.color} bg-clip-text text-transparent`}>{b.label}</span>
                        <span class="text-gray-400 font-mono">{count}/{ver.total}</span>
                        </div>
                        <div class="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div class={`h-full rounded-full bg-gradient-to-r ${b.color}`} style={{ width: `${pct}%` }} />
                        </div>
                        </div>
                    )
                })}
                </div>
                </div>
            ))}
            </div>
        )}
        </div>
    )
}
