// app/router.options.ts takes over scrollBehavior, so nothing restores scroll unless the curtain applies this stash.
export interface ScrollTarget {
  top: number
  left: number
  hash: string
}

let stashed: ScrollTarget | null = null

export function stashScroll(target: ScrollTarget) {
  stashed = target
}

export function takeScroll(): ScrollTarget | null {
  const target = stashed
  stashed = null
  return target
}
