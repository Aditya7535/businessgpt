import apiClient from './api';

export interface ChatResponse {
  response?: string;
  answer?: string;
  session_id: string;
  module_used?: string;
  sources?: string[];
  confidence?: number;
  inventory_adjustment?: any;
  source_nodes?: string[];
  suggested_actions?: string[];
}

export const chatService = {
  async sendMessage(message: string, sessionId?: string): Promise<ChatResponse> {
    const response = await apiClient.post<ChatResponse>('/api/chat', {
      message,
      session_id: sessionId,
    });
    return response.data;
  },

  async getSessions(): Promise<Array<{ id: string; title: string; created_at: string }>> {
    const response = await apiClient.get('/api/chat/sessions');
    return response.data;
  },

  async deleteSession(id: string): Promise<void> {
    await apiClient.delete(`/api/chat/sessions/${id}`);
  },

  async transcribeVoice(audioFormData: FormData): Promise<{ text: string }> {
    const response = await apiClient.post<{ text: string }>('/api/voice/transcribe', audioFormData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};

export default chatService;
