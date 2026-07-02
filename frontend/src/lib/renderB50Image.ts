import { apiUrl } from './api'
import { getRank as getRankText } from '@o-mai/shared'

export interface B50ImageScore {
  title: string
  difficulty: string
  chart_type: string
  achievement: number
  chart_constant: number
  rating: number
  fc: string | null
  sync: string | null
  image_name: string
}

export interface B50ImageData {
  totalRating: number
  newScores: B50ImageScore[]
  oldScores: B50ImageScore[]
  username?: string
  in_game_name?: string
  dan_img_url?: string
  icon_img_url?: string
}

const OUTPUT_SCALE = 0.75
const W = 2400
const PAD = 72
const COLS = 5
const GAP = 24
const CARD_W = (W - PAD * 2 - GAP * (COLS - 1)) / COLS
const CARD_H = 220
const HEADER_H = 260
const SECTION_H = 64
const FOOTER_H = 76
const FONT_SANS = '"Noto Sans JP", "Noto Sans TC", "Noto Sans CJK JP", "Noto Sans CJK TC", "PingFang TC", "Microsoft JhengHei", system-ui, sans-serif'

const JACKET_BASE = 'https://cdn.jsdelivr.net/gh/zvuc/otoge-db@master/maimai/jacket/'
const BADGE_URL: Record<string, string> = {
  DX: 'https://cdn.jsdelivr.net/gh/zvuc/otoge-db@master/maimai/img/chart_badge_dx.png',
  STANDARD: 'https://cdn.jsdelivr.net/gh/zvuc/otoge-db@master/maimai/img/chart_badge_std.png',
}

const DIFF_COLOR: Record<string, string> = {
  BASIC: '#16a34a',
  ADVANCED: '#ca8a04',
  EXPERT: '#dc2626',
  MASTER: '#9333ea',
  REMASTER: '#e9d5ff',
}

const FC_COLOR: Record<string, string> = {
  fc: '#10b981',
  fcp: '#6ee7b7',
  ap: '#f59e0b',
  app: '#fde68a',
}

const SYNC_COLOR: Record<string, string> = {
  fs: '#0ea5e9',
  fsp: '#7dd3fc',
  fdx: '#8b5cf6',
  fdxp: '#c4b5fd',
}

const FC_LABEL: Record<string, string> = {
  fc: 'FC',
  fcp: 'FC+',
  ap: 'AP',
  app: 'AP+',
}

const SYNC_LABEL: Record<string, string> = {
  fs: 'FS',
  fsp: 'FS+',
  fdx: 'FDX',
  fdxp: 'FDX+',
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function drawRoundedFill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string | CanvasGradient | CanvasPattern,
) {
  roundRect(ctx, x, y, w, h, r)
  ctx.fillStyle = fill
  ctx.fill()
}

function drawTextFit(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  font: string,
  fill = '#fff',
) {
  ctx.font = font
  ctx.fillStyle = fill
  let value = text
  if (ctx.measureText(value).width <= maxWidth) {
    ctx.fillText(value, x, y)
    return
  }
  while (value.length > 1 && ctx.measureText(`${value}...`).width > maxWidth) {
    value = value.slice(0, -1)
  }
  ctx.fillText(`${value}...`, x, y)
}

async function loadImage(url: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

async function ensureCanvasFonts() {
  if (!('fonts' in document)) return

  try {
    await Promise.all([
      document.fonts.load(`900 120px "Noto Sans JP"`),
      document.fonts.load(`900 40px "Noto Sans JP"`),
      document.fonts.load(`900 36px "Noto Sans JP"`),
      document.fonts.load(`900 120px "Noto Sans TC"`),
      document.fonts.load(`900 40px "Noto Sans TC"`),
      document.fonts.load(`900 36px "Noto Sans TC"`),
    ])
    await document.fonts.ready
  } catch {
    // Font loading failure should not block image export; browser fallback is acceptable.
  }
}

function drawImageCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight)
  const sw = w / scale
  const sh = h / scale
  const sx = (img.naturalWidth - sw) / 2
  const sy = (img.naturalHeight - sh) / 2
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h)
}

