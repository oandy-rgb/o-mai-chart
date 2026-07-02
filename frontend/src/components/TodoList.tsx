// src/components/TodoList.tsx
import { useState, useEffect } from 'preact/hooks'
import SongDetailModal from './SongDetailModal'
import type { SongData, PlayerScore } from './SongCard'
import { apiUrl, recordIdPart } from '../lib/api'
import JacketImage from './JacketImage'
import { loadSongs } from '../lib/songStore'

export interface TodoItem {
    id: string
    song_key: string
    title: string
    chart_type: string
    image_name: string
    difficulty: string
    target_achievement: number | null
    target_fc: string | null
    source: string
    done: boolean
    created_at: string
}

const DIFF_STYLES: Record<string, { bg: string, text: string }> = {
    BASIC:    { bg: 'bg-green-500',  text: 'text-white'      },
    ADVANCED: { bg: 'bg-yellow-500', text: 'text-white'      },
    EXPERT:   { bg: 'bg-red-500',    text: 'text-white'      },
    MASTER:   { bg: 'bg-purple-500', text: 'text-white'      },
    REMASTER: { bg: 'bg-purple-200', text: 'text-purple-900' },
}

const FC_LABELS: Record<string, string> = {
    fc: 'FC', fcp: 'FC+', ap: 'AP', app: 'AP+'
}

const BADGE_URL: Record<string, string> = {
    DX:       'https://cdn.jsdelivr.net/gh/zvuc/otoge-db@master/maimai/img/chart_badge_dx.png',
    STANDARD: 'https://cdn.jsdelivr.net/gh/zvuc/otoge-db@master/maimai/img/chart_badge_std.png',
}

function getToken() {
    return localStorage.getItem('maimai_sync_token')
}

