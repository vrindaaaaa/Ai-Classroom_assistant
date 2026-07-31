import API from "../api/axios";

/**
 * Extract the most descriptive error message from a failed quiz API call.
 * The backend returns structured errors: { success, step, error, exception, traceback }
 * Falls back to err.message if no backend detail is available.
 */
export function extractQuizError(err) {
  const data = err?.response?.data;
  if (data) {
    if (data?.message) return data.message;
    if (data?.error) return data.error;
    if (data?.detail?.message) return data.detail.message;
    if (typeof data.detail === "string") return data.detail;
    if (Array.isArray(data.detail)) return data.detail.map((d) => d.msg || JSON.stringify(d)).join("; ");
  }
  return err?.message || "An unknown error occurred.";
}

const quizService = {
  generateQuiz: async (title, difficulty, material) => {
    const response = await API.post("/quizzes/generate", {
      title,
      difficulty,
      material,
    });
    return response.data;
  },

  generateDocumentQuiz: async (documentId, title, difficulty) => {
    const response = await API.post(
      `/documents/${documentId}/quiz/generate`,
      { title, difficulty }
    );
    return response.data;
  },

  submitQuizResult: async (userId, quizId, score, feedback = "") => {
    const response = await API.post("/quizzes/results", {
      user_id: userId,
      quiz_id: quizId,
      score: parseFloat(score),
      feedback,
    });
    return response.data;
  },

  submitDocumentQuiz: async (
    documentId,
    userId,
    quizId,
    score,
    feedback = "",
    selectedAnswers = {}
  ) => {
    const response = await API.post(`/documents/${documentId}/quiz/submit`, {
      user_id: userId,
      quiz_id: quizId,
      score: parseFloat(score),
      feedback,
      selected_answers: selectedAnswers,
    });
    return response.data;
  },

  getDocuments: async () => {
    const response = await API.get("/documents/");
    return response.data;
  },

  getQuizHistory: async (documentId) => {
    if (documentId) {
      const response = await API.get(
        `/quizzes/documents/${documentId}/quizzes`
      );
      return response.data;
    }
    const response = await API.get("/quiz-history");
    return response.data;
  },

  getQuizDashboardHistory: async () => {
    const response = await API.get("/quizzes/history");
    return response.data;
  },

  getQuiz: async (quizId) => {
    const response = await API.get(`/quizzes/${quizId}`);
    return response.data;
  },

  getQuizResult: async (quizId) => {
    const response = await API.get(`/quizzes/${quizId}/result`);
    return response.data;
  },

  resumeQuiz: async (quizId) => {
    const response = await API.patch(`/quizzes/${quizId}/resume`);
    return response.data;
  },

  retakeQuiz: async (quizId) => {
    const response = await API.post(`/quizzes/${quizId}/retake`);
    return response.data;
  },

  deleteQuiz: async (quizId) => {
    const response = await API.delete(`/quizzes/${quizId}`);
    return response.data;
  },

  clearQuizHistory: async () => {
    const response = await API.delete("/quizzes/history");
    return response.data;
  },
};

export default quizService;
