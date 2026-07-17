import API from "../api/axios";

const transcriptionService = {
  transcribeAudio: async (file) => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await API.post("/transcribe/audio", formData, {
      headers: {
        "Content-Type": "multipart/form-data"
      }
    });
    return response.data;
  }
};

export default transcriptionService;
