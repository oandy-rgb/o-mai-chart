// src/components/Recommend.tsx
import { useState, useEffect } from 'preact/hooks'
import SongDetailModal from './SongDetailModal'
import type { SongData, PlayerScore } from './SongCard'
import type { PersonalizedSongInfo } from './SongDetailModal'
import { apiUrl } from '../lib/api'
import JacketImage from './JacketImage'
import { loadSongs } from '../lib/songStore'

interface RecommendEntry {
    title: string
    chart_type: string
    difficulty: string
    image_name: string
    chart_constant: number
    current_achievement: number
    current_rank: string
    next_rank: string
    next_achievement: number
    current_rating: number
    next_rating: number
    rating_gain: number
    gap: number
    in_b50: boolean
}

interface RecommendData {
    new: RecommendEntry[]
    old: RecommendEntry[]
}

interface PersonalizedEntry {
    title: string
    chart_type: string
    difficulty: string
    image_name: string
    chart_constant: number
    current_achievement: number | null
    predicted_achievement: number
    predicted_rank: string
    confidence: number
    sample_count: number
    dominant_factor: number
    skill_match: number
    recommendation_score: number
    top_factors?: { factor: number, value: number }[]
}

interface PersonalizedData {
    ready: boolean
    reason?: string
    model?: {
        players: number
        scores: number
        filtered_out: number
        factors: number
    }
    recommendations: PersonalizedEntry[]
    factors?: {
        factor: number
        player_value: number
        top_songs: {
            title: string
            chart_type: string
            difficulty: string
            chart_constant: number
            image_name: string
            value: number
        }[]
    }[]
}

type SortMode = 'recommended' | 'gainDesc'
type RecommendMode = 'rating' | 'personalized'

const DIFF_BG: Record<string, string> = {
    BASIC:    'bg-green-500',
    ADVANCED: 'bg-yellow-500',
    EXPERT:   'bg-red-500',
    MASTER:   'bg-purple-500',
    REMASTER: 'bg-purple-200',
}

const BADGE_IMG: Record<string, string> = {
    DX:       'https://cdn.jsdelivr.net/gh/zvuc/otoge-db@master/maimai/img/chart_badge_dx.png',
    STANDARD: 'https://cdn.jsdelivr.net/gh/zvuc/otoge-db@master/maimai/img/chart_badge_std.png',
}

function RecommendCard({
    entry,
    onOpen,
}: {
    entry: RecommendEntry
    onOpen: () => void
}) {
    return (
        <div
            class="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-gray-800 rounded-xl border border-gray-700 hover:border-gray-500 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
            onClick={onOpen}
        >
            <div class="flex items-center gap-3 min-w-0 flex-1">
            <div class="relative w-12 h-12 shrink-0 rounded-lg overflow-hidden bg-gray-700">
                <JacketImage imageName={entry.image_name} title={entry.title} />
                <div class="absolute top-0 left-0">
                    <img src={BADGE_IMG[entry.chart_type] ?? BADGE_IMG.STANDARD} alt="" class="h-3" />
                </div>
            </div>

            <div class="flex-1 min-w-0">
                <div class="zh-clamp-2 text-white text-sm font-bold">{entry.title}</div>
                <div class="flex items-center gap-1 mt-0.5">
                    <div class="flex items-center gap-1 min-w-0 flex-1">
                    <span class={`px-1.5 py-0.5 rounded text-[9px] font-bold text-white ${DIFF_BG[entry.difficulty] ?? 'bg-gray-600'}`}>
                        {entry.difficulty}
                    </span>
                    <span class="text-gray-500 text-[10px]">{entry.chart_constant.toFixed(1)}</span>
                    {entry.in_b50 && (
                        <span class="px-1 py-0.5 rounded text-[9px] font-bold leading-none bg-blue-600/45 text-blue-200 border border-blue-500/25">
                            B50中
                        </span>
                    )}
                    </div>
                    <div class="flex sm:hidden items-center justify-end gap-1 shrink-0 text-right">
                        <div class="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-mono font-bold leading-none bg-yellow-400/15 text-yellow-300 border border-yellow-400/25">
                            +{entry.gap.toFixed(4)}%
                        </div>
                        <div class="flex items-center justify-end gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold leading-none bg-gray-700/70 text-gray-300">
                            <span>{entry.current_rank}</span>
                            <span class="text-gray-500">→</span>
                            <span class="text-yellow-400">{entry.next_rank}</span>
                        </div>
                        <div class="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold leading-none bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">
                            +{entry.rating_gain}
                        </div>
                    </div>
                </div>
            </div>
            </div>

            <div class="hidden sm:flex items-center justify-end gap-2 shrink-0 text-right self-center">
                <div class="shrink-0 rounded px-2 py-1 text-xs font-mono font-bold leading-none bg-yellow-400/15 text-yellow-300 border border-yellow-400/25">
                    +{entry.gap.toFixed(4)}%
                </div>
                <div class="flex items-center justify-end gap-1 rounded px-2 py-1 text-xs font-bold leading-none bg-gray-700/70 text-gray-300">
                    <span>{entry.current_rank}</span>
                    <span class="text-gray-500">→</span>
                    <span class="text-yellow-400">{entry.next_rank}</span>
                </div>
                <div class="shrink-0 rounded px-2 py-1 text-xs font-bold leading-none bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">
                    +{entry.rating_gain}
                </div>
            </div>
        </div>
    )
}

