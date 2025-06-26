import { useEffect, useRef, useState } from 'preact/hooks';

import { callTwitchApi } from './twitch-auth';
import { WSMessage, isMsgType } from './twitch';
import { Backgrounded } from './backgrounded';
import { getFgColorRgb, hexToRgb, isSimilarColor } from './color-utils';

const KEEPALIVE_SECONDS = 10; // Can be between 10 and 600
const KEEPALIVE_MS = (KEEPALIVE_SECONDS + 1) * 1000; // Add 1s buffer
const WS_URL = `wss://eventsub.wss.twitch.tv/ws?keepalive_timeout_seconds=${KEEPALIVE_SECONDS}`;
const USER_ID = import.meta.env.VITE_TWITCH_USER_ID;

const MAX_MSGS = 50;
const OPACITY_FADE_RATE = 0.03;

export function Chat() {
  const msgIds = useRef(new Set());
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [wsConnectionId, setWsConnectionId] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    // If this method isn't called with `refresh = true` within KEEPALIVE_MS,
    // refresh chat
    let lastKeepalive = performance.now();
    let keepaliveInterval: number | null = null;
    const checkKeepalive = (refresh?: boolean) => {
      const now = performance.now();
      if (now - lastKeepalive >= KEEPALIVE_MS) {
        console.info('opening new chat websocket');
        setWsConnectionId((prev) => prev + 1);
      }
      if (refresh) {
        lastKeepalive = now;
      }
      console.info(`keepalive ${refresh ? 'refreshed' : 'checked'}, rescheduling`);
      if (keepaliveInterval) {
        clearInterval(keepaliveInterval);
      }
      keepaliveInterval = setInterval(() => checkKeepalive(), KEEPALIVE_MS);
    };

    const append = (msg: Message) => {
      if (msgIds.current.has(msg.id)) {
        return;
      } else {
        msgIds.current.add(msg.id);
      }
      setMsgs((prevMsgs) => {
        while (prevMsgs.length > MAX_MSGS) {
          prevMsgs.shift();
        }
        return [...prevMsgs, msg];
      });
    };

    const ws = new WebSocket(WS_URL);
    checkKeepalive(true);

    ws.onmessage = (event) => {
      checkKeepalive(true);
      const wsMsg = JSON.parse(event.data) as WSMessage;
      const msg = msgFromWsMsg(wsMsg, setSessionId);
      if (msg) {
        append(msg);
      }
    };

    return () => {
      ws.close();
      if (keepaliveInterval) {
        clearInterval(keepaliveInterval);
      }
    };
  }, [wsConnectionId]);

  useEffect(() => {
    if (sessionId) {
      subscribe(sessionId, {
        type: 'channel.chat.message',
        version: '1',
        condition: { broadcaster_user_id: USER_ID, user_id: USER_ID },
      });
    }
  }, [sessionId]);

  return (
    <div className="Chat">
      <div className="messages">
        {msgs.map((msg, index) => (
          <ChatMessage
            key={msg.id}
            message={msg}
            opacity={1 - (msgs.length - index - 1) * OPACITY_FADE_RATE}
          />
        ))}
      </div>
    </div>
  );
}

interface MessageFragment {
  text: string;
  emoteId?: string;
}

interface Message {
  id: string;
  type: 'welcome' | 'chat';
  name: string;
  content: MessageFragment[];
  color?: string;
}

function ChatMessage({
  message: { name, content, color },
  opacity,
}: {
  message: Message;
  opacity: number;
}) {
  const [nameEl, setNameEl] = useState<HTMLDivElement | null>(null);
  const [invertFgColor, setInvertFgColor] = useState(false);

  useEffect(() => {
    if (!color || !nameEl) return;

    const bgColor = hexToRgb(color);
    const fgColor = getFgColorRgb(nameEl);

    if (!bgColor || !fgColor) return;

    if (isSimilarColor(bgColor, fgColor)) {
      setInvertFgColor(true);
    }
  }, [color, nameEl]);

  const emoteImgUrl = (emoteId: string) =>
    `https://static-cdn.jtvnw.net/emoticons/v2/${emoteId}/static/light/2.0`;

  const nameClass = ['name', invertFgColor && 'inverted'].filter(Boolean).join(' ');

  return (
    <div className="ChatMessage" style={{ opacity }}>
      <div ref={setNameEl} className={nameClass} style={color ? { background: color } : undefined}>
        {name}
      </div>
      <Backgrounded className="content" pattern="dots">
        {content.map(({ text, emoteId }, index) => {
          if (emoteId) {
            return <img key={index} alt={text} src={emoteImgUrl(emoteId)} className="emoji" />;
          } else {
            return <span key={index}>{text}</span>;
          }
        })}
      </Backgrounded>
    </div>
  );
}

function msgFromWsMsg(msg: WSMessage, onConnect?: (sessionId: string) => void): Message | null {
  if (isMsgType(msg, 'session_welcome')) {
    onConnect?.(msg.payload.session.id);
    return {
      id: 'welcome',
      type: 'welcome',
      name: 'SYSTEM',
      content: [{ text: 'Joined chat!' }],
    };
  }

  if (isMsgType(msg, 'notification')) {
    return {
      id: msg.payload.event.message_id,
      type: 'chat',
      name: msg.payload.event.chatter_user_name,
      content: msg.payload.event.message.fragments.map((fragment) => {
        if (fragment.type == 'emote') {
          return { text: fragment.text, emoteId: fragment.emote?.id };
        } else {
          return { text: fragment.text };
        }
      }),
      color: msg.payload.event.color,
    };
  } else if (isMsgType(msg, 'session_keepalive')) {
  } else {
    console.warn(
      `unhandled websocket message_type: ${msg.metadata.message_type}\n${JSON.stringify(msg.payload)}`,
    );
  }
  return null;
}

type SubscribeOptions = {
  type: 'channel.chat.message';
  version: '1';
  condition: {
    broadcaster_user_id: string;
    user_id: string;
  };
};

async function subscribe(session_id: string, options: SubscribeOptions) {
  const { type, version, condition } = options;
  return await callTwitchApi('https://api.twitch.tv/helix/eventsub/subscriptions', {
    method: 'POST',
    body: JSON.stringify({
      type,
      version,
      condition,
      transport: {
        method: 'websocket',
        session_id,
      },
    }),
  });
}
