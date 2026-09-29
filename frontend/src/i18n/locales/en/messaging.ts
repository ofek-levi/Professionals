/** Conversation list and chat copy. */
export const messaging = {
  conversations: {
    you: 'You: {{text}}',
    youPrefix: 'You:',
    noMessages: 'No messages yet. Say hello!',
    unread_one: '{{count}} unread message',
    unread_other: '{{count}} unread messages',
    empty: 'No conversations yet',
    a11y: {
      openHint: 'Opens the chat',
    },
  },
  chat: {
    placeholder: 'Write a message…',
    send: 'Send message',
    sending: 'Sending…',
    sent: 'Sent',
    read: 'Read',
    failed: 'Not sent · Tap to retry',
    failedA11y: 'Not sent. Double-tap to try again.',
    discardTitle: 'Delete this message?',
    discardMessage: 'It wasn’t sent and will be removed from this chat.',
    closedMessage: 'This chat was closed because the job was cancelled.',
    closedPlaceholder: 'Messaging is closed',
    charactersLeft_one: '{{count}} character left',
    charactersLeft_other: '{{count}} characters left',
    beginningTitle: 'Say hello to {{name}}',
    beginningDescription: 'Use this chat to agree on the details: access, parking, materials or a change of plans.',
    viewJob: 'View job',
    notFoundTitle: 'Chat not found',
    notFoundDescription: 'This conversation may have been removed or you no longer have access to it.',
    a11y: {
      fromYou: 'You, {{time}}: {{text}}',
      fromOther: '{{name}}, {{time}}: {{text}}',
      jobDetails: 'Open job details',
    },
  },
} as const;
