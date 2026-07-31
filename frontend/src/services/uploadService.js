import API from "../api/axios";

const uploadService = {
  uploadDocument: async (title, file, onUploadProgress) => {
    const formData = new FormData();
    formData.append("title", title || file.name);
    formData.append("file", file);

    console.log("[uploadService] POST /documents/upload", {
      title,
      fileName: file?.name,
      fileSize: file?.size,
      fileType: file?.type,
    });

    try {
      const response = await API.post("/documents/upload", formData, {
        onUploadProgress,
      });
      console.log("[uploadService] response.data =", response.data);
      return response.data;
    } catch (error) {
      console.error("[uploadService] upload error:", error);
      console.error("[uploadService] error.response:", error.response);
      console.error("[uploadService] error.response?.data:", error.response?.data);
      throw error;
    }
  },

  getDocuments: async () => {
    const response = await API.get("/documents/");
    return response.data;
  },

  deleteDocument: async (documentId) => {
    const response = await API.delete(`/documents/${documentId}`);
    return response.data;
  },

  getDocument: async (documentId) => {
    const response = await API.get(`/documents/${documentId}`);
    return response.data;
  },

  downloadDocument: async (documentId) => {
    const response = await API.get(`/documents/${documentId}`, {
      params: { download: "true" },
      responseType: "blob",
    });
    return response;
  },

  generateExplanation: async (documentId) => {
    const response = await API.post(`/documents/${documentId}/explanation`);
    return response.data;
  },
};

export default uploadService;
