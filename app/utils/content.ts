import * as data from '~/data'
import type { GalleryImage } from '~/data'
import type { Education, Experience, Lang, Profile, Project, Service, SkillGroup, SocialLink, StackItem } from '~/types/portfolio'
import { localize } from '~/types/portfolio'

export interface Content {
  lang: Lang
  profile: Profile
  experience: Experience[]
  education: Education[]
  skillGroups: SkillGroup[]
  stack: StackItem[]
  projects: Project[]
  featuredProjects: Project[]
  services: Service[]
  gallery: GalleryImage[]
  socials: SocialLink[]
  projectBySlug: (slug: string) => Project | undefined
}

function build(lang: Lang): Content {
  const projects = localize<Project[]>(data.projects, lang)
  return {
    lang,
    profile: localize<Profile>(data.profile, lang),
    experience: localize<Experience[]>(data.experience, lang),
    education: localize<Education[]>(data.education, lang),
    skillGroups: localize<SkillGroup[]>(data.skillGroups, lang),
    stack: localize<StackItem[]>(data.stack, lang),
    projects,
    featuredProjects: projects.slice(0, data.FEATURED),
    services: localize<Service[]>(data.services, lang),
    gallery: localize<GalleryImage[]>(data.gallery, lang),
    socials: localize<SocialLink[]>(data.socials, lang),
    projectBySlug: slug => projects.find(p => p.slug === slug),
  }
}

const views: Partial<Record<Lang, Content>> = {}

export function contentFor(lang: Lang): Content {
  return (views[lang] ??= build(lang))
}

export function langOf(locale: string | null | undefined): Lang {
  return locale === 'ar' ? 'ar' : 'en'
}
