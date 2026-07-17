import API from "../api/axios";

const ocrService = {
  extractOCR: async (file) => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await API.post("/ocr/extract", formData, {
      headers: {
        "Content-Type": "multipart/form-data"
      }
    });
    return response.data;
  }
};

export default ocrService;
