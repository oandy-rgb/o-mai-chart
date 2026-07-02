// src/components/SongDatabase.tsx
import { useState, useEffect } from "preact/hooks";
import SongCard, { type SongData, type PlayerScore } from "./SongCard";
import SongDetailModal from "./SongDetailModal";
import { useSongFilter, type SearchScope } from "../hooks/useSongFilter";
import { apiUrl } from "../lib/api";

const SEARCH_SCOPE_LABELS: Record<SearchScope, string> = {
  ALL: "全部",
  title: "曲名",
  artist: "Artist",
  designer: "譜師",
};

const SEARCH_SCOPE_PLACEHOLDERS: Record<SearchScope, string> = {
  ALL: "搜尋曲名、別名、Artist、譜師",
  title: "搜尋曲名或別名",
  artist: "搜尋 Artist",
  designer: "搜尋譜師",
};

const DIFF_ACTIVE_STYLE: Record<string, string> = {
  ALL: "bg-gray-600 border-gray-500 text-white",
  BASIC: "bg-green-500 border-green-400 text-white",
  ADVANCED: "bg-yellow-500 border-yellow-400 text-white",
  EXPERT: "bg-red-500 border-red-400 text-white",
  MASTER: "bg-purple-500 border-purple-400 text-white",
  REMASTER: "bg-purple-200 border-purple-300 text-purple-900",
};

const ACHIEVEMENT_FILTERS = [
  { key: "ALL", label: "全部", min: 0, max: 101 },
  { key: "UNPLAYED", label: "未遊玩", min: null, max: null },
  { key: "SSS_PLUS", label: "SSS+", min: 100.5, max: 101 },
  { key: "SSS", label: "SSS", min: 100, max: 100.5 },
  { key: "SS_PLUS", label: "SS+", min: 99.5, max: 100 },
  { key: "SS", label: "SS", min: 99, max: 99.5 },
  { key: "S_PLUS", label: "S+", min: 98, max: 99 },
  { key: "S", label: "S", min: 97, max: 98 },
] as const;

type AchievementFilter = (typeof ACHIEVEMENT_FILTERS)[number]["key"];

const CLEAR_STATUS_FILTERS = [
  { key: "ALL", label: "全部", field: null, value: null },
  { key: "FC", label: "FC", field: "fc", value: "fc" },
  { key: "FCP", label: "FC+", field: "fc", value: "fcp" },
  { key: "AP", label: "AP", field: "fc", value: "ap" },
  { key: "APP", label: "AP+", field: "fc", value: "app" },
  { key: "FS", label: "FS", field: "sync", value: "fs" },
  { key: "FSP", label: "FS+", field: "sync", value: "fsp" },
  { key: "FDX", label: "FDX", field: "sync", value: "fdx" },
  { key: "FDXP", label: "FDX+", field: "sync", value: "fdxp" },
] as const;

type ClearStatusFilter = (typeof CLEAR_STATUS_FILTERS)[number]["key"];

