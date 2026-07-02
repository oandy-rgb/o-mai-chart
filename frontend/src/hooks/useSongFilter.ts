// src/hooks/useSongFilter.ts
import { useState, useEffect, useMemo } from 'preact/hooks'
import type { SongData } from '../components/SongCard'
import { loadSongs } from '../lib/songStore'

export type MatchReason = 'title' | 'alias' | 'artist' | 'designer' | null
export type SearchScope = 'ALL' | 'title' | 'artist' | 'designer'

export interface FilteredSong {
    song: SongData
    matchReason: MatchReason
    matchedDesigner: string | null
    matchedAlias: string | null
}

export function useSongFilter() {
    const [searchQuery, setSearchQuery] = useState('')
    const [searchScope, setSearchScope] = useState<SearchScope>('ALL')
    const [rawSongs, setRawSongs] = useState<SongData[]>([])
    const [loading, setLoading] = useState(true)

    const [filterType, setFilterType] = useState('ALL')
    const [filterDiff, setFilterDiff] = useState('ALL')
    const [minCC, setMinCC] = useState<string>('')
    const [maxCC, setMaxCC] = useState<string>('')

    useEffect(() => {
        const fetchSongs = async () => {
            try {
                setRawSongs(await loadSongs())
            } catch (err) {
                console.error('Failed to fetch songs:', err)
            } finally {
                setLoading(false)
            }
        }
        fetchSongs()
    }, [])

    const filteredSongs = useMemo((): FilteredSong[] => {
        const query = searchQuery.trim().toLowerCase()

        return rawSongs
        .map(song => {
            let matchReason: MatchReason = null
            let matchedDesigner: string | null = null
            let matchedAlias: string | null = null

            if (query) {
                const matchTitle = (searchScope === 'ALL' || searchScope === 'title') &&
                song.title.toLowerCase().includes(query)

                // alias 比對（跟 title 同一個 scope）
                const aliases: string[] = (song as any).aliases ?? []
                const aliasMatch = (searchScope === 'ALL' || searchScope === 'title')
                ? aliases.find(a => a.toLowerCase().includes(query))
                : undefined

                const matchArtist = (searchScope === 'ALL' || searchScope === 'artist') &&
                (song.artist || '').toLowerCase().includes(query)

                const designerMatch = (searchScope === 'ALL' || searchScope === 'designer')
                ? song.difficulties.find(d => (d.chart_designer || '').toLowerCase().includes(query))
                : undefined

                if (matchTitle) matchReason = 'title'
                    else if (aliasMatch) {
                        matchReason = 'alias'
                        matchedAlias = aliasMatch
                    }
                    else if (matchArtist) matchReason = 'artist'
                        else if (designerMatch) {
                            matchReason = 'designer'
        matchedDesigner = designerMatch.chart_designer
                        }

                        if (!matchReason) return null
            }

            if (filterType !== 'ALL' && song.chart_type !== filterType) return null

                if (filterDiff === 'ALL' && minCC.trim() === '' && maxCC.trim() === '') {
                    return { song, matchReason, matchedDesigner, matchedAlias }
                }

                const diffMatch = song.difficulties.some(d => {
                    const matchDiff = filterDiff === 'ALL' || d.difficulty === filterDiff
                    const cc = Number(d.chart_constant) || 0
                    const parsedMin = minCC.trim() !== '' ? Number(minCC) : null
                    const parsedMax = maxCC.trim() !== '' ? Number(maxCC) : null
                    const matchMin = parsedMin === null || isNaN(parsedMin) || cc >= parsedMin
                    const matchMax = parsedMax === null || isNaN(parsedMax) || cc <= parsedMax
                    return matchDiff && matchMin && matchMax
                })

                return diffMatch ? { song, matchReason, matchedDesigner, matchedAlias } : null
        })
        .filter((x): x is FilteredSong => x !== null)
    }, [rawSongs, searchQuery, searchScope, filterType, filterDiff, minCC, maxCC])

    return {
        searchQuery, setSearchQuery,
        searchScope, setSearchScope,
        filteredSongs, loading,
        filterType, setFilterType,
        filterDiff, setFilterDiff,
        minCC, setMinCC,
        maxCC, setMaxCC
    }
}
