// src/components/B50.tsx
import { useEffect, useRef, useState } from "preact/hooks";
import SongDetailModal from "./SongDetailModal";
import type { SongData, PlayerScore } from "./SongCard";
import { apiUrl } from "../lib/api";
import { renderB50Image } from "../lib/renderB50Image";
import JacketImage from "./JacketImage";
import { clearSongsCache, loadSongs } from "../lib/songStore";
import { getRank as getRankText } from "@o-mai/shared";

interface Score {
  id: string;
  title: string;
  difficulty: string;
  chart_type: string;
  level: string;
  achievement: number;
  chart_constant: number;
  rating: number;
  fc: string | null;
  sync: string | null;
  image_name: string;
}

interface B50Data {
  totalRating: number;
  newScores: Score[];
  oldScores: Score[];
  username?: string;
  in_game_name?: string;
  dan_img_url?: string;
  icon_img_url?: string;
}

// 更新定數標籤的背景色，使其更具立體感
const DIFF_BG: Record<string, string> = {
  BASIC: "bg-green-600 border border-green-400 text-white",
  ADVANCED: "bg-yellow-600 border border-yellow-400 text-white",
  EXPERT: "bg-red-600 border border-red-400 text-white",
  MASTER: "bg-purple-600 border border-purple-400 text-white",
  REMASTER: "bg-fuchsia-300 border border-white text-purple-900",
};

const FC_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  fc: { bg: "bg-emerald-500", text: "text-white", label: "FC" },
  fcp: { bg: "bg-emerald-500", text: "text-white", label: "FC+" },
  ap: { bg: "bg-amber-400", text: "text-white", label: "AP" },
  app: { bg: "bg-amber-400", text: "text-white", label: "AP+" },
};

const SYNC_STYLES: Record<string, { bg: string; text: string; label: string }> =
  {
    fs: { bg: "bg-sky-500", text: "text-white", label: "FS" },
    fsp: { bg: "bg-sky-500", text: "text-white", label: "FS+" },
    fdx: { bg: "bg-violet-500", text: "text-white", label: "FDX" },
    fdxp: { bg: "bg-violet-500", text: "text-white", label: "FDX+" },
  };

const BADGE_URL: Record<string, string> = {
  DX: "https://cdn.jsdelivr.net/gh/zvuc/otoge-db@master/maimai/img/chart_badge_dx.png",
  STANDARD:
    "https://cdn.jsdelivr.net/gh/zvuc/otoge-db@master/maimai/img/chart_badge_std.png",
};

