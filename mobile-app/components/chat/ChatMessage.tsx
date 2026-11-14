import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import Colors from '../../constants/colors';
import { Shadows } from '../../constants/theme';
import { ChatMessage as ChatMessageType } from '../../types';

interface ChatMessageProps {
  message: ChatMessageType;
  children?: React.ReactNode;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, children }) => {
  const isUser = message.role === 'user';

  return (
    <View
      style={[
        styles.row,
        isUser ? styles.rowUser : styles.rowAssistant,
      ]}
    >
      {!isUser && (
        <Image
          source={require('../../assets/logo_mark.png')}
          style={styles.avatar}
          resizeMode="contain"
        />
      )}

      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleAssistant,
        ]}
      >
        <Text
          style={[
            styles.text,
            isUser ? styles.textUser : styles.textAssistant,
          ]}
        >
          {message.content}
        </Text>

        {children}

        <Text
          style={[
            styles.time,
            isUser ? styles.timeUser : styles.timeAssistant,
          ]}
        >
          {message.timestamp}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginBottom: 14,
    paddingHorizontal: 12,
    gap: 8,
    alignItems: 'flex-end',
  },
  rowUser: {
    justifyContent: 'flex-end',
  },
  rowAssistant: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.black,
  },
  bubble: {
    maxWidth: '82%',
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    ...Shadows.brutalSm,
  },
  bubbleUser: {
    backgroundColor: Colors.lime,
    borderBottomRightRadius: 2,
  },
  bubbleAssistant: {
    backgroundColor: Colors.white,
    borderBottomLeftRadius: 2,
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
  },
  textUser: {
    color: Colors.black,
    fontWeight: '600',
  },
  textAssistant: {
    color: Colors.textMain,
    fontWeight: '500',
  },
  time: {
    fontSize: 10,
    marginTop: 6,
    alignSelf: 'flex-end',
  },
  timeUser: {
    color: '#3f5e00',
    fontWeight: '600',
  },
  timeAssistant: {
    color: Colors.textDim,
  },
});

export default ChatMessage;
