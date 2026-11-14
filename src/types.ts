export interface Actor { id: string; name: string; birth: string; death: string; oldImg: string; newImg: string; duration: number }
export interface Project { pageName: string; profileImg: string; logoImg: string; actors: Actor[] }
export const emptyProject: Project = { pageName: 'اسم الصفحة', profileImg: '', logoImg: '', actors: [] }
export const uid = () => Math.random().toString(36).slice(2, 10)
