import { useState, useEffect } from 'preact/hooks';

import { Backgrounded } from './backgrounded';
import { Marquee } from './marquee';
import { WS_URL } from './api';

export function NowPlaying() {
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
