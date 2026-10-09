<script setup lang="ts">
import { contact as C } from '~/config/motion'
import { LANDED } from '~/composables/useReveal'

const content = useContent()

// Email, then message, in one slot: every state has the same footprint (the row cannot grow).
// `novalidate`: only the field in the slot is checked, with setCustomValidity in the page's language.
const { web3formsKey } = useRuntimeConfig().public
const { t, locale } = useI18n()

type Step = 'email' | 'message' | 'sending' | 'sent' | 'failed'
const step = ref<Step>('email')

const email = ref('')
const message = ref('')
/** Web3Forms' honeypot: people never tick it, bots do. */
const botcheck = ref(false)

const MESSAGE_MAX = 500
const TIMEOUT_MS = 15_000

const field = computed(() => (step.value === 'email' ? 'email' : 'message'))
const stage = computed(() => (step.value === 'sent' || step.value === 'failed' ? step.value : 'form'))
const head = computed(() => (step.value === 'sent' ? 'thanks' : 'ask'))

const buttonLabel = computed(() => {
  if (step.value === 'email') return t('contact.next')
  if (step.value === 'message') return t('contact.send')
  return t('contact.sending')
})
const labelEl = ref<HTMLElement | null>(null)
const { swapTo } = useTextSwap(labelEl)

watch(buttonLabel, async (_now, before) => {
  await nextTick()
  void swapTo(before)
})

/** The live region is always rendered: one inserted together with its text is often not announced. */
const announcement = computed(() => {
  if (step.value === 'sending') return t('contact.sending')
  if (step.value === 'sent') return `${t('contact.sent')} ${t('contact.replyTo', { email: email.value.trim() })}`
  if (step.value === 'failed') return `${t('contact.failedLead')} ${content.profile.email} ${t('contact.failedTail')}`
  return ''
})

const formEl = ref<HTMLFormElement | null>(null)
const stageEl = ref<HTMLElement | null>(null)
const rowEl = ref<HTMLElement | null>(null)
const fieldsEl = ref<HTMLElement | null>(null)
const emailLayer = ref<HTMLElement | null>(null)
const messageLayer = ref<HTMLElement | null>(null)
const emailInput = ref<HTMLInputElement | null>(null)
const messageInput = ref<HTMLInputElement | null>(null)
const sentEl = ref<HTMLElement | null>(null)
const failedEl = ref<HTMLElement | null>(null)
const headEl = ref<HTMLElement | null>(null)
const askEl = ref<HTMLElement | null>(null)
const thanksEl = ref<HTMLElement | null>(null)
const emailPrompt = ref<HTMLElement | null>(null)
const submitInk = ref<{ pulse: () => void } | null>(null)

const motion = useContactMotion()

const ready = { email: false, message: false }

function onType(which: 'email' | 'message', event: Event) {
  const input = event.target as HTMLInputElement
  // A custom message sticks until it is cleared, so every keystroke clears it.
  input.setCustomValidity('')
  const length = input.value.trim().length
  const ok = which === 'email' ? length > 0 && input.checkValidity() : length >= C.rule.ready
  const per = which === 'email' ? C.rule.emailChars : C.rule.messageChars
  const fraction = ok ? 1 : Math.min(0.9, length / per)
  void motion.rule(which === 'email' ? emailLayer.value : messageLayer.value, fraction, ok)
  if (ok && !ready[which]) submitInk.value?.pulse()
  ready[which] = ok
}

function onFocus(which: 'email' | 'message') {
  void motion.pen(which === 'email' ? emailLayer.value : messageLayer.value, 'focus')
}

function onBlur(which: 'email' | 'message') {
  void motion.lift(which === 'email' ? emailLayer.value : messageLayer.value)
}

let watcher: MutationObserver | null = null

function arrive() {
  if (step.value !== 'email' || prefersStillness()) return
  if (document.activeElement === emailInput.value || email.value) return
  void motion.pen(emailLayer.value, 'arrive')
  void motion.decode(emailPrompt.value)
  setTimeout(() => submitInk.value?.pulse(), C.pen.arrive * 1000)
}

onMounted(() => {
  const heading = askEl.value
  if (!heading || heading.hasAttribute(LANDED)) return
  watcher = new MutationObserver(() => {
    if (!heading.hasAttribute(LANDED)) return
    watcher?.disconnect()
    watcher = null
    arrive()
  })
  watcher.observe(heading, { attributes: true, attributeFilter: [LANDED] })
})