function PersonalizedCard({
    entry,
    onOpen,
}: {
    entry: PersonalizedEntry
    onOpen: () => void
}) {
    const diff = entry.current_achievement == null
        ? null
        : entry.predicted_achievement - entry.current_achievement

    return (
        <div
            class="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-gray-800 rounded-xl border border-gray-700 hover:border-violet-500 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
            onClick={onOpen}
        >
            <div class="flex items-center gap-3 min-w-0 flex-1">
                <div class="relative w-12 h-12 shrink-0 rounded-lg overflow-hidden bg-gray-700">
                    <JacketImage imageName={entry.image_name} title={entry.title} />
                    <div class="absolute top-0 left-0">
                        <img src={BADGE_IMG[entry.chart_type] ?? BADGE_IMG.STANDARD} alt="" class="h-3" />
                    </div>
                </div>

                <div class="flex-1 min-w-0">
                    <div class="zh-clamp-2 text-white text-sm font-bold">{entry.title}</div>
                    <div class="flex flex-wrap items-center gap-1 mt-0.5">
                        <span class={`px-1.5 py-0.5 rounded text-[9px] font-bold text-white ${DIFF_BG[entry.difficulty] ?? 'bg-gray-600'}`}>
                            {entry.difficulty}
                        </span>
                        <span class="text-gray-500 text-[10px]">{entry.chart_constant.toFixed(1)}</span>
                        <span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-violet-500/15 text-violet-300 border border-violet-500/25">
                            Factor {entry.dominant_factor + 1}
                        </span>
                        <span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-sky-500/15 text-sky-300 border border-sky-500/25">
                            樣本 {entry.sample_count}
                        </span>
                    </div>
                </div>
            </div>

            <div class="flex items-center justify-end gap-1.5 shrink-0 text-right">
                <div class="rounded px-2 py-1 text-xs font-bold leading-none bg-gray-700/70 text-gray-300">
                    預測 <span class="text-yellow-300">{entry.predicted_achievement.toFixed(2)}%</span>
                </div>
                {diff != null && (
                    <div class="rounded px-2 py-1 text-xs font-mono font-bold leading-none bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">
                        {diff >= 0 ? '+' : ''}{diff.toFixed(2)}%
                    </div>
                )}
            </div>
        </div>
    )
}

