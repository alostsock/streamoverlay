import '@fontsource/dotgothic16';
import './style.scss';

import { render } from 'preact';
import { Route, Switch } from 'wouter';

import { Clock } from './clock';
import { NowPlaying } from './now-playing';
import { Chat } from './chat';
import { Birbs } from './birbs';
import { Janktuber } from './janktuber';
import { TwitchAuth } from './twitch-auth';

export function App() {
  return (
    <Switch>
      <Route path="/">
        <main className="HomePage">
          <section className="sidebar">
            <div className="visuals">
              <Birbs />
              <Chat />
              <Janktuber />
              <Clock />
            </div>
            <NowPlaying />
          </section>
          <section className="main" />
        </main>
      </Route>

      <Route path="/fullscreen">
        <main className="FullscreenPage">
          <div className="topbar">
            <Clock />
            <NowPlaying inline />
          </div>
          <Chat />
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

      <Route path="/auth">
        <TwitchAuth />
      </Route>
    </Switch>
  );
}

render(<App />, document.getElementById('app') as HTMLElement);
