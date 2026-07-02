(function () {
  if (document.getElementById("maimai-version-ui")) return;

  const REPO_OVERRIDES_URL =
    "https://raw.githubusercontent.com/oandy-rgb/maimai-score/main/overrides.json";

  const VERSION_INDEX_TO_CODE = {
    0: "10000",
    1: "11000",
    2: "12000",
    3: "13000",
    4: "14000",
    5: "15000",
    6: "16000",
    7: "17000",
    8: "18000",
    9: "18500",
    10: "19000",
    11: "19500",
    12: "19900",
    13: "20000",
    14: "20500",
    15: "21000",
    16: "21500",
    17: "22000",
    18: "22500",
    19: "23000",
    20: "23500",
    21: "24000",
    22: "24500",
    23: "25000",
    24: "25500",
    25: "26000",
  };

  const DIFFS = [
    { diff: "MASTER", index: 3 },
    { diff: "REMASTER", index: 4 },
  ];

  const VERSION_COUNT = Object.keys(VERSION_INDEX_TO_CODE).length;
  const TOTAL = VERSION_COUNT * DIFFS.length;

  const ui = document.createElement("div");
  ui.id = "maimai-version-ui";
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
        min-width: 260px;
    `;
  document.body.appendChild(ui);
  ui.innerHTML = `<p style="margin:0">🔄 載入現有 overrides.json...</p>`;

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async function fetchWithRetry(url, retries = 3, delay = 500) {
    for (let i = 0; i < retries; i++) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res;
      } catch (e) {
        if (i < retries - 1) await sleep(delay * (i + 1));
        else throw e;
      }
    }
  }

  function parseVersionRows(html) {
    const parser = new DOMParser();
    const dom = parser.parseFromString(html, "text/html");
    const rows = dom.querySelectorAll(".w_450.m_15");
    const result = [];

    rows.forEach((row) => {
      const titleEl = row.querySelector(".music_name_block");
      const chartTypeImg = row.querySelector("img.music_kind_icon");
      if (!titleEl) return;

      const title = titleEl.innerText.trim();
      const chartType = chartTypeImg?.src.includes("music_dx")
        ? "DX"
        : "STANDARD";
      result.push({ title, chartType });
    });

    return result;
  }

  function downloadJson(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function run() {
    // 1. fetch 現有 overrides.json
    let existing = {};
    try {
      const res = await fetch(REPO_OVERRIDES_URL);
      if (res.ok) {
        existing = await res.json();
        // 移除 _comment _example 等 meta key
        for (const key of Object.keys(existing)) {
          if (key.startsWith("_")) delete existing[key];
        }
      }
    } catch (e) {
      console.warn("無法載入現有 overrides.json，從空白開始", e);
    }

    // 2. 爬版本資料
    let done = 0;
    let errors = 0;

    for (let ver = 0; ver < VERSION_COUNT; ver++) {
      for (const { diff, index } of DIFFS) {
        done++;
        const pct = Math.round((done / TOTAL) * 100);
        ui.innerHTML = `
                    <p style="margin:0 0 4px;font-size:13px">🎵 抓取版本資料...</p>
                    <div style="background:#333;border-radius:4px;height:6px;margin:4px 0 6px">
                        <div style="background:#a78bfa;height:6px;border-radius:4px;width:${pct}%;transition:width 0.2s"></div>
                    </div>
                    <p style="margin:0;font-size:11px;color:#aaa">
                        ${done}/${TOTAL} (${pct}%) · ver=${ver} ${diff}
                        ${errors > 0 ? `<br><span style="color:#f87171">錯誤 ${errors} 次</span>` : ""}
                    </p>
                `;

        try {
          const url = `/maimai-mobile/record/musicVersion/search/?version=${ver}&diff=${index}`;
          const res = await fetchWithRetry(url, 3, 500);
          const html = await res.text();
          const songs = parseVersionRows(html);

          for (const { title, chartType } of songs) {
            const key = `${title}_${chartType}`;
            existing[key] ??= {};
            existing[key].version ??= {};
            existing[key].aliases ??= []; // 沒有才加，有就不動
            existing[key].chart_constant ??= {}; // 沒有才加，有就不動
            existing[key].version[diff] = VERSION_INDEX_TO_CODE[ver];
          }
        } catch (e) {
          console.error(`fetch failed: ver=${ver} diff=${diff}`, e);
          errors++;
        }

        await sleep(120);
      }
    }

    // 3. 下載
    ui.innerHTML = `
            <p style="margin:0 0 6px;font-size:13px">✅ 版本資料抓取完成</p>
            <p style="margin:0 0 8px;font-size:12px;color:#aaa">
                共 ${Object.keys(existing).length} 首歌
                ${errors > 0 ? `<br><span style="color:#f87171">請求錯誤 ${errors} 次</span>` : ""}
            </p>
            <button id="maimai-version-download" style="background:#7c3aed;color:white;border:0;border-radius:8px;padding:8px 14px;font-weight:700;cursor:pointer;width:100%">
                下載 overrides.json
            </button>
        `;
    document
      .getElementById("maimai-version-download")
      ?.addEventListener("click", () => {
        downloadJson("overrides.json", existing);
      });
  }

  run();
})();