onBeforeUnmount(() => watcher?.disconnect())

function refuse(input: HTMLInputElement, why: string, layer: HTMLElement | null) {
  input.setCustomValidity(why)
  input.reportValidity()
  void motion.shake(layer)
}

async function submit() {
  if (step.value === 'email') {
    const input = emailInput.value
    if (!input) return
    input.setCustomValidity('')
    // The template's `pattern` requires a TLD: the browser alone accepts "name@gmail".
    if (!input.checkValidity()) return refuse(input, t('contact.invalidEmail'), emailLayer.value)
    return go('message')
  }

  if (step.value === 'message') {
    const input = messageInput.value
    if (!input) return
    input.setCustomValidity('')
    if (!message.value.trim()) return refuse(input, t('contact.emptyMessage'), messageLayer.value)
    return send()
  }
}

async function go(to: 'email' | 'message') {
  const forward = to === 'message'
  step.value = to
  await nextTick()
  const [from, into] = forward ? [emailLayer.value, messageLayer.value] : [messageLayer.value, emailLayer.value]
  void motion.roll(fieldsEl.value, from, into, forward ? 1 : -1)
  ;(forward ? messageInput.value : emailInput.value)?.focus({ preventScroll: true })
  // Prefetch DrawSVG for the thanks while the visitor types.
  if (forward) void loadPlugin('DrawSVGPlugin')
}

function back() {
  if (step.value === 'message') void go('email')
}

async function send() {
  step.value = 'sending'
  await nextTick()
  const [ok] = await Promise.all([deliver(), motion.post(messageInput.value)])

  // Asked before the row goes: focus follows the answer only if it was in the form.
  const hadFocus = !!formEl.value?.contains(document.activeElement)
  step.value = ok ? 'sent' : 'failed'
  await nextTick()
  const answer = ok ? sentEl.value : failedEl.value
  if (ok) {
    void motion.roll(headEl.value, askEl.value, thanksEl.value, 1)
    setTimeout(() => { void motion.roll(stageEl.value, rowEl.value, answer, 1) }, C.turn * 1000)
  }
  else {
    void motion.roll(stageEl.value, rowEl.value, answer, 1)
  }
  if (hadFocus) answer?.focus({ preventScroll: true })
  setTimeout(() => { if (step.value === 'sent' || step.value === 'failed') motion.rest(messageInput.value) },
    (C.turn + C.roll.duration) * 1000 + 100)
}

async function deliver(): Promise<boolean> {
  const from = email.value.trim()
  try {
    const res = await $fetch<{ success: boolean, message?: string }>(
      'https://api.web3forms.com/submit',
      {
        method: 'POST',
        timeout: TIMEOUT_MS,
        body: {
          access_key: web3formsKey,
          // Web3Forms makes this the Reply-To, so answering is one click.
          email: from,
          message: message.value.trim(),
          botcheck: botcheck.value,
          subject: `Portfolio enquiry from ${from}`,
          from_name: 'Portfolio contact form',
          language: locale.value === 'ar' ? 'Arabic' : 'English',
        },
      },
    )
    if (!res.success) throw new Error(res.message || 'Submission rejected')
    return true
  }
  catch (e) {
    console.warn('[contact] not sent:', e instanceof Error ? e.message : e)
    return false
  }
}

async function retry() {
  if (step.value !== 'failed') return
  step.value = 'message'
  await nextTick()
  void motion.roll(stageEl.value, failedEl.value, rowEl.value, -1)
  void motion.unpost(messageInput.value)
  messageInput.value?.focus({ preventScroll: true })
}

async function another() {
  if (step.value !== 'sent') return
  motion.rest(messageInput.value)
  message.value = ''
  ready.message = false
  void motion.rule(messageLayer.value, 0, false)
  step.value = 'message'
  await nextTick()
  void motion.roll(headEl.value, thanksEl.value, askEl.value, -1)
  setTimeout(() => { void motion.roll(stageEl.value, sentEl.value, rowEl.value, -1) }, C.turn * 1000)
  messageInput.value?.focus({ preventScroll: true })
}
</script>

