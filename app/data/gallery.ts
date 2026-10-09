import type { Authored } from '~/types/portfolio'

export interface GalleryImage {
  id: string
  src: string | null
  alt: string
  /** `object-position` for the crop: below 1200px the frame is square, so keep the face in. */
  focus?: string
}

// Published as WebP with all metadata stripped: the originals carried GPS positions.
export const gallery: Authored<GalleryImage>[] = [
  {
    id: 'garden',
    src: '/photos/garden.webp',
    alt: { en: 'Haydar sitting on a lit marble ledge in a garden at night', ar: 'حيدر كاعد على حافة رخام مضوية بحديقة بالليل' },
    focus: '60% 25%',
  },
  {
    id: 'cafe',
    src: '/photos/cafe.webp',
    alt: { en: 'Haydar at a café railing with an iced drink', ar: 'حيدر واكف يم الحاجز بكافيه وبيده عصير بارد' },
    focus: '50% 25%',
  },
  {
    id: 'quad',
    src: '/photos/quad.webp',
    alt: { en: 'Haydar on a quad bike in the mountains, giving a thumbs up', ar: 'حيدر على دراجة رباعية بالجبل ورافع ابهامه' },
    focus: '55% 20%',
  },
]
