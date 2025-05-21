import { useState, useEffect } from 'preact/hooks';

import { Backgrounded } from './backgrounded';
import { Marquee } from './marquee';
import { WS_URL } from './api';

export function NowPlaying({ inline = false }: { inline?: boolean }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(true);
  const [artist, setArtist] = useState('');
  const [track, setTrack] = useState('');

  useEffect(() => {
    const ws = new WebSocket(`${WS_URL}/now-playing`);

    const handleMsg = (event: MessageEvent) => {
      const [isPlaying, isPaused, artist, track] = (event.data as string)
        .split('||')
        .map((s) => s.trim());
      setIsPlaying(isPlaying === '1');
      setIsPaused(isPaused === '1');
      setArtist(artist === '?' ? '' : artist);
      setTrack(track === '?' ? '' : track);
    };

    ws.addEventListener('message', handleMsg);

    return () => {
      ws.close();
    };
  }, []);

  const showDetails = isPlaying && !isPaused;

  const cls = ['NowPlaying', inline && 'inline'].filter(Boolean).join(' ');

  return (
    <Backgrounded pattern="dots" className={cls}>
      <span className="icon">♫</span>
      {showDetails ? (
        <div>
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
        </div>
      ) : (
        <span>No BGM</span>
      )}
    </Backgrounded>
  );
}