<template>
  <BaseCard as="section" class="contact">
    <!-- Both are headings; only one is in the accessibility tree (the other is visibility: hidden). -->
    <div ref="headEl" class="contact__head" :data-head="head">
      <h2 ref="askEl" v-reveal.lines class="text-h3 text-ink-strong" data-layer="ask">{{ $t('contact.heading') }}</h2>
      <h2 ref="thanksEl" class="text-h3 text-ink-strong" data-layer="thanks">{{ $t('contact.sent') }}</h2>
    </div>

    <form
      ref="formEl"
      class="contact__form"
      novalidate
      :aria-busy="step === 'sending'"
      @submit.prevent="submit"
    >
      <!-- Honeypot. aria-hidden + tabindex -1 so it is unreachable by keyboard and AT. -->
      <div class="contact__hp" aria-hidden="true">
        <label for="contact-botcheck">{{ $t('contact.honeypot') }}</label>
        <input id="contact-botcheck" v-model="botcheck" type="checkbox" name="botcheck" tabindex="-1" autocomplete="off">
      </div>

      <div ref="stageEl" class="contact__stage" :data-stage="stage">
        <div ref="rowEl" class="contact__row" data-layer="form">
          <div ref="fieldsEl" class="contact__fields" :data-field="field">
            <div ref="emailLayer" class="contact__field" data-layer="email">
              <label for="contact-email" class="sr-only">{{ $t('contact.emailLabel') }}</label>
              <input
                id="contact-email"
                ref="emailInput"
                v-model="email"
                type="email"
                name="email"
                required
                pattern="[^@\s]+@[^@\s]+\.[^@\s]{2,}"
                autocomplete="email"
                placeholder=" "
                class="contact__input"
                @input="onType('email', $event)"
                @focus="onFocus('email')"
                @blur="onBlur('email')"
              >
              <!-- Floated by CSS alone (:focus, :placeholder-shown, hence placeholder=" "). -->
              <span ref="emailPrompt" class="contact__prompt" aria-hidden="true">{{ $t('contact.placeholder') }}</span>
              <span class="contact__rule" aria-hidden="true" />
              <svg class="contact__ring u-rtl-mirror" aria-hidden="true" focusable="false"><rect /></svg>
            </div>

            <div ref="messageLayer" class="contact__field" data-layer="message">
              <button
                type="button"
                class="contact__back"
                :aria-label="$t('contact.back')"
                :disabled="step === 'sending'"
                @click="back"
              >
                <Icon name="ph:caret-left" class="u-rtl-mirror" aria-hidden="true" />
              </button>
              <label for="contact-message" class="sr-only">{{ $t('contact.messageLabel') }}</label>
              <input
                id="contact-message"
                ref="messageInput"
                v-model="message"
                type="text"
                name="message"
                :required="field === 'message'"
                :maxlength="MESSAGE_MAX"
                :readonly="step === 'sending'"
                autocomplete="off"
                placeholder=" "
                class="contact__input contact__input--message"
                @input="onType('message', $event)"
                @focus="onFocus('message')"
                @blur="onBlur('message')"
              >
              <span class="contact__prompt" aria-hidden="true">{{ $t('contact.messagePlaceholder') }}</span>
              <span class="contact__rule" aria-hidden="true" />
              <svg class="contact__ring u-rtl-mirror" aria-hidden="true" focusable="false"><rect /></svg>
            </div>
          </div>

          <BaseButton type="submit" :show-arrow="false" class="contact__action">
            <span class="contact__label">
              <span ref="labelEl" class="contact__labelText">{{ buttonLabel }}</span>
              <!-- Sized to the longest label, so "Sending…" never squeezes the already-measured field. -->
              <span class="contact__labelSizer" aria-hidden="true">{{ $t('contact.next') }}</span>
              <span class="contact__labelSizer" aria-hidden="true">{{ $t('contact.send') }}</span>
              <span class="contact__labelSizer" aria-hidden="true">{{ $t('contact.sending') }}</span>
            </span>
            <InkLayer ref="submitInk" />
          </BaseButton>
        </div>

        <!-- Focusable so focus can follow the answer in; the live region announces it. -->
        <div ref="sentEl" class="contact__answer" data-layer="sent" tabindex="-1">
          <div class="contact__reply">
            <img src="/portrait/avatar.webp" alt="" aria-hidden="true" width="256" height="256" loading="lazy" decoding="async" class="contact__avatar">
            <p class="contact__answerText">
              <DrawnTick :play="step === 'sent'" :delay="C.tickAt + C.turn" class="contact__tick" />
              {{ $t('contact.replyTo', { email: email.trim() }) }}
            </p>
          </div>
          <BaseButton :show-arrow="false" class="contact__action" @click="another">
            {{ $t('contact.another') }}
            <InkLayer />
          </BaseButton>
        </div>

        <div ref="failedEl" class="contact__answer" data-layer="failed" tabindex="-1">
          <p class="contact__answerText">
            {{ $t('contact.failedLead') }}
            <a :href="`mailto:${content.profile.email}`">{{ content.profile.email }}</a> {{ $t('contact.failedTail') }}
          </p>
          <BaseButton :show-arrow="false" class="contact__action" @click="retry">
            {{ $t('contact.retry') }}
            <InkLayer />
          </BaseButton>
        </div>
      </div>

      <p class="sr-only" role="status" aria-live="polite">{{ announcement }}</p>
    </form>
  </BaseCard>
