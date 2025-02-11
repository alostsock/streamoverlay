import { JSX } from 'preact';
import { useState, useEffect } from 'preact/hooks';

export function Marquee({ children, className, ...props }: JSX.HTMLAttributes<HTMLDivElement>) {
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
