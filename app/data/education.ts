import type { Authored, Education } from '~/types/portfolio'

export const education: Authored<Education>[] = [
  {
    id: 'university-of-technology',
    institution: { en: 'University of Technology', ar: 'الجامعة التكنولوجية' },
    credential: { en: "Bachelor's Degree, Computer Science", ar: 'بكالوريوس في علوم الحاسوب' },
    year: 2023,
  },
  {
    id: 'computiq',
    institution: { en: 'Computiq (Harvard University Course)', ar: 'Computiq (دورة من جامعة هارفارد)' },
    // Verbatim from the CV; not ours to correct.
    credential: 'Web50x',
    year: 2023,
  },
]