</template>

<style scoped>
.contact {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 1.5rem;
  min-height: 0;
}

/* `visibility`, not `display`: hidden layers keep their size yet leave the tab order and accessibility tree. */
.contact__head,
.contact__stage,
.contact__fields {
  display: grid;
}

.contact__head > *,
.contact__stage > *,
.contact__fields > * {
  grid-area: 1 / 1;
  min-width: 0;
  /* Never transitioned, even by the reduced-motion block: its 0.01ms `all` transition would keep a shown
     layer hidden for a frame, and focus sent into it is refused. */
  transition-property: none;
}

.contact__head:not([data-head='ask']) > [data-layer='ask'],
.contact__head:not([data-head='thanks']) > [data-layer='thanks'],
.contact__stage:not([data-stage='form']) > [data-layer='form'],
.contact__stage:not([data-stage='sent']) > [data-layer='sent'],
.contact__stage:not([data-stage='failed']) > [data-layer='failed'],
.contact__fields:not([data-field='email']) > [data-layer='email'],
.contact__fields:not([data-field='message']) > [data-layer='message'] {
  visibility: hidden;
}

/* Descendants too: they inherit the layers' visibility, and focus must land in them at once. */
@media (prefers-reduced-motion: reduce) {
  .contact__head,
  .contact__head *,
  .contact__stage,
  .contact__stage * {
    transition-property: none !important;
  }
}

/* Clipped only while rolling: at rest a focus ring, or the Arabic dots below the line, must never be cut. */
.contact__head.is-rolling,
.contact__stage.is-rolling,
.contact__fields.is-rolling {
  clip-path: inset(0 -1rem);
}

.contact__row,
.contact__answer {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-gutter);
}

@media (width >= 810px) {
  .contact__row,
  .contact__answer { flex-direction: row; align-items: center; }
  .contact__fields,
  .contact__reply,
  .contact__answerText { flex: 1 1 auto; min-width: 0; }
  .contact__action { flex: 0 0 auto; }
}

.contact__field { position: relative; }

.contact__stage .contact__action {
  justify-content: center;
  padding: 1.25rem 1.75rem;
  border-radius: var(--radius-tile);
  background-color: var(--color-border-subtle);
  font-size: var(--text-body-sm);
  font-weight: 500;
  /* The label mask's line (1.4) on all three: the tallest layer sets every state's height. */
  line-height: 1.4;
}

/* A real hover only: iOS keeps `:hover` on the last thing tapped. */
@media (hover: hover) {
  .contact__stage .contact__action:hover {
    background-color: var(--color-surface-hover);
  }
}

/* An inset ring, not a border (no layout cost); the first shadow stays at zero spread until focus. */
.contact__input {
  width: 100%;
  padding: 1.25rem 1.5rem;
  border: 0;
  border-radius: var(--radius-tile);
  background-color: transparent;
  box-shadow:
    inset 0 0 0 0 var(--color-ink-faint),
    inset 0 0 0 2px var(--color-border-strong);
  color: var(--color-ink-strong);
  font-size: var(--text-body-sm);
}

