import { useEffect, useState } from "preact/hooks";
import { apiUrl } from "../lib/api";
import JacketImage from "./JacketImage";

interface HistoryEntry {
  song_id: string;
  id: string;
  achievement: number;
  chart_type: string;
  difficulty: string;
  level: string;
  synced_at: string;
}

export default function History() {
  const [scores, setScores] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("maimai_sync_token");
    if (!token) {
      setLoading(false);
      return;
    }

    fetch(apiUrl("/api/history"), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setScores(data);
        setLoading(false);
      });
  }, []);

  if (loading) return <div class="text-gray-400">載入中...</div>;

  return (
    <div class="grid gap-3">
      {scores.map((score) => (
        <div
          key={score.id}
          class="bg-gray-800 rounded-lg p-3 flex gap-4 items-center"
        >
          <div class="flex-1 min-w-0">
            <div class="font-bold truncate">{score.song_id}</div>
            <div class="text-sm text-gray-400">
              {score.difficulty} {score.level} · {score.chart_type}
            </div>
          </div>

          <div class="text-xl font-mono text-yellow-400 shrink-0">
            {score.achievement.toFixed(4)}%
          </div>
        </div>
      ))}
    </div>
  );
}
