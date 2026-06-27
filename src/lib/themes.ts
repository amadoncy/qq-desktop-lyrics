export interface ThemePreset {
  id: string;
  name: string;
  nameZh: string;
  background: string;
  accent: string;
  cool: string;
  warm: string;
  /** 未唱字颜色 */
  pendingLyric: string;
  /** 已唱字颜色 */
  sungLyric: string;
}

export const BUILT_IN_THEMES: ThemePreset[] = [
  {
    id: 'nocturnal',
    name: 'Nocturnal',
    nameZh: '深海月夜',
    background: '#020408',
    accent: '#33e6ff',
    cool: '#004dff',
    warm: '#ff3319',
    pendingLyric: 'rgba(255,255,255,0.36)',
    sungLyric: '#33e6ff',
  },
  {
    id: 'neon-tokyo',
    name: 'Neon Tokyo',
    nameZh: '霓虹东京',
    background: '#0a0210',
    accent: '#ff66cc',
    cool: '#ff1a99',
    warm: '#1affcc',
    pendingLyric: 'rgba(255,200,240,0.38)',
    sungLyric: '#ff99dd',
  },
  {
    id: 'cyber-forest',
    name: 'Cyber Forest',
    nameZh: '赛博森林',
    background: '#020804',
    accent: '#99ff4d',
    cool: '#1aff80',
    warm: '#ccff1a',
    pendingLyric: 'rgba(180,255,160,0.35)',
    sungLyric: '#b8ff66',
  },
  {
    id: 'minimal-monochrome',
    name: 'Minimal Monochrome',
    nameZh: '极简黑白',
    background: '#050505',
    accent: '#ffffff',
    cool: '#e6e6e6',
    warm: '#ffffff',
    pendingLyric: 'rgba(255,255,255,0.32)',
    sungLyric: '#f5f5f5',
  },
  {
    id: 'twilight-rose',
    name: 'Twilight Rose',
    nameZh: '暮光玫瑰',
    background: '#12040c',
    accent: '#ff8fab',
    cool: '#7c3aed',
    warm: '#fb7185',
    pendingLyric: 'rgba(255,180,200,0.38)',
    sungLyric: '#ffb3c6',
  },
  {
    id: 'amber-noon',
    name: 'Amber Noon',
    nameZh: '琥珀午后',
    background: '#100804',
    accent: '#fbbf24',
    cool: '#f97316',
    warm: '#fde047',
    pendingLyric: 'rgba(255,220,160,0.38)',
    sungLyric: '#fcd34d',
  },
  {
    id: 'mint-dawn',
    name: 'Mint Dawn',
    nameZh: '薄荷清晨',
    background: '#031008',
    accent: '#5eead4',
    cool: '#14b8a6',
    warm: '#a7f3d0',
    pendingLyric: 'rgba(160,240,220,0.36)',
    sungLyric: '#99f6e4',
  },
  {
    id: 'cyber-violet',
    name: 'Cyber Violet',
    nameZh: '赛博紫境',
    background: '#08051a',
    accent: '#c084fc',
    cool: '#6366f1',
    warm: '#e879f9',
    pendingLyric: 'rgba(210,180,255,0.38)',
    sungLyric: '#d8b4fe',
  },
  {
    id: 'sakura-snow',
    name: 'Sakura Snow',
    nameZh: '樱花飘雪',
    background: '#100810',
    accent: '#fda4af',
    cool: '#f9a8d4',
    warm: '#fecdd3',
    pendingLyric: 'rgba(255,200,210,0.38)',
    sungLyric: '#fecdd3',
  },
  {
    id: 'indigo-stars',
    name: 'Indigo Stars',
    nameZh: '靛蓝星空',
    background: '#030818',
    accent: '#818cf8',
    cool: '#312e81',
    warm: '#60a5fa',
    pendingLyric: 'rgba(180,200,255,0.36)',
    sungLyric: '#a5b4fc',
  },
  {
    id: 'sunset-wave',
    name: 'Sunset Wave',
    nameZh: '落日余晖',
    background: '#0c0608',
    accent: '#fb923c',
    cool: '#dc2626',
    warm: '#fbbf24',
    pendingLyric: 'rgba(255,200,150,0.38)',
    sungLyric: '#fdba74',
  },
  {
    id: 'glacier-blue',
    name: 'Glacier Blue',
    nameZh: '冰川之蓝',
    background: '#020a12',
    accent: '#7dd3fc',
    cool: '#0ea5e9',
    warm: '#e0f2fe',
    pendingLyric: 'rgba(180,220,255,0.36)',
    sungLyric: '#bae6fd',
  },
];

export function getThemeById(themeId: string): ThemePreset {
  return BUILT_IN_THEMES.find((theme) => theme.id === themeId) ?? BUILT_IN_THEMES[0];
}
