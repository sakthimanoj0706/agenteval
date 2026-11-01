"""
Comprehensive Test Suite for RAG and Agent Evaluation Platform.
Tests:
- API health and startup
- Project CRUD and statistics
- Document upload, text extraction, chunking, and FAISS indexing
- Evaluation dataset and test cases
- Agent execution pipeline (Query analysis -> Retrieval -> Context prep -> Tool calling -> Generation -> Traces)
- Multi-dimensional evaluation engine (Faithfulness, Relevance, Recall@K, Latency, Tool accuracy)
- Failure categorization (8 modes)
- Regression comparison testing
- Demo environment creation & teardown
"""

import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.main import app
from app.models.models import Project, Document, EvaluationDataset, TestCase, AgentRun
from app.services.rag.document_processor import DocumentProcessor
from app.services.rag.retriever import get_retriever

TEST_DB_URL = "sqlite:///./data/test_platform.db"
test_engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)
    if os.path.exists("./data/test_platform.db"):
        try:
            os.remove("./data/test_platform.db")
        except Exception:
            pass


def test_health_check():
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"


def test_project_crud():
    # 1. Create project
    create_res = client.post("/api/projects", json={
        "name": "Unit Test Project",
        "description": "Integration test evaluation project"
    })
    assert create_res.status_code == 201
    project_id = create_res.json()["id"]

    # 2. Get project
    get_res = client.get(f"/api/projects/{project_id}")
    assert get_res.status_code == 200
    assert get_res.json()["name"] == "Unit Test Project"

    # 3. List projects
    list_res = client.get("/api/projects")
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 1

    # 4. Update project
    up_res = client.put(f"/api/projects/{project_id}", json={"description": "Updated description"})
    assert up_res.status_code == 200
    assert up_res.json()["description"] == "Updated description"

    # 5. Get stats
    stats_res = client.get(f"/api/projects/{project_id}/stats")
    assert stats_res.status_code == 200
    assert stats_res.json()["total_documents"] == 0


def test_document_processing_and_indexing():
    # Create project
    p = client.post("/api/projects", json={"name": "Doc Test Project"}).json()
    project_id = p["id"]

    # Upload document
    test_content = b"Artificial Intelligence and Machine Learning are transforming modern software development. Deep learning relies on multi-layer neural networks."
    upload_res = client.post(
        f"/api/projects/{project_id}/documents?auto_index=true",
        files={"file": ("test_ai.txt", test_content, "text/plain")}
    )
    assert upload_res.status_code == 201
    doc_data = upload_res.json()
    assert doc_data["status"] == "indexed"
    assert doc_data["chunk_count"] > 0
    doc_id = doc_data["id"]

    # Get chunks
    chunks_res = client.get(f"/api/documents/{doc_id}/chunks")
    assert chunks_res.status_code == 200
    chunks = chunks_res.json()
    assert len(chunks) > 0
    assert "Artificial Intelligence" in chunks[0]["content"]

    # Test retriever directly
    retriever = get_retriever(project_id)
    search_res = retriever.search("neural networks", top_k=2)
    assert len(search_res) > 0
    assert search_res[0]["similarity_score"] > 0.0


def test_agent_execution_pipeline():
    # Create project with document
    p = client.post("/api/projects", json={"name": "Agent Execution Project"}).json()
    project_id = p["id"]

    content = b"The library hours are Monday through Friday from 8 AM to 10 PM. Weekend hours are 10 AM to 6 PM."
    client.post(
        f"/api/projects/{project_id}/documents?auto_index=true",
        files={"file": ("library_hours.txt", content, "text/plain")}
    )

    # Execute query through agent
    exec_res = client.post("/api/agent/execute", json={
        "project_id": project_id,
        "query": "What are the weekend library hours?",
        "model_name": "mock-model",
        "model_provider": "mock",
        "top_k": 2,
    })
    assert exec_res.status_code == 200
    run_data = exec_res.json()

    assert run_data["status"] == "completed"
    assert run_data["response"] is not None
    assert len(run_data["traces"]) >= 4  # QueryAnalysis, Retrieval, ContextPrep, Generation
    assert len(run_data["retrieved_chunks"]) > 0
    assert len(run_data["evaluation_results"]) > 0

    # Test evaluation scores
    evals = {e["metric_name"]: e for e in run_data["evaluation_results"]}
    assert "faithfulness" in evals
    assert "answer_relevance" in evals
    assert "context_relevance" in evals
    assert evals["faithfulness"]["is_evaluated"] is True


