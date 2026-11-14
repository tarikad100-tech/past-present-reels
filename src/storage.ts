import type { Project } from './types'
const open = () => new Promise<IDBDatabase>((res, rej) => { const r = indexedDB.open('past-present', 1); r.onupgradeneeded = () => r.result.createObjectStore('lists'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
const tx = async <T,>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) => { const db = await open(); return new Promise<T>((res, rej) => { const r = fn(db.transaction('lists', mode).objectStore('lists')); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) }) }
export const saveList = (name: string, p: Project) => tx('readwrite', s => s.put(p, name))
export const loadList = (name: string) => tx<Project | undefined>('readonly', s => s.get(name))
export const listNames = () => tx<IDBValidKey[]>('readonly', s => s.getAllKeys()).then(k => k.map(String))
export const deleteList = (name: string) => tx('readwrite', s => s.delete(name))
export function fileToDataUrl(f: File, max = 1600): Promise<string> {
  return new Promise((res, rej) => { const u = URL.createObjectURL(f), i = new Image()
    i.onload = () => { const s = Math.min(1, max / Math.max(i.width, i.height)), c = document.createElement('canvas'); c.width = i.width * s; c.height = i.height * s; c.getContext('2d')!.drawImage(i, 0, 0, c.width, c.height); URL.revokeObjectURL(u); res(c.toDataURL('image/jpeg', .9)) }
    i.onerror = () => rej(new Error('تعذر قراءة الصورة')); i.src = u })
}
