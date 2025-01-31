import './style.scss';

import { render, JSX } from 'preact';
import { ComponentPropsWithoutRef } from 'preact/compat';
import { useCallback, useEffect, useState } from 'preact/hooks';

const API_URL = 'http://localhost:8000';
const WS_URL = 'ws://localhost:8000';

export function App() {
  return (
    <main>
      <section className="Main" />
      <section className="Sidebar">
        <BackgroundPattern />
        <Spacer />
        <NowPlaying />
      </section>
    </main>
  );
}

render(<App />, document.getElementById('app'));

function BackgroundPattern() {
  return (
    <svg className="BackgroundPattern" width="100px" height="100px" style="stroke-width: 2">
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
  );
}

function Spacer() {
  return <span className="Spacer" />;
}

function NowPlaying() {
  const [artist, setArtist] = useState('');
  const [track, setTrack] = useState('');

  useEffect(() => {
    const ws = new WebSocket(`${WS_URL}/now-playing`);

    const handleMsgEvent = (event: MessageEvent) => {
      const [artist, track] = (event.data as string).split('||').map((s) => s.trim());
      setArtist(artist === '?' ? '' : artist);
      setTrack(track === '?' ? '' : track);
    };

    ws.addEventListener('message', handleMsgEvent);

    return () => {
      ws.close();
    };
  }, []);

  return (
    <section className="NowPlaying">
      <Marquee className="track">{track}</Marquee>
      <Marquee className="artist">{artist}</Marquee>
    </section>
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
