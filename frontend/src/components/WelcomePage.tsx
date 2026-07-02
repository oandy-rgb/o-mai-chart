// src/components/WelcomePage.tsx
import { useState } from "preact/hooks";

const BOOKMARKLET = `javascript:(function(){var s=document.createElement('script');s.src='https://mai.o-andy.com/sync.js?t='+Date.now();document.body.appendChild(s);})()`;

export default function WelcomePage() {
  const [copied, setCopied] = useState(false);

  const copyBookmarklet = () => {
    navigator.clipboard.writeText(BOOKMARKLET).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div class="min-h-screen bg-gray-900 flex flex-col items-center justify-center px-4 py-16">
      <div class="w-full max-w-2xl">
        <div class="text-center mb-12">
          <h1 class="text-5xl font-black text-white mb-3">
            mai<span class="text-yellow-400">tracker</span>
          </h1>
          <p class="text-gray-400 text-lg">maimai DX 個人成績追蹤與練習助手</p>
        </div>

        <div class="space-y-4 mb-10">
          <div class="flex gap-4 p-5 bg-gray-800 rounded-xl border border-gray-700">
            <div class="shrink-0 w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center text-black font-black text-sm">
              1
            </div>
            <div>
              <p class="text-white font-bold mb-1">用 Google 帳號登入</p>
              <p class="text-gray-400 text-sm">
                點下方按鈕，用 Google 帳號建立你的追蹤帳號。
              </p>
            </div>
          </div>

          <div class="flex gap-4 p-5 bg-gray-800 rounded-xl border border-gray-700">
            <div class="shrink-0 w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center text-black font-black text-sm">
              2
            </div>
            <div class="flex-1">
              <p class="text-white font-bold mb-1">安裝同步書籤</p>
              <p class="text-gray-400 text-sm mb-3">
                複製下方程式碼，在瀏覽器書籤列按右鍵 →
                新增書籤，貼到「網址」欄位，名稱隨意。
              </p>
              <div class="flex gap-2">
                <code class="flex-1 px-3 py-2 bg-gray-900 rounded-lg text-xs text-gray-400 truncate border border-gray-700">
                  {BOOKMARKLET.slice(0, 60)}...
                </code>
                <button
                  onClick={copyBookmarklet}
                  class={`shrink-0 px-4 py-2 rounded-lg text-xs font-bold transition-colors ${copied ? "bg-green-600 text-white" : "bg-gray-700 hover:bg-gray-600 text-gray-300"}`}
                >
                  {copied ? "✅ 已複製" : "複製"}
                </button>
              </div>
            </div>
          </div>

          <div class="flex gap-4 p-5 bg-gray-800 rounded-xl border border-gray-700">
            <div class="shrink-0 w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center text-black font-black text-sm">
              3
            </div>
            <div>
              <p class="text-white font-bold mb-1">到 maimai-net 同步成績</p>
              <p class="text-gray-400 text-sm">
                前往{" "}
                <a
                  href="https://maimaidx-eng.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-blue-400 hover:underline"
                >
                  maimaidx-eng.com
                </a>{" "}
                並登入，然後點擊你剛才加的書籤。同步完成後會顯示成功筆數。
              </p>
            </div>
          </div>

          <div class="flex gap-4 p-5 bg-gray-800 rounded-xl border border-gray-700">
            <div class="shrink-0 w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center text-black font-black text-sm">
              4
            </div>
            <div>
              <p class="text-white font-bold mb-1">回來查看你的 B50</p>
              <p class="text-gray-400 text-sm">
                同步完成後回到這裡，即可查看 B50 榜單、歌曲資料庫與待打清單。
              </p>
            </div>
          </div>
        </div>

        <div class="flex flex-col items-center gap-3">
          <p class="text-gray-500 text-sm">先登入，再安裝書籤</p>
          {/* GSI 動態載入後會自動找到這個 class 並渲染按鈕 */}
          <div class="g_id_signin" data-type="standard" data-size="large" />
        </div>
      </div>
    </div>
  );
}
