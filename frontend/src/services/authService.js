import API from "../api/axios";

const authService = {
  login: async (email, password) => {
    const response = await API.post("/auth/login", { email, password });
    return response.data;
  },

  register: async (name, email, password, role = "student") => {
    const response = await API.post("/auth/register", { name, email, password, role });
    return response.data;
  },

  getMe: async () => {
    const response = await API.get("/auth/me");
    return response.data;
  }
};

export default authService;
