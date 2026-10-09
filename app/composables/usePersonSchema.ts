import { isTodo } from '~/types/portfolio'

export function usePersonSchema() {
  const site = useSiteConfig()
  const { locale, t } = useI18n()
  const content = useContent()

  // Built inside the head getter: the locale can change after setup, mid-navigation.
  const schema = () => {
    const { profile, experience, education, skillGroups } = content
    const sameAs = profile.socials
      .filter(s => !isTodo(s.href) && !s.blocked && !/^(mailto|tel):/.test(s.href))
      // Drop the query: WhatsApp's carries a prefilled message, not the profile.
      .map(s => s.href.split('?')[0])
    const current = experience.filter(e => e.period.end === null && e.company)
    return {
      '@context': 'https://schema.org',
      '@type': 'Person',
      'name': profile.name,
      'inLanguage': locale.value,
      'email': `mailto:${profile.email}`,
      'telephone': `+${profile.phone.replace(/\D/g, '')}`,
      'jobTitle': t('meta.jobTitle'),
      'url': site.url,
      'address': {
        '@type': 'PostalAddress',
        'addressLocality': profile.location,
        'addressCountry': 'IQ',
      },
      'description': profile.summary,
      ...(sameAs.length ? { sameAs } : {}),
      ...(current.length
        ? { worksFor: current.map(e => ({ '@type': 'Organization', 'name': e.company })) }
        : {}),
      'alumniOf': education.map(e => ({
        '@type': 'EducationalOrganization',
        'name': e.institution,
      })),
      'knowsAbout': skillGroups
        .filter(g => !['soft', 'performance'].includes(g.id))
        .flatMap(g => g.items),
    }
  }

  useHead(() => ({
    script: [{ type: 'application/ld+json', innerHTML: JSON.stringify(schema()) }],
  }))
}
