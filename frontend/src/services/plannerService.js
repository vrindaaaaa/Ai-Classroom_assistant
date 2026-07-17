import API from "../api/axios";

const plannerService = {
  generatePlan: async (userId, title, examDate, hoursPerDay) => {
    const response = await API.post("/study-plans/generate", {
      user_id: userId,
      title,
      exam_date: examDate,
      hours_per_day: parseInt(hoursPerDay, 10)
    });
    return response.data;
  }
};

export default plannerService;
