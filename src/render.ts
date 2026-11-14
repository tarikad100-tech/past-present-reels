import type { Actor, Project } from './types'
import { calcAge, ageWord, deathYear } from './age'
export const W = 1080, H = 1920, MID = H / 2, TRANS = 1.0, SLANT = 170
const cache = new Map<string, HTMLImageElement>()
export function loadImg(src: string): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null)
  const c = cache.get(src); if (c?.complete) return Promise.resolve(c)
  return new Promise(res => { const i = new Image(); i.onload = () => { cache.set(src, i); res(i) }; i.onerror = () => res(null); i.src = src })
}
export const preload = (p: Project) => Promise.all([p.profileImg, p.logoImg, ...p.actors.flatMap(a => [a.oldImg, a.newImg])].map(loadImg))
export const totalDuration = (p: Project) => p.actors.reduce((s, a) => s + a.duration, 0)
const ease = (k: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3)

function cover(ctx: CanvasRenderingContext2D, src: string, y: number, h: number, zoom: number, drift: number) {
  const img = cache.get(src)
  if (img) { const s = Math.max(W / img.width, h / img.height) * zoom; const dw = img.width * s, dh = img.height * s; ctx.drawImage(img, (W - dw) / 2 + drift, y + (h - dh) / 2, dw, dh) }
  else { ctx.fillStyle = '#222a3d'; ctx.fillRect(0, y, W, h) }
}
// كشف بمسح مائل مع خط ضوء على الحافة؛ fromRight يحدد اتجاه المسح
function reveal(ctx: CanvasRenderingContext2D, src: string, y: number, h: number, e: number, fromRight: boolean, local: number, dur: number, dir: number) {
  if (e <= 0) return
  const xt = W + SLANT - e * (W + SLANT), X = (x: number) => fromRight ? x : W - x
  ctx.save(); ctx.beginPath()
  ctx.moveTo(X(xt), y); ctx.lineTo(X(W), y); ctx.lineTo(X(W), y + h); ctx.lineTo(X(xt - SLANT), y + h); ctx.closePath(); ctx.clip()
  const zoom = (1.04 + 0.08 * Math.min(1, local / dur)) * (1 + 0.22 * (1 - e))
  cover(ctx, src, y, h, zoom, dir * (1 - e) * 60 + dir * 30 * Math.min(1, local / dur))
  ctx.restore()
  if (e < 1) { ctx.save(); ctx.globalAlpha = 1 - e; ctx.lineWidth = 6; ctx.strokeStyle = '#fff3c4'; ctx.shadowColor = '#ffd166'; ctx.shadowBlur = 30
    ctx.beginPath(); ctx.moveTo(X(xt), y); ctx.lineTo(X(xt - SLANT), y + h); ctx.stroke(); ctx.restore() }
}
function shadowText(ctx: CanvasRenderingContext2D, text: string, y: number, font: string, fill: string | CanvasGradient, maxW: number, alpha: number, dy: number) {
  ctx.save(); ctx.globalAlpha *= alpha; ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = font
  const m = ctx.measureText(text).width; if (m > maxW) { const px = parseInt(/(\d+)px/.exec(font)![1]); ctx.font = font.replace(/\d+px/, Math.floor(px * maxW / m) + 'px') }
  ctx.fillStyle = fill; ctx.shadowColor = 'rgba(0,0,0,.8)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 4
  ctx.fillText(text, W / 2, y + dy); ctx.shadowBlur = 6; ctx.shadowOffsetY = 2; ctx.fillText(text, W / 2, y + dy); ctx.restore()
}
function divider(ctx: CanvasRenderingContext2D, y: number, k: number, alpha: number) {
  if (k <= 0) return
  const half = 150 * k; ctx.save(); ctx.globalAlpha *= alpha; ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 3; ctx.shadowColor = 'rgba(0,0,0,.8)'; ctx.shadowBlur = 10
  ctx.beginPath(); ctx.moveTo(W / 2 - half, y); ctx.lineTo(W / 2 - 18, y); ctx.moveTo(W / 2 + 18, y); ctx.lineTo(W / 2 + half, y); ctx.stroke()
  ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.moveTo(W / 2, y - 9); ctx.lineTo(W / 2 + 9, y); ctx.lineTo(W / 2, y + 9); ctx.lineTo(W / 2 - 9, y); ctx.fill(); ctx.restore()
}
function drawActor(ctx: CanvasRenderingContext2D, a: Actor, local: number, textFade: number, textStart: number) {
  const h = H / 2
  reveal(ctx, a.oldImg, 0, h, ease(local / 0.8), true, local, a.duration, 1)
  reveal(ctx, a.newImg, MID, h, ease((local - 0.2) / 0.9), false, local, a.duration, -1)
  const e = ease((local - textStart) / 0.7) * textFade, dy = (1 - e) * 36
  const g = ctx.createLinearGradient(0, MID - 70, 0, MID + 40); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#ffe9a8')
  shadowText(ctx, a.name, MID - 40, '900 94px Cairo', g, 940, e, dy)
  divider(ctx, MID + 28, e, textFade)
  const age = calcAge(a.birth, a.death), dead = !!deathYear(a.death)
  if (age !== null) shadowText(ctx, dead ? `عن عمر ${age} ${ageWord(age)}` : `العمر: ${age} ${ageWord(age)}`, MID + 82, '700 50px Cairo', '#ffffff', 940, e, dy)
  if (dead) shadowText(ctx, `توفي في ${deathYear(a.death)}`, MID + (age !== null ? 146 : 82), '700 46px Cairo', '#ffb3b3', 940, e, dy)
}
function header(ctx: CanvasRenderingContext2D, p: Project) {
  const g = ctx.createLinearGradient(0, 0, 0, 300); g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, 300)
  const R = 84, cy = 150; ctx.font = '800 42px Cairo'; ctx.direction = 'rtl'
  const tw = Math.min(ctx.measureText(p.pageName).width, 620), total = R + 20 + tw, cx = (W + total) / 2 - R / 2
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 14; ctx.fillStyle = '#394065'; ctx.beginPath(); ctx.arc(cx, cy, R / 2, 0, Math.PI * 2); ctx.fill(); ctx.restore()
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R / 2, 0, Math.PI * 2); ctx.clip()
  const im = p.profileImg ? cache.get(p.profileImg) : undefined
  if (im) { const s = Math.max(R / im.width, R / im.height); ctx.drawImage(im, cx - im.width * s / 2, cy - im.height * s / 2, im.width * s, im.height * s) }
  ctx.restore(); ctx.lineWidth = 4; ctx.strokeStyle = '#ffd166'; ctx.beginPath(); ctx.arc(cx, cy, R / 2, 0, Math.PI * 2); ctx.stroke()
  ctx.save(); ctx.fillStyle = '#fff'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.shadowColor = 'rgba(0,0,0,.8)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 2
  ctx.fillText(p.pageName, cx - R / 2 - 20, cy + 2, 620); ctx.restore()
}
export function drawFrame(ctx: CanvasRenderingContext2D, p: Project, t: number) {
  ctx.fillStyle = '#0b0f1a'; ctx.fillRect(0, 0, W, H)
  const total = totalDuration(p)
  if (p.actors.length) {
    t = Math.min(Math.max(0, t), total - 0.001); let start = 0, i = 0
    for (; i < p.actors.length; i++) { if (t < start + p.actors[i].duration) break; start += p.actors[i].duration }
    const a = p.actors[i], local = t - start
    if (i > 0 && local < TRANS) { const pr = p.actors[i - 1]; drawActor(ctx, pr, pr.duration + local, 1 - ease(local / 0.35), 0) }
    drawActor(ctx, a, local, 1, i > 0 ? 0.55 : 0.35)
  } else { ctx.fillStyle = '#8b93b5'; ctx.font = '700 54px Cairo'; ctx.textAlign = 'center'; ctx.direction = 'rtl'; ctx.fillText('أضف ممثلين لبدء المعاينة', W / 2, H / 2) }
  header(ctx, p)
  if (p.logoImg && cache.get(p.logoImg)) { const im = cache.get(p.logoImg)!, s = 150 / Math.max(im.width, im.height); ctx.save(); ctx.globalAlpha = .75; ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 10; ctx.drawImage(im, W - 40 - im.width * s, H - 40 - im.height * s, im.width * s, im.height * s); ctx.restore() }
}
