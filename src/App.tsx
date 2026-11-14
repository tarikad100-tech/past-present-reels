import { useEffect, useRef, useState } from 'react'
import { Actor, Project, emptyProject, uid } from './types'
import { W, H, drawFrame, preload, totalDuration } from './render'
import { calcAge } from './age'
import { exportMp4, exportSupported } from './exporter'
import { saveList, loadList, listNames, deleteList, fileToDataUrl } from './storage'

const newActor = (): Actor => ({ id: uid(), name: '', birth: '', death: '', oldImg: '', newImg: '', duration: 5 })
function Pick({ label, value, onPick }: { label: string; value: string; onPick: (f: File) => void }) {
  return <label className="pick" title={label} style={value ? { backgroundImage: `url(${value})` } : undefined}>
    {!value && <span>{label}</span>}<input type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = '' }} /></label>
}

export default function App() {
  const [p, setP] = useState<Project>(() => { try { return JSON.parse(localStorage.getItem('pp-draft') || '') } catch { return { ...emptyProject, actors: [newActor()] } } })
  const [music, setMusic] = useState<{ name: string; url: string; buf: ArrayBuffer } | null>(null)
  const [vol, setVol] = useState(0.6)
  const [t, setT] = useState(0), [playing, setPlaying] = useState(false)
  const [prog, setProg] = useState<{ f: number; label: string } | null>(null)
  const [msg, setMsg] = useState(''), [names, setNames] = useState<string[]>([])
  const cv = useRef<HTMLCanvasElement>(null), audio = useRef<HTMLAudioElement>(null), tRef = useRef(0)
  const total = totalDuration(p)
  const upd = (fn: (d: Project) => Project) => setP(fn)
  const setActor = (id: string, patch: Partial<Actor>) => upd(d => ({ ...d, actors: d.actors.map(a => a.id === id ? { ...a, ...patch } : a) }))
  const img = async (f: File, cb: (s: string) => void) => { try { cb(await fileToDataUrl(f)) } catch (e) { setMsg((e as Error).message) } }

  useEffect(() => { try { localStorage.setItem('pp-draft', JSON.stringify(p)) } catch { setMsg('تعذر الحفظ التلقائي: الصور كبيرة جداً. احفظ القائمة بالزر المخصص.') } }, [p])
  useEffect(() => { listNames().then(setNames) }, [])
  useEffect(() => { let off = false; document.fonts.load('900 100px Cairo').then(() => preload(p)).then(() => { if (!off && cv.current) drawFrame(cv.current.getContext('2d')!, p, tRef.current) }); return () => { off = true } }, [p, t])
  useEffect(() => {
    if (!playing) { audio.current?.pause(); return }
    if (tRef.current >= total) { tRef.current = 0 }
    const a = audio.current; if (a && music) { a.currentTime = tRef.current; a.volume = vol; a.play().catch(() => {}) }
    let last = performance.now(), raf = 0
    const tick = (n: number) => { tRef.current += (n - last) / 1000; last = n
      if (tRef.current >= total) { tRef.current = total; setT(total); setPlaying(false); return }
      setT(tRef.current); raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf)
  }, [playing])
  const seek = (v: number) => { tRef.current = v; setT(v); if (audio.current) audio.current.currentTime = v }
  const move = (i: number, d: number) => upd(x => { const a = [...x.actors], j = i + d; if (j < 0 || j >= a.length) return x; [a[i], a[j]] = [a[j], a[i]]; return { ...x, actors: a } })

  async function doExport() {
    setPlaying(false); setMsg('')
    if (!p.actors.length) return setMsg('أضف ممثلاً واحداً على الأقل.')
    const bad = p.actors.findIndex(a => !a.name || !a.oldImg || !a.newImg)
    if (bad >= 0) return setMsg(`الممثل رقم ${bad + 1} ينقصه اسم أو صورة.`)
    try { const blob = await exportMp4(p, music?.buf ?? null, vol, (f, label) => setProg({ f, label }))
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'past-present.mp4'; a.click(); setMsg(`تم التصدير بنجاح (${(blob.size / 1e6).toFixed(1)} MB)`)
    } catch (e) { setMsg('فشل التصدير: ' + (e as Error).message) } finally { setProg(null) }
  }
  async function save() { const n = prompt('اسم القائمة:'); if (!n) return; await saveList(n, p); setNames(await listNames()); setMsg('تم حفظ القائمة') }

  return <div className="app">
    <header><h1>🎬 الماضي والحاضر <small>صانع Reels</small></h1>
      <div className="row">
        <select value="" onChange={async e => { const v = e.target.value; if (v) { const l = await loadList(v); if (l) setP(l) } }}><option value="">📂 تحميل قائمة محفوظة…</option>{names.map(n => <option key={n}>{n}</option>)}</select>
        <button onClick={save}>💾 حفظ القائمة</button>
        <button onClick={async () => { const n = prompt('اسم القائمة المراد حذفها:'); if (n) { await deleteList(n); setNames(await listNames()) } }}>🗑</button>
      </div></header>
    <main>
      <section className="panel">
        <h2>الحساب</h2>
        <div className="row"><Pick label="صورة البروفايل" value={p.profileImg} onPick={f => img(f, s => upd(d => ({ ...d, profileImg: s })))} />
          <Pick label="شعار (اختياري)" value={p.logoImg} onPick={f => img(f, s => upd(d => ({ ...d, logoImg: s })))} />
          <input className="grow" value={p.pageName} placeholder="اسم الصفحة" onChange={e => upd(d => ({ ...d, pageName: e.target.value }))} /></div>
        <div className="row"><label className="btn">🎵 موسيقى خلفية<input type="file" accept="audio/*" hidden onChange={async e => { const f = e.target.files?.[0]; if (f) setMusic({ name: f.name, url: URL.createObjectURL(f), buf: await f.arrayBuffer() }) }} /></label>
          <span className="muted">{music?.name ?? 'لا توجد'}</span>{music && <button onClick={() => setMusic(null)}>✕</button>}
          <input type="range" min=".05" max="1" step=".05" value={vol} onChange={e => { setVol(+e.target.value); if (audio.current) audio.current.volume = +e.target.value }} title="مستوى الصوت" /></div>
        <h2>الممثلون ({p.actors.length}) <button className="primary" onClick={() => upd(d => ({ ...d, actors: [...d.actors, newActor()] }))}>＋ إضافة ممثل</button></h2>
        <div className="actors">{p.actors.map((a, i) => {
          const age = calcAge(a.birth, a.death)
          return <div className="card" key={a.id}>
            <div className="num">{i + 1}</div>
            <Pick label="الماضي" value={a.oldImg} onPick={f => img(f, s => setActor(a.id, { oldImg: s }))} />
            <Pick label="الحاضر" value={a.newImg} onPick={f => img(f, s => setActor(a.id, { newImg: s }))} />
            <div className="fields">
              <input value={a.name} placeholder="اسم الممثل" onChange={e => setActor(a.id, { name: e.target.value })} />
              <div className="row"><input dir="ltr" value={a.birth} placeholder="الميلاد 1960 أو 1960-05-20" onChange={e => setActor(a.id, { birth: e.target.value })} />
                <input dir="ltr" value={a.death} placeholder="الوفاة (اختياري)" onChange={e => setActor(a.id, { death: e.target.value })} /></div>
              <div className="row"><label>المدة <input type="number" min="2" max="30" step=".5" value={a.duration} onChange={e => setActor(a.id, { duration: Math.max(2, +e.target.value || 5) })} /> ث</label>
                <span className="muted">{age !== null ? `العمر: ${age}` : 'تاريخ الميلاد غير صالح'}</span>
                <span className="grow" /><button onClick={() => move(i, -1)}>▲</button><button onClick={() => move(i, 1)}>▼</button>
                <button onClick={() => upd(d => ({ ...d, actors: [...d.actors.slice(0, i + 1), { ...a, id: uid() }, ...d.actors.slice(i + 1)] }))}>⧉</button>
                <button onClick={() => upd(d => ({ ...d, actors: d.actors.filter(x => x.id !== a.id) }))}>🗑</button></div>
            </div></div>
        })}</div>
      </section>
      <section className="preview">
        <canvas ref={cv} width={W} height={H} />
        <input type="range" min="0" max={total || 1} step=".05" value={t} onChange={e => seek(+e.target.value)} />
        <div className="row"><button className="primary" onClick={() => setPlaying(!playing)}>{playing ? '⏸ إيقاف' : '▶ تشغيل'}</button>
          <span className="muted">{t.toFixed(1)} / {total.toFixed(1)} ث</span><span className="grow" />
          <button className="primary big" disabled={!!prog} onClick={doExport}>⬇ تصدير MP4 (1080×1920)</button></div>
        {prog && <div className="bar"><div style={{ width: prog.f * 100 + '%' }} /><span>{prog.label} {Math.round(prog.f * 100)}%</span></div>}
        {msg && <p className="msg">{msg}</p>}
        {!exportSupported() && <p className="msg">التصدير يتطلب Chrome أو Edge حديثاً.</p>}
        <audio ref={audio} src={music?.url} loop />
      </section>
    </main></div>
}
