import API from "../api/axios";

const plannerService = {
  generatePlan: async (userId, title, examDate, hoursPerDay, documentId = null) => {
    const payload = {
      user_id: userId,
      title,
      exam_date: examDate,
      hours_per_day: parseInt(hoursPerDay, 10),
    };
    if (documentId) {
      payload.document_id = documentId;
    }
    const response = await API.post("/study-plans/generate", payload);
    return response.data;
  }
};

export default plannerService;
