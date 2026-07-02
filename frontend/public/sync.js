(function () {
    if (document.getElementById('maimai-sync-ui')) return

    const API_BASE_URL = 'https://api.o-andy.com'
    const apiUrl = (path) => `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`

    const gsiScript = document.createElement('script')
    gsiScript.src = 'https://accounts.google.com/gsi/client'
    document.head.appendChild(gsiScript)

    const ui = document.createElement('div')
    ui.id = 'maimai-sync-ui'
    ui.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #1a1a2e;
        color: white;
        padding: 16px;
        border-radius: 12px;
        z-index: 9999;
        font-family: sans-serif;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        min-width: 240px;
    `
    document.body.appendChild(ui)

    const token = localStorage.getItem('maimai_sync_token')
    const isFriendBattlePage = location.pathname.includes('/maimai-mobile/friend/friendGenreVs/')

    if (token) {
        if (isFriendBattlePage) {
            ui.innerHTML = '<p style="margin:0 0 8px">👥 好友對戰資料抓取中...</p>'
            syncFriendBattleScores(token)
        } else {
            ui.innerHTML = '<p style="margin:0 0 8px">🎵 maimai 同步中...</p>'
            syncScores(token)
        }
    } else {
        ui.innerHTML = `
            <p style="margin:0 0 8px">🎵 maimai 成績追蹤</p>
            <div id="maimai-google-btn"></div>
        `
        gsiScript.onload = () => {
            google.accounts.id.initialize({
                client_id: '785041222690-7l200uqtgsoio0bugjd2a1bh8bti629j.apps.googleusercontent.com',
                callback: async (response) => {
                    const res = await fetch(apiUrl('/auth/google'), {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ idToken: response.credential }),
                    })
                    const data = await res.json()
                    if (data.token) {
                        localStorage.setItem('maimai_sync_token', data.token)
                        if (isFriendBattlePage) {
                            ui.innerHTML = '<p style="margin:0 0 8px">👥 好友對戰資料抓取中...</p>'
                            syncFriendBattleScores(data.token)
                        } else {
                            ui.innerHTML = '<p style="margin:0 0 8px">🎵 maimai 同步中...</p>'
                            syncScores(data.token)
                        }
                    }
                },
            })
            google.accounts.id.renderButton(
                document.getElementById('maimai-google-btn'),
                { type: 'standard', text: 'signin_with' }
            )
        }
    }

    // ==========================================
    // 工具函數
    // ==========================================

    function sleep(ms) {
        return new Promise(r => setTimeout(r, ms))
    }

    function calcDxStars(got, total) {
        if (!total || total === 0) return 0
        const pct = got / total
        if (pct >= 0.97) return 5
        if (pct >= 0.95) return 4
        if (pct >= 0.93) return 3
        if (pct >= 0.90) return 2
        if (pct >= 0.85) return 1
        return 0
    }

    async function fetchWithRetry(url, retries = 3, delay = 500) {
        for (let i = 0; i < retries; i++) {
            try {
                const res = await fetch(url)
                if (!res.ok) throw new Error(`HTTP ${res.status}`)
                return res
            } catch (e) {
                if (i < retries - 1) {
                    await sleep(delay * (i + 1))
                } else {
                    throw e
                }
            }
        }
    }

    function downloadJson(filename, data) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
    }

    // ==========================================
    // 解析成績列
    // ==========================================
    function parseRows(html, difficulty) {
        const parser = new DOMParser()
        const dom = parser.parseFromString(html, 'text/html')
        const rows = dom.querySelectorAll('.w_450.m_15')
        const scores = []

        rows.forEach(row => {
            const titleEl      = row.querySelector('.music_name_block')
            const levelEl      = row.querySelector('.music_lv_block')
            const achieveEl    = row.querySelector('.music_score_block.w_112')
            const dxScoreEl    = row.querySelector('.music_score_block.w_190')
            if (!titleEl || !achieveEl) return

            const chartTypeImg = row.querySelector('img.music_kind_icon')
            const chartType    = chartTypeImg?.src.includes('music_dx') ? 'DX' : 'STANDARD'

            const achievementText = achieveEl.innerText.replace('%', '').trim()
            const achievement     = achievementText ? parseFloat(achievementText) : null

            // dx_score / dx_total / dx_stars
            let dx_score = null
            let dx_total = null
            let dx_stars = null
            if (dxScoreEl) {
                const dxText  = dxScoreEl.innerText.replace(/,/g, '').trim()
                const match   = dxText.match(/(\d+)\s*\/\s*(\d+)/)
                if (match) {
                    dx_score = parseInt(match[1])
                    dx_total = parseInt(match[2])
                    dx_stars = calcDxStars(dx_score, dx_total)
                }
            }

            const allImgs  = Array.from(row.querySelectorAll('img.h_30.f_r'))
            const fcImg    = allImgs.find(img =>
                img.src.includes('music_icon_fc') ||
                img.src.includes('music_icon_ap')
            )
            const syncImg  = allImgs.find(img =>
                img.src.includes('music_icon_sync') ||
                img.src.includes('music_icon_fs') ||
                img.src.includes('music_icon_fdx')
            )

            let fc = null
            if (fcImg) {
                const src = fcImg.src
                if (src.includes('music_icon_app'))      fc = 'app'
                else if (src.includes('music_icon_fcp')) fc = 'fcp'
                else if (src.includes('music_icon_ap'))  fc = 'ap'
                else if (src.includes('music_icon_fc'))  fc = 'fc'
            }

            let sync = null
            if (syncImg) {
                const src = syncImg.src
                if (src.includes('music_icon_fdxp'))      sync = 'fdxp'
                else if (src.includes('music_icon_fdx'))  sync = 'fdx'
                else if (src.includes('music_icon_fsp'))  sync = 'fsp'
                else if (src.includes('music_icon_fs'))   sync = 'fs'
                else if (src.includes('music_icon_sync')) sync = 'fs'
            }

            scores.push({
                title:       titleEl.innerText.trim(),
                level:       levelEl?.innerText.trim() ?? '',
                difficulty,
                chart_type:  chartType,
                achievement,
                dx_score,
                dx_total,
                dx_stars,
                fc,
                sync,
            })
        })

        return scores
    }

    // ==========================================
    // 好友對戰
    // ==========================================
    function getFriendBattleIdx() {
        const url = new URL(location.href)
        return url.searchParams.get('idx') || location.pathname.match(/idx=(\d+)/)?.[1]
    }

    function parseFriendBattleRows(html, difficulty, diffIndex, friendIdx) {
        const parser = new DOMParser()
        const dom    = parser.parseFromString(html, 'text/html')
        const rowClass = {
            BASIC:    'music_basic_score_back',
            ADVANCED: 'music_advanced_score_back',
            EXPERT:   'music_expert_score_back',
            MASTER:   'music_master_score_back',
            REMASTER: 'music_remaster_score_back',
        }[difficulty] || 'music_master_score_back'
        const rows   = dom.querySelectorAll(`.${rowClass}`)
        const scores = []

        const textOf = (el) => (el?.textContent ?? el?.innerText ?? '').trim()
        const parseAchievement = (text) => {
            const value = text.replace(/[％%]/g, '').trim()
            if (!value || value === '-' || value === '―' || value === '－') return null
            const match = value.match(/\d+(?:\.\d+)?/)
            return match ? parseFloat(match[0]) : null
        }

        rows.forEach(row => {
            const title = textOf(row.querySelector('.music_name_block'))
            const level = textOf(row.querySelector('.music_lv_block'))
            if (!title) return

            const chartTypeImg = row.querySelector('img.music_kind_icon')
            const chartType    = chartTypeImg?.src.includes('music_dx') ? 'DX' : 'STANDARD'

            const scoreLabelClass = {
                BASIC:    'basic_score_label',
                ADVANCED: 'advanced_score_label',
                EXPERT:   'expert_score_label',
                MASTER:   'master_score_label',
                REMASTER: 'remaster_score_label',
            }[difficulty] || 'master_score_label'

            const scoreCells       = Array.from(row.querySelectorAll(`.${scoreLabelClass}`))
            const scoreValues      = scoreCells.map(el => parseAchievement(textOf(el)))
            const selfAchievement  = scoreValues[0] ?? null
            const friendAchievement = scoreValues[1] ?? null

            const center    = row.querySelector('.see_through_block')
            const resultImg = center?.querySelector('img')?.src ?? ''
            const diffText  = textOf(center?.querySelector('div')).replace('%', '').trim()
            const difference = diffText ? parseFloat(diffText.replace(/[＋+]/g, '')) : null
            const result    = resultImg.includes('vs_win')  ? 'win'
                            : resultImg.includes('vs_lose') ? 'lose'
                            : resultImg.includes('vs_draw') ? 'draw'
                            : null

            const iconCells  = row.querySelectorAll('tr:nth-child(2) td')
            const selfIcons  = Array.from(iconCells[0]?.querySelectorAll('img.h_30') ?? [])
            const friendIcons = Array.from(iconCells[1]?.querySelectorAll('img.h_30') ?? [])

            const parseIcons = (imgs) => {
                let fc = null, sync = null
                for (const img of imgs) {
                    const src = img.src
                    if (src.includes('music_icon_app'))       fc = 'app'
                    else if (src.includes('music_icon_fcp'))  fc = 'fcp'
                    else if (src.includes('music_icon_ap'))   fc = 'ap'
                    else if (src.includes('music_icon_fc'))   fc = 'fc'

                    if (src.includes('music_icon_fdxp'))      sync = 'fdxp'
                    else if (src.includes('music_icon_fdx'))  sync = 'fdx'
                    else if (src.includes('music_icon_fsp'))  sync = 'fsp'
                    else if (src.includes('music_icon_fs'))   sync = 'fs'
                    else if (src.includes('music_icon_sync')) sync = 'fs'
                }
                return { fc, sync }
            }

            scores.push({
                friend_idx:          friendIdx,
                title,
                level,
                difficulty,
                diff_index:          diffIndex,
                chart_type:          chartType,
                self_achievement:    selfAchievement,
                friend_achievement:  friendAchievement,
                difference,
                result,
                self:                parseIcons(selfIcons),
                friend:              parseIcons(friendIcons),
            })
        })

        return scores
    }

    async function syncFriendBattleScores(token) {
        const friendIdx = getFriendBattleIdx()
        if (!friendIdx) {
            ui.innerHTML = '<p style="margin:0;color:#f87171">❌ 找不到好友 idx</p>'
            return
        }

        const DIFFS = [
            { diff: 'BASIC',    index: 0 },
            { diff: 'ADVANCED', index: 1 },
            { diff: 'EXPERT',   index: 2 },
            { diff: 'MASTER',   index: 3 },
            { diff: 'REMASTER', index: 4 },
        ]

        const results = []
        let errors = 0

        for (let i = 0; i < DIFFS.length; i++) {
            const { diff, index } = DIFFS[i]
            ui.innerHTML = `
                <p style="margin:0 0 6px;font-size:13px">👥 抓取好友對戰資料...</p>
                <p style="margin:0;font-size:12px;color:#aaa">${i + 1}/${DIFFS.length} · ${diff}</p>
            `
            try {
                const url = `/maimai-mobile/friend/friendGenreVs/battleStart/?scoreType=2&genre=99&diff=${index}&idx=${friendIdx}`
                const res = await fetchWithRetry(url, 3, 500)
                const html = await res.text()
                results.push(...parseFriendBattleRows(html, diff, index, friendIdx))
            } catch (e) {
                console.error(`friend battle fetch failed: diff=${diff}`, e)
                errors++
            }
            await sleep(180)
        }

        const observed = results.filter(r => r.friend_achievement !== null)
        let uploadResult = null
        if (observed.length > 0) {
            ui.innerHTML = `<p style="margin:0;font-size:13px">👥 上傳好友觀測成績...</p>`
            const uploadRes = await fetch(apiUrl('/api/maimai-friends/observations'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ friend_idx: friendIdx, scores: results }),
            })
            if (uploadRes.ok) {
                uploadResult = await uploadRes.json()
            }
        }

        ui.innerHTML = `
            <p style="margin:0 0 6px;font-size:13px">✅ 好友對戰抓取完成</p>
            <p style="margin:0 0 8px;font-size:12px;color:#aaa">
                共 ${results.length} 筆 · 對方有成績 ${observed.length} 筆
                ${uploadResult ? `<br>已寫入 ${uploadResult.observed} 筆 · 跳過 ${uploadResult.skipped} 筆` : ''}
                ${errors > 0 ? `<br>請求錯誤 ${errors} 次` : ''}
            </p>
            <button id="maimai-friend-battle-download" style="background:#7c3aed;color:white;border:0;border-radius:8px;padding:8px 10px;font-weight:700;cursor:pointer">
                下載 JSON
            </button>
        `
        document.getElementById('maimai-friend-battle-download')?.addEventListener('click', () => {
            downloadJson(`maimai-friend-battle-${friendIdx}.json`, {
                friend_idx:  friendIdx,
                observed_at: new Date().toISOString(),
                scores:      results,
            })
        })
    }

    // ==========================================
    // 主同步邏輯
    // ==========================================
    async function syncScores(token) {
        // 1. 抓玩家資訊
        ui.innerHTML = `<p style="margin:0">🎵 抓取玩家資訊...</p>`
        const homeRes  = await fetchWithRetry('/maimai-mobile/home/')
        const homeHtml = await homeRes.text()
        const homeDom  = new DOMParser().parseFromString(homeHtml, 'text/html')

        const playerName     = homeDom.querySelector('.name_block')?.innerText.trim()
        const danImgUrl      = homeDom.querySelector('img.h_35.f_l')?.src
        const classRankUrl   = homeDom.querySelector('img.p_l_10.h_35.f_l')?.src
        const iconImgUrl     = homeDom.querySelector('img.w_112.f_l')?.src

        // 2. 抓成績
        const SCORE_URLS = [
            { diff: 'BASIC',    url: '/maimai-mobile/record/musicGenre/search/?genre=99&diff=0' },
            { diff: 'ADVANCED', url: '/maimai-mobile/record/musicGenre/search/?genre=99&diff=1' },
            { diff: 'EXPERT',   url: '/maimai-mobile/record/musicGenre/search/?genre=99&diff=2' },
            { diff: 'MASTER',   url: '/maimai-mobile/record/musicGenre/search/?genre=99&diff=3' },
            { diff: 'REMASTER', url: '/maimai-mobile/record/musicGenre/search/?genre=99&diff=4' },
        ]

        const allScores = []
        for (const { diff, url } of SCORE_URLS) {
            ui.innerHTML = `<p style="margin:0">🎵 抓取 ${diff}...</p>`
            try {
                const res    = await fetchWithRetry(url, 3, 500)
                const html   = await res.text()
                const scores = parseRows(html, diff)
                allScores.push(...scores)
            } catch (e) {
                console.error(`fetch failed: diff=${diff}`, e)
            }
            await sleep(100)
        }

        // 3. 上傳
        ui.innerHTML = `<p style="margin:0">📡 上傳成績...</p>`
        const syncRes = await fetch(apiUrl('/api/scores/sync'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                playerName,
                danImgUrl,
                classRankUrl,
                iconImgUrl,
                scores: allScores,
            }),
        })

        if (syncRes.status === 401) {
            localStorage.removeItem('maimai_sync_token')
            ui.innerHTML = '<p style="margin:0;color:#f87171">❌ 登入過期，請重新按書籤</p>'
            return
        }

        const syncData = await syncRes.json()

        if (syncRes.ok) {
            ui.innerHTML = `
                <p style="margin:0 0 6px;font-size:13px">✅ 同步完成</p>
                <p style="margin:0 0 6px;font-size:12px;color:#aaa">
                    共 ${allScores.length} 筆成績已上傳
                </p>
                <a href="https://mai.o-andy.com" target="_blank" style="color:#a78bfa;font-size:12px">查看成績 →</a>
            `
        } else {
            ui.innerHTML = `<p style="margin:0;color:#f87171">❌ 上傳失敗：${syncData.error ?? syncRes.status}</p>`
        }
    }
})()
