# AI Agent Evaluation and Observability Platform

A comprehensive platform for evaluating, monitoring, debugging, and improving Retrieval-Augmented Generation (RAG) applications and tool-using AI agents.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React Frontend                        │
│  (TypeScript, Vite, Material UI, Recharts)              │
├─────────────────────────────────────────────────────────┤
│                    FastAPI Backend                        │
│  (Python, Pydantic, SQLAlchemy)                         │
├──────────┬──────────┬──────────┬────────────────────────┤
│ RAG      │ Agent    │ Eval     │ Observability          │
│ Pipeline │ Engine   │ Engine   │ & Tracing              │
├──────────┴──────────┴──────────┴────────────────────────┤
│  SQLite DB  │  FAISS Vector Store  │  Ollama/HF LLM    │
└─────────────┴──────────────────────┴────────────────────┘
```

## Features

- **Project Workspace**: Create and manage evaluation projects
- **RAG Pipeline**: Upload documents, build vector indexes, query with context
- **AI Agent Execution**: LangGraph-orchestrated agent with tool support
- **Evaluation Datasets**: Create, import/export test cases with ground truth
- **Trace Collection**: Complete execution traces with step-level detail
- **Evaluation Engine**: Deterministic, LLM-judge, and human evaluation
- **Analytics Dashboard**: Interactive charts and metrics visualization
- **Model Comparison**: Compare models, prompts, and configurations
- **Failure Analysis**: Categorized failure detection with debugging guidance
- **Regression Testing**: Track metric changes across evaluation runs

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- (Optional) Ollama for local LLM inference

### Backend Setup

```bash
cd backend
python -m venv venv
# Windows
venv\Scripts\activate
# Linux/Mac
source venv/bin/activate

pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### Access

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs

## Configuration

Copy `.env.example` to `.env` and configure:

- `OLLAMA_BASE_URL`: Ollama server endpoint (default: http://localhost:11434)
- `OLLAMA_DEFAULT_MODEL`: Default LLM model (default: llama3.2)
- `HF_EMBEDDING_MODEL`: Sentence Transformer model for embeddings
- `DEFAULT_CHUNK_SIZE`: Document chunk size for RAG
- `DEFAULT_TOP_K`: Number of retrieved chunks

## Demo Mode

The platform includes optional demo data to help you explore features. Demo data is clearly labeled and can be removed at any time from the Settings page.

## Project Structure

```
miniproject/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI application
│   │   ├── database.py          # Database setup
│   │   ├── models/              # SQLAlchemy models
│   │   ├── schemas/             # Pydantic schemas
│   │   ├── routers/             # API endpoints
│   │   ├── services/            # Business logic
│   │   │   ├── rag/             # RAG pipeline
│   │   │   ├── agent/           # Agent execution
│   │   │   ├── eval/            # Evaluation engine
│   │   │   └── trace/           # Trace collection
│   │   └── utils/               # Utilities
│   ├── tests/                   # Test suite
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/          # Reusable components
│   │   ├── pages/               # Application pages
│   │   ├── services/            # API client
│   │   ├── types/               # TypeScript types
│   │   └── theme/               # MUI theme
│   └── package.json
├── .env.example
├── docker-compose.yml
└── README.md
```

## License

MIT