export default function Recommend() {
    const [data, setData] = useState<RecommendData | null>(null)
    const [personalized, setPersonalized] = useState<PersonalizedData | null>(null)
    const [personalizedLoading, setPersonalizedLoading] = useState(false)
    const [personalizedRequested, setPersonalizedRequested] = useState(false)
    const [personalizedError, setPersonalizedError] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [allSongs, setAllSongs] = useState<SongData[]>([])
    const [playerScores, setPlayerScores] = useState<PlayerScore[]>([])
    const [selectedSong, setSelectedSong] = useState<SongData | null>(null)
    const [selectedPersonalized, setSelectedPersonalized] = useState<PersonalizedSongInfo | null>(null)
    const [sortMode, setSortMode] = useState<SortMode>('recommended')
    const [mode, setMode] = useState<RecommendMode>('rating')

    useEffect(() => {
        const token = localStorage.getItem('maimai_sync_token')
        if (!token) { setLoading(false); return }

        loadSongs().then(setAllSongs).catch(console.error)

        fetch(apiUrl('/api/scores/all'), {
            headers: { 'Authorization': `Bearer ${token}` },
        }).then(r => r.json()).then(d => { if (Array.isArray(d)) setPlayerScores(d) }).catch(console.error)

        fetch(apiUrl('/api/recommend'), {
            headers: { 'Authorization': `Bearer ${token}` },
        })
            .then(r => r.json())
            .then(d => { if (d.new && d.old) setData(d) })
            .catch(console.error)
            .finally(() => setLoading(false))

    }, [])

    useEffect(() => {
        const token = localStorage.getItem('maimai_sync_token')
        if (!token || mode !== 'personalized' || personalized || personalizedLoading || personalizedRequested) return

        setPersonalizedRequested(true)
        setPersonalizedLoading(true)
        setPersonalizedError(null)
        fetch(apiUrl('/api/recommend/nmf'), {
            headers: { 'Authorization': `Bearer ${token}` },
        })
            .then(r => r.json())
            .then(d => { if ('ready' in d) setPersonalized(d) })
            .catch(err => {
                console.error(err)
                setPersonalizedError('個人化推薦載入失敗，請稍後再試')
            })
            .finally(() => setPersonalizedLoading(false))
    }, [mode, personalized, personalizedLoading, personalizedRequested])

    const openSong = async (entry: RecommendEntry | PersonalizedEntry, personalizedInfo: PersonalizedSongInfo | null = null) => {
        const songs = allSongs.length ? allSongs : await loadSongs()
        if (!allSongs.length) setAllSongs(songs)
        const song = songs.find(s => s.title === entry.title && s.chart_type === entry.chart_type)
        if (song) {
            const matchedPersonalized = personalizedInfo ?? personalized?.recommendations.find(item =>
                item.title === entry.title &&
                item.chart_type === entry.chart_type &&
                item.difficulty === entry.difficulty
            ) ?? null
            setSelectedPersonalized(matchedPersonalized)
            setSelectedSong(song)
        }
    }

    if (loading) return <div class="text-center py-20 text-gray-400">載入中...</div>
    if (!data) return <div class="text-center py-20 text-gray-400">沒有資料，請先同步成績</div>

    const sortEntries = (list: RecommendEntry[]) => {
        if (sortMode === 'gainDesc') {
            return [...list].sort((a, b) => {
                const gainDiff = b.rating_gain - a.rating_gain
                if (gainDiff !== 0) return gainDiff
                return a.gap - b.gap
            })
        }

        return list
    }

    const renderSection = (list: RecommendEntry[], title: string) => (
        <div class="mb-10">
            <h2 class="text-xl font-bold text-white border-l-4 border-yellow-400 pl-3 mb-4">
                {title}
                <span class="text-gray-500 text-sm font-normal ml-2">{list.length} 首</span>
            </h2>
            {list.length === 0 ? (
                <div class="text-center py-10 text-gray-600">沒有符合條件的推薦</div>
            ) : (
                <div class="space-y-2">
                    {sortEntries(list).map((entry, i) => (
                        <RecommendCard key={i} entry={entry} onOpen={() => openSong(entry)} />
                    ))}
                </div>
            )}
        </div>
    )

    const renderPersonalized = () => {
        if (!personalized) {
            return (
                <div class="text-center py-10 text-gray-500">
                    {personalizedError ?? '個人化推薦載入中...'}
                </div>
            )
        }
        if (!personalized.ready) {
            return (
                <div class="rounded-xl border border-gray-700 bg-gray-800 p-5 text-gray-300">
                    <div class="font-bold text-white mb-2">個人化推薦資料不足</div>
                    <div class="text-sm text-gray-400">{personalized.reason ?? '需要更多玩家成績才能建立模型'}</div>
                </div>
            )
        }

        const factorMeta = new Map((personalized.factors ?? []).map(factor => [factor.factor, factor]))
        const byFactor = personalized.recommendations.reduce((map, entry) => {
            const list = map.get(entry.dominant_factor) ?? []
            list.push(entry)
            map.set(entry.dominant_factor, list)
            return map
        }, new Map<number, PersonalizedEntry[]>())
        const factorGroups = Array.from(byFactor.entries()).sort(([a], [b]) => {
            const av = factorMeta.get(a)?.player_value ?? 0
            const bv = factorMeta.get(b)?.player_value ?? 0
            return bv - av
        })

        return (
            <div class="space-y-3">
                {personalized.model && (
                    <div class="flex flex-wrap gap-2 text-xs text-gray-400 mb-4">
                        <span class="px-2 py-1 rounded bg-gray-800 border border-gray-700">玩家 {personalized.model.players}</span>
                        <span class="px-2 py-1 rounded bg-gray-800 border border-gray-700">成績 {personalized.model.scores}</span>
                        <span class="px-2 py-1 rounded bg-gray-800 border border-gray-700">過濾 {personalized.model.filtered_out}</span>
                        <span class="px-2 py-1 rounded bg-gray-800 border border-gray-700">Factors {personalized.model.factors}</span>
                    </div>
                )}
                {personalized.recommendations.length === 0 ? (
                    <div class="text-center py-10 text-gray-600">沒有符合條件的個人化推薦</div>
                ) : factorGroups.map(([factor, entries]) => {
                    const meta = factorMeta.get(factor)
                    return (
                        <section key={factor} class="mb-8">
                            <div class="mb-3 rounded-xl border border-gray-700 bg-gray-900/70 p-3">
                                <div class="flex items-center justify-between gap-3">
                                    <div>
                                        <h2 class="text-white font-black">
                                            Factor {factor + 1}
                                            <span class="text-gray-500 text-sm font-normal ml-2">{entries.length} 首</span>
                                        </h2>
                                        <div class="text-xs text-gray-400 mt-1">
                                            你的值 <span class="text-violet-300 font-mono">{meta?.player_value?.toFixed(4) ?? '-'}</span>
                                        </div>
                                    </div>
                                    <div class="text-right text-xs text-gray-500 shrink-0">
                                        dominant factor
                                    </div>
                                </div>
                                {meta?.top_songs?.length ? (
                                    <div class="mt-3 flex flex-wrap gap-1.5">
                                        {meta.top_songs.slice(0, 6).map(song => (
                                            <span
                                                key={`${song.title}_${song.chart_type}_${song.difficulty}`}
                                                class="px-2 py-1 rounded bg-gray-800 text-gray-300 text-xs border border-gray-700"
                                            >
                                                {song.title}
                                                <span class="text-gray-500 ml-1">{song.chart_constant.toFixed(1)}</span>
                                            </span>
                                        ))}
                                    </div>
                                ) : null}
                            </div>

                            <div class="space-y-2">
                                {entries.map((entry, i) => (
                                    <PersonalizedCard key={`${factor}_${i}`} entry={entry} onOpen={() => openSong(entry, entry)} />
                                ))}
                            </div>
                        </section>
                    )
                })}
            </div>
        )
    }

    return (
        <div class="max-w-3xl mx-auto p-4">
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-8">
                <div class="inline-flex rounded-lg border border-gray-700 bg-gray-900 p-1 self-start">
                    <button
                        type="button"
                        class={`px-3 py-1.5 rounded-md text-sm font-bold transition-colors ${mode === 'rating' ? 'bg-yellow-400 text-gray-950' : 'text-gray-400 hover:text-white'}`}
                        onClick={() => setMode('rating')}
                    >
                        提分推薦
                    </button>
                    <button
                        type="button"
                        class={`px-3 py-1.5 rounded-md text-sm font-bold transition-colors ${mode === 'personalized' ? 'bg-violet-400 text-gray-950' : 'text-gray-400 hover:text-white'}`}
                        onClick={() => setMode('personalized')}
                    >
                        個人化推薦
                    </button>
                </div>

                {mode === 'rating' && (
                <div class="inline-flex rounded-lg border border-gray-700 bg-gray-900 p-1 self-start sm:self-auto">
                    <button
                        type="button"
                        class={`px-3 py-1.5 rounded-md text-sm font-bold transition-colors ${sortMode === 'recommended' ? 'bg-emerald-500 text-gray-950' : 'text-gray-400 hover:text-white'}`}
                        onClick={() => setSortMode('recommended')}
                    >
                        預設排序
                    </button>
                    <button
                        type="button"
                        class={`px-3 py-1.5 rounded-md text-sm font-bold transition-colors ${sortMode === 'gainDesc' ? 'bg-emerald-500 text-gray-950' : 'text-gray-400 hover:text-white'}`}
                        onClick={() => setSortMode('gainDesc')}
                    >
                        加分高到低
                    </button>
                </div>
                )}
            </div>

            {mode === 'rating' ? (
                <>
                    {renderSection(data.new, '新曲 (NEW)')}
                    {renderSection(data.old, '舊曲 (OTHERS)')}
                </>
            ) : renderPersonalized()}

            {selectedSong && (
                <SongDetailModal
                    song={selectedSong}
                    playerScores={playerScores}
                    personalized={selectedPersonalized}
                    onClose={() => { setSelectedSong(null); setSelectedPersonalized(null) }}
                />
            )}
        </div>
    )
}
