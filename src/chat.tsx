import { useEffect, useState } from 'preact/hooks';

import { callTwitchApi } from './twitch-auth';
import { WSMessage, isMsgType } from './twitch';
import { Backgrounded } from './backgrounded';
import { getFgColorRgb, hexToRgb, isSimilarColor } from './color-utils';

const WS_URL = 'wss://eventsub.wss.twitch.tv/ws?keepalive_timeout_seconds=10';
const USER_ID = import.meta.env.VITE_TWITCH_USER_ID;

const MAX_MSGS = 50;
const OPACITY_FADE_RATE = 0.04;

export function Chat() {
  // const [wsMsgs, setWsMsgs] = useState<WSMessage[]>([]);
  const [msgs, setMsgs] = useState<Message[]>(
    [],
    // testMessages.map((m) => msgFromWsMsg(m)).filter(Boolean) as Message[],
  );
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);

    // const appendWs = (msg: WSMessage) => setWsMsgs((prev) => [...prev, msg]);
    const append = (msg: Message) =>
      setMsgs((prevMsgs) => {
        while (prevMsgs.length > MAX_MSGS) {
          prevMsgs.shift();
        }
        return [...prevMsgs, msg];
      });

    ws.onmessage = (event) => {
      const wsMsg = JSON.parse(event.data) as WSMessage;
      // appendWs(wsMsg);
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

const testMessages = [
  {
    metadata: {
      message_id: 'cb10d8f1-0f13-4c85-9405-83ea5a9d9f48',
      message_type: 'session_welcome',
      message_timestamp: '2025-06-01T05:08:19.877720518Z',
    },
    payload: {
      session: {
        id: 'AgoQ8CmQlsdoQd2ITQEsc23n5RIGY2VsbC1i',
        status: 'connected',
        connected_at: '2025-06-01T05:08:19.8729835Z',
        keepalive_timeout_seconds: 10,
        reconnect_url: null,
        recovery_url: null,
      },
    },
  },
  {
    metadata: {
      message_id: 'Sj1x_D_IUgj-Q-piYBt2waQyVUphIvzjqmDsTlOUlUc=',
      message_type: 'notification',
      message_timestamp: '2025-06-01T05:08:23.577688474Z',
      subscription_type: 'channel.chat.message',
      subscription_version: '1',
    },
    payload: {
      subscription: {
        id: '17bfbc3e-13ac-4532-aa99-7c0d10b7c32a',
        status: 'enabled',
        type: 'channel.chat.message',
        version: '1',
        condition: {
          broadcaster_user_id: '107561125',
          user_id: '107561125',
        },
        transport: {
          method: 'websocket',
          session_id: 'AgoQ8CmQlsdoQd2ITQEsc23n5RIGY2VsbC1i',
        },
        created_at: '2025-06-01T05:08:20.011592553Z',
        cost: 0,
      },
      event: {
        broadcaster_user_id: '107561125',
        broadcaster_user_login: 'para_sox',
        broadcaster_user_name: 'para_sox',
        source_broadcaster_user_id: null,
        source_broadcaster_user_login: null,
        source_broadcaster_user_name: null,
        chatter_user_id: '107561125',
        chatter_user_login: 'para_sox',
        chatter_user_name: 'para_sox',
        message_id: 'd01eafc2-c3f1-47f7-80de-f266107e221d',
        source_message_id: null,
        is_source_only: null,
        message: {
          text: 'this is a test message',
          fragments: [
            {
              type: 'text',
              text: 'this is a test message',
              cheermote: null,
              emote: null,
              mention: null,
            },
          ],
        },
        color: '#5F9EA0',
        badges: [
          {
            set_id: 'broadcaster',
            id: '1',
            info: '',
          },
        ],
        source_badges: null,
        message_type: 'text',
        cheer: null,
        reply: null,
        channel_points_custom_reward_id: null,
        channel_points_animation_id: null,
      },
    },
  },
  {
    metadata: {
      message_id: '999f577f-b60a-40d0-989b-2400eef22189',
      message_type: 'session_keepalive',
      message_timestamp: '2025-06-01T05:08:33.713906542Z',
    },
    payload: {},
  },
  {
    metadata: {
      message_id: '7WPjCm1enBd7ugzd7aLxutNHPl2jk8t6iMamEkNt6mQ=',
      message_type: 'notification',
      message_timestamp: '2025-06-01T05:08:47.150618114Z',
      subscription_type: 'channel.chat.message',
      subscription_version: '1',
    },
    payload: {
      subscription: {
        id: '17bfbc3e-13ac-4532-aa99-7c0d10b7c32a',
        status: 'enabled',
        type: 'channel.chat.message',
        version: '1',
        condition: {
          broadcaster_user_id: '107561125',
          user_id: '107561125',
        },
        transport: {
          method: 'websocket',
          session_id: 'AgoQ8CmQlsdoQd2ITQEsc23n5RIGY2VsbC1i',
        },
        created_at: '2025-06-01T05:08:20.011592553Z',
        cost: 0,
      },
      event: {
        broadcaster_user_id: '107561125',
        broadcaster_user_login: 'para_sox',
        broadcaster_user_name: 'para_sox',
        source_broadcaster_user_id: null,
        source_broadcaster_user_login: null,
        source_broadcaster_user_name: null,
        chatter_user_id: '107561125',
        chatter_user_login: 'para_sox',
        chatter_user_name: 'para_sox',
        message_id: '7d6a7085-ef0c-4224-abda-56fdaf8a5426',
        source_message_id: null,
        is_source_only: null,
        message: {
          text: 'another message with an emoji PokPikachu',
          fragments: [
            {
              type: 'text',
              text: 'another message with an emoji ',
              cheermote: null,
              emote: null,
              mention: null,
            },
            {
              type: 'emote',
              text: 'PokPikachu',
              cheermote: null,
              emote: {
                id: '743904',
                emote_set_id: '19194',
                owner_id: '0',
                format: ['static'],
              },
              mention: null,
            },
          ],
        },
        color: '#5F9EA0',
        badges: [
          {
            set_id: 'broadcaster',
            id: '1',
            info: '',
          },
        ],
        source_badges: null,
        message_type: 'text',
        cheer: null,
        reply: null,
        channel_points_custom_reward_id: null,
        channel_points_animation_id: null,
      },
    },
  },
];
