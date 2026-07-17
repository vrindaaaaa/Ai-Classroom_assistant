import API from "../api/axios";

const uploadService = {
  uploadDocument: async (title, file, onUploadProgress) => {
    const formData = new FormData();
    formData.append("title", title || file.name);
    formData.append("file", file);

    const response = await API.post("/documents/upload", formData, {
      onUploadProgress,
    });
    return response.data;
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
};

export default uploadService;
