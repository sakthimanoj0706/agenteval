"""
Trace Collector Service.
Records structured execution traces for each stage of agent and RAG workflows.
"""

import json
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app.models.models import AgentRun, ExecutionTrace, RetrievedChunk, ToolCall

logger = logging.getLogger(__name__)


def utcnow():
    return datetime.now(timezone.utc)


class TraceCollector:
    def __init__(self, db: Session, project_id: int, query: str, model_name: str = "mock-model", model_provider: str = "mock", dataset_id: Optional[int] = None, test_case_id: Optional[int] = None, prompt_version_id: Optional[int] = None):
        self.db = db
        self.project_id = project_id
        self.query = query
        self.model_name = model_name
        self.model_provider = model_provider
        self.dataset_id = dataset_id
        self.test_case_id = test_case_id
        self.prompt_version_id = prompt_version_id

        self.run_uuid = str(uuid.uuid4())
        self.start_time = time.time()
        self.step_index = 0

        # Create AgentRun record
        self.agent_run = AgentRun(
            project_id=self.project_id,
            dataset_id=self.dataset_id,
            test_case_id=self.test_case_id,
            prompt_version_id=self.prompt_version_id,
            run_id=self.run_uuid,
            query=self.query,
            model_name=self.model_name,
            model_provider=self.model_provider,
            status="running",
            created_at=utcnow(),
        )
        self.db.add(self.agent_run)
        self.db.commit()
        self.db.refresh(self.agent_run)

    def record_step(
        self,
        step_name: str,
        step_type: str,
        input_data: Any,
        output_data: Any = None,
        latency_ms: Optional[float] = None,
        status: str = "completed",
        error_message: Optional[str] = None
    ) -> ExecutionTrace:
        """Add an execution trace step to the run."""
        self.step_index += 1

        inp_str = json.dumps(input_data) if not isinstance(input_data, str) else input_data
        out_str = json.dumps(output_data) if output_data is not None and not isinstance(output_data, str) else output_data

        trace = ExecutionTrace(
            agent_run_id=self.agent_run.id,
            step_index=self.step_index,
            step_name=step_name,
            step_type=step_type,
            status=status,
            input_data=inp_str,
            output_data=out_str,
            latency_ms=round(latency_ms, 2) if latency_ms is not None else None,
            error_message=error_message,
            created_at=utcnow(),
        )
        self.db.add(trace)
        self.db.commit()
        return trace

    def record_retrieved_chunks(self, chunks: List[Dict[str, Any]]):
        """Record chunks retrieved for this run."""
        for c in chunks:
            rc = RetrievedChunk(
                agent_run_id=self.agent_run.id,
                chunk_id=c["chunk_id"],
                similarity_score=float(c.get("similarity_score", 0.0)),
                rank_position=int(c.get("rank", 1)),
                created_at=utcnow(),
            )
            self.db.add(rc)
        self.db.commit()

    def record_tool_call(
        self,
        tool_name: str,
        tool_input: Any,
        tool_output: Any = None,
        latency_ms: Optional[float] = None,
        status: str = "completed",
        error_message: Optional[str] = None
    ):
        """Record an invoked tool execution."""
        tc = ToolCall(
            agent_run_id=self.agent_run.id,
            tool_name=tool_name,
            tool_input=json.dumps(tool_input) if not isinstance(tool_input, str) else tool_input,
            tool_output=json.dumps(tool_output) if tool_output is not None and not isinstance(tool_output, str) else tool_output,
            status=status,
            latency_ms=round(latency_ms, 2) if latency_ms is not None else None,
            error_message=error_message,
            created_at=utcnow(),
        )
        self.db.add(tc)
        self.db.commit()

    def complete_run(
        self,
        response: Optional[str],
        retrieval_latency_ms: Optional[float] = None,
        generation_latency_ms: Optional[float] = None,
        prompt_tokens: int = 0,
        completion_tokens: int = 0,
        status: str = "completed",
        error_message: Optional[str] = None
    ) -> AgentRun:
        """Mark run as completed/failed and finalize total latency."""
        total_latency = (time.time() - self.start_time) * 1000

        self.agent_run.response = response
        self.agent_run.status = status
        self.agent_run.total_latency_ms = round(total_latency, 2)
        self.agent_run.retrieval_latency_ms = round(retrieval_latency_ms, 2) if retrieval_latency_ms is not None else None
        self.agent_run.generation_latency_ms = round(generation_latency_ms, 2) if generation_latency_ms is not None else None
        self.agent_run.token_usage_prompt = prompt_tokens
        self.agent_run.token_usage_completion = completion_tokens
        self.agent_run.error_message = error_message
        self.agent_run.completed_at = utcnow()

        self.db.commit()
        self.db.refresh(self.agent_run)
        return self.agent_run
