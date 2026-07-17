import API from "../api/axios";

const quizService = {
  generateQuiz: async (title, difficulty, material) => {
    const response = await API.post("/quizzes/generate", {
      title,
      difficulty,
      material
    });
    return response.data;
  },

  saveQuizResult: async (userId, quizId, score, feedback = "") => {
    const response = await API.post("/quizzes/results", {
      user_id: userId,
      quiz_id: quizId,
      score: parseFloat(score),
      feedback
    });
    return response.data;
  }
};

export default quizService;
