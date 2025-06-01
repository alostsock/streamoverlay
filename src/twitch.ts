interface BaseWebSocketMessage<MessageType, Payload> {
  metadata: {
    message_id: string;
    message_type: MessageType;
    message_timestamp: string;
  };
  payload: Payload;
}

type WelcomeMessage = BaseWebSocketMessage<
  'session_welcome',
  {
    session: {
      id: string;
    };
  }
>;

type KeepAliveMessage = BaseWebSocketMessage<'session_keepalive', {}>;

type ChatMessage = BaseWebSocketMessage<
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

type UnknownMessage = BaseWebSocketMessage<string, unknown>;

export type WSMessage = WelcomeMessage | ChatMessage | KeepAliveMessage | UnknownMessage;

// Nested tagged union fix
// https://github.com/microsoft/TypeScript/issues/18758#issuecomment-1458957930
export function isMsgType<MessageType extends string>(
  msg: { metadata: { message_type: string } },
  type: MessageType,
): msg is { metadata: { message_type: MessageType } } {
  return msg.metadata.message_type === type;
}