function drawPill(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, fill: string, color = '#fff') {
  ctx.font = '800 24px system-ui, sans-serif'
  const width = Math.ceil(ctx.measureText(text).width) + 28
  drawRoundedFill(ctx, x, y, width, 36, 10, fill)
  ctx.fillStyle = color
  ctx.fillText(text, x + 14, y + 26)
  return width
}

function drawSectionTitle(ctx: CanvasRenderingContext2D, title: string, x: number, y: number, colorA: string, colorB: string) {
  const grad = ctx.createLinearGradient(x, y, x + 300, y)
  grad.addColorStop(0, colorA)
  grad.addColorStop(1, colorB)
  drawRoundedFill(ctx, x, y, 320, 48, 24, grad)
  ctx.fillStyle = '#fff'
  ctx.font = '900 28px system-ui, sans-serif'
  ctx.fillText(title, x + 26, y + 34)
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x + 348, y + 24)
  ctx.lineTo(W - PAD, y + 24)
  ctx.stroke()
}

async function drawScoreCard(ctx: CanvasRenderingContext2D, score: B50ImageScore, rank: number, x: number, y: number) {
  drawRoundedFill(ctx, x, y, CARD_W, CARD_H, 24, '#111827')
  ctx.save()
  roundRect(ctx, x, y, CARD_W, CARD_H, 24)
  ctx.clip()

  const jacket = await loadImage(`${JACKET_BASE}${score.image_name}`)
  if (jacket) {
    drawImageCover(ctx, jacket, x, y, CARD_W, CARD_H)
  } else {
    const grad = ctx.createLinearGradient(x, y, x + CARD_W, y + CARD_H)
    grad.addColorStop(0, '#334155')
    grad.addColorStop(1, '#111827')
    ctx.fillStyle = grad
    ctx.fillRect(x, y, CARD_W, CARD_H)
  }

  const shade = ctx.createLinearGradient(x, y, x, y + CARD_H)
  shade.addColorStop(0, 'rgba(0,0,0,0.03)')
  shade.addColorStop(0.42, 'rgba(0,0,0,0.18)')
  shade.addColorStop(1, 'rgba(0,0,0,0.90)')
  ctx.fillStyle = shade
  ctx.fillRect(x, y, CARD_W, CARD_H)

  ctx.strokeStyle = 'rgba(168, 85, 247, 0.82)'
  ctx.lineWidth = 5
  roundRect(ctx, x + 2.5, y + 2.5, CARD_W - 5, CARD_H - 5, 22)
  ctx.stroke()

  const badge = await loadImage(BADGE_URL[score.chart_type] ?? BADGE_URL.STANDARD)
  if (badge) ctx.drawImage(badge, x + 18, y + 16, 86, 32)

  const diffColor = DIFF_COLOR[score.difficulty] ?? '#475569'
  const constantText = score.chart_constant.toFixed(1)
  ctx.font = '900 24px ui-monospace, SFMono-Regular, Menlo, monospace'
  const constantW = Math.ceil(ctx.measureText(constantText).width) + 44
  drawRoundedFill(ctx, x + CARD_W - constantW, y, constantW, 48, 14, diffColor)
  ctx.fillStyle = score.difficulty === 'REMASTER' ? '#4c1d95' : '#fff'
  ctx.fillText(constantText, x + CARD_W - constantW + 18, y + 33)

  let badgeX = x + CARD_W - 18
  if (score.sync && SYNC_COLOR[score.sync]) {
    ctx.font = '900 18px system-ui, sans-serif'
    const label = SYNC_LABEL[score.sync] ?? score.sync.toUpperCase()
    const width = Math.ceil(ctx.measureText(label).width) + 20
    badgeX -= width
    drawRoundedFill(ctx, badgeX, y + 54, width, 28, 8, SYNC_COLOR[score.sync])
    ctx.fillStyle = '#fff'
    ctx.fillText(label, badgeX + 10, y + 75)
  }
  if (score.fc && FC_COLOR[score.fc]) {
    ctx.font = '900 18px system-ui, sans-serif'
    const label = FC_LABEL[score.fc] ?? score.fc.toUpperCase()
    const width = Math.ceil(ctx.measureText(label).width) + 20
    badgeX -= width + 8
    drawRoundedFill(ctx, badgeX, y + 54, width, 28, 8, FC_COLOR[score.fc])
    ctx.fillStyle = '#fff'
    ctx.fillText(label, badgeX + 10, y + 75)
  }

  ctx.shadowColor = 'rgba(0,0,0,0.95)'
  ctx.shadowBlur = 8
  drawTextFit(ctx, score.title, x + 24, y + CARD_H - 86, CARD_W - 48, `900 36px ${FONT_SANS}`)

  ctx.fillStyle = '#facc15'
  ctx.font = '900 20px system-ui, sans-serif'
  ctx.fillText(getRankText(score.achievement), x + 24, y + CARD_H - 44)
  ctx.fillStyle = '#fff'
  ctx.font = '900 27px system-ui, sans-serif'
  ctx.fillText(`${score.achievement.toFixed(4)}%`, x + 24, y + CARD_H - 18)

  ctx.textAlign = 'right'
  ctx.fillStyle = '#cbd5e1'
  ctx.font = '800 20px system-ui, sans-serif'
  ctx.fillText(`#${rank}`, x + CARD_W - 112, y + CARD_H - 28)
  ctx.fillStyle = '#fff'
  ctx.font = '950 50px system-ui, sans-serif'
  ctx.fillText(String(score.rating), x + CARD_W - 20, y + CARD_H - 18)
  ctx.textAlign = 'left'
  ctx.shadowBlur = 0
  ctx.restore()
}