def test_tool_execution():
    p = client.post("/api/projects", json={"name": "Tool Test Project"}).json()
    project_id = p["id"]

    # Query triggering calculator
    exec_res = client.post("/api/agent/execute", json={
        "project_id": project_id,
        "query": "Calculate 1500 * 3 for annual fees",
        "model_name": "mock-model",
        "model_provider": "mock",
    })
    assert exec_res.status_code == 200
    data = exec_res.json()
    assert len(data["tool_calls"]) > 0
    assert data["tool_calls"][0]["tool_name"] == "calculator"
    assert data["tool_calls"][0]["status"] == "completed"


def test_evaluation_dataset_and_batch_execution():
    p = client.post("/api/projects", json={"name": "Dataset Test Project"}).json()
    project_id = p["id"]

    # Create dataset
    ds_res = client.post(f"/api/projects/{project_id}/datasets", json={
        "name": "Benchmark Dataset",
        "description": "Validation test cases"
    })
    assert ds_res.status_code == 201
    dataset_id = ds_res.json()["id"]

    # Add test cases
    tc1 = client.post(f"/api/datasets/{dataset_id}/test-cases", json={
        "query": "What is the admissions criteria?",
        "expected_answer": "Minimum GPA 3.5",
        "category": "normal"
    }).json()

    tc2 = client.post(f"/api/datasets/{dataset_id}/test-cases", json={
        "query": "Calculate tuition 1000 + 200",
        "expected_answer": "1200",
        "category": "tool_dependent",
        "expected_tool": "calculator"
    }).json()

    # Batch execute dataset
    batch_res = client.post("/api/agent/execute-dataset", json={
        "project_id": project_id,
        "dataset_id": dataset_id,
        "top_k": 3
    })
    assert batch_res.status_code == 200
    assert batch_res.json()["executed_count"] == 2


def test_failure_analysis_endpoint():
    res = client.get("/api/failures/analysis")
    assert res.status_code == 200
    data = res.json()
    assert "categories" in data
    assert len(data["categories"]) == 8


def test_dashboard_endpoints():
    res_summary = client.get("/api/dashboard/summary")
    assert res_summary.status_code == 200

    res_quality = client.get("/api/dashboard/charts/retrieval-quality")
    assert res_quality.status_code == 200
    assert isinstance(res_quality.json(), list)

    res_perf = client.get("/api/dashboard/charts/model-performance")
    assert res_perf.status_code == 200

    res_trend = client.get("/api/dashboard/charts/latency-trend")
    assert res_trend.status_code == 200


def test_regression_testing():
    p = client.post("/api/projects", json={"name": "Regression Test Project"}).json()
    project_id = p["id"]

    ds = client.post(f"/api/projects/{project_id}/datasets", json={"name": "Regression DS"}).json()
    dataset_id = ds["id"]

    client.post(f"/api/datasets/{dataset_id}/test-cases", json={"query": "Test query 1"})

    reg_res = client.post("/api/regression/run", json={
        "project_id": project_id,
        "dataset_id": dataset_id,
        "baseline_config": {"model_name": "mock-baseline", "top_k": 3},
        "comparison_config": {"model_name": "mock-comparison", "top_k": 5},
    })
    assert reg_res.status_code == 200
    data = reg_res.json()
    assert "improved_metrics" in data
    assert "declined_metrics" in data


def test_demo_mode():
    setup_res = client.post("/api/demo/setup")
    assert setup_res.status_code == 200

    status_res = client.get("/api/demo/status")
    assert status_res.status_code == 200
    assert status_res.json()["has_demo_data"] is True

    cleanup_res = client.delete("/api/demo/cleanup")
    assert cleanup_res.status_code == 200
