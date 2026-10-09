import type { Lang } from '~/types/portfolio'
import { contentFor } from '~/utils/content'

// Keyed on the i18n-stripped route base name, so /about and /ar/about match.
export interface PageTitle {
  label: string
  title: string
}

type Translate = (key: string, named?: Record<string, unknown>) => string

export function pageTitle(
  baseName: string | null | undefined,
  params: Record<string, unknown>,
  t: Translate,
  lang: Lang,
): PageTitle {
  const { profile, projectBySlug } = contentFor(lang)
  switch (baseName) {
    case 'index':
      return {
        label: profile.name,
        title: t('meta.homeTitle', { name: profile.name }),
      }

    case 'about':
      return {
        label: t('sections.about'),
        title: t('meta.aboutTitle', { name: profile.name }),
      }

    case 'projects':
      return {
        label: t('sections.projects'),
        title: t('meta.projectsTitle', { name: profile.name }),
      }

    case 'projects-slug': {
      const project = projectBySlug(String(params.slug ?? ''))
      if (!project) return notFound(t)
      return {
        label: project.title,
        title: t('meta.projectTitle', { title: project.title, name: profile.name }),
      }
    }

    default:
      return notFound(t)
  }
}

function notFound(t: Translate): PageTitle {
  return { label: '404', title: t('meta.notFoundTitle', { status: 404 }) }
}
