import { useState, useEffect } from 'preact/hooks';

import { Backgrounded } from './backgrounded';
import { Marquee } from './marquee';
import { WS_URL } from './api';

export function NowPlaying({ inline = false }: { inline?: boolean }) {
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

  const cls = ['NowPlaying', inline && 'inline'].filter(Boolean).join(' ');

  return (
    <Backgrounded pattern="dots" className={cls}>
      {inline ? (
        <Marquee>
          {artist} - {track}
        </Marquee>
      ) : (
        <>
          <Marquee>{track}</Marquee>
          <Marquee>{artist}</Marquee>
        </>
      )}
    </Backgrounded>
  );
}
