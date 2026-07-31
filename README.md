# 🎓 AI Classroom Assistant

An AI-powered personalized learning platform that helps students learn smarter by generating AI explanations, answering questions from uploaded documents, creating quizzes, building study plans, and providing learning analytics.

---

## 🚀 Features

### 🔐 Authentication
- User Registration & Login
- JWT Authentication
- Secure Password Hashing
- Protected Routes

### 📄 Document Upload
- Upload PDF and DOCX files
- Automatic text extraction
- Store document metadata
- View extracted document content

### 🤖 AI Study Guide
- Generate easy-to-understand explanations
- AI-powered summaries
- Structured learning content
- ChatGPT-style formatting

### 💬 AI Document Chat (RAG)
- Ask questions about uploaded documents
- Context-aware responses
- Retrieval-Augmented Generation (RAG)
- Conversational AI interface

### 📝 AI Quiz Generator
- Generate Multiple Choice Questions
- Difficulty Levels (Easy / Medium / Hard)
- Instant Evaluation
- Quiz History
- Score Tracking

### 📅 Study Planner
- AI-generated personalized study plans
- Daily learning schedules
- Organized study roadmap

### 📊 Learning Analytics
- Quiz Performance
- Learning Progress
- Dashboard Statistics
- Study Insights

### 📈 Dashboard
- Uploaded Documents Count
- Generated Quizzes
- Study Plans
- Learning Overview
- Recent Activities

---

# 🛠 Tech Stack

## Frontend
- React.js
- Vite
- JavaScript
- CSS

## Backend
- FastAPI
- Python

## Database
- MongoDB

## AI & NLP
- Google Gemini API
- Retrieval-Augmented Generation (RAG)

## Authentication
- JWT
- Passlib (bcrypt)

## Document Processing
- PyMuPDF
- python-docx

---

# 📂 Project Structure

```
AI-Classroom-Assistant/
│
├── backend/
│   ├── app/
│   ├── routes/
│   ├── services/
│   ├── models/
│   ├── database.py
│   ├── dependencies.py
│   └── main.py
│
├── frontend/
│   ├── src/
│   ├── components/
│   ├── pages/
│   ├── services/
│   └── App.jsx
│
├── .gitignore
├── README.md
└── requirements.txt
```

---

# ⚙️ Installation

## 1️⃣ Clone Repository

```bash
git clone https://github.com/vrindaaaaa/Ai-Classroom_assistant.git
```

```bash
cd Ai-Classroom_assistant
```

---

## 2️⃣ Backend Setup

```bash
cd backend
```

Create Virtual Environment

```bash
python -m venv .venv
```

Activate

### Windows

```bash
.venv\Scripts\activate
```

Install Dependencies

```bash
pip install -r requirements.txt
```

Create a `.env` file inside the backend directory:

```env
MONGODB_URL=your_mongodb_connection_string
SECRET_KEY=your_secret_key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
GEMINI_API_KEY=your_gemini_api_key
```

Run Backend

```bash
uvicorn app.main:app --reload
```

---

## 3️⃣ Frontend Setup

```bash
cd frontend
```

Install packages

```bash
npm install
```

Run

```bash
npm run dev
```

---

# 📷 Screenshots

Add screenshots here after uploading them.

Example:

```
screenshots/
│
├── login.png
├── dashboard.png
├── upload.png
├── explanation.png
├── chat.png
├── quiz.png
├── planner.png
└── analytics.png
```

---

# 📌 Modules

- User Authentication
- Dashboard
- Document Upload
- AI Study Guide
- AI Chat
- Quiz Generation
- Quiz History
- Study Planner
- Learning Analytics

---

# 🔄 Workflow

```
User Login
      │
      ▼
Upload PDF/DOCX
      │
      ▼
Extract Text
      │
      ▼
Store in MongoDB
      │
      ▼
Generate AI Study Guide
      │
      ├───────────────┐
      ▼               ▼
 AI Chat          AI Quiz
      │               │
      └───────┬───────┘
              ▼
      Study Planner
              │
              ▼
      Learning Analytics
```

---

# 🔮 Future Enhancements

- Voice-based Learning Assistant
- Handwritten Notes OCR
- Flashcard Generation
- AI Recommendation Engine
- Multi-language Support
- Teacher Dashboard
- Student Progress Reports

---

# 👩‍💻 Author

**Vrinda Kumtakar**

GitHub:
https://github.com/vrindaaaaa

---

# ⭐ If you found this project useful, please consider giving it a star!