export default function B50() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<B50Data | null>(null);
  const [selectedSong, setSelectedSong] = useState<SongData | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isFetchingModal, setIsFetchingModal] = useState(false);
  const [allSongsCache, setAllSongsCache] = useState<SongData[] | null>(null);
  const [playerScores, setPlayerScores] = useState<PlayerScore[]>([]);

  // 新增：嘗試取得玩家名稱 (若 API 支援，或從 JWT 解析)
  const [playerName, setPlayerName] = useState<string>("Player");

  useEffect(() => {
    const current = rootRef.current;
    if (!current) return;

    const cleanupDuplicateRoots = () => {
      const roots = Array.from(
        document.querySelectorAll<HTMLElement>("[data-b50-root]"),
      );
      const keep = roots[roots.length - 1];
      for (const root of roots.slice(0, -1)) {
        if (root === keep) continue;
        const island = root.closest("astro-island");
        if (island && !island.contains(keep)) island.remove();
        else root.remove();
      }
    };

    cleanupDuplicateRoots();

    const observer = new MutationObserver(cleanupDuplicateRoots);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("maimai_sync_token");
    if (!token) return;

    const fetchB50ThenDetails = async () => {
      const b50Res = await fetch(apiUrl("/b50"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const b50 = await b50Res.json();
      if (b50.error) {
        setData(null);
        return;
      }

      setData(b50);
      if (b50.in_game_name) setPlayerName(b50.in_game_name);
      else if (b50.username) setPlayerName(b50.username);

      loadSongs().then(setAllSongsCache).catch(console.error);

      fetch(apiUrl("/api/scores/all"), {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((d) => {
          if (Array.isArray(d)) setPlayerScores(d);
        })
        .catch(console.error);
    };

    fetchB50ThenDetails().catch(console.error);
  }, []);

  const openSongDetail = async (score: Score) => {
    if (isCapturing || isFetchingModal) return;
    setIsFetchingModal(true);
    try {
      let songsToSearch = allSongsCache;
      if (!songsToSearch) {
        songsToSearch = await loadSongs();
        setAllSongsCache(songsToSearch);
      }

      let fullSong = songsToSearch?.find(
        (s) => s.title === score.title && s.chart_type === score.chart_type,
      );
      const hasDifficulty = fullSong?.difficulties?.some(
        (d) => d.difficulty === score.difficulty,
      );
      if (fullSong && hasDifficulty) {
        setSelectedSong(fullSong);
      } else {
        clearSongsCache();
        songsToSearch = await loadSongs({ force: true });
        setAllSongsCache(songsToSearch);
        fullSong = songsToSearch?.find(
          (s) => s.title === score.title && s.chart_type === score.chart_type,
        );
        if (fullSong) setSelectedSong(fullSong);
        else alert("詳細資料庫中找不到這首歌 🥲");
      }
    } catch (err) {
      console.error("抓取失敗:", err);
    } finally {
      setIsFetchingModal(false);
    }
  };

  const downloadB50Image = async () => {
    if (!data || isCapturing) return;
    setIsCapturing(true);
    try {
      const dataUrl = await renderB50Image(data, playerName);
      const link = document.createElement("a");
      link.download = `maimai-B50-${playerName}-${new Date().toISOString().slice(0, 10)}.webp`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("擷取失敗:", err);
    } finally {
      setIsCapturing(false);
    }
  };

  if (!data)
    return (
      <div ref={rootRef} data-b50-root class="text-gray-400 text-center py-10">
        載入中...
      </div>
    );

  const renderSection = (scores: Score[], title: string, bgTag: string) => (
    <div class="mb-10">
      <div class="flex items-center gap-3 mb-5">
        <span
          class={`px-4 py-1.5 rounded-full text-sm font-black text-white uppercase tracking-widest shadow-md ${bgTag}`}
        >
          {title}
        </span>
        <div class="flex-1 h-px bg-gray-700/50"></div>
      </div>

      <div class="b50-score-grid grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {scores.map((s, i) => {
          const fcStyle = s.fc ? FC_STYLES[s.fc] : null;
          const syncStyle = s.sync ? SYNC_STYLES[s.sync] : null;
          return (
            <div
              key={s.id}
              onClick={() => openSongDetail(s)}
              class="relative flex flex-col rounded-xl overflow-hidden shadow-[0_8px_20px_rgba(0,0,0,0.5)] border border-gray-700/60 hover:border-yellow-400/80 hover:-translate-y-1 transition-all duration-300 cursor-pointer group aspect-square bg-gray-900"
            >
              {/* 封面圖 */}
              <JacketImage
                imageName={s.image_name}
                title={s.title}
                class="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                crossOrigin="anonymous"
              />

              {/* 漸層遮罩：加重底部黑色比例，凸顯文字 */}
              <div class="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent"></div>

              {/* 左上角 */}
              <div class="absolute top-2 left-2">
                <img src={BADGE_URL[s.chart_type]} class="h-5 drop-shadow-md" />
              </div>

              {/* 右上角 */}
              <div class="absolute top-2 right-2 flex flex-col gap-1.5 items-end">
                <span
                  class={`px-2 py-0.5 rounded shadow-lg text-xs font-black leading-none ${DIFF_BG[s.difficulty]}`}
                >
                  {s.chart_constant.toFixed(1)}
                </span>
                <div class="flex gap-1">
                  {fcStyle && (
                    <span
                      class={`px-1.5 py-0.5 rounded text-[10px] font-black shadow-md leading-none ${fcStyle.bg} ${fcStyle.text}`}
                    >
                      {fcStyle.label}
                    </span>
                  )}
                  {syncStyle && (
                    <span
                      class={`px-1.5 py-0.5 rounded text-[10px] font-black shadow-md leading-none ${syncStyle.bg} ${syncStyle.text}`}
                    >
                      {syncStyle.label}
                    </span>
                  )}
                </div>
              </div>

              {/* 底部內容：全面改用 text-shadow 打造銳利黑邊 */}
              <div class="absolute bottom-0 left-0 right-0 p-2.5 flex flex-col z-10">
                <div class="zh-clamp-2 text-[12px] sm:text-[13px] font-black text-white mb-1 [text-shadow:1px_1px_2px_#000,0_0_4px_#000]">
                  {s.title}
                </div>

                <div class="flex justify-between items-end">
                  {/* 左下角：極致還原的 Rank 與達成率 */}
                  <div class="flex flex-col">
                    <span class="text-[10px] font-black text-[#ffdd00] leading-tight tracking-wide [text-shadow:1px_1px_0_#000,0_0_2px_#000]">
                      {getRankText(s.achievement)}
                    </span>
                    <span class="text-[13px] font-black text-white leading-none tracking-tight [text-shadow:1px_1px_0_#000,0_0_2px_#000]">
                      {s.achievement.toFixed(4)}%
                    </span>
                  </div>

                  {/* 右下角：排名與 Rating */}
                  <div class="flex items-baseline gap-1">
                    <span class="text-[10px] text-gray-300 font-bold italic [text-shadow:1px_1px_0_#000]">
                      #{i + 1}
                    </span>
                    <span class="text-2xl font-black text-white leading-none tracking-tighter [text-shadow:1px_1px_0_#000,0_0_4px_#000]">
                      {s.rating}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div ref={rootRef} data-b50-root class="max-w-7xl mx-auto p-4">
      {/* 功能操作區：下載按鈕 */}
      <div class="flex justify-end mb-6">
        <button
          onClick={downloadB50Image}
          disabled={isCapturing}
          class={`px-6 py-3 rounded-xl font-black text-white transition-all shadow-lg flex items-center gap-2 ${
            isCapturing
              ? "bg-gray-600"
              : "bg-gradient-to-r from-pink-500 to-rose-500 hover:scale-105 active:scale-95"
          }`}
        >
          <svg
            class="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="3"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          {isCapturing ? "生成戰報中..." : "下載 B50 圖片"}
        </button>
      </div>

      {/* 🌟 圖片下載範圍 (Capture Area) */}
      <div class="bg-gradient-to-br from-gray-900 via-[#1a1125] to-gray-900 rounded-3xl p-4 lg:p-8 border border-gray-700/50">
        {/* 頂部玩家儀表板 (Header) */}
        <div class="b50-player-panel flex flex-col sm:flex-row sm:items-center justify-between gap-5 mb-8 p-4 sm:p-6 bg-black/40 backdrop-blur-md rounded-2xl border border-gray-700/50 shadow-2xl">
          <div class="flex items-center gap-4 sm:gap-5 min-w-0">
            {/* 1. 頭像區：優先顯示同步抓取的圖片 */}
            {data.icon_img_url ? (
              <img
                // 🌟 改用 proxy API，並把官方圖片網址當作 url 參數傳過去
                src={apiUrl(
                  `/api/proxy-image?url=${encodeURIComponent(data.icon_img_url)}`,
                )}
                crossOrigin="anonymous" // 👈 沒有這行 Canvas 依然會報錯
                class="w-16 h-16 sm:w-20 sm:h-20 rounded-xl border-2 border-yellow-500/50 shadow-lg object-cover shrink-0"
                alt="Player Icon"
              />
            ) : (
              <div class="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl sm:text-3xl font-black shadow-[0_0_15px_rgba(99,102,241,0.5)] border-2 border-white/20 shrink-0">
                {playerName[0]?.toUpperCase()}
              </div>
            )}

            {/* 2. 玩家資訊區：名稱與段位圖 */}
            <div>
              <div class="text-[10px] text-gray-400 font-bold mb-1 tracking-[0.2em] uppercase">
                Player Info
              </div>
              <div class="zh-tight text-2xl sm:text-3xl font-black text-white mb-2">
                {data.in_game_name || data.username || playerName}
              </div>

              {/* 🌟 段位圖片區塊：一樣透過 Proxy 拿取，解除 Canvas 封鎖 */}
              {data.dan_img_url && (
                <img
                  src={apiUrl(
                    `/api/proxy-image?url=${encodeURIComponent(data.dan_img_url)}`,
                  )}
                  crossOrigin="anonymous"
                  class="h-8 w-auto object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
                  alt="Dan Rank"
                />
              )}
            </div>
          </div>

          {/* 3. Rating 顯示區 */}
          <div class="text-left sm:text-right shrink-0">
            <div class="text-sm text-pink-400 font-bold mb-1 tracking-widest">
              DX RATING
            </div>
            <div class="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-100 via-yellow-300 to-yellow-600 drop-shadow-md leading-none">
              {data.totalRating}
            </div>
          </div>
        </div>

        {/* 歌曲列表分區 */}
        {renderSection(
          data.newScores,
          `NEW SONGS`,
          "bg-gradient-to-r from-pink-600 to-rose-600",
        )}
        {renderSection(
          data.oldScores,
          `OLD SONGS`,
          "bg-gradient-to-r from-blue-600 to-cyan-600",
        )}

        {/* 底部腳註 */}
        <div class="mt-8 text-center text-gray-500 font-mono text-xs tracking-widest uppercase">
          Generated by maiTracker • {new Date().toISOString().slice(0, 10)}
        </div>
      </div>

      {/* 歌曲詳情彈窗 */}
      {selectedSong && (
        <SongDetailModal
          song={selectedSong}
          playerScores={playerScores}
          onClose={() => setSelectedSong(null)}
        />
      )}
    </div>
  );
}