async function drawHeader(ctx: CanvasRenderingContext2D, data: B50ImageData, playerName: string) {
  drawRoundedFill(ctx, PAD, PAD, W - PAD * 2, HEADER_H, 36, 'rgba(2, 6, 23, 0.76)')
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)'
  ctx.lineWidth = 2
  roundRect(ctx, PAD, PAD, W - PAD * 2, HEADER_H, 36)
  ctx.stroke()

  const name = data.in_game_name || data.username || playerName
  const iconUrl = data.icon_img_url ? apiUrl(`/api/proxy-image?url=${encodeURIComponent(data.icon_img_url)}`) : ''
  const icon = iconUrl ? await loadImage(iconUrl) : null

  const iconSize = 236
  const iconX = PAD + 36
  const iconY = PAD + 12

  if (icon) {
    ctx.save()
    roundRect(ctx, iconX, iconY, iconSize, iconSize, 34)
    ctx.clip()
    drawImageCover(ctx, icon, iconX, iconY, iconSize, iconSize)
    ctx.restore()
  } else {
    const grad = ctx.createLinearGradient(iconX, iconY, iconX + iconSize, iconY + iconSize)
    grad.addColorStop(0, '#6366f1')
    grad.addColorStop(1, '#9333ea')
    drawRoundedFill(ctx, iconX, iconY, iconSize, iconSize, 34, grad)
    ctx.fillStyle = '#fff'
    ctx.font = `900 108px ${FONT_SANS}`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
    ctx.fillText(name[0]?.toUpperCase() ?? 'P', iconX + iconSize / 2, iconY + iconSize / 2 + 2)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
  }

  ctx.fillStyle = '#94a3b8'
  ctx.font = `900 38px ${FONT_SANS}`
  ctx.fillText('PLAYER INFO', PAD + 318, PAD + 76)

  ctx.fillStyle = '#fff'
  ctx.font = `900 86px ${FONT_SANS}`
  if ('letterSpacing' in ctx) {
    ;(ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '-4px'
  }
  ctx.shadowColor = 'rgba(0,0,0,0.65)'
  ctx.shadowBlur = 8
  ctx.fillText(name, PAD + 318, PAD + 158, 900)
  ctx.shadowBlur = 0
  if ('letterSpacing' in ctx) {
    ;(ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '0px'
  }

  if (data.dan_img_url) {
    const dan = await loadImage(apiUrl(`/api/proxy-image?url=${encodeURIComponent(data.dan_img_url)}`))
    if (dan) {
      const h = 72
      const w = Math.min(420, dan.naturalWidth * (h / dan.naturalHeight))
      ctx.drawImage(dan, PAD + 318, PAD + 186, w, h)
    }
  }

  ctx.textAlign = 'right'
  ctx.fillStyle = '#f472b6'
  ctx.font = `900 40px ${FONT_SANS}`
  ctx.fillText('DX RATING', W - PAD - 54, PAD + 92)
  const ratingGrad = ctx.createLinearGradient(W - PAD - 420, PAD + 122, W - PAD - 54, PAD + 210)
  ratingGrad.addColorStop(0, '#fef3c7')
  ratingGrad.addColorStop(0.5, '#fde047')
  ratingGrad.addColorStop(1, '#d97706')
  ctx.fillStyle = ratingGrad
  ctx.font = `900 152px ${FONT_SANS}`
  ctx.fillText(String(data.totalRating), W - PAD - 54, PAD + 224)
  ctx.textAlign = 'left'
}

export async function renderB50Image(data: B50ImageData, playerName: string) {
  await ensureCanvasFonts()

  const newRows = Math.ceil(data.newScores.length / COLS)
  const oldRows = Math.ceil(data.oldScores.length / COLS)
  const height = PAD + HEADER_H + 44 + SECTION_H + newRows * CARD_H + Math.max(0, newRows - 1) * GAP + 52 + SECTION_H + oldRows * CARD_H + Math.max(0, oldRows - 1) * GAP + FOOTER_H

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(W * OUTPUT_SCALE)
  canvas.height = Math.round(height * OUTPUT_SCALE)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available')
  ctx.scale(OUTPUT_SCALE, OUTPUT_SCALE)

  const bg = ctx.createLinearGradient(0, 0, W, height)
  bg.addColorStop(0, '#111827')
  bg.addColorStop(0.45, '#1a1125')
  bg.addColorStop(1, '#0f172a')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, height)

  ctx.fillStyle = 'rgba(59, 130, 246, 0.12)'
  ctx.beginPath()
  ctx.arc(280, 100, 420, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(236, 72, 153, 0.10)'
  ctx.beginPath()
  ctx.arc(W - 220, 260, 500, 0, Math.PI * 2)
  ctx.fill()

  await drawHeader(ctx, data, playerName)

  let y = PAD + HEADER_H + 44
  drawSectionTitle(ctx, 'NEW SONGS', PAD, y, '#db2777', '#e11d48')
  y += SECTION_H
  for (let i = 0; i < data.newScores.length; i++) {
    const col = i % COLS
    const row = Math.floor(i / COLS)
    await drawScoreCard(ctx, data.newScores[i], i + 1, PAD + col * (CARD_W + GAP), y + row * (CARD_H + GAP))
  }

  y += newRows * CARD_H + Math.max(0, newRows - 1) * GAP + 52
  drawSectionTitle(ctx, 'OLD SONGS', PAD, y, '#2563eb', '#0891b2')
  y += SECTION_H
  for (let i = 0; i < data.oldScores.length; i++) {
    const col = i % COLS
    const row = Math.floor(i / COLS)
    await drawScoreCard(ctx, data.oldScores[i], i + 1, PAD + col * (CARD_W + GAP), y + row * (CARD_H + GAP))
  }

  ctx.fillStyle = '#64748b'
  ctx.font = '800 22px ui-monospace, SFMono-Regular, Menlo, monospace'
  ctx.textAlign = 'center'
  ctx.fillText(`Generated by maiTracker - ${new Date().toISOString().slice(0, 10)}`, W / 2, height - 42)
  ctx.textAlign = 'left'

  return canvas.toDataURL('image/webp', 0.88)
}
