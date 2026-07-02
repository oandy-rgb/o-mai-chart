// src/components/SongCard.tsx
import type { MatchReason } from '../hooks/useSongFilter'
import JacketImage from './JacketImage'

export interface DifficultyData {
    difficulty: string
    level: string
    chart_constant: number
    chart_designer: string
    notes_tap: number | null
    notes_hold: number | null
    notes_slide: number | null
    notes_touch: number | null
    notes_break: number | null
}

export interface PlayerScore {
    title: string
    chart_type: string
    difficulty: string
    achievement: number
    fc: string | null
    sync: string | null
    dx_score?: number | null
    dx_total?: number | null
    dx_stars?: number | null
}

export interface SongData {
    id: string
    title: string
    artist: string
    bpm?: number | null
    image_name: string
    chart_type: string
    aliases?: string[]
    date_intl_added?:   string | null
    date_intl_updated?: string | null
    date_added?:        string | null
    date_updated?:      string | null
    difficulties: DifficultyData[]
}

const BADGE_URL: Record<string, string> = {
    DX:       'https://cdn.jsdelivr.net/gh/zvuc/otoge-db@master/maimai/img/chart_badge_dx.png',
    STANDARD: 'https://cdn.jsdelivr.net/gh/zvuc/otoge-db@master/maimai/img/chart_badge_std.png',
}

const DIFF_GLOW: Record<string, string> = {
    BASIC:    'shadow-[0_4px_12px_rgba(34,197,94,0.6)]   ring-2 ring-green-500',
    ADVANCED: 'shadow-[0_4px_12px_rgba(234,179,8,0.6)]   ring-2 ring-yellow-500',
    EXPERT:   'shadow-[0_4px_12px_rgba(239,68,68,0.6)]   ring-2 ring-red-500',
    MASTER:   'shadow-[0_4px_12px_rgba(168,85,247,0.6)]  ring-2 ring-purple-500',
    REMASTER: 'shadow-[0_4px_12px_rgba(216,180,254,0.6)] ring-2 ring-purple-200',
}

function highlightText(text: string, query: string) {
    if (!query) return <span>{text}</span>
        const idx = text.toLowerCase().indexOf(query.toLowerCase())
        if (idx === -1) return <span>{text}</span>
            return (
                <span>
                {text.slice(0, idx)}
                <span class="text-yellow-300 font-black">{text.slice(idx, idx + query.length)}</span>
                {text.slice(idx + query.length)}
                </span>
            )
}

interface SongCardProps {
    song: SongData
    onClick: () => void
    filterDiff?: string
    matchReason?: MatchReason
    matchedDesigner?: string | null
    matchedAlias?: string | null
    searchQuery?: string
}

export default function SongCard({
    song,
    onClick,
    filterDiff = 'ALL',
    matchReason = null,
    matchedDesigner = null,
    matchedAlias = null,
    searchQuery = '',
}: SongCardProps) {
    const glowClass = filterDiff !== 'ALL' ? (DIFF_GLOW[filterDiff] ?? '') : ''
    const visibleAliases = (song.aliases ?? []).slice(0, 2)

    return (
        <div
        onClick={onClick}
        class={`relative aspect-square rounded-xl sm:rounded-2xl overflow-hidden shadow-md cursor-pointer hover:-translate-y-1 hover:shadow-lg transition-all duration-200 group bg-gray-800 ${glowClass}`}
        >
        <JacketImage
        imageName={song.image_name}
        title={song.title}
        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"></div>

        <div class="absolute top-2 left-2">
        <img src={BADGE_URL[song.chart_type] ?? BADGE_URL.STANDARD} alt={song.chart_type} class="h-5 sm:h-5 drop-shadow-md" />
        </div>

        {/* 命中標籤（右上）*/}
        {matchReason === 'designer' && matchedDesigner && (
            <div class="absolute top-2 right-2 px-2 py-1 rounded text-[10px] font-bold bg-orange-500 text-white leading-none shadow-md max-w-[70%] truncate">
            譜: {matchedDesigner}
            </div>
        )}
        {matchReason === 'artist' && (
            <div class="absolute top-2 right-2 px-2 py-1 rounded text-[10px] font-bold bg-blue-500 text-white leading-none shadow-md">
            Artist
            </div>
        )}
        {matchReason === 'alias' && matchedAlias && (
            <div class="absolute top-2 right-2 px-2 py-1 rounded text-[10px] font-bold bg-teal-500 text-white leading-none shadow-md max-w-[70%] truncate">
            別名: {matchedAlias}
            </div>
        )}

        <div class="absolute bottom-2 left-2 right-2 flex flex-col">
        <span class="zh-clamp-2 text-white font-black text-[14px] sm:text-sm drop-shadow-md">
        {matchReason === 'title' ? highlightText(song.title, searchQuery) : song.title}
        </span>
        <span class="zh-clamp-2 text-gray-200 text-xs sm:text-xs drop-shadow-md mt-1">
        {matchReason === 'artist' ? highlightText(song.artist, searchQuery) : song.artist}
        </span>
        {visibleAliases.length > 0 && (
            <span class="mt-1 truncate text-[10px] font-bold text-cyan-200/90 drop-shadow-md">
            別名: {visibleAliases.join(' / ')}
            </span>
        )}
        </div>
        </div>
    )
}
