import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import Colors from '../../constants/colors';
import { Shadows } from '../../constants/theme';
import Header from '../../components/ui/Header';
import ChatMessage from '../../components/chat/ChatMessage';
import StockProposalCard from '../../components/chat/StockProposalCard';
import { ChatMessage as ChatMessageType, ConversationalProposal } from '../../types';
import chatService from '../../services/chat.service';
import inventoryService from '../../services/inventory.service';
import { Send, Mic, Sparkles, RefreshCw, Volume2 } from 'lucide-react-native';

const SUGGESTED_PROMPTS = [
  'Aaj kitni sale hui?',
  '50 packet Maggi stock aaya',
  'Kaunsa product reorder karna chahiye?',
  'Mujhe low stock products dikhao',
  'Is month ka top selling item kaunsa hai?',
];

export default function ChatScreen() {
  const [messages, setMessages] = useState<ChatMessageType[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Namaste! Main aapka BusinessGPT AI Partner hoon. Aap mujhse Hindi, Hinglish ya English mein sales, inventory ya profit ke baare mein pooch sakte hain, ya bolkar stock update kar sakte hain.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [isRecording, setIsRecording] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    const userMsg: ChatMessageType = {
      id: Date.now().toString(),
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // Check if user is trying a conversational inventory stock adjustment
      const isStockCommand =
        /(stock|packet|peice|box|carton|aaya|bika|aaye|bik|update|karo|bheja)/i.test(query);

      let proposal: ConversationalProposal | undefined;

      if (isStockCommand) {
        try {
          const propRes: any = await inventoryService.proposeConversationalAdjustment(query);
          if (propRes) {
            if (propRes.proposals && propRes.proposals.length > 0) {
              const p = propRes.proposals[0];
              proposal = {
                operation: (p.net_change >= 0 ? 'ADD' : 'REMOVE') as any,
                product_id: p.product_id,
                product_name: p.product_name,
                quantity: Math.abs(p.net_change),
                unit: p.unit || 'units',
                confidence: 0.95,
                current_stock: p.previous_stock ?? 0,
                projected_stock: p.new_stock ?? 0,
                needs_clarification: false,
                pending_id: propRes.pending_id,
                session_id: propRes.session_id,
              };
            } else if (propRes.product_name && !propRes.needs_clarification) {
              proposal = propRes;
            }
          }
        } catch {
          // If proposal fails or not matched, proceed with standard AI chat
        }
      }

      // Call the main AI Chat backend
      const res = await chatService.sendMessage(query, sessionId);
      if (res.session_id) {
        setSessionId(res.session_id);
      }

      let finalProposal = proposal;
      if (!finalProposal && res.inventory_adjustment) {
        finalProposal = {
          operation: (res.inventory_adjustment.operation || 'ADD') as any,
          product_id: res.inventory_adjustment.product_id,
          product_name: res.inventory_adjustment.product_name,
          quantity: res.inventory_adjustment.quantity,
          unit: res.inventory_adjustment.unit || 'units',
          confidence: res.confidence || 0.95,
          current_stock: res.inventory_adjustment.current_stock || 0,
          projected_stock: res.inventory_adjustment.projected_stock || 0,
          needs_clarification: false,
        };
      }

      const botMsg: ChatMessageType = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: res.response || res.answer || 'I have analyzed your request.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        proposal: finalProposal,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessageType = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Error: ${err.message || 'Could not connect to AI service. Please check backend connection.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleVoiceSimulate = () => {
    // Demonstrates instant voice-to-text recognition
    setIsRecording(true);
    setTimeout(() => {
      setIsRecording(false);
      handleSend('50 packet Maggi stock aaya');
    }, 1200);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      style={styles.container}
    >
      <Header
        title="BusinessGPT AI Copilot"
        subtitle="Voice & Business Intelligence"
        rightAction={
          <TouchableOpacity
            onPress={() => {
              setMessages([
                {
                  id: 'welcome',
                  role: 'assistant',
                  content: 'Chat session refreshed. How can I help with your store today?',
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                },
              ]);
              setSessionId(undefined);
            }}
            style={styles.refreshBtn}
          >
            <RefreshCw size={16} color={Colors.black} />
          </TouchableOpacity>
        }
      />

      {/* Suggested Quick Prompts */}
      <View style={styles.promptBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.promptScroll}
        >
          {SUGGESTED_PROMPTS.map((prompt, idx) => (
            <TouchableOpacity
              key={idx}
              onPress={() => handleSend(prompt)}
              style={styles.promptChip}
            >
              <Sparkles size={12} color={Colors.black} />
              <Text style={styles.promptText}>{prompt}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Messages Stream */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        renderItem={({ item }) => (
          <ChatMessage message={item}>
            {item.proposal && (
              <StockProposalCard
                proposal={item.proposal}
                onConfirmed={() => {
                  setMessages((prev) => [
                    ...prev,
                    {
                      id: Date.now().toString(),
                      role: 'assistant',
                      content: `Transaction confirmed and saved to store database: ${item.proposal?.product_name} is updated.`,
                      timestamp: new Date().toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      }),
                    },
                  ]);
                }}
              />
            )}
          </ChatMessage>
        )}
      />

      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={Colors.black} />
          <Text style={styles.loadingText}>BusinessGPT is analyzing store data...</Text>
        </View>
      )}

      {/* Input Row */}
      <View style={styles.inputContainer}>
        <TouchableOpacity
          onPress={handleVoiceSimulate}
          style={[
            styles.micBtn,
            isRecording && styles.micBtnActive,
          ]}
        >
          <Mic size={20} color={isRecording ? Colors.white : Colors.black} />
        </TouchableOpacity>

        <TextInput
          placeholder="Ask in Hindi, Marathi, or English..."
          placeholderTextColor={Colors.textDim}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => handleSend()}
          style={styles.input}
        />

        <TouchableOpacity
          disabled={!input.trim() || loading}
          onPress={() => handleSend()}
          style={[
            styles.sendBtn,
            !input.trim() && { opacity: 0.5 },
          ]}
        >
          <Send size={18} color={Colors.black} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.warmBg,
  },
  refreshBtn: {
    padding: 8,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 6,
    backgroundColor: Colors.white,
  },
  promptBar: {
    borderBottomWidth: 1,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.white,
    paddingVertical: 8,
  },
  promptScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  promptChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  promptText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMain,
  },
  messageList: {
    paddingVertical: 16,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  loadingText: {
    fontSize: 12,
    color: Colors.textDim,
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: Colors.white,
    borderTopWidth: 2,
    borderColor: Colors.border,
    gap: 8,
  },
  micBtn: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.brutalSm,
  },
  micBtnActive: {
    backgroundColor: Colors.redDark,
  },
  input: {
    flex: 1,
    height: 44,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: Colors.warmBg,
    fontSize: 14,
    color: Colors.textMain,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.brutalSm,
  },
});
