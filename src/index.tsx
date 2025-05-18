import './style.scss';

import { render } from 'preact';
import { Route, Switch } from 'wouter';

import { NowPlaying } from './now-playing';
import { Birbs } from './birbs';
import { Janktuber } from './janktuber';

export function App() {
  return (
    <Switch>
      <Route path="/">
        <main className="HomePage">
          <section className="sidebar">
            <div className="visuals">
              <Birbs />
              <Janktuber />
            </div>
            <NowPlaying />
          </section>
          <section className="main" />
        </main>
      </Route>

      <Route path="/fullscreen">
        <main className="FullscreenPage">
          <div className="topbar">
            <NowPlaying inline />
          </div>
          <Janktuber />
        </main>
      </Route>

      <Route path="/birbs">
        <main className="BirbsPage">
          <Birbs count={200} cameraVerticalAdjustment={300} />
        </main>
      </Route>

      <Route path="/janktuber">
        <main className="JanktuberPage">
          <Janktuber />
        </main>
      </Route>
    </Switch>
  );
}

render(<App />, document.getElementById('app') as HTMLElement);
