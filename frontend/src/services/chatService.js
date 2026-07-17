import API from "../api/axios";

const chatService = {
  askQuestion: async (question) => {
    const response = await API.post("/rag/chat", { question });
    return response.data;
  }
};

export default chatService;
