import type { Authored, Experience } from '~/types/portfolio'

// Bullets are verbatim from the CV (the Arabic translates, never rewrites); `employmentType` only where the CV states it.
export const experience: Authored<Experience>[] = [
  {
    id: 'transforat',
    role: { en: 'Frontend Developer', ar: 'مطور واجهات أمامية' },
    company: 'TransForat',
    location: { en: 'Al Mansour, Baghdad', ar: 'المنصور، بغداد' },
    period: { start: '2026-02', end: null },
    highlights: [
      {
        en: 'Develop and maintain modern, responsive user interfaces for corporate platforms and event management dashboards.',
        ar: 'تطوير واجهات مستخدم حديثة ومتجاوبة وصيانتها لمنصات الشركات ولوحات تحكم إدارة الفعاليات.',
      },
      {
        en: 'Collaborate with design and backend teams to implement features for the Gudea Event Dashboard, optimizing for performance and seamless usability.',
        ar: 'التعاون مع فريقي التصميم والواجهات الخلفية لتنفيذ ميزات لوحة تحكم فعاليات Gudea، مع تحسين الأداء وسلاسة الاستخدام.',
      },
    ],
  },
  {
    id: 'health360',
    role: { en: 'Frontend Developer', ar: 'مطور واجهات أمامية' },
    company: 'Health360',
    location: { en: 'Zayouna, Baghdad', ar: 'زيونة، بغداد' },
    period: { start: '2025-09', end: null },
    employmentType: 'part-time',
    arrangement: 'remote',
    highlights: [
      {
        en: 'Develop and maintain scalable and responsive web applications using Vue.js.',
        ar: 'تطوير تطبيقات ويب قابلة للتوسع ومتجاوبة وصيانتها باستخدام Vue.js.',
      },
      {
        en: 'Utilize Pinia for efficient state management and integrate Axios / TanStack Query to handle API requests.',
        ar: 'استخدام Pinia لإدارة الحالة بكفاءة، ودمج Axios وTanStack Query لمعالجة طلبات الواجهات البرمجية (API).',
      },
    ],
    note: {
      en: 'Part-time and fully remote since February 2026, alongside the role at TransForat.',
      ar: 'بدوام جزئي وعن بعد بالكامل منذ شباط 2026، إلى جانب العمل في TransForat.',
    },
  },
  {
    id: 'al-muraba',
    role: { en: 'Frontend Developer', ar: 'مطور واجهات أمامية' },
    company: 'AL Muraba for Information Technology',
    location: { en: 'Al Mansour, Baghdad', ar: 'المنصور، بغداد' },
    period: { start: '2023-10', end: '2025-09' },
    highlights: [
      {
        en: 'Develop and maintain scalable and responsive web applications using Vue.js.',
        ar: 'تطوير تطبيقات ويب قابلة للتوسع ومتجاوبة وصيانتها باستخدام Vue.js.',
      },
      {
        en: 'Utilized Pinia for efficient state management and Axios/TanStack Query for handling API requests.',
        ar: 'استخدام Pinia لإدارة الحالة بكفاءة، وAxios وTanStack Query لمعالجة طلبات الواجهات البرمجية (API).',
      },
      {
        en: 'Collaborated on projects including ERP systems, DMIS systems, and CMS platforms. Implemented reusable components and libraries to streamline development processes.',
        ar: 'المشاركة في مشاريع شملت أنظمة ERP وأنظمة DMIS ومنصات إدارة المحتوى (CMS)، وبناء مكونات ومكتبات قابلة لإعادة الاستخدام لتبسيط عمليات التطوير.',
      },
    ],
  },
  {
    id: 'freelance',
    role: { en: 'Freelance Frontend Developer', ar: 'مطور واجهات أمامية فري لانس' },
    period: { start: '2023-05', end: '2023-10' },
    employmentType: 'freelance',
    highlights: [
      {
        en: 'Delivered a market store web design to showcase products.',
        ar: 'تسليم تصميم موقع لمتجر إلكتروني لعرض المنتجات.',
      },
      {
        en: 'Worked on a small-scale project tailored to client needs.',
        ar: 'العمل على مشروع صغير مصمم وفق احتياجات العميل.',
      },
    ],
  },
]
