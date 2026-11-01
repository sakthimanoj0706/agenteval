"""
Pydantic schemas for API request and response validation.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# ==================== Common ====================

class BaseResponse(BaseModel):
    message: str
    status: str = "success"


# ==================== Project ====================

class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = ""


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None


class ProjectResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = ""
    status: str
    created_at: datetime
    updated_at: datetime
    document_count: Optional[int] = 0
    dataset_count: Optional[int] = 0
    run_count: Optional[int] = 0

    class Config:
        from_attributes = True


class ProjectStats(BaseModel):
    total_documents: int = 0
    total_chunks: int = 0
    total_datasets: int = 0
    total_test_cases: int = 0
    total_runs: int = 0
    avg_faithfulness: Optional[float] = None
    avg_relevance: Optional[float] = None
    avg_latency_ms: Optional[float] = None
    success_rate: Optional[float] = None


# ==================== Document ====================

class DocumentResponse(BaseModel):
    id: int
    project_id: int
    filename: str
    file_type: str
    file_size: int
    status: str
    chunk_count: int
    created_at: datetime
    error_message: Optional[str] = None

    class Config:
        from_attributes = True


class DocumentChunkResponse(BaseModel):
    id: int
    document_id: int
    chunk_index: int
    content: str
    start_char: int
    end_char: int
    metadata_json: Optional[str] = "{}"
    created_at: datetime

    class Config:
        from_attributes = True


class IndexingRequest(BaseModel):
    chunk_size: Optional[int] = 512
    chunk_overlap: Optional[int] = 50


# ==================== Evaluation Dataset & Test Case ====================

class TestCaseCreate(BaseModel):
    query: str = Field(..., min_length=1)
    expected_answer: Optional[str] = None
    reference_context: Optional[str] = None
    relevant_doc_ids: Optional[List[int]] = None
    expected_tool: Optional[str] = None
    category: Optional[str] = "normal"


class TestCaseUpdate(BaseModel):
    query: Optional[str] = None
    expected_answer: Optional[str] = None
    reference_context: Optional[str] = None
    relevant_doc_ids: Optional[List[int]] = None
    expected_tool: Optional[str] = None
    category: Optional[str] = None


class TestCaseResponse(BaseModel):
    id: int
    dataset_id: int
    query: str
    expected_answer: Optional[str] = None
    reference_context: Optional[str] = None
    relevant_doc_ids: Optional[str] = None  # JSON string
    expected_tool: Optional[str] = None
    category: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DatasetCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = ""


class DatasetUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class DatasetResponse(BaseModel):
    id: int
    project_id: int
    name: str
    description: Optional[str] = ""
    created_at: datetime
    updated_at: datetime
    test_case_count: Optional[int] = 0
    test_cases: Optional[List[TestCaseResponse]] = []

    class Config:
        from_attributes = True


# ==================== Agent Execution & Run ====================

class AgentExecuteRequest(BaseModel):
    model_config = {"protected_namespaces": ()}
    project_id: int
    query: str
    model_name: Optional[str] = "mock-model"
    model_provider: Optional[str] = "mock"
    prompt_version_id: Optional[int] = None
    dataset_id: Optional[int] = None
    test_case_id: Optional[int] = None
    chunk_size: Optional[int] = 512
    chunk_overlap: Optional[int] = 50
    top_k: Optional[int] = 5
    similarity_threshold: Optional[float] = 0.3
    tools_enabled: Optional[List[str]] = ["knowledge_base", "college_info", "calculator"]


class ExecuteDatasetRequest(BaseModel):
    model_config = {"protected_namespaces": ()}
    project_id: int
    dataset_id: int
    model_name: Optional[str] = "mock-model"
    model_provider: Optional[str] = "mock"
    top_k: Optional[int] = 5
    similarity_threshold: Optional[float] = 0.3


class RetrievedChunkResponse(BaseModel):
    id: int
    chunk_id: int
    similarity_score: float
    rank_position: int
    content: Optional[str] = None
    document_name: Optional[str] = None

    class Config:
        from_attributes = True


class ToolCallResponse(BaseModel):
    id: int
    tool_name: str
    tool_input: str
    tool_output: Optional[str] = None
    status: str
    latency_ms: Optional[float] = None
    error_message: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ExecutionTraceResponse(BaseModel):
    id: int
    step_index: int
    step_name: str
    step_type: str
    status: str
    input_data: str
    output_data: Optional[str] = None
    latency_ms: Optional[float] = None
    error_message: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class EvaluationResultResponse(BaseModel):
    id: int
    eval_type: str
    metric_name: str
    metric_value: Optional[float] = None
    evaluation_method: str
    details: Optional[str] = None
    is_evaluated: bool
    reason: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AgentRunResponse(BaseModel):
    model_config = {"protected_namespaces": (), "from_attributes": True}
    id: int
    project_id: int
    dataset_id: Optional[int] = None
    test_case_id: Optional[int] = None
    run_id: str
    query: str
    response: Optional[str] = None
    model_name: str
    model_provider: str
    status: str
    total_latency_ms: Optional[float] = None
    retrieval_latency_ms: Optional[float] = None
    generation_latency_ms: Optional[float] = None
    token_usage_prompt: Optional[int] = None
    token_usage_completion: Optional[int] = None
    error_message: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    is_demo: bool = False
    traces: Optional[List[ExecutionTraceResponse]] = []
    retrieved_chunks: Optional[List[RetrievedChunkResponse]] = []
    tool_calls: Optional[List[ToolCallResponse]] = []
    evaluation_results: Optional[List[EvaluationResultResponse]] = []

    class Config:
        from_attributes = True


# ==================== Evaluation Engine ====================

class HumanReviewRequest(BaseModel):
    agent_run_id: int
    faithfulness_score: Optional[float] = None
    relevance_score: Optional[float] = None
    notes: Optional[str] = None


class MetricsSummaryResponse(BaseModel):
    total_runs: int = 0
    avg_faithfulness: Optional[float] = None
    avg_answer_relevance: Optional[float] = None
    avg_context_relevance: Optional[float] = None
    avg_recall_at_k: Optional[float] = None
    task_completion_rate: Optional[float] = None
    avg_total_latency_ms: Optional[float] = None
    avg_retrieval_latency_ms: Optional[float] = None
    avg_generation_latency_ms: Optional[float] = None
    total_tokens_used: int = 0
    failed_runs_count: int = 0


# ==================== Comparison & Regression ====================

class ComparisonRequest(BaseModel):
    project_id: int
    dataset_id: int
    configurations: List[Dict[str, Any]]  # [{model_name, provider, top_k, chunk_size, etc.}]


class RegressionRunRequest(BaseModel):
    project_id: int
    dataset_id: int
    baseline_config: Dict[str, Any]
    comparison_config: Dict[str, Any]


class RegressionResultResponse(BaseModel):
    id: int
    project_id: int
    dataset_id: int
    status: str
    improved_metrics: List[Dict[str, Any]] = []
    declined_metrics: List[Dict[str, Any]] = []
    unchanged_metrics: List[Dict[str, Any]] = []
    new_failures: List[Dict[str, Any]] = []
    resolved_failures: List[Dict[str, Any]] = []
    latency_delta_ms: Optional[float] = 0.0
    token_delta: Optional[int] = 0
    created_at: datetime


# ==================== Settings & Providers ====================

class ProviderTestRequest(BaseModel):
    provider: str
    endpoint_url: Optional[str] = None
    api_key: Optional[str] = None
    model_name: Optional[str] = None


class ProviderStatusResponse(BaseModel):
    provider: str
    available: bool
    status_message: str
    models: List[str] = []


class ModelConfigCreate(BaseModel):
    name: str
    provider: str
    model_name: str
    endpoint_url: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = {"temperature": 0.7, "max_tokens": 512}
    is_default: Optional[bool] = False


# ==================== Prompt Version ====================

class PromptVersionCreate(BaseModel):
    project_id: int
    name: str
    version: str
    system_prompt: str
    user_prompt_template: str


class PromptVersionResponse(BaseModel):
    id: int
    project_id: int
    name: str
    version: str
    system_prompt: str
    user_prompt_template: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True