export default function TodoList() {
    const [items, setItems] = useState<TodoItem[]>([])
    const [loading, setLoading] = useState(true)
    const [showDone, setShowDone] = useState(false)
    const [selectedSong, setSelectedSong] = useState<SongData | null>(null)
    const [playerScores, setPlayerScores] = useState<PlayerScore[]>([])
    const [allSongs, setAllSongs] = useState<SongData[]>([])

    useEffect(() => {
        const token = getToken()
        if (!token) { setLoading(false); return }

        loadSongs().then(setAllSongs).catch(console.error)

        // 載入 playerScores
        fetch(apiUrl('/api/scores/all'), {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(r => r.json())
        .then(data => { if (Array.isArray(data)) setPlayerScores(data) })
        .catch(console.error)

        // 載入 todos
        fetch(apiUrl('/api/todo'), {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(r => r.json())
        .then(data => { if (Array.isArray(data)) setItems(data) })
        .catch(console.error)
        .finally(() => setLoading(false))
    }, [])

    const openSong = (item: TodoItem) => {
        const song = allSongs.find(s => s.title === item.title && s.chart_type === item.chart_type)
        if (song) setSelectedSong(song)
    }

    const toggleDone = async (item: TodoItem) => {
        const token = getToken()
        if (!token) return
        await fetch(apiUrl(`/api/todo/${recordIdPart(item.id)}`), {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ done: !item.done }),
        })
        setItems(prev => prev.map(t => t.id === item.id ? { ...t, done: !t.done } : t))
    }

    const deleteItem = async (item: TodoItem) => {
        const token = getToken()
        if (!token) return
        await fetch(apiUrl(`/api/todo/${recordIdPart(item.id)}`), {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` },
        })
        setItems(prev => prev.filter(t => t.id !== item.id))
    }

    const pending = items.filter(t => !t.done)
    const done = items.filter(t => t.done)
    const display = showDone ? done : pending

    if (loading) return <div class="max-w-3xl mx-auto p-4 text-center py-20 text-gray-400">載入中...</div>

    if (items.length === 0) return (
        <div class="max-w-3xl mx-auto p-4 text-center py-20">
        <div class="text-6xl mb-4">🎯</div>
        <p class="text-gray-400 text-lg font-bold">待打清單是空的</p>
        <p class="text-gray-600 text-sm mt-2">在歌曲資料庫點擊歌曲，按「待打」按鈕加入</p>
        </div>
    )

    return (
        <div class="max-w-3xl mx-auto p-4 space-y-4">

        <div class="flex items-center justify-between">
        <div class="flex gap-3 text-sm">
        <span class="text-white font-bold">待完成 <span class="text-orange-400">{pending.length}</span></span>
        <span class="text-gray-600">|</span>
        <span class="text-gray-400">已完成 <span class="text-green-400">{done.length}</span></span>
        </div>
        <div class="flex gap-2">
        <button onClick={() => setShowDone(false)}
        class={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${!showDone ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
        >待完成</button>
        <button onClick={() => setShowDone(true)}
        class={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${showDone ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
        >已完成</button>
        </div>
        </div>

        {display.length === 0 && (
            <div class="text-center py-12 text-gray-500">
            {showDone ? '還沒有已完成的項目' : '所有項目都完成了！🎉'}
            </div>
        )}

        <div class="space-y-3">
        {display.map(item => {
            const diffStyle = DIFF_STYLES[item.difficulty] || { bg: 'bg-gray-600', text: 'text-white' }
            return (
                <div key={item.id.toString()}
                class={`bg-gray-800 rounded-xl border overflow-hidden transition-all ${item.done ? 'border-green-700/50 opacity-60' : 'border-gray-700'}`}
                >
                <div class="flex items-center gap-3 p-3">

                {/* 封面：可點擊 */}
                <div
                class="relative w-14 h-14 shrink-0 rounded-lg overflow-hidden bg-gray-700 cursor-pointer hover:ring-2 hover:ring-white/30 transition-all"
                onClick={() => openSong(item)}
                >
                <JacketImage imageName={item.image_name} title={item.title} />
                <div class="absolute top-0.5 left-0.5">
                <img src={BADGE_URL[item.chart_type] ?? BADGE_URL.STANDARD} alt={item.chart_type} class="h-3.5" />
                </div>
                </div>

                <div class="flex-1 min-w-0 cursor-pointer" onClick={() => openSong(item)}>
                <div class="flex items-center gap-2 flex-wrap">
                <span class={`px-2 py-0.5 rounded text-[10px] font-bold ${diffStyle.bg} ${diffStyle.text}`}>
                {item.difficulty}
                </span>
                <span class="zh-clamp-2 text-white font-bold text-sm">{item.title}</span>
                {item.source === 'recommended' && (
                    <span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-600 text-white">推薦</span>
                )}
                </div>
                <div class="flex gap-2 mt-1 flex-wrap">
                {item.target_achievement && (
                    <span class="text-xs text-yellow-400 font-mono">目標 {item.target_achievement.toFixed(1)}%</span>
                )}
                {item.target_fc && (
                    <span class="text-xs text-emerald-400 font-bold">目標 {FC_LABELS[item.target_fc] ?? item.target_fc}</span>
                )}
                {!item.target_achievement && !item.target_fc && (
                    <span class="text-xs text-gray-600">無指定目標</span>
                )}
                </div>
                </div>

                <div class="flex gap-2 shrink-0">
                <button onClick={() => toggleDone(item)}
                class={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors font-bold text-sm ${item.done ? 'bg-gray-700 text-gray-400 hover:bg-gray-600' : 'bg-green-600 hover:bg-green-500 text-white'}`}
                title={item.done ? '標記為未完成' : '標記為完成'}
                >{item.done ? '↩' : '✓'}</button>
                <button onClick={() => deleteItem(item)}
                class="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-700 hover:bg-red-600 text-gray-400 hover:text-white transition-colors text-sm"
                title="刪除">✕</button>
                </div>
                </div>
                </div>
            )
        })}
        </div>

        {selectedSong && (
            <SongDetailModal
            song={selectedSong}
            playerScores={playerScores}
            onClose={() => setSelectedSong(null)}
            />
        )}
        </div>
    )
}
