// src/components/Friends.tsx
import { useState, useEffect } from 'preact/hooks'
import { apiUrl, recordIdPart, sameRecordId } from '../lib/api'

interface Player {
    id: string
    username: string
}

interface Friendship {
    id: string
    from_id: string
    from_username: string
    to_id: string
    to_username: string
    status: string
}

interface PendingRequest {
    id: string
    from_id: string
    from_username: string
    created_at: string
}

function getToken() {
    return localStorage.getItem('maimai_sync_token')
}

function authHeaders() {
    return {
        'Authorization': `Bearer ${getToken()}`,
        'Content-Type': 'application/json',
    }
}

// 取得目前玩家 id（從 JWT payload 解析）
function getMyPlayerId(): string | null {
    const token = getToken()
    if (!token) return null
        try {
            const payload = JSON.parse(atob(token.split('.')[1]))
            return payload.playerId ?? null
        } catch { return null }
}

// 從 friendship 取得對方的 id 和名稱
function getFriendInfo(f: Friendship, myId: string) {
    if (sameRecordId(f.from_id, myId)) {
        return { id: f.to_id?.toString(), name: f.to_username }
    }
    return { id: f.from_id?.toString(), name: f.from_username }
}

export default function Friends() {
    const [tab, setTab] = useState<'friends' | 'search' | 'pending'>('friends')
    const [friends, setFriends] = useState<Friendship[]>([])
    const [pending, setPending] = useState<PendingRequest[]>([])
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<Player[]>([])
    const [searching, setSearching] = useState(false)
    const [loading, setLoading] = useState(true)
    const [sentRequests, setSentRequests] = useState<Set<string>>(new Set())
    const [feedback, setFeedback] = useState<string | null>(null)
    const [myId, setMyId] = useState<string | null>(null)

    useEffect(() => {
        setMyId(getMyPlayerId())
    }, [])

    const showFeedback = (msg: string) => {
        setFeedback(msg)
        setTimeout(() => setFeedback(null), 2000)
    }

    const fetchFriends = async () => {
        const token = getToken()
        if (!token) { setLoading(false); return }
        const [friendsRes, pendingRes] = await Promise.all([
            fetch(apiUrl('/api/friends'), { headers: authHeaders() }),
            fetch(apiUrl('/api/friends/pending'), { headers: authHeaders() }),
        ])
        const friendsData = await friendsRes.json()
        const pendingData = await pendingRes.json()
        if (Array.isArray(friendsData)) setFriends(friendsData)
            if (Array.isArray(pendingData)) setPending(pendingData)
                setLoading(false)
    }

    useEffect(() => { fetchFriends() }, [])

    const handleSearch = async (q: string) => {
        setSearchQuery(q)
        if (q.trim().length < 2) { setSearchResults([]); return }
        setSearching(true)
        try {
            const res = await fetch(apiUrl(`/api/players/search?q=${encodeURIComponent(q)}`), {
                headers: authHeaders(),
            })
            const data = await res.json()
            if (Array.isArray(data)) setSearchResults(data)
        } catch (e) {
            console.error(e)
        } finally {
            setSearching(false)
        }
    }

    const sendRequest = async (toPlayerId: string) => {
        await fetch(apiUrl('/api/friends/request'), {
            method: 'POST',
            headers: authHeaders(),
                    body: JSON.stringify({ toPlayerId }),
        })
        setSentRequests(prev => new Set([...prev, toPlayerId]))
        showFeedback('✅ 好友請求已送出')
    }

    const acceptRequest = async (friendshipId: string) => {
        await fetch(apiUrl('/api/friends/accept'), {
            method: 'POST',
            headers: authHeaders(),
                    body: JSON.stringify({ friendshipId }),
        })
        showFeedback('✅ 已接受好友請求')
        fetchFriends()
    }

    const rejectRequest = async (friendshipId: string) => {
        await fetch(apiUrl('/api/friends/reject'), {
            method: 'POST',
            headers: authHeaders(),
                    body: JSON.stringify({ friendshipId }),
        })
        showFeedback('已拒絕好友請求')
        fetchFriends()
    }

    const removeFriend = async (friendshipId: string, name: string) => {
        if (!window.confirm(`確定要解除與 ${name} 的好友關係？`)) return
        const res = await fetch(apiUrl(`/api/friends/${recordIdPart(friendshipId)}`), {
            method: 'DELETE',
            headers: authHeaders(),
        })
        if (res.ok) {
            setFriends(prev => prev.filter(friend => friend.id !== friendshipId))
            showFeedback('已解除好友')
        } else {
            showFeedback('解除好友失敗')
        }
    }

    if (loading) return (
        <div class="text-center py-20 text-gray-400">載入中...</div>
    )

        return (
            <div class="max-w-2xl mx-auto p-4 space-y-4">

            {feedback && (
                <div class="fixed top-4 right-4 z-50 px-4 py-2 bg-green-600 text-white text-sm font-bold rounded-lg shadow-lg">
                {feedback}
                </div>
            )}

            <h1 class="text-2xl font-black text-white border-l-4 border-blue-400 pl-3">👥 好友</h1>

            <div class="flex gap-2 border-b border-gray-700 pb-0">
            {([
                { key: 'friends', label: `好友 (${friends.length})` },
              { key: 'pending', label: `待處理 (${pending.length})`, highlight: pending.length > 0 },
              { key: 'search',  label: '搜尋玩家' },
            ] as { key: typeof tab, label: string, highlight?: boolean }[]).map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                class={`px-4 py-2 text-sm font-bold border-b-2 transition-colors -mb-px ${
                    tab === t.key ? 'border-blue-400 text-white' : 'border-transparent text-gray-400 hover:text-white'
                } ${t.highlight ? 'text-orange-400' : ''}`}
                >
                {t.label}
                </button>
            ))}
            </div>

            {/* 好友列表 */}
            {tab === 'friends' && (
                <div class="space-y-2">
                {friends.length === 0 ? (
                    <div class="text-center py-12 text-gray-500">還沒有好友，去搜尋玩家加好友吧</div>
                ) : friends.map(f => {
                    const friend = myId ? getFriendInfo(f, myId) : { id: f.from_id?.toString(), name: f.from_username }
                    return (
                        <div key={f.id.toString()} class="flex items-center justify-between p-4 bg-gray-800 rounded-xl border border-gray-700">
                        <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-black text-sm">
                        {(friend.name?.[0] ?? '?').toUpperCase()}
                        </div>
                        <span class="text-white font-bold">{friend.name}</span>
                        </div>
                        <div class="flex items-center gap-2">
                        <a
                        href={`/friend-b50?id=${recordIdPart(friend.id)}`}
                        class="px-3 py-1.5 bg-gray-700 hover:bg-blue-600 text-gray-300 hover:text-white text-xs font-bold rounded-lg transition-colors"
                        >
                        查看 B50
                        </a>
                        <button
                        onClick={() => removeFriend(f.id, friend.name ?? '這位玩家')}
                        class="px-3 py-1.5 bg-gray-900 hover:bg-red-900/70 border border-gray-700 hover:border-red-700 text-gray-400 hover:text-red-300 text-xs font-bold rounded-lg transition-colors"
                        >
                        解除
                        </button>
                        </div>
                        </div>
                    )
                })}
                </div>
            )}

            {/* 待處理請求 */}
            {tab === 'pending' && (
                <div class="space-y-2">
                {pending.length === 0 ? (
                    <div class="text-center py-12 text-gray-500">沒有待處理的好友請求</div>
                ) : pending.map(req => (
                    <div key={req.id.toString()} class="flex items-center justify-between p-4 bg-gray-800 rounded-xl border border-orange-700/40">
                    <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white font-black text-sm">
                    {(req.from_username?.[0] ?? '?').toUpperCase()}
                    </div>
                    <div>
                    <span class="text-white font-bold">{req.from_username}</span>
                    <p class="text-gray-500 text-xs">想加你為好友</p>
                    </div>
                    </div>
                    <div class="flex items-center gap-2">
                    <button onClick={() => rejectRequest(req.id.toString())}
                    class="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white text-xs font-bold rounded-lg transition-colors"
                    >拒絕</button>
                    <button onClick={() => acceptRequest(req.id.toString())}
                    class="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors"
                    >接受</button>
                    </div>
                    </div>
                ))}
                </div>
            )}

            {/* 搜尋玩家 */}
            {tab === 'search' && (
                <div class="space-y-3">
                <input type="text" value={searchQuery}
                onInput={(e) => handleSearch(e.currentTarget.value)}
                placeholder="輸入玩家名稱搜尋..."
                class="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-xl p-3 focus:border-blue-500 outline-none placeholder-gray-500"
                />
                {searching && <div class="text-center text-gray-400 text-sm">搜尋中...</div>}
                {searchResults.length > 0 && (
                    <div class="space-y-2">
                    {searchResults.map(player => {
                        const alreadyFriend = friends.some(f => sameRecordId(f.from_id, player.id) || sameRecordId(f.to_id, player.id))
                        const sent = sentRequests.has(player.id)
                        return (
                            <div key={player.id.toString()} class="flex items-center justify-between p-4 bg-gray-800 rounded-xl border border-gray-700">
                            <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center text-white font-black text-sm">
                            {(player.username?.[0] ?? '?').toUpperCase()}
                            </div>
                            <span class="text-white font-bold">{player.username}</span>
                            </div>
                            {alreadyFriend ? (
                                <span class="text-xs text-gray-500">已是好友</span>
                            ) : sent ? (
                                <span class="text-xs text-green-400">已送出請求</span>
                            ) : (
                                <button onClick={() => sendRequest(player.id.toString())}
                                class="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors"
                                >+ 加好友</button>
                            )}
                            </div>
                        )
                    })}
                    </div>
                )}
                {!searching && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
                    <div class="text-center py-8 text-gray-500 text-sm">找不到玩家「{searchQuery}」</div>
                )}
                </div>
            )}
            </div>
        )
}
