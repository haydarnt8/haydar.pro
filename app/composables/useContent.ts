import type { Content } from '~/utils/content'
import { contentFor, langOf } from '~/utils/content'

// Getters, not a snapshot: a language switch changes the locale under mounted components.
// Read it as `content.profile`; never destructure it at setup.
export function useContent(): Readonly<Content> {
  const { locale } = useI18n()
  const now = () => contentFor(langOf(locale.value))
  return {
    get lang() { return now().lang },
    get profile() { return now().profile },
    get experience() { return now().experience },
    get education() { return now().education },
    get skillGroups() { return now().skillGroups },
    get stack() { return now().stack },
    get projects() { return now().projects },
    get featuredProjects() { return now().featuredProjects },
    get services() { return now().services },
    get gallery() { return now().gallery },
    get socials() { return now().socials },
    projectBySlug: (slug: string) => now().projectBySlug(slug),
  }
}
