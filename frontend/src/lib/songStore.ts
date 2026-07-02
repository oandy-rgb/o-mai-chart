import type { SongData } from '../components/SongCard'
import { apiUrl } from './api'

const SONGS_CACHE_KEY = 'maimai_songs_cache_v3'

let songsPromise: Promise<SongData[]> | null = null
let songsMemoryCache: SongData[] | null = null

function readSessionSongs(): SongData[] | null {
    try {
        const cached = sessionStorage.getItem(SONGS_CACHE_KEY)
        return cached ? JSON.parse(cached) : null
    } catch {
        return null
    }
}

function writeSessionSongs(data: SongData[]) {
    try {
        sessionStorage.setItem(SONGS_CACHE_KEY, JSON.stringify(data))
    } catch {
        console.warn('sessionStorage full, skipping songs cache')
    }
}

export function loadSongs(options: { force?: boolean } = {}) {
    if (!options.force) {
        if (songsMemoryCache) return Promise.resolve(songsMemoryCache)
        if (songsPromise) return songsPromise

        const cached = readSessionSongs()
        if (cached) {
            songsMemoryCache = cached
            return Promise.resolve(cached)
        }
    }

    songsPromise = fetch(apiUrl('/api/songs'))
        .then(res => {
            if (!res.ok) throw new Error(`Failed to load songs: ${res.status}`)
            return res.json()
        })
        .then((data: SongData[]) => {
            songsMemoryCache = data
            writeSessionSongs(data)
            return data
        })
        .finally(() => {
            songsPromise = null
        })

    return songsPromise
}

export function clearSongsCache() {
    songsMemoryCache = null
    songsPromise = null
    try {
        sessionStorage.removeItem(SONGS_CACHE_KEY)
    } catch {}
}

export function updateSongAliases(title: string, chartType: string, aliases: string[]) {
    const update = (songs: SongData[]) => songs.map(song => (
        song.title === title && song.chart_type === chartType
            ? { ...song, aliases }
            : song
    ))

    if (songsMemoryCache) {
        songsMemoryCache = update(songsMemoryCache)
        writeSessionSongs(songsMemoryCache)
        return
    }

    const cached = readSessionSongs()
    if (cached) {
        songsMemoryCache = update(cached)
        writeSessionSongs(songsMemoryCache)
    }
}
