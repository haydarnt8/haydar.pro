import type * as MatterNS from 'matter-js'
import type { GsapModules } from '~/composables/useGsap'
import { cursor as C, tower as T } from '~/config/motion'

// Matter.js for the stack tower (StackTower.vue owns the markup). Bodies only write a transform relative to
// each block's stylesheet place; leaving plays the recorded fall backwards onto the marks.

type Matter = typeof MatterNS
type Gsap = GsapModules['gsap']
type Body = MatterNS.Body

let loading: Promise<Matter | null> | null = null

export function loadMatter(): Promise<Matter | null> {
  loading ??= import('matter-js')
    .then(m => ((m as unknown as { default?: Matter }).default ?? m) as Matter)
    .catch(() => null)
  return loading
}

export interface Point { x: number, y: number }

/** The stage's inside, in its own px. */
export interface Bounds { left: number, right: number, top: number, floor: number }

export interface Block {
  el: HTMLElement
  /** Its centre at rest, in the stage's px. */
  rest: Point
  size: number
}

export interface Tower {
  aim: (p: Point) => void
  lower: () => void
  grab: (p: Point) => boolean
  drag: (p: Point) => void
  release: () => void
  poke: (p: Point) => boolean
  wake: () => void
  displaced: () => boolean
  rewind: () => Promise<void>
  readonly rewinding: boolean
  destroy: () => void
}

interface Options {
  blocks: Block[]
  bounds: Bounds
  gsap: Gsap
  /** Also feel the page's scrolling (phones). */
  carried?: boolean
  onSettle?: () => void
}

const STEP = 1000 / 60

