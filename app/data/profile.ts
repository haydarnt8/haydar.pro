import type { Authored, Profile, SocialLink } from '~/types/portfolio'

const PHONE = '+964 7826665785'

export const phoneHref = `tel:+${PHONE.replace(/\D/g, '')}`

// wa.me needs the number in digits; a username does not resolve.
const whatsapp = (text: string) => `https://wa.me/${PHONE.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`

// brandColor is the hover fill: each platform's own brand hex, deliberately raw.
export const socials: Authored<SocialLink>[] = [
  {
    id: 'github',
    label: 'GitHub',
    href: 'https://github.com/haydarnt8',
    icon: 'ph:github-logo',
    brandColor: '#181717',
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/in/haydar-yosef',
    icon: 'ph:linkedin-logo',
    brandColor: '#0a66c2',
  },
  {
    id: 'email',
    label: { en: 'Email', ar: 'الإيميل' },
    href: 'mailto:haydarnt8@gmail.com',
    icon: 'ph:envelope',
    brandColor: '#ea4335',
  },
  // The icon says nothing alone, so the screen-reader label carries the number.
  // Blue, not green: WhatsApp's green is the tile beside it.
  {
    id: 'phone',
    label: { en: `Call ${PHONE}`, ar: `خابرني على ${PHONE}` },
    href: phoneHref,
    icon: 'ph:phone',
    brandColor: '#007aff',
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    href: {
      en: whatsapp('Hi Haydar, I saw your portfolio and wanted to get in touch'),
      ar: whatsapp('هلا حيدر، شفت موقعك وحاب أتواصل وياك'),
    },
    icon: 'ph:whatsapp-logo',
    brandColor: '#25d366',
  },
  {
    id: 'instagram',
    label: 'Instagram',
    href: 'https://www.instagram.com/q58s',
    icon: 'ph:instagram-logo',
    brandColor: '#833ab4',
  },
]

export const profile: Authored<Profile> = {
  // Latin in both languages: the intro draws it and lands the signature on it.
  name: 'Haydar',
  email: 'haydarnt8@gmail.com',
  phone: PHONE,
  location: { en: 'Baghdad, Al-Kadhimiya', ar: 'بغداد، الكاظمية' },
  // Its first sentence is the meta description, so it must stand on its own.
  summary: {
    en: 'I’m an experienced frontend developer who builds scalable, responsive web apps with Vue.js '
      + 'and modern web technologies. I connect them to APIs with Axios, manage their state with Pinia, '
      + 'design them for every screen size, and tune their performance so they feel fast and polished.',
    ar: 'اني مطور واجهات أمامية عندي خبرة، أسوي تطبيقات ويب تتوسع وتمشي على كل الشاشات '
      + 'بـ Vue.js وأحدث تقنيات الويب. أربطها بالـ API عن طريق Axios، وأدير الستيت مالتها بـ Pinia، '
      + 'وأصممها تناسب كل حجم شاشة، وأضبط أداءها حتى تطلع سريعة ومرتبة.',
  },
  // Keep it short: a longer line wraps to three lines at 1440px.
  tagline: {
    en: 'Frontend developer in Baghdad. I build apps with Vue.js.',
    ar: 'أشتغل مطور واجهات ببغداد، أسوي تطبيقات Vue.js.',
  },
  // Two lines at most: the card has a fixed height in the pinned bento.
  aboutTeaser: {
    en: 'I’ve worked on dashboards since 2023.',
    ar: 'من 2023 واني أشتغل على لوحات تحكم.',
  },
  photo: '/portrait-720.webp',
  socials,
}