/* Same 64px either way (26 + 24 + 14 = 20 + 24 + 20). The one-space placeholder is what
   `:placeholder-shown` reads to know the field is empty. */
.contact__input:focus,
.contact__input:not(:placeholder-shown) {
  padding-top: 1.625rem;
  padding-bottom: 0.875rem;
}

.contact__input {
  transition:
    box-shadow var(--duration-base) var(--ease-out-soft),
    padding var(--duration-base) var(--ease-out-soft);
}

.contact__prompt {
  position: absolute;
  inset-inline-start: 1.5rem;
  top: 50%;
  margin-top: -0.75em;
  font-size: var(--text-body-sm);
  line-height: 1.5;
  color: var(--color-ink-faint);
  white-space: nowrap;
  pointer-events: none;
  transform-origin: left center;
  transition:
    transform var(--duration-base) var(--ease-out-soft),
    color var(--duration-base) var(--ease-out-soft);
}

.contact__input:focus + .contact__prompt,
.contact__input:not(:placeholder-shown) + .contact__prompt {
  transform: translateY(-1.1rem) scale(0.72);
  color: var(--color-ink-muted);
}

/* Length is `--fill` (useContactMotion `rule`), a custom property, never an inline transform. */
.contact__rule {
  position: absolute;
  inset-inline: 1.5rem;
  bottom: 0.625rem;
  height: 1px;
  background-color: var(--color-ink-faint);
  transform: scaleX(var(--fill, 0));
  transform-origin: left center;
  pointer-events: none;
  transition: background-color var(--duration-base) var(--ease-out-soft);
}

.contact__field.is-ready .contact__rule { background-color: var(--color-ink-strong); }

.contact__input--message + .contact__prompt,
.contact__input--message ~ .contact__rule { inset-inline-start: 3.75rem; }

[dir='rtl'] .contact__prompt,
[dir='rtl'] .contact__rule { transform-origin: right center; }

.contact__ring {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  opacity: 0;
  pointer-events: none;
  fill: none;
  stroke: var(--color-ink-strong);
  stroke-width: 2;
}

.contact__input:focus-visible {
  outline: none;
  box-shadow:
    inset 0 0 0 2px var(--color-ink-faint),
    inset 0 0 0 2px var(--color-border-strong);
}

.contact__input--message { padding-inline-start: 3.75rem; }

.contact__input.is-posting { caret-color: transparent; }

/* 44px: a full touch target inside the 64px field. */
.contact__back {
  position: absolute;
  inset-block: 0;
  inset-inline-start: 0.625rem;
  display: grid;
  place-items: center;
  width: 2.75rem;
  height: 2.75rem;
  margin-block: auto;
  border-radius: 0.75rem;
  color: var(--color-ink-muted);
  font-size: 1.125rem;
  transition:
    color var(--duration-base) var(--ease-out-soft),
    background-color var(--duration-base) var(--ease-out-soft);
}

@media (hover: hover) {
  .contact__back:hover:not(:disabled) {
    color: var(--color-ink-strong);
    background-color: var(--color-border-subtle);
  }
}

.contact__back:disabled { opacity: 0.4; }

/* clip-path, not overflow: the ز of "دز" reaches past its box. */
.contact__label {
  position: relative;
  display: grid;
  justify-items: center;
  /* Inherited by the outgoing copy useTextSwap lays over the label. */
  justify-content: center;
  clip-path: inset(0 -0.15em);
  line-height: 1.4;
  height: 1.4em;
}

.contact__label > * { grid-area: 1 / 1; }
.contact__labelText { display: block; }
.contact__labelSizer { visibility: hidden; }

.contact__answerText {
  font-size: var(--text-body-sm);
  color: var(--color-ink);
}

.contact__answerText a { color: var(--color-ink-strong); text-decoration: underline; }

.contact__tick {
  display: inline-block;
  width: 1.25rem;
  height: 1.25rem;
  margin-inline-end: 0.375rem;
  vertical-align: -0.3em;
  color: var(--color-ink-strong);
}

.contact__reply {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.contact__avatar {
  flex: 0 0 auto;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  border: 1px solid var(--color-border);
}

/* A place for focus to land, not a control: the next Tab is the real one. */
.contact__answer:focus { outline: none; }

/* Invisible without `display:none`, which some bots detect. */
.contact__hp {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
