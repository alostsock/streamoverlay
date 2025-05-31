import { useEffect, useState } from 'preact/hooks';

const CLIENT_ID = import.meta.env.VITE_TWITCH_CLIENT_ID;
const CLIENT_SECRET = import.meta.env.VITE_TWITCH_CLIENT_SECRET;
const REDIRECT_URI = `${window.origin}/auth`;

// I'd use URLSearchParams, but the scope string ends up double URL encoded
const params = [
  `client_id=${CLIENT_ID}`,
  // 'force_verify=true',
  `redirect_uri=${REDIRECT_URI}`,
  `response_type=code`,
  `scope=${encodeURIComponent(['user:read:chat', 'user:write:chat'].join(' '))}`,
  // 'state=',
].join('&');

const AUTH_URL = `https://id.twitch.tv/oauth2/authorize?${params}`;

type AuthResponse = {
  code: string;
  scope: string;
  state: string;
};
const AUTH_RES = 'auth-code-response';

const TOKEN_URL = 'https://id.twitch.tv/oauth2/token';

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  scope: string[];
  token_type: string;
};
const TOKEN_RES = 'token-response';

const Storage = {
  get: (k: string) => {
    const item = localStorage.getItem(k);
    const ts = localStorage.getItem(`${k}-timestamp`);
    return item ? { ...JSON.parse(item), itemTimestamp: ts } : null;
  },
  set: (k: string, v: Record<string, any> | null) => {
    localStorage.setItem(k, JSON.stringify(v));
    localStorage.setItem(`${k}-timestamp`, JSON.stringify(new Date().toISOString()));
  },
};

type AuthState = 'unauthed' | 'unauthed_empty_cache' | 'requesting_token' | 'authed' | 'error';

// https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#authorization-code-grant-flow
export function TwitchAuth() {
  const [state, setState] = useState<AuthState>('unauthed');
  const [msgs, setMsgs] = useState<Record<string, any>[]>([{ status: 'unauthed' }]);

  const transition = (status: string, newState?: AuthState, msg?: Record<string, any>) => {
    if (newState) {
      setState(newState);
    }
    setMsgs([...msgs, { status, ...msg }]);
  };

  useEffect(() => {
    if (state === 'unauthed') {
      if (document.location.search) {
        const params = new URLSearchParams(document.location.search);
        const response = Object.fromEntries(params.entries());

        if (!params.has('access_token')) {
          transition('error receiving auth code', 'error', response);
          Storage.set(AUTH_RES, null);
        }

        transition('received auth code', 'requesting_token', response);
        Storage.set(AUTH_RES, response);
      } else {
        const tokenResponse = Storage.get(TOKEN_RES);

        if (!tokenResponse?.access_token || !tokenResponse?.refresh_token) {
          const error = 'no stored token response, or invalid token response';
          transition('checked token cache', 'unauthed_empty_cache', { error });
          Storage.set(TOKEN_RES, null);
        } else {
          transition('checked token cache', 'authed', tokenResponse);
        }
      }
    } else if (state === 'requesting_token') {
      const authResponse = Storage.get(AUTH_RES) as AuthResponse;
      fetch(TOKEN_URL, {
        method: 'POST',
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          code: authResponse.code,
          grant_type: 'authorization_code',
          redirect_uri: REDIRECT_URI,
        }),
      })
        .then((response) => response.json())
        .then((response) => {
          if (response?.access_token) {
            transition('received tokens', 'authed', response);
            Storage.set(TOKEN_RES, response);
          } else {
            transition('invalid token response', 'error', response);
            Storage.set(TOKEN_RES, null);
          }
        })
        .catch((err) => {
          transition('error while requesting tokens', 'error', err);
          Storage.set(TOKEN_RES, null);
        });
    }
  }, [state]);

  return (
    <div className="TwitchAuth">
      {['unauthed', 'unauthed_empty_cache'].includes(state) && (
        <a href={AUTH_URL}>Connect with Twitch</a>
      )}

      <pre>
        <code>{JSON.stringify(msgs, null, 2)}</code>
      </pre>
    </div>
  );
}

export async function callTwitchApi<T>(url: string, options?: RequestInit) {
  let retries = 1;

  while (retries > 0) {
    try {
      const tokenResponse = Storage.get(TOKEN_RES) as TokenResponse;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${tokenResponse.access_token}`,
          'Client-Id': CLIENT_ID,
          'Content-Type': 'application/json',
        },
        ...options,
      });

      if (response.status === 401) {
        await handleTokenRefresh();
        retries -= 1;
        continue;
      }

      return (await response.json()) as T;
    } catch (error) {
      console.warn(error);
      retries -= 1;

      if (retries === 0) {
        throw error;
      }
    }
  }
}

async function handleTokenRefresh() {
  const prevTokenResponse = Storage.get(TOKEN_RES) as TokenResponse;

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: prevTokenResponse.refresh_token,
    }),
  });

  const tokenResponse = (await response.json()) as TokenResponse;

  if (!tokenResponse?.access_token || !tokenResponse?.refresh_token) {
    throw new Error('invalid token response while refreshing tokens');
  }

  Storage.set(TOKEN_RES, tokenResponse);

  return tokenResponse.access_token;
}
