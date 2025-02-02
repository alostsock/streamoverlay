import './style.scss';

import { render, JSX, ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { Route, Switch } from 'wouter';

import { Flock } from './birbs';

const API_URL = 'http://localhost:8000';
const WS_URL = 'ws://localhost:8000';

export function App() {
  return (
    <Switch>
      <Route path="/">
        <main className="HomePage">
          <section className="Main" />
          <section className="Sidebar">
            <Birbs />
            <NowPlaying />
          </section>
        </main>
      </Route>

      <Route path="/birbs">
        <main className="BirbsPage">
          <Birbs />
        </main>
      </Route>
    </Switch>
  );
}

render(<App />, document.getElementById('app'));

function Backgrounded({
  pattern,
  gradient,
  as: Component = 'div',
  children,
  className,
  ...props
}: {
  pattern?: 'lines' | 'dots';
  gradient?: boolean;
  as?: keyof JSX.IntrinsicElements;
  children?: ComponentChildren;
  className?: string;
  props?: JSX.HTMLAttributes;
}) {
  const cls = ['Backgrounded', className].filter(Boolean).join(' ');

  return (
    <Component className={cls} {...props}>
      {pattern === 'lines' ? (
        <svg
          className="pattern"
          width="100px"
          height="100px"
          style="stroke-width: 1.5; opacity: 0.3;"
        >
          <pattern
            id="pattern-lines"
            width="7"
            height="7"
            patternTransform="rotate(35 0 0)"
            patternUnits="userSpaceOnUse"
          >
            <line x1="0" y1="0" x2="0" y2="7" stroke-linecap="round" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#pattern-lines)" style="stroke: none" />
        </svg>
      ) : null}

      {pattern === 'dots' ? (
        <svg
          className="pattern"
          width="100px"
          height="100px"
          style="stroke-width: 2; opacity: 0.25;"
        >
          <pattern
            id="pattern-dots"
            width="8"
            height="8"
            patternTransform="rotate(45 0 0)"
            patternUnits="userSpaceOnUse"
          >
            <line x1="2" y1="2" x2="2" y2="2" stroke-linecap="round" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#pattern-dots)" style="stroke: none" />
        </svg>
      ) : null}

      {gradient && <div className="gradient" />}

      {/* This div is (unfortunately) needed to create a new stacking context,
          using `position: relative`. Since the background elements have
          `position: absolute`, the children -- without their own positioned
          element -- would be rendered beneath the background. */}
      <div className="foreground">{children}</div>
    </Component>
  );
}

function NowPlaying() {
  const [artist, setArtist] = useState('');
  const [track, setTrack] = useState('');

  useEffect(() => {
    const ws = new WebSocket(`${WS_URL}/now-playing`);

    const handleMsg = (event: MessageEvent) => {
      const [artist, track] = (event.data as string).split('||').map((s) => s.trim());
      setArtist(artist === '?' ? '' : artist);
      setTrack(track === '?' ? '' : track);
    };

    ws.addEventListener('message', handleMsg);

    return () => {
      ws.close();
    };
  }, []);

  return (
    <Backgrounded pattern="dots" className="NowPlaying">
      <Marquee>{track}</Marquee>
      <Marquee>{artist}</Marquee>
    </Backgrounded>
  );
}

function Marquee({ children, className, ...props }: JSX.HTMLAttributes<HTMLDivElement>) {
  const [shouldMarquee, setShouldMarquee] = useState(false);
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  const [itemEl, setItemEl] = useState<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (containerEl && itemEl) {
      setShouldMarquee(itemEl.scrollWidth > containerEl.clientWidth);
    }
  }, [containerEl, itemEl, children]);

  const cls = ['Marquee', className, shouldMarquee && 'scroll'].filter(Boolean).join(' ');

  return (
    <div ref={setContainerEl} className={cls} {...props}>
      <span ref={setItemEl}>{children}</span>
      {shouldMarquee && <span>{children}</span>}
    </div>
  );
}

function Birbs() {
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerEl) return;

    new Flock(containerEl).render();
  }, [containerEl]);

  return (
    <Backgrounded pattern="lines" gradient className="Birbs">
      <div ref={setContainerEl} className="container" />
    </Backgrounded>
  );
}
