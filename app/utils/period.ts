import type { Period, YearMonth } from '~/types/portfolio'

const EN_DASH = '–'

export function periodYear(month: YearMonth): number {
  return Number.parseInt(month.slice(0, 4), 10)
}

export interface FormatPeriodOptions {
  /** A pure util has no i18n: callers pass the localised label. */
  presentLabel?: string
  showStartWhenOngoing?: boolean
}

export function formatPeriod(period: Period, options: FormatPeriodOptions = {}): string {
  const { presentLabel = 'Current', showStartWhenOngoing = false } = options
  const start = periodYear(period.start)

  if (period.end === null) {
    return showStartWhenOngoing ? `${start} ${EN_DASH} ${presentLabel}` : presentLabel
  }

  const end = periodYear(period.end)
  return start === end ? `${start}` : `${start} ${EN_DASH} ${end}`
}

/** For `<time datetime>`; keeps the month precision `formatPeriod` drops. */
export function periodDateTime(period: Period): string {
  return period.end === null ? period.start : `${period.start}/${period.end}`
}

export function byRecency(a: { period: Period }, b: { period: Period }): number {
  if ((a.period.end === null) !== (b.period.end === null)) {
    return a.period.end === null ? -1 : 1
  }
  return b.period.start.localeCompare(a.period.start)
}