export default function SongDatabase() {
  const {
    searchQuery,
    setSearchQuery,
    searchScope,
    setSearchScope,
    filteredSongs,
    loading,
    filterType,
    setFilterType,
    filterDiff,
    setFilterDiff,
    minCC,
    setMinCC,
    maxCC,
    setMaxCC,
  } = useSongFilter();

  const [selectedSong, setSelectedSong] = useState<SongData | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [playerScores, setPlayerScores] = useState<PlayerScore[]>([]);
  const [achievementFilter, setAchievementFilter] =
    useState<AchievementFilter>("ALL");
  const [clearStatusFilter, setClearStatusFilter] =
    useState<ClearStatusFilter>("ALL");

  useEffect(() => {
    const token = localStorage.getItem("maimai_sync_token");
    if (!token) return;
    fetch(apiUrl("/api/scores/all"), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setPlayerScores(data);
      })
      .catch(console.error);
  }, []);

  const scoreMap = new Map(
    playerScores.map((score) => [
      `${score.title}_${score.chart_type}_${score.difficulty}`,
      score,
    ]),
  );
  const activeAchievementFilter =
    ACHIEVEMENT_FILTERS.find((filter) => filter.key === achievementFilter) ??
    ACHIEVEMENT_FILTERS[0];
  const activeClearStatusFilter =
    CLEAR_STATUS_FILTERS.find((filter) => filter.key === clearStatusFilter) ??
    CLEAR_STATUS_FILTERS[0];
  const hasScoreFilter =
    achievementFilter !== "ALL" || clearStatusFilter !== "ALL";
  const matchesAchievementFilter = (score: PlayerScore | undefined) => {
    if (achievementFilter === "ALL") return true;
    if (achievementFilter === "UNPLAYED")
      return !score || score.achievement == null;
    if (
      !score ||
      score.achievement == null ||
      activeAchievementFilter.min == null ||
      activeAchievementFilter.max == null
    )
      return false;
    return (
      score.achievement >= activeAchievementFilter.min &&
      score.achievement < activeAchievementFilter.max
    );
  };
  const matchesClearStatusFilter = (score: PlayerScore | undefined) => {
    if (clearStatusFilter === "ALL") return true;
    if (
      !score ||
      !activeClearStatusFilter.field ||
      !activeClearStatusFilter.value
    )
      return false;
    return (
      score[activeClearStatusFilter.field] === activeClearStatusFilter.value
    );
  };
  const displaySongs = !hasScoreFilter
    ? filteredSongs
    : filteredSongs.filter(({ song }) => {
        const difficulties =
          filterDiff === "ALL"
            ? song.difficulties
            : song.difficulties.filter(
                (diff) => diff.difficulty === filterDiff,
              );

        return difficulties.some((diff) => {
          const score = scoreMap.get(
            `${song.title}_${song.chart_type}_${diff.difficulty}`,
          );
          return (
            matchesAchievementFilter(score) && matchesClearStatusFilter(score)
          );
        });
      });

  return (
    <div class="max-w-7xl mx-auto px-1 sm:p-4 space-y-5 sm:space-y-6">
      <div class="sticky top-0 z-10 bg-gray-900/95 backdrop-blur pt-2 sm:pt-4 pb-4 border-b border-gray-800 shadow-xl">
        <div class="flex flex-col gap-4">
          <div class="grid grid-cols-1 lg:grid-cols-[auto_minmax(0,1fr)_auto] gap-3 items-stretch">
            <div class="grid grid-cols-4 gap-1 rounded-xl border border-gray-700 bg-gray-800/80 p-1 shadow-inner lg:w-fit">
              {(["ALL", "title", "artist", "designer"] as SearchScope[]).map(
                (scope) => (
                  <button
                    key={scope}
                    onClick={() => setSearchScope(scope)}
                    class={`touch-target h-10 rounded-lg px-2 text-sm font-bold transition-colors ${
                      searchScope === scope
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-gray-400 hover:bg-gray-700/80 hover:text-white"
                    }`}
                  >
                    {SEARCH_SCOPE_LABELS[scope]}
                  </button>
                ),
              )}
            </div>

            <div class="relative min-w-0">
              <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                <svg
                  class="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <input
                type="text"
                value={searchQuery}
                onInput={(e) => setSearchQuery(e.currentTarget.value)}
                placeholder={SEARCH_SCOPE_PLACEHOLDERS[searchScope]}
                aria-label={SEARCH_SCOPE_PLACEHOLDERS[searchScope]}
                class="block h-12 w-full min-w-0 rounded-xl border border-gray-700 bg-gray-800 px-3 pl-10 text-base text-white shadow-inner outline-none placeholder:text-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:text-sm"
              />
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              class={`touch-target flex h-12 items-center justify-center gap-2 rounded-xl border px-4 text-base font-bold transition-all sm:text-sm lg:w-28 ${showFilters ? "bg-blue-600 border-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)]" : "bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"}`}
            >
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                />
              </svg>
              <span>篩選</span>
              <span class="text-xs">{showFilters ? "▲" : "▼"}</span>
            </button>
          </div>

          {showFilters && (
            <div class="grid grid-cols-1 md:grid-cols-3 gap-5 p-4 sm:p-5 bg-gray-800/80 rounded-xl border border-gray-700">
              <div class="flex flex-col gap-2">
                <label class="text-gray-400 font-bold text-xs uppercase tracking-wider">
                  譜面類型
                </label>
                <div class="flex gap-2">
                  {["ALL", "DX", "STANDARD"].map((t) => (
                    <button
                      key={t}
                      onClick={() => setFilterType(t)}
                      class={`touch-target px-3 py-2 rounded-lg border text-sm font-bold transition-colors ${filterType === t ? "bg-blue-600 border-blue-500 text-white" : "bg-gray-900 border-gray-700 text-gray-400 hover:bg-gray-700 hover:text-white"}`}
                    >
                      {t === "ALL" ? "全部" : t === "STANDARD" ? "標準" : "DX"}
                    </button>
                  ))}
                </div>
              </div>

              <div class="flex flex-col gap-2">
                <label class="text-gray-400 font-bold text-xs uppercase tracking-wider">
                  難易度
                </label>
                <div class="flex flex-wrap gap-2">
                  {[
                    "ALL",
                    "BASIC",
                    "ADVANCED",
                    "EXPERT",
                    "MASTER",
                    "REMASTER",
                  ].map((d) => (
                    <button
                      key={d}
                      onClick={() => setFilterDiff(d)}
                      class={`touch-target px-2.5 py-2 rounded-lg border text-xs font-bold transition-colors ${
                        filterDiff === d
                          ? DIFF_ACTIVE_STYLE[d]
                          : "bg-gray-900 border-gray-700 text-gray-400 hover:bg-gray-700 hover:text-white"
                      }`}
                    >
                      {d === "ALL" ? "全部" : d === "REMASTER" ? "Re:MAS" : d}
                    </button>
                  ))}
                </div>
              </div>

              <div class="flex flex-col gap-2">
                <label class="text-gray-400 font-bold text-xs uppercase tracking-wider">
                  定數區間 (Constant)
                </label>
                <div class="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    value={minCC}
                    onInput={(e) => setMinCC(e.currentTarget.value)}
                    placeholder="Min"
                    class="w-full bg-gray-900 border border-gray-700 text-white rounded-lg p-2.5 text-center focus:border-blue-500 outline-none placeholder-gray-600"
                  />
                  <span class="text-gray-500 font-bold">~</span>
                  <input
                    type="number"
                    step="0.1"
                    value={maxCC}
                    onInput={(e) => setMaxCC(e.currentTarget.value)}
                    placeholder="Max"
                    class="w-full bg-gray-900 border border-gray-700 text-white rounded-lg p-2.5 text-center focus:border-blue-500 outline-none placeholder-gray-600"
                  />
                </div>
              </div>

              <div class="flex flex-col gap-2 md:col-span-3">
                <label class="text-gray-400 font-bold text-xs uppercase tracking-wider">
                  Rank
                </label>
                <div class="flex flex-wrap gap-2">
                  {ACHIEVEMENT_FILTERS.map((filter) => (
                    <button
                      key={filter.key}
                      onClick={() => setAchievementFilter(filter.key)}
                      class={`touch-target px-2.5 py-2 rounded-lg border text-xs font-bold transition-colors ${
                        achievementFilter === filter.key
                          ? "bg-yellow-500 border-yellow-400 text-gray-950"
                          : "bg-gray-900 border-gray-700 text-gray-400 hover:bg-gray-700 hover:text-white"
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

              <div class="flex flex-col gap-2 md:col-span-3">
                <label class="text-gray-400 font-bold text-xs uppercase tracking-wider">
                  達成狀態
                </label>
                <div class="flex flex-wrap gap-2">
                  {CLEAR_STATUS_FILTERS.map((filter) => (
                    <button
                      key={filter.key}
                      onClick={() => setClearStatusFilter(filter.key)}
                      class={`touch-target px-2.5 py-2 rounded-lg border text-xs font-bold transition-colors ${
                        clearStatusFilter === filter.key
                          ? "bg-emerald-500 border-emerald-400 text-gray-950"
                          : "bg-gray-900 border-gray-700 text-gray-400 hover:bg-gray-700 hover:text-white"
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {searchQuery && (
        <div class="text-sm text-gray-400 px-1">
          找到 <span class="text-white font-bold">{displaySongs.length}</span>{" "}
          筆結果
          <span>
            （搜尋：<span class="text-yellow-400">{searchQuery}</span>）
          </span>
          <button
            onClick={() => setSearchQuery("")}
            class="text-sm text-gray-400 px-1"
          >
            清除
          </button>
        </div>
      )}

      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
        {loading ? (
          <div class="col-span-full py-20 text-center text-gray-400 animate-pulse font-bold tracking-widest">
            正在搜尋與過濾資料... 🎵
          </div>
        ) : displaySongs.length > 0 ? (
          displaySongs.map(
            ({ song, matchReason, matchedDesigner, matchedAlias }) => (
              <SongCard
                key={song.id}
                song={song}
                onClick={() => setSelectedSong(song)}
                filterDiff={filterDiff}
                matchReason={matchReason}
                matchedDesigner={matchedDesigner}
                matchedAlias={matchedAlias}
                searchQuery={searchQuery}
              />
            ),
          )
        ) : (
          <div class="col-span-full py-20 text-center text-gray-500 font-bold">
            找不到符合所有篩選條件的歌曲... 🥲
          </div>
        )}
      </div>

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
