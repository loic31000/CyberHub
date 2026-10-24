import { useStoryRuntime } from './useStoryRuntime'
import storyMarkup from './terminal-story-markup.html?raw'
import './landing.css'

export default function LandingPage() {
  useStoryRuntime()
  return <div id="welcome-content" dangerouslySetInnerHTML={{ __html: storyMarkup }} />
}
