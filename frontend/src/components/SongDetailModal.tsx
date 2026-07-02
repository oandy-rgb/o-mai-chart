// src/components/SongDetailModal.tsx
import { useState, useEffect } from 'preact/hooks'
import type { SongData, PlayerScore } from './SongCard'
import { apiUrl } from '../lib/api'
import JacketImage from './JacketImage'
import { getRank as getRankText } from '@o-mai/shared'

interface Props {
    song: SongData
    playerScores: PlayerScore[]
    onClose: () => void
    personalized?: PersonalizedSongInfo | null
}

export interface PersonalizedSongInfo {
    title?: string
    chart_type?: string
    difficulty?: string
    image_name?: string
    chart_constant?: number
    current_achievement: number | null
    predicted_achievement: number
    predicted_rank: string
    confidence: number
    sample_count: number
    dominant_factor: number
    skill_match: number
    recommendation_score: number
    top_factors?: { factor: number, value: number, share?: number }[]
}

interface PersonalizedResponse {
    ready?: boolean
    reason?: string
    recommendations?: PersonalizedSongInfo[]
    candidates?: PersonalizedSongInfo[]
}

let personalizedCache: {
    data: PersonalizedResponse | null
    promise: Promise<PersonalizedResponse> | null
    fetchedAt: number
} = {
    data: null,
    promise: null,
    fetchedAt: 0,
}

const PERSONALIZED_CACHE_MS = 5 * 60 * 1000

function fetchPersonalizedRecommendations(token: string) {
    const now = Date.now()
    if (personalizedCache.data && now - personalizedCache.fetchedAt < PERSONALIZED_CACHE_MS) {
        return Promise.resolve(personalizedCache.data)
    }

    if (!personalizedCache.promise) {
        personalizedCache.promise = fetch(apiUrl('/api/recommend/nmf'), {
            headers: { Authorization: `Bearer ${token}` },
        })
        .then(async (res) => {
            const data = await res.json()
            if (!res.ok) throw new Error(data?.error || data?.reason || '個人化資料載入失敗')
            personalizedCache.data = data
            personalizedCache.fetchedAt = Date.now()
            return data
        })
        .finally(() => {
            personalizedCache.promise = null
        })
    }

    return personalizedCache.promise
}

function matchesSong(entry: PersonalizedSongInfo, song: SongData) {
    return entry.title === song.title && entry.chart_type === song.chart_type
}

