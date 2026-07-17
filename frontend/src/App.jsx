import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import Layout from "./components/Layout";
import SettingsPage from "./pages/SettingsPage";
import NotFoundPage from "./pages/NotFoundPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import ChatPage from "./pages/ChatPage";
import Dashboard from "./pages/Dashboard";
import LandingPage from "./pages/LandingPage";
import Login from "./pages/Login";
import OCRPage from "./pages/OCRPage";
import PlannerPage from "./pages/PlannerPage";
import QuizPage from "./pages/QuizPage";
import Signup from "./pages/Signup";
import UploadPage from "./pages/UploadPage";
import DocumentTextPage from "./pages/DocumentTextPage";
import DocumentExplanationPage from "./pages/DocumentExplanationPage";

function ProtectedRoute({ children }) {
  const token = localStorage.getItem("token");
  return token ? children : <Navigate to="/login" replace />;
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            {/* Protected routes */}
            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/upload" element={<UploadPage />} />
              <Route path="/documents/:id/extracted" element={<DocumentTextPage />} />
              <Route path="/documents/:id/explanation" element={<DocumentExplanationPage />} />
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/ocr" element={<OCRPage />} />
              <Route path="/quizzes" element={<QuizPage />} />
              <Route path="/planner" element={<PlannerPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;