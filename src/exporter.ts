import { Muxer, ArrayBufferTarget } from 'mp4-muxer'
import type { Project } from './types'
import { W, H, drawFrame, preload, totalDuration } from './render'
const FPS = 30, SR = 48000
export const exportSupported = () => typeof VideoEncoder !== 'undefined' && typeof AudioEncoder !== 'undefined'

async function renderAudio(buf: ArrayBuffer, dur: number, vol: number): Promise<AudioBuffer> {
  const dec = await new AudioContext().decodeAudioData(buf.slice(0))
  const off = new OfflineAudioContext(2, Math.ceil(dur * SR), SR)
  const src = off.createBufferSource(); src.buffer = dec; src.loop = true
  const g = off.createGain(); g.gain.setValueAtTime(vol, 0); g.gain.setValueAtTime(vol, Math.max(0, dur - 1.5)); g.gain.linearRampToValueAtTime(0, dur)
  src.connect(g).connect(off.destination); src.start(); return off.startRendering()
}

export async function exportMp4(p: Project, music: ArrayBuffer | null, vol: number, onProgress: (f: number, label: string) => void): Promise<Blob> {
  if (!exportSupported()) throw new Error('المتصفح لا يدعم WebCodecs. استخدم Chrome أو Edge حديثاً.')
  await document.fonts.load('900 100px Cairo'); await document.fonts.load('700 50px Cairo'); await document.fonts.load('800 50px Cairo')
  await preload(p)
  const dur = totalDuration(p), frames = Math.round(dur * FPS)
  const muxer = new Muxer({ target: new ArrayBufferTarget(), video: { codec: 'avc', width: W, height: H }, ...(music ? { audio: { codec: 'aac' as const, numberOfChannels: 2, sampleRate: SR } } : {}), fastStart: 'in-memory' })
  let err: unknown = null
  const venc = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: e => (err = e) })
  venc.configure({ codec: 'avc1.640033', width: W, height: H, bitrate: 8_000_000, framerate: FPS })
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d')!
  for (let i = 0; i < frames; i++) {
    if (err) throw err
    drawFrame(ctx, p, i / FPS)
    const f = new VideoFrame(cv, { timestamp: Math.round(i * 1e6 / FPS), duration: Math.round(1e6 / FPS) })
    venc.encode(f, { keyFrame: i % 60 === 0 }); f.close()
    while (venc.encodeQueueSize > 8) await new Promise(r => setTimeout(r, 5))
    if (i % 10 === 0) { onProgress(i / frames * (music ? .85 : 1), 'ترميز الفيديو'); await new Promise(r => setTimeout(r)) }
  }
  await venc.flush()
  if (music) {
    onProgress(.88, 'معالجة الموسيقى')
    const ab = await renderAudio(music, dur, vol)
    const aenc = new AudioEncoder({ output: (c, m) => muxer.addAudioChunk(c, m), error: e => (err = e) })
    aenc.configure({ codec: 'mp4a.40.2', sampleRate: SR, numberOfChannels: 2, bitrate: 192_000 })
    const L = ab.getChannelData(0), R = ab.getChannelData(1), CH = 4800
    for (let o = 0; o < L.length; o += CH) {
      const n = Math.min(CH, L.length - o), d = new Float32Array(n * 2); d.set(L.subarray(o, o + n), 0); d.set(R.subarray(o, o + n), n)
      const ad = new AudioData({ format: 'f32-planar', sampleRate: SR, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round(o / SR * 1e6), data: d })
      aenc.encode(ad); ad.close(); while (aenc.encodeQueueSize > 20) await new Promise(r => setTimeout(r, 2))
    }
    await aenc.flush()
  }
  if (err) throw err
  muxer.finalize(); onProgress(1, 'اكتمل')
  return new Blob([(muxer.target as ArrayBufferTarget).buffer], { type: 'video/mp4' })
}
