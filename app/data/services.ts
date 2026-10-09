import type { Authored, Service } from '~/types/portfolio'

export const services: Authored<Service>[] = [
  {
    id: 'dashboards',
    title: { en: 'Dashboards and admin panels', ar: 'لوحات تحكم وإدارة' },
    description: {
      en: 'I build the screens teams work in all day: tables whose filters stay in the link, detail pages, approvals and statistics.',
      ar: 'أسوي الشاشات اللي الفريق يشتغل عليها طول اليوم: جداول فلاترها محفوظة بالرابط، وصفحات تفاصيل، وموافقات، وإحصائيات.',
    },
  },
  {
    id: 'arabic-first',
    title: { en: 'Arabic-first interfaces', ar: 'واجهات عربية أولا' },
    description: {
      en: 'Right-to-left layouts that feel native in Arabic and work just as well in English, in light and dark themes.',
      ar: 'تصاميم من اليمين لليسار تبين طبيعية بالعربي وتمشي زينة بالإنكليزي هم، بالوضع الفاتح والداكن.',
    },
  },
  {
    id: 'permissions',
    title: { en: 'Roles and permissions', ar: 'الأدوار والصلاحيات' },
    description: {
      en: 'Pages, menus and buttons all check the same access rules, so each person sees exactly what their role allows.',
      ar: 'الصفحات والقوائم والأزرار كلها تفحص نفس القواعد، فكل واحد يشوف بالضبط اللي يسمحله بيه دوره.',
    },
  },
  {
    id: 'every-screen',
    title: { en: 'Fast on every screen', ar: 'سريعة على كل شاشة' },
    description: {
      en: 'A real phone layout for every list and detail page, not a squeezed desktop, with lazy loading and code splitting so it opens fast.',
      ar: 'تصميم خاص للموبايل لكل قائمة وصفحة تفاصيل، مو ديسكتوب مضغوط، ويا تحميل مؤجل وتقسيم للشيفرة حتى تفتح بسرعة.',
    },
  },
]
