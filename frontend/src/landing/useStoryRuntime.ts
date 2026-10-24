import { useLayoutEffect } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
// @ts-ignore The source pilot is kept intact from the reviewed Showcase prototype.
import { createPilot } from './engine/pilot-gsap.js'
// @ts-ignore The source scene engines are carried forward from the reviewed prototype.
import { createProductDemos } from './engine/product-demos.js'
// @ts-ignore The source scene engines are carried forward from the reviewed prototype.
import { createSecondaryDemos } from './engine/secondary-demos.js'
// @ts-ignore These pure helpers preserve the ten-state source narrative.
import { motionAllowed, prefersReducedMotion, sectionProgress } from './engine/motion.js'
// @ts-ignore These pure helpers preserve the ten-state source narrative.
import { STORY_STATES, resolveStory } from './engine/story-engine.js'
import storyMarkup from './terminal-story-markup.html?raw'

export function useStoryRuntime() {
  useLayoutEffect(() => {
    const root = document.getElementById('welcome-content')
    const stage = root?.querySelector<HTMLElement>('.handoff-track')
    const motionControl = root?.querySelector<HTMLButtonElement>('.motion-control')
    const status = root?.querySelector<HTMLElement>('.story-status')

    if (!root || !stage || !motionControl || !status) return

    const pageRoot = root
    const storyStage = stage
    const motionButton = motionControl
    const storyStatus = status

    const controller = new AbortController()
    const { signal } = controller
    let frame = 0
    let waypoints: number[] = []
    let activeState = -1
    let alive = true
    let pilot: ReturnType<typeof createPilot>
    let productDemos: ReturnType<typeof createProductDemos>
    let secondaryDemos: ReturnType<typeof createSecondaryDemos>
    const statusStep = storyStatus.querySelector<HTMLElement>('.story-status-step')
    const statusTitle = storyStatus.querySelector<HTMLElement>('.story-status-title')
    const statusDetail = storyStatus.querySelector<HTMLElement>('.story-status-detail')

    if (!statusStep || !statusTitle || !statusDetail) return

    const storyStatusStep = statusStep
    const storyStatusTitle = statusTitle
    const storyStatusDetail = statusDetail

    const context = gsap.context(() => {
      document.body.classList.add('story-enhanced')
      pilot = createPilot({ motionAllowed })
      productDemos = createProductDemos({ motionAllowed })
      secondaryDemos = createSecondaryDemos({ motionAllowed })
      pilot.start()
    }, pageRoot)

    const documentTop = (selector: string) => {
      const element = pageRoot.querySelector<HTMLElement>(selector)
      return element ? element.getBoundingClientRect().top + window.scrollY : 0
    }

    function measureWaypoints() {
      const height = window.innerHeight
      const stageRange = Math.max(1, storyStage.offsetHeight - height)
      const points = [
        0,
        documentTop('.handoff-track') + stageRange * 0.72,
        documentTop('.correlation-shell') - height * 0.52,
        documentTop('.mitre-demo') - height * 0.52,
        documentTop('.investigation-work') - height * 0.52,
        documentTop('.playbook') - height * 0.52,
        documentTop('.cve-shell') - height * 0.52,
        documentTop('.osint-shell') - height * 0.52,
        documentTop('.bgp-shell') - height * 0.52,
        documentTop('.final-stage') - height * 0.52,
      ]
      waypoints = points.reduce<number[]>((ordered, point, index) => {
        ordered.push(Math.max(index ? ordered[index - 1] + 1 : 0, point))
        return ordered
      }, [])
    }

    function updateStoryCopy(index: number) {
      if (activeState === index) return
      activeState = index
      const state = STORY_STATES[index]
      document.body.dataset.storyState = state.id
      storyStatusStep.textContent = `${String(index + 1).padStart(2, '0')} / ${String(STORY_STATES.length).padStart(2, '0')}`
      storyStatusTitle.textContent = state.caption
      storyStatusDetail.textContent = state.detail

      pageRoot.querySelectorAll<HTMLAnchorElement>('.story-nav a, .mobile-nav a, .ecosystem-nav a').forEach((link) => {
        const href = link.getAttribute('href')
        if (href === `#${state.scene}` || (state.scene === 'disciplines' && href === '#cve')) {
          link.setAttribute('aria-current', 'location')
        } else {
          link.removeAttribute('aria-current')
        }
      })
      pageRoot.querySelectorAll<HTMLElement>('main > section').forEach((section) => {
        section.toggleAttribute('data-scene-active', section.id === state.scene)
      })
    }

    function updateScroll() {
      frame = 0
      if (!alive) return
      if (!waypoints.length) measureWaypoints()
      const story = resolveStory(window.scrollY, waypoints)
      updateStoryCopy(story.active)
      pilot.syncStatus()
      productDemos.syncStatus()
      secondaryDemos.syncStatus()

      const moving = motionAllowed()
      const handoff = Math.min(
        1,
        Math.max(0, -storyStage.getBoundingClientRect().top / Math.max(1, storyStage.offsetHeight - window.innerHeight)),
      )
      storyStage.style.setProperty('--handoff', moving ? handoff.toFixed(3) : '1')
      const stageLabel = pageRoot.querySelector<HTMLElement>('#stage-label')
      if (stageLabel) stageLabel.textContent = handoff > 0.55 ? '02 / qualifier' : '01 / repérer'
      pageRoot.querySelector<HTMLElement>('.investigation-timeline')?.style.setProperty('--investigation-progress', '1')
      pageRoot.querySelectorAll<HTMLElement>('.section-head').forEach((node) => {
        node.style.setProperty('--scene-progress', moving ? sectionProgress(node).toFixed(3) : '1')
      })

      const scrollable = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
      document.documentElement.style.setProperty('--page-progress', `${Math.round((window.scrollY / scrollable) * 100)}%`)
    }

    function requestScroll() {
      if (!frame) frame = requestAnimationFrame(updateScroll)
    }

    function refreshLayout() {
      if (!alive) return
      document.documentElement.style.setProperty('--story-header-height', `${pageRoot.querySelector<HTMLElement>('.story-header')?.offsetHeight ?? 76}px`)
      document.documentElement.style.setProperty('--story-status-height', `${storyStatus.offsetHeight}px`)
      measureWaypoints()
      requestScroll()
    }

    function setMotionState(stopped: boolean) {
      document.body.classList.toggle('motion-stopped', stopped)
      motionButton.setAttribute('aria-pressed', String(stopped))
      motionButton.textContent = stopped ? 'Reprendre les animations' : 'Arrêter les animations'
      if (stopped) {
        pilot.finish()
        productDemos.finish()
        secondaryDemos.finish()
      }
      refreshLayout()
    }

    const handleScroll = () => requestScroll()
    const handleResize = () => refreshLayout()
    const handleMotionChange = () => {
      if (prefersReducedMotion()) {
        pilot.finish()
        productDemos.finish()
        secondaryDemos.finish()
      }
      refreshLayout()
    }

    motionButton.addEventListener('click', () => {
      setMotionState(!document.body.classList.contains('motion-stopped'))
    }, { signal })
    pageRoot.querySelector<HTMLButtonElement>('#replay-command')?.addEventListener('click', pilot.replay, { signal })
    pageRoot.querySelector<HTMLButtonElement>('.attach-source')?.addEventListener('click', (event) => {
      const button = event.currentTarget as HTMLButtonElement
      const attached = button.getAttribute('aria-pressed') !== 'true'
      button.setAttribute('aria-pressed', String(attached))
      const sourceStatus = pageRoot.querySelector<HTMLElement>('#source-status')
      if (sourceStatus) {
        sourceStatus.textContent = attached
          ? 'Source ajoutée au dossier fictif dans cette page seulement. Aucune donnée enregistrée.'
          : 'Source retirée du dossier fictif. Aucune donnée enregistrée.'
      }
    }, { signal })

    const menu = pageRoot.querySelector<HTMLButtonElement>('.menu-control')
    const mobileNav = pageRoot.querySelector<HTMLElement>('#mobile-nav')
    menu?.addEventListener('click', () => {
      const opened = menu.getAttribute('aria-expanded') !== 'true'
      menu.setAttribute('aria-expanded', String(opened))
      if (mobileNav) mobileNav.hidden = !opened
    }, { signal })
    pageRoot.querySelectorAll<HTMLAnchorElement>('#mobile-nav a').forEach((link) => {
      link.addEventListener('click', () => {
        menu?.setAttribute('aria-expanded', 'false')
        if (mobileNav) mobileNav.hidden = true
      }, { signal })
    })
    const revealDirectPlaybook = () => {
      if (window.location.hash !== '#playbook') return
      pageRoot.querySelector<HTMLButtonElement>('#investigation .product-guide button')?.click()
    }
    pageRoot.querySelectorAll<HTMLAnchorElement>('a[href="#playbook"]').forEach((link) => {
      link.addEventListener('click', () => requestAnimationFrame(revealDirectPlaybook), { signal })
    })
    window.addEventListener('hashchange', revealDirectPlaybook, { signal })
    if (window.location.hash === '#playbook') requestAnimationFrame(revealDirectPlaybook)

    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
    motionPreference.addEventListener('change', handleMotionChange, { signal })
    window.addEventListener('scroll', handleScroll, { passive: true, signal })
    window.addEventListener('resize', handleResize, { signal })
    window.addEventListener('orientationchange', handleResize, { signal })
    document.fonts?.ready.then(() => { if (alive) refreshLayout() })

    const observer = 'ResizeObserver' in window ? new ResizeObserver(refreshLayout) : undefined
    if (observer) {
      observer.observe(pageRoot)
      observer.observe(storyStatus)
      const header = pageRoot.querySelector<HTMLElement>('.story-header')
      if (header) observer.observe(header)
    }

    refreshLayout()
    requestAnimationFrame(() => {
      if (alive) ScrollTrigger.refresh()
    })

    return () => {
      alive = false
      controller.abort()
      observer?.disconnect()
      if (frame) cancelAnimationFrame(frame)
      pilot.destroy()
      productDemos.destroy()
      secondaryDemos.destroy()
      context.revert()
      document.body.classList.remove('story-enhanced', 'motion-stopped', 'pilot-enhanced')
      delete document.body.dataset.storyState
      document.documentElement.style.removeProperty('--story-header-height')
      document.documentElement.style.removeProperty('--story-status-height')
      document.documentElement.style.removeProperty('--page-progress')
      pageRoot.innerHTML = storyMarkup
    }
  }, [])
}