export function createTower(M: Matter, { blocks, bounds, gsap, carried = false, onSettle }: Options): Tower {
  const { Engine, Bodies, Body, Composite, Constraint, Query, Sleeping, Bounds: Box } = M
  // Typed by hand (the types lag): `updateVelocity` makes a moved static body push, not teleport.
  const place = Body.setPosition as (body: Body, position: Point, updateVelocity?: boolean) => void
  const P = T.physics

  const engine = Engine.create({
    enableSleeping: true,
    positionIterations: 10,
    velocityIterations: 8,
  })
  // Matter's gravity is a multiplier of 0.001px/ms²; the tower's is in px/s².
  engine.gravity.y = T.gravity / 1000

  const bodies: Body[] = blocks.map(({ rest, size }) => {
    const body = Bodies.rectangle(rest.x, rest.y, size, size, {
      chamfer: { radius: size * (16 / 72) },
      friction: P.friction,
      frictionStatic: P.frictionStatic,
      frictionAir: P.frictionAir,
      restitution: P.restitution,
      density: P.density,
    })
    // Asleep from the start: a body woken into a stack settles a fraction of a pixel, a visible shiver.
    Sleeping.set(body, true)
    return body
  })

  const wall = { isStatic: true, friction: P.friction, restitution: P.restitution }
  const W = bounds.right - bounds.left
  const H = bounds.floor - bounds.top
  const thick = 200
  Composite.add(engine.world, [
    ...bodies,
    Bodies.rectangle(bounds.left + W / 2, bounds.floor + thick / 2, W + thick * 2, thick, wall),
    Bodies.rectangle(bounds.left - thick / 2, bounds.top + H / 2, thick, H * 4, wall),
    Bodies.rectangle(bounds.right + thick / 2, bounds.top + H / 2, thick, H * 4, wall),
    Bodies.rectangle(bounds.left + W / 2, bounds.top - thick / 2, W + thick * 2, thick, wall),
  ])

  const n = bodies.length
  const pose = () => {
    const frame = new Float32Array(n * 3)
    bodies.forEach((b, i) => {
      frame[i * 3] = b.position.x
      frame[i * 3 + 1] = b.position.y
      frame[i * 3 + 2] = b.angle
    })
    return frame
  }
  let frames: Float32Array[] = [pose()]
  /** Real-time tape length, in ms; halving the tape changes the frames, not this. */
  let taped = 0

  function record() {
    frames.push(pose())
    if (frames.length <= T.maxFrames) return
    // Halve rather than cut: frame 0 is the built tower, where the rewind ends.
    frames = frames.filter((_, i) => i === 0 || i % 2 === 1)
  }

  function paint(x: number, y: number, a: number, i: number) {
    const { el, rest } = blocks[i]!
    const dx = x - rest.x
    const dy = y - rest.y
    el.style.transform = Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01 && Math.abs(a) < 0.0005
      ? ''
      : `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0) rotate(${a.toFixed(4)}rad)`
  }

  function render() {
    bodies.forEach((b, i) => paint(b.position.x, b.position.y, b.angle, i))
  }

  const radius = C.states.push / 2
  let hand: Body | null = null
  const target = { x: 0, y: 0 }
  const eased = { x: 0, y: 0 }
  let easeX: ((v: number) => void) | null = null
  let easeY: ((v: number) => void) | null = null
  let lastHand = { x: Number.NaN, y: Number.NaN }

  function aim(p: Point) {
    if (rewinding) return
    target.x = p.x
    target.y = p.y
    if (!hand) {
      eased.x = p.x
      eased.y = p.y
      easeX = gsap.quickTo(eased, 'x', { duration: C.follow, ease: 'power3' })
      easeY = gsap.quickTo(eased, 'y', { duration: C.follow, ease: 'power3' })
      hand = Bodies.circle(p.x, p.y, radius, { isStatic: true, isSensor: true, friction: P.friction })
      Composite.add(engine.world, hand)
    }
    easeX?.(p.x)
    easeY?.(p.y)
    wake()
  }

  function lower() {
    if (!hand) return
    Composite.remove(engine.world, hand)
    hand = null
    easeX = easeY = null
  }

  let hold: MatterNS.Constraint | null = null

  const under = (p: Point) => Query.point(bodies, p)[0] ?? null

  function grab(p: Point) {
    if (rewinding) return false
    const body = under(p)
    if (!body) return false
    Sleeping.set(body, false)
    hold = Constraint.create({
      pointA: { x: p.x, y: p.y },
      bodyB: body,
      pointB: { x: p.x - body.position.x, y: p.y - body.position.y },
      stiffness: 0.18,
      damping: 0.12,
      length: 0,
    })
    Composite.add(engine.world, hold)
    // The hand would fight the block it is holding.
    if (hand) hand.isSensor = true
    wake()
    return true
  }

  function drag(p: Point) {
    if (!hold) return
    hold.pointA = { x: p.x, y: p.y }
    wake()
  }

  function release() {
    if (!hold) return
    Composite.remove(engine.world, hold)
    hold = null
    wake()
  }

  function poke(p: Point) {
    if (rewinding) return false
    const body = under(p)
    if (!body) return false
    Sleeping.set(body, false)
    const side = Math.sign(body.position.x - p.x) || (Math.random() < 0.5 ? -1 : 1)
    Body.setVelocity(body, {
      x: body.velocity.x + side * T.poke.spread,
      y: body.velocity.y - T.poke.lift,
    })
    Body.setAngularVelocity(body, body.angularVelocity + side * 0.08)
    wake()
    return true
  }

  let scrollY = carried ? window.scrollY : 0
  let scrollV = 0
  let felt = 0
  let primed = false
  /** Listen until then (ms) after the last scroll: a fling's stop is felt most, and stops send no events. */
  let carryUntil = 0

  // A body in the card feels +scrollY'' (down the screen): a stopping fling throws the blocks up.
  function carry(dtMs: number) {
    const y = window.scrollY
    const dt = dtMs / 1000
    // Smoothed: a phone's uneven scroll steps would differentiate into noise.
    const raw = (y - scrollY) / dt
    scrollY = y
    if (!primed) {
      scrollV = raw
      primed = true
      felt = 0
      return
    }
    const v = scrollV + (raw - scrollV) * 0.25
    const a = (v - scrollV) / dt
    scrollV = v
    felt = Math.max(-T.shake.max, Math.min(T.shake.max, a * T.shake.gain))
    // Lift only: a hard press sinks the stack into its floor and Matter springs it back, a hop.
    if (felt > -T.shake.wake) return
    for (const b of bodies) {
      if (b.isSleeping) Sleeping.set(b, false)
      // Matter integrates force / mass over ms²: px/s² → px/ms².
      Body.applyForce(b, b.position, { x: 0, y: b.mass * felt / 1e6 })
    }
  }

  let running = false
  let rewinding = false
  let rewindTween: ReturnType<Gsap['to']> | null = null

  function wake() {
    if (carried) carryUntil = performance.now() + 300
    if (running || rewinding) return
    running = true
    if (carried) {
      scrollY = window.scrollY
      scrollV = 0
      primed = false
    }
    gsap.ticker.add(tick)
  }

  function sleep() {
    running = false
    gsap.ticker.remove(tick)
  }

  const moving = () => bodies.some(b => !b.isSleeping)

  function step(dt: number) {
    if (hand) {
      place(hand, { x: eased.x, y: eased.y }, true)
      // A hand that appears inside a block stays a sensor until clear, or it fires the block out.
      if (hand.isSensor && !hold && !Query.collides(hand, bodies).length) hand.isSensor = false
      if (!hand.isSensor) {
        // Matter never lets a static body wake a sleeping one, so the hand does it.
        const reach = Box.create([
          { x: eased.x - radius - 2, y: eased.y - radius - 2 },
          { x: eased.x + radius + 2, y: eased.y + radius + 2 },
        ])
        for (const b of Query.region(bodies, reach)) if (b.isSleeping) Sleeping.set(b, false)
      }
    }
    Engine.update(engine, dt)
    contain()
  }

  /** A body thrown hard enough can tunnel a wall; put it back. */
  function contain() {
    for (const b of bodies) {
      const { x, y } = b.position
      if (x > bounds.left && x < bounds.right && y > bounds.top - 1 && y < bounds.floor + 1) continue
      Body.setPosition(b, {
        x: Math.min(bounds.right - 20, Math.max(bounds.left + 20, x)),
        y: Math.min(bounds.floor - 20, Math.max(bounds.top + 20, y)),
      })
      Body.setVelocity(b, { x: 0, y: 0 })
    }
  }

  function tick(_time: number, deltaMs: number) {
    // A hidden tab resumes with a huge delta.
    const dt = Math.min(Math.max(deltaMs, 4), 1000 / 30)
    if (carried) carry(dt)
    const steps = dt > STEP * 1.2 ? 2 : 1
    for (let s = 0; s < steps; s++) step(dt / steps)

    const handMoved = hand ? Math.abs(eased.x - lastHand.x) + Math.abs(eased.y - lastHand.y) > 0.05 : false
    if (hand) lastHand = { x: eased.x, y: eased.y }

    if (moving() || hold) {
      record()
      taped += dt
    }
    render()

    const carrying = carried && performance.now() < carryUntil
    if (!moving() && !hold && !handMoved && !carrying && Math.abs(felt) < T.shake.wake) {
      sleep()
      onSettle?.()
    }
  }

  function displaced() {
    return bodies.some((b, i) => {
      const { rest } = blocks[i]!
      return Math.abs(b.position.x - rest.x) > 1 || Math.abs(b.position.y - rest.y) > 1 || Math.abs(b.angle) > 0.01
    })
  }

  function home() {
    bodies.forEach((b, i) => {
      Body.setPosition(b, blocks[i]!.rest)
      Body.setAngle(b, 0)
      Body.setVelocity(b, { x: 0, y: 0 })
      Body.setAngularVelocity(b, 0)
      Sleeping.set(b, true)
    })
    frames = [pose()]
    taped = 0
    for (const { el } of blocks) el.style.removeProperty('transform')
  }

  function rewind(): Promise<void> {
    if (rewinding) return Promise.resolve()
    release()
    lower()
    sleep()

    const tape = [...frames, pose()]
    if (tape.length < 3 || !displaced()) {
      home()
      return Promise.resolve()
    }

    rewinding = true
    const last = tape.length - 1
    const head = { t: last }
    const duration = Math.min(T.rewind.max, Math.max(T.rewind.min, taped / 1000 / T.rewind.speed))

    return new Promise((resolve) => {
      rewindTween = gsap.to(head, {
        t: 0,
        duration,
        ease: T.rewind.ease,
        onUpdate: () => {
          const i = Math.min(last - 1, Math.floor(head.t))
          const f = head.t - i
          const a = tape[i]!
          const b = tape[i + 1]!
          for (let k = 0; k < n; k++) {
            const o = k * 3
            paint(
              a[o]! + (b[o]! - a[o]!) * f,
              a[o + 1]! + (b[o + 1]! - a[o + 1]!) * f,
              a[o + 2]! + (b[o + 2]! - a[o + 2]!) * f,
              k,
            )
          }
        },
        onComplete: () => {
          rewinding = false
          rewindTween = null
          home()
          resolve()
        },
      })
    })
  }

  function destroy() {
    sleep()
    rewindTween?.progress(1)
    rewindTween?.kill()
    rewinding = false
    lower()
    release()
    Composite.clear(engine.world, false)
    Engine.clear(engine)
    for (const { el } of blocks) el.style.removeProperty('transform')
  }

  return {
    aim,
    lower,
    grab,
    drag,
    release,
    poke,
    wake,
    displaced,
    rewind,
    get rewinding() { return rewinding },
    destroy,
  }
}
