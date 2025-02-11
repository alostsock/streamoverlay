import { JSX, ComponentChildren } from 'preact';

export function Backgrounded({
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
            patternTransform="rotate(-35 0 0)"
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
