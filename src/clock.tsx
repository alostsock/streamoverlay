import { useEffect, useState } from 'preact/hooks';

export function Clock() {
  const [clockText, setClockText] = useState('00:00 am');
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const hours = now.getHours() % 12;
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const suffix = now.getHours() > 12 ? 'pm' : 'am';
      setClockText(`${hours}:${minutes}${suffix}`);
    };

    update();

    const interval = setInterval(update, 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return <div className="Clock">{clockText}</div>;
}
