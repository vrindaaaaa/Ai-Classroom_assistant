import API from "../api/axios";

const dashboardService = {
  getMetrics: async () => {
    const response = await API.get("/dashboard/");
    return response.data;
  },

  getAnalytics: async () => {
    const response = await API.get("/dashboard/analytics");
    return response.data;
  }
};

export default dashboardService;
