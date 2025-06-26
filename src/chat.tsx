import { useEffect, useState } from 'preact/hooks';

import { callTwitchApi } from './twitch-auth';
import { WSMessage, isMsgType } from './twitch';
import { Backgrounded } from './backgrounded';
import { getFgColorRgb, hexToRgb, isSimilarColor } from './color-utils';

const WS_URL = 'wss://eventsub.wss.twitch.tv/ws?keepalive_timeout_seconds=10';
const USER_ID = import.meta.env.VITE_TWITCH_USER_ID;

const MAX_MSGS = 50;
const OPACITY_FADE_RATE = 0.03;

export function Chat() {
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);

    const append = (msg: Message) =>
      setMsgs((prevMsgs) => {
        while (prevMsgs.length > MAX_MSGS) {
          prevMsgs.shift();
        }
        return [...prevMsgs, msg];
      });

    ws.onmessage = (event) => {
      const wsMsg = JSON.parse(event.data) as WSMessage;
      const msg = msgFromWsMsg(wsMsg, setSessionId);
      if (msg) append(msg);
    };

    return () => {
      ws.close();
    };
  }, []);

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

interface Message {
  id: string;
  type: 'welcome' | 'chat';
  name: string;
  text: string;
  color?: string;
}

function ChatMessage({
  message: { name, text, color },
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

  const nameClass = ['name', invertFgColor && 'inverted'].filter(Boolean).join(' ');

  return (
    <div className="ChatMessage" style={{ opacity }}>
      <div ref={setNameEl} className={nameClass} style={color ? { background: color } : undefined}>
        {name}
      </div>
      <Backgrounded className="content" pattern="dots">
        {text}
      </Backgrounded>
    </div>
  );
}

function msgFromWsMsg(msg: WSMessage, onConnect?: (sessionId: string) => void): Message | null {
  if (isMsgType(msg, 'session_welcome')) {
    onConnect?.(msg.payload.session.id);
    return { id: 'welcome', type: 'welcome', name: 'SYSTEM', text: 'Joined chat!' };
  }

  if (isMsgType(msg, 'notification')) {
    return {
      id: msg.payload.event.message_id,
      type: 'chat',
      name: msg.payload.event.chatter_user_name,
      text: msg.payload.event.message.text,
      color: msg.payload.event.color,
    };
  }

  console.warn(
    `unhandled websocket message_type: ${msg.metadata.message_type}\n${JSON.stringify(msg.payload)}`,
  );
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