const DIFF_STYLES: Record<string, { bg: string, text: string, order: number }> = {
    BASIC:    { bg: 'bg-green-500',  text: 'text-white',      order: 1 },
    ADVANCED: { bg: 'bg-yellow-500', text: 'text-white',      order: 2 },
    EXPERT:   { bg: 'bg-red-500',    text: 'text-white',      order: 3 },
    MASTER:   { bg: 'bg-purple-500', text: 'text-white',      order: 4 },
    REMASTER: { bg: 'bg-purple-200', text: 'text-purple-900', order: 5 },
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

const FC_OPTIONS = [
    { value: '', label: '不指定' },
{ value: 'fc',  label: 'FC' },
{ value: 'fcp', label: 'FC+' },
{ value: 'ap',  label: 'AP' },
{ value: 'app', label: 'AP+' },
]

const TARGET_RANKS = [
    { label: 'SSS+', value: 100.5 },
    { label: 'SSS', value: 100 },
    { label: 'SS+', value: 99.5 },
    { label: 'SS', value: 99 },
    { label: 'S+', value: 98 },
    { label: 'S', value: 97 },
]

function normalizeTargetAchievement(value: number) {
    return Math.max(0, Math.min(101, Math.round(value * 10) / 10))
}

export default function SongDetailModal({ song, playerScores, onClose, personalized = null }: Props) {
    const [tab, setTab] = useState<'detail' | 'personalized'>(personalized ? 'personalized' : 'detail')
    const [expandedDiff, setExpandedDiff] = useState<string | null>(null)
    const [showAddForm, setShowAddForm] = useState(false)
    const [todoKeys, setTodoKeys] = useState<Set<string>>(new Set())
    const [personalizedMatches, setPersonalizedMatches] = useState<PersonalizedSongInfo[]>(personalized ? [personalized] : [])
    const [personalizedLoading, setPersonalizedLoading] = useState(false)
    const [personalizedError, setPersonalizedError] = useState<string | null>(null)
    const [selectedPersonalizedDifficulty, setSelectedPersonalizedDifficulty] = useState(personalized?.difficulty ?? '')
    const [aliasInput, setAliasInput] = useState('')
    const [aliasMessage, setAliasMessage] = useState<string | null>(null)
    const [aliasSubmitting, setAliasSubmitting] = useState(false)
    const [showAliasForm, setShowAliasForm] = useState(false)

    const defaultDiff = [...(song.difficulties || [])]
    .sort((a, b) => (DIFF_STYLES[a.difficulty]?.order || 99) - (DIFF_STYLES[b.difficulty]?.order || 99))
    .findLast(d => d.difficulty !== 'REMASTER')?.difficulty
    ?? song.difficulties[0]?.difficulty ?? 'MASTER'

    const [todoDiff, setTodoDiff] = useState(defaultDiff)
    const [todoAchievement, setTodoAchievement] = useState('')
    const [todoFc, setTodoFc] = useState('')
    const [addedFeedback, setAddedFeedback] = useState(false)

    const sortedDifficulties = [...(song.difficulties || [])].sort((a, b) =>
    (DIFF_STYLES[a.difficulty]?.order || 99) - (DIFF_STYLES[b.difficulty]?.order || 99)
    )

    const scoreMap = new Map<string, PlayerScore>()
    for (const s of playerScores) {
        if (s.title === song.title && s.chart_type === song.chart_type) {
            scoreMap.set(s.difficulty, s)
        }
    }

    const activePersonalized = personalizedMatches.find(item => item.difficulty === selectedPersonalizedDifficulty)
        ?? personalizedMatches[0]
        ?? null

    // 載入這首歌目前在清單裡的難度
    useEffect(() => {
        const token = localStorage.getItem('maimai_sync_token')
        if (!token) return
            fetch(apiUrl('/api/todo'), {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            .then(r => r.json())
            .then(data => {
                if (!Array.isArray(data)) return
                    const keys = new Set<string>(
                        data
                        .filter((t: any) => t.title === song.title && t.chart_type === song.chart_type && !t.done)
                        .map((t: any) => t.difficulty)
                    )
                    setTodoKeys(keys)
            })
            .catch(console.error)
    }, [song.title, song.chart_type])

    useEffect(() => {
        if (personalized) {
            setPersonalizedMatches([personalized])
            setSelectedPersonalizedDifficulty(personalized.difficulty ?? '')
            setPersonalizedError(null)
            setPersonalizedLoading(false)
            return
        }

        const token = localStorage.getItem('maimai_sync_token')
        if (!token) {
            setPersonalizedMatches([])
            setPersonalizedError('需要先登入並同步成績')
            return
        }

        let cancelled = false
        setPersonalizedLoading(true)
        setPersonalizedError(null)
        fetchPersonalizedRecommendations(token)
        .then(data => {
            if (cancelled) return
            if (!data.ready) {
                setPersonalizedMatches([])
                setPersonalizedError(data.reason ?? '需要更多成績才能建立個人化模型')
                return
            }

            const matches = (data.candidates ?? data.recommendations ?? [])
            .filter(entry => matchesSong(entry, song))
            .sort((a, b) => b.recommendation_score - a.recommendation_score)

            setPersonalizedMatches(matches)
            setSelectedPersonalizedDifficulty(matches[0]?.difficulty ?? '')
            setPersonalizedError(matches.length ? null : '這首歌目前沒有足夠樣本可分析')
        })
        .catch(error => {
            if (cancelled) return
            setPersonalizedMatches([])
            setPersonalizedError(error instanceof Error ? error.message : '個人化資料載入失敗')
        })
        .finally(() => {
            if (!cancelled) setPersonalizedLoading(false)
        })

        return () => { cancelled = true }
    }, [song.title, song.chart_type, personalized])

    const ytUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(song.title + ' maimai')}`

    const setTargetAchievement = (value: number) => {
        setTodoAchievement(normalizeTargetAchievement(value).toFixed(1))
    }

    const adjustTargetAchievement = (delta: number) => {
        const current = todoAchievement ? parseFloat(todoAchievement) : 97
        setTargetAchievement(current + delta)
    }

    const handleAddTodo = async (e: Event) => {
        e.stopPropagation()
        const token = localStorage.getItem('maimai_sync_token')
        if (!token) return
            try {
                await fetch(apiUrl('/api/todo'), {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        title: song.title,
                        chart_type: song.chart_type,
                        image_name: song.image_name,
                        difficulty: todoDiff,
                        target_achievement: todoAchievement ? parseFloat(todoAchievement) : null,
                                         target_fc: todoFc || null,
                                         source: 'manual',
                    }),
                })
                setTodoKeys(prev => new Set([...prev, todoDiff]))
                setAddedFeedback(true)
                setTimeout(() => { setAddedFeedback(false); setShowAddForm(false) }, 1200)
            } catch (e) {
                console.error('add todo error:', e)
            }
    }

    const handleAliasSuggestion = async (e: Event) => {
        e.stopPropagation()
        const token = localStorage.getItem('maimai_sync_token')
        if (!token) {
            setAliasMessage('需要先登入')
            return
        }

        const alias = aliasInput.replace(/\s+/g, ' ').trim()
        if (!alias) {
            setAliasMessage('請輸入別名')
            return
        }

        setAliasSubmitting(true)
        setAliasMessage(null)
        try {
            const res = await fetch(apiUrl('/api/songs/alias-suggestions'), {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: song.title,
                    chart_type: song.chart_type,
                    alias,
                }),
            })
            const data = await res.json()
            if (!res.ok) {
                setAliasMessage(data.error ?? '送出失敗')
                return
            }
            setAliasInput('')
            setAliasMessage(data.status === 'already_exists' ? '這個別名已存在' : '已送出，等待審核')
        } catch (error) {
            console.error('alias suggestion error:', error)
            setAliasMessage('送出失敗')
        } finally {
            setAliasSubmitting(false)
        }
    }

    return (
        <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in"
        onClick={onClose}
        >
        <div
        class="bg-gray-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl relative border border-gray-700 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        >
        <button onClick={onClose}
        class="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-black/50 text-white hover:bg-red-500 transition-colors"
        >✕</button>

        <div class="relative w-full aspect-[2/1] bg-gray-900 flex justify-center items-center overflow-hidden">
        <JacketImage
        imageName={song.image_name}
        title={song.title}
        class="absolute inset-0 w-full h-full object-cover opacity-30 blur-xl scale-110"
        />
        <JacketImage
        imageName={song.image_name}
        title={song.title}
        class="relative h-4/5 aspect-square rounded-lg shadow-xl border border-gray-700 object-cover"
        loading="eager"
        />
        </div>

        <div class="p-6">
        <div class="mb-4 inline-flex rounded-lg border border-gray-700 bg-gray-900 p-1">
        <button
        type="button"
        class={`px-3 py-1.5 rounded-md text-sm font-bold transition-colors ${tab === 'detail' ? 'bg-yellow-400 text-gray-950' : 'text-gray-400 hover:text-white'}`}
        onClick={(e) => { e.stopPropagation(); setTab('detail') }}
        >
        詳情
        </button>
        <button
        type="button"
        class={`px-3 py-1.5 rounded-md text-sm font-bold transition-colors ${tab === 'personalized' ? 'bg-violet-400 text-gray-950' : 'text-gray-400 hover:text-white'}`}
        onClick={(e) => { e.stopPropagation(); setTab('personalized') }}
        >
        個人化
        </button>
        </div>

        {tab === 'personalized' ? (
            activePersonalized ? (
            <div class="space-y-4">
            <div>
            <h2 class="zh-tight text-2xl font-black text-white">{song.title}</h2>
            <p class="text-gray-400 mt-1 text-sm">{song.artist || '未知藝術家'}</p>
            {personalizedMatches.length > 1 && (
                <div class="mt-3 flex gap-2 flex-wrap">
                {personalizedMatches.map(item => {
                    const style = DIFF_STYLES[item.difficulty ?? ''] ?? DIFF_STYLES.MASTER
                    return (
                        <button
                        key={`${item.difficulty}-${item.chart_type}`}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setSelectedPersonalizedDifficulty(item.difficulty ?? '') }}
                        class={`px-2.5 py-1 rounded text-xs font-bold border-2 transition-all ${selectedPersonalizedDifficulty === item.difficulty ? `${style.bg} ${style.text} border-white` : 'bg-gray-900 text-gray-400 border-gray-700 hover:border-gray-500'}`}
                        >
                        {item.difficulty}
                        </button>
                    )
                })}
                </div>
            )}
            </div>

            <div class="grid grid-cols-2 gap-3">
            <div class="rounded-xl bg-gray-900 border border-gray-700 p-3">
            <div class="text-[10px] text-gray-500 uppercase tracking-wider font-bold">預測達成率</div>
            <div class="mt-1 text-2xl font-black text-yellow-300">{activePersonalized.predicted_achievement.toFixed(2)}%</div>
            <div class="text-xs text-gray-400">{activePersonalized.predicted_rank}</div>
            </div>
            <div class="rounded-xl bg-gray-900 border border-gray-700 p-3">
            <div class="text-[10px] text-gray-500 uppercase tracking-wider font-bold">目前差距</div>
            <div class="mt-1 text-2xl font-black text-emerald-300">
            {activePersonalized.current_achievement == null
                ? '未遊玩'
                : `${(activePersonalized.predicted_achievement - activePersonalized.current_achievement >= 0 ? '+' : '')}${(activePersonalized.predicted_achievement - activePersonalized.current_achievement).toFixed(2)}%`}
            </div>
            <div class="text-xs text-gray-400">
            {activePersonalized.current_achievement == null ? '無目前成績' : `目前 ${activePersonalized.current_achievement.toFixed(4)}%`}
            </div>
            </div>
            </div>

            <div class="rounded-xl bg-gray-900 border border-gray-700 p-4">
            <div class="flex items-center justify-between gap-3 mb-3">
            <div>
            <div class="text-white font-black">Factor 分布</div>
            <div class="text-xs text-gray-500">主要 Factor {activePersonalized.dominant_factor + 1} · match {activePersonalized.skill_match.toFixed(4)}</div>
            </div>
            <div class="text-right text-xs text-gray-400">
            樣本 {activePersonalized.sample_count}<br />
            信心 {(activePersonalized.confidence * 100).toFixed(0)}%
            </div>
            </div>

            {(activePersonalized.top_factors?.length ? activePersonalized.top_factors : [{ factor: activePersonalized.dominant_factor, value: activePersonalized.skill_match }]).map(item => (
                <div key={item.factor} class="mb-2 last:mb-0">
                <div class="flex justify-between text-xs mb-1">
                <span class="text-gray-300 font-bold">Factor {item.factor + 1}</span>
                <span class="text-violet-300 font-mono">{((item.share ?? item.value) * 100).toFixed(1)}%</span>
                </div>
                <div class="h-2 rounded bg-gray-800 overflow-hidden">
                <div
                class="h-full rounded bg-violet-400"
                style={{ width: `${Math.min(100, Math.max(4, (item.share ?? item.value) * 100))}%` }}
                />
                </div>
                </div>
            ))}
            </div>
            </div>
            ) : (
                <div class="rounded-xl bg-gray-900 border border-gray-700 p-6 text-center">
                <h2 class="zh-tight text-xl font-black text-white">{song.title}</h2>
                <p class="mt-3 text-sm text-gray-400">
                {personalizedLoading ? '個人化資料載入中...' : personalizedError ?? '目前沒有個人化資料'}
                </p>
                </div>
            )
        ) : (
        <>
        <div class="flex items-start justify-between gap-3">
        <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
        <h2 class="zh-tight text-2xl font-black text-white">{song.title}</h2>
        <a href={ytUrl} target="_blank" rel="noopener noreferrer"
        class="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg bg-red-600 hover:bg-red-500 transition-colors text-white text-xs font-bold"
        onClick={(e) => e.stopPropagation()}>
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
        </svg>
        YT
        </a>
        <button
        onClick={(e) => { e.stopPropagation(); setShowAddForm(!showAddForm) }}
        class={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg transition-colors text-xs font-bold ${showAddForm ? 'bg-orange-500 text-white' : 'bg-gray-700 hover:bg-orange-500 text-gray-300 hover:text-white'}`}
        >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        待打
        </button>
        <button
        onClick={(e) => { e.stopPropagation(); setShowAliasForm(!showAliasForm) }}
        class={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg transition-colors text-xs font-bold ${showAliasForm ? 'bg-cyan-500 text-gray-950' : 'bg-gray-700 hover:bg-cyan-500 text-gray-300 hover:text-gray-950'}`}
        >
        別名
        </button>
        </div>
        <p class="text-gray-400 mt-1 text-sm">{song.artist || '未知藝術家'}</p>
        {song.bpm ? (
            <div class="mt-2 inline-flex rounded-md border border-gray-700 bg-gray-900 px-2 py-1 text-xs font-bold text-gray-300">
            BPM <span class="ml-1 font-mono text-yellow-300">{song.bpm}</span>
            </div>
        ) : null}
        {(song.aliases?.length ?? 0) > 0 && (
            <div class="mt-2 flex flex-wrap gap-1.5">
            {song.aliases?.map(alias => (
                <span key={alias} class="rounded-md border border-cyan-500/25 bg-cyan-500/10 px-2 py-1 text-xs font-bold text-cyan-200">
                {alias}
                </span>
            ))}
            </div>
        )}
        <div class="flex gap-3 mt-1 flex-wrap">
        {song.date_intl_added && (
            <span class="text-gray-500 text-xs font-mono">
            🌐 {song.date_intl_added.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')}
            {song.date_intl_updated && song.date_intl_updated !== song.date_intl_added && (
                <span class="text-gray-600"> → {song.date_intl_updated.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')}</span>
            )}
            </span>
        )}
        {song.date_added && (
            <span class="text-gray-600 text-xs font-mono">
            🇯🇵 {song.date_added.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')}
            {song.date_updated && song.date_updated !== song.date_added && (
                <span> → {song.date_updated.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')}</span>
            )}
            </span>
        )}
        </div>
        </div>
        <img src={BADGE_URL[song.chart_type] ?? BADGE_URL.STANDARD} alt={song.chart_type}
        class="h-7 shrink-0 drop-shadow-md" />
        </div>

        {showAliasForm && (
        <div class="mt-4 rounded-xl border border-cyan-500/30 bg-gray-900 p-3" onClick={(e) => e.stopPropagation()}>
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div class="flex-1">
        <label class="mb-1 block text-xs font-bold text-gray-400">建議別名</label>
        <input
        value={aliasInput}
        maxLength={50}
        onInput={(e) => setAliasInput(e.currentTarget.value)}
        placeholder="例：常用簡稱、中文俗稱"
        class="w-full rounded-lg border border-gray-700 bg-gray-800 p-2 text-sm text-white outline-none placeholder-gray-600 focus:border-cyan-500"
        />
        </div>
        <button
        type="button"
        disabled={aliasSubmitting}
        onClick={handleAliasSuggestion}
        class="rounded-lg bg-cyan-500 px-3 py-2 text-sm font-bold text-gray-950 transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60 sm:self-end"
        >
        {aliasSubmitting ? '送出中' : '送出'}
        </button>
        </div>
        {aliasMessage && <div class="mt-2 text-xs text-gray-400">{aliasMessage}</div>}
        </div>
        )}

        {showAddForm && (
            <div class="mt-4 p-4 bg-gray-900 rounded-xl border border-orange-500/40 space-y-3" onClick={(e) => e.stopPropagation()}>
            <p class="text-xs font-bold text-orange-400 uppercase tracking-wider">加入待打清單</p>
            <div class="flex flex-col gap-1">
            <label class="text-xs text-gray-400">難度</label>
            <div class="flex gap-2 flex-wrap">
            {sortedDifficulties.map(d => {
                const style = DIFF_STYLES[d.difficulty]
                const inList = todoKeys.has(d.difficulty)
                return (
                    <button key={d.difficulty} onClick={() => setTodoDiff(d.difficulty)}
                    class={`px-2.5 py-1 rounded text-xs font-bold transition-all border-2 ${todoDiff === d.difficulty ? `${style?.bg} ${style?.text} border-white` : 'bg-gray-800 text-gray-400 border-transparent hover:border-gray-600'}`}
                    >
                    {d.difficulty}{inList ? ' ✓' : ''}
                    </button>
                )
            })}
            </div>
            </div>
            <div class="flex gap-3">
            <div class="flex-1 flex flex-col gap-1">
            <label class="text-xs text-gray-400">目標達成率 (%)</label>
            <input type="number" step="0.1" min="0" max="101"
            value={todoAchievement} onInput={(e) => setTodoAchievement(e.currentTarget.value)}
            placeholder="例：99.5"
            class="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg p-2 focus:border-orange-500 outline-none placeholder-gray-600 w-full"
            />
            </div>
            <div class="flex-1 flex flex-col gap-1">
            <label class="text-xs text-gray-400">目標 FC</label>
            <select value={todoFc} onChange={(e) => setTodoFc(e.currentTarget.value)}
            class="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg p-2 focus:border-orange-500 outline-none w-full"
            >
            {FC_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
            </select>
            </div>
            </div>
            <div class="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
            {TARGET_RANKS.map(rank => (
                <button
                type="button"
                key={rank.label}
                onClick={() => setTargetAchievement(rank.value)}
                class={`px-2 py-1.5 rounded-lg text-xs font-bold transition-colors ${parseFloat(todoAchievement) === rank.value ? 'bg-yellow-400 text-gray-950' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
                >
                {rank.label}
                </button>
            ))}
            </div>
            <button onClick={handleAddTodo}
            class={`w-full py-2 rounded-lg text-sm font-bold transition-all ${addedFeedback ? 'bg-green-600 text-white' : 'bg-orange-500 hover:bg-orange-400 text-white'}`}
            >
            {addedFeedback ? '✅ 已加入！' : '加入清單'}
            </button>
            </div>
        )}

        <div class="mt-6 space-y-2">
        {sortedDifficulties.length > 0 ? sortedDifficulties.map(diff => {
            const style = DIFF_STYLES[diff.difficulty] || { bg: 'bg-gray-600', text: 'text-white' }
            const playerScore = scoreMap.get(diff.difficulty)
            const isExpanded = expandedDiff === diff.difficulty
            const hasNotes = diff.notes_tap != null || diff.notes_hold != null
            const hasAchievement = playerScore?.achievement != null
            const fcStyle = playerScore?.fc ? FC_STYLES[playerScore.fc] : null
            const syncStyle = playerScore?.sync ? SYNC_STYLES[playerScore.sync] : null

            return (
                <div key={diff.difficulty} class="rounded-lg overflow-hidden border border-gray-700">
                <div class={`grid min-h-12 grid-cols-[6rem_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 bg-gray-900 px-2 py-2 sm:grid-cols-[6rem_minmax(0,1fr)_auto] ${hasNotes ? 'cursor-pointer hover:bg-gray-800 transition-colors' : ''}`}
                onClick={() => hasNotes && setExpandedDiff(isExpanded ? null : diff.difficulty)}>
                <div class={`w-24 rounded-md px-2 py-1.5 text-[11px] font-bold text-center leading-none shadow-sm ${style.bg} ${style.text}`}>
                {diff.difficulty}
                </div>
                <div class="col-span-3 row-start-2 min-w-0 px-1 text-xs font-bold leading-snug text-gray-300 sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:text-sm sm:truncate">
                {diff.chart_designer ? `譜面: ${diff.chart_designer}` : ''}
                </div>
                <div class="flex items-center justify-end gap-1.5 sm:gap-2">
                <span class="text-sm font-bold text-gray-300">Lv.{diff.level}</span>
                <span class="text-lg font-mono font-black text-white">{diff.chart_constant.toFixed(1)}</span>
                {hasNotes && <span class="text-gray-500 text-xs">{isExpanded ? '▲' : '▼'}</span>}
                </div>
                </div>

                {playerScore && hasAchievement && (
                    <div class="flex items-center gap-2 px-3 py-1.5 bg-gray-900/80 border-t border-gray-700/50 flex-wrap">
                    <span class="text-[10px] text-gray-500 uppercase tracking-wider">你的成績</span>
                    <span class="text-sm font-mono font-bold text-yellow-400">{playerScore.achievement.toFixed(4)}%</span>
                    <span class="text-xs font-bold text-white">{getRankText(playerScore.achievement)}</span>
                    {fcStyle && <span class={`px-1.5 py-0.5 rounded text-[10px] font-bold ${fcStyle.bg} ${fcStyle.text}`}>{fcStyle.label}</span>}
                    {syncStyle && <span class={`px-1.5 py-0.5 rounded text-[10px] font-bold ${syncStyle.bg} ${syncStyle.text}`}>{syncStyle.label}</span>}
                    {playerScore.dx_score != null && playerScore.dx_total != null && (
                        <span class="text-[10px] font-mono text-violet-300 ml-1">
                            {playerScore.dx_score.toLocaleString()}/{playerScore.dx_total.toLocaleString()}
                            {playerScore.dx_stars != null && playerScore.dx_stars > 0 && (
                                <span class="text-violet-400 ml-1">
                                    {'♦'.repeat(playerScore.dx_stars)}
                                </span>
                            )}
                        </span>
                    )}
                    </div>
                )}

                {isExpanded && hasNotes && (
                    <div class="px-4 py-3 bg-gray-950 border-t border-gray-700 grid grid-cols-5 gap-2 text-center">
                    {[
                        { label: 'Tap',   value: diff.notes_tap },
                        { label: 'Hold',  value: diff.notes_hold },
                        { label: 'Slide', value: diff.notes_slide },
                        { label: 'Touch', value: diff.notes_touch },
                        { label: 'Break', value: diff.notes_break },
                    ].map(({ label, value }) => (
                        <div key={label} class="flex flex-col gap-1">
                        <span class="text-[10px] text-gray-500 uppercase tracking-wider">{label}</span>
                        <span class="text-sm font-mono font-bold text-white">{value != null ? value : '—'}</span>
                        </div>
                    ))}
                    </div>
                )}
                </div>
            )
        }) : (
            <div class="p-4 bg-gray-900 rounded-lg border border-gray-700 text-center text-gray-400 text-sm">
            載入定數資訊中或查無資料...
            </div>
        )}
        </div>
        </>
        )}
        </div>
        </div>
        </div>
    )
}
