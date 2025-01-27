import { render } from 'preact';

import './style.css';

export function App() {
  return (
    <main>
      <section className="now-playing">hey there</section>
    </main>
  );
}

render(<App />, document.getElementById('app'));
