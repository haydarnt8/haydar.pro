import type { Authored, SkillGroup, StackItem } from '~/types/portfolio'

export const skillGroups: Authored<SkillGroup>[] = [
  {
    id: 'frontend',
    label: { en: 'Frontend Technologies', ar: 'تقنيات الواجهات الأمامية' },
    items: ['HTML', 'CSS', 'JavaScript', 'TypeScript', 'Vue.js', 'React.js', 'Nuxt.js'],
  },
  { id: 'state', label: { en: 'State Management', ar: 'إدارة الحالة' }, items: ['Pinia', 'Redux'] },
  { id: 'http', label: { en: 'HTTP Libraries', ar: 'مكتبات HTTP' }, items: ['Axios', 'TanStack Query'] },
  { id: 'ui', label: { en: 'UI Libraries', ar: 'مكتبات واجهات المستخدم' }, items: ['Vuetify', 'Tailwind'] },
  { id: 'services', label: { en: 'Services', ar: 'الخدمات' }, items: ['Firebase', 'Netlify'] },
  { id: 'tools', label: { en: 'Tools', ar: 'الأدوات' }, items: ['GitHub', 'Vite', 'Figma', 'Postman'] },
  {
    id: 'performance',
    label: { en: 'Performance Optimization', ar: 'تحسين الأداء' },
    items: [
      { en: 'Lazy loading', ar: 'التحميل المؤجل' },
      { en: 'Code splitting', ar: 'تقسيم الشيفرة' },
    ],
  },
  {
    id: 'soft',
    label: { en: 'Soft Skills', ar: 'المهارات الشخصية' },
    items: [
      { en: 'Problem-solving', ar: 'حل المشكلات' },
      { en: 'team collaboration', ar: 'العمل الجماعي' },
      { en: 'adaptability', ar: 'القدرة على التكيف' },
    ],
  },
]

// Marks, not wordmarks (a block is square). Axios has only a wordmark in `logos`, so it uses
// Simple Icons in its own purple; GitHub uses `ph` so it takes the page's ink on a dark block.
export const stack: StackItem[] = [
  { id: 'html', label: 'HTML', icon: 'logos:html-5' },
  { id: 'css', label: 'CSS', icon: 'logos:css-3' },
  { id: 'javascript', label: 'JavaScript', icon: 'logos:javascript' },
  { id: 'typescript', label: 'TypeScript', icon: 'logos:typescript-icon' },
  { id: 'vue', label: 'Vue.js', icon: 'logos:vue' },
  { id: 'react', label: 'React.js', icon: 'logos:react' },
  { id: 'nuxt', label: 'Nuxt.js', icon: 'logos:nuxt-icon' },
  { id: 'pinia', label: 'Pinia', icon: 'logos:pinia' },
  { id: 'redux', label: 'Redux', icon: 'logos:redux' },
  { id: 'axios', label: 'Axios', icon: 'simple-icons:axios', color: '#5a29e4' },
  { id: 'tanstack-query', label: 'TanStack Query', icon: 'logos:react-query-icon' },
  { id: 'vuetify', label: 'Vuetify', icon: 'logos:vuetifyjs' },
  { id: 'tailwind', label: 'Tailwind', icon: 'logos:tailwindcss-icon' },
  { id: 'firebase', label: 'Firebase', icon: 'logos:firebase-icon' },
  { id: 'netlify', label: 'Netlify', icon: 'logos:netlify-icon' },
  { id: 'github', label: 'GitHub', icon: 'ph:github-logo-fill' },
  { id: 'vite', label: 'Vite', icon: 'logos:vitejs' },
  { id: 'figma', label: 'Figma', icon: 'logos:figma' },
  { id: 'postman', label: 'Postman', icon: 'logos:postman-icon' },
]

/** The tower's courses by CV group, base first; tiles are looked up in `stack` by label. */
const COURSES = [['frontend'], ['state', 'http'], ['ui', 'services'], ['tools']]

const named = (item: Authored<string>) => (typeof item === 'string' ? item : item.en)

export const towerCourses: string[][] = COURSES.map(groups => groups.flatMap((id) => {
  const group = skillGroups.find(g => g.id === id)
  return (group?.items ?? [])
    .map(item => stack.find(tile => tile.label === named(item))?.id)
    .filter((tile): tile is string => Boolean(tile))
}))
