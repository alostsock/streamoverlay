import { useEffect, useState } from 'preact/hooks';
import { callTwitchApi } from './twitch-auth';

const WS_URL = 'wss://eventsub.wss.twitch.tv/ws?keepalive_timeout_seconds=10';
const USER_ID = import.meta.env.VITE_TWITCH_USER_ID;

interface BaseWebSocketMessage<MessageType, Payload> {
  metadata: {
    message_id: string;
    message_type: MessageType;
    message_timestamp: string;
  };
  payload: Payload;
}

type WSWelcomeMessage = BaseWebSocketMessage<
  'session_welcome',
  {
    session: {
      id: string;
    };
  }
>;

type WSChatMessage = BaseWebSocketMessage<
  'notification',
  {
    subscription: {
      type: 'channel.chat.message';
      created_at: string;
    };
    event: {
      chatter_user_id: string;
      chatter_user_name: string;
      message_id: string;
      message: {
        text: string;
        fragments: Array<{
          type: 'text' | 'cheermote' | 'emote' | 'mention';
          text: string;
          cheermote: {
            prefix: string;
            bits: number;
            tier: number;
          } | null;
          emote: {
            id: string;
            emote_set_id: string;
            owner_id: string;
            format: Array<'animated' | 'static'>;
          } | null;
          mention: {
            user_id: string;
            user_name: string;
          } | null;
        }>;
      };
      message_type:
        | 'text'
        | 'channel_points_highlighted'
        | 'channel_points_sub_only'
        | 'user_intro'
        | 'power_ups_message_effect'
        | 'power_ups_gigantified_emote';
      badges: Array<{
        id: string;
        set_id: string;
        info: string;
      }>;
      cheer: { bits: number } | null;
      color: string;
    };
  }
>;

type WSMessage = WSWelcomeMessage | WSChatMessage;

interface Message {
  type: 'welcome' | string;
  text: string;
}

export function Chat() {
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data) as WSMessage;
      if (data.metadata.message_type === 'session_welcome') {
        setSessionId(data.payload.session.id);
      } else {
        console.warn(
          `unhandled websocket message_type: ${data.metadata.message_type}\n${data.payload}`,
        );
      }
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
      {msgs.map((msg) => (
        <div>{msg.text}</div>
      ))}
    </div>
  );
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
