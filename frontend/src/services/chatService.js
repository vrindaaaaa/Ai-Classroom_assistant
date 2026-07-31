import API from "../api/axios";

const chatService = {
  askQuestion: async (question, documentId, conversationHistory = []) => {
    const response = await API.post("/rag/chat", {
      question,
      document_id: documentId || null,
      conversation_history: conversationHistory,
    });
    return response.data;
  }
};

export default chatService;
