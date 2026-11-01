"""
Agent Orchestration and Workflow Executor.
Coordinates Query Analysis -> Document Retrieval -> Context Preparation -> Tool Execution -> Generation.
Captures full execution traces and step-level metrics.
"""

import json
import logging
import time
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app.models.models import AgentRun, PromptVersion
from app.services.agent.llm_provider import get_llm_provider
from app.services.agent.tools import ToolRegistry
from app.services.rag.retriever import get_retriever
from app.services.trace.collector import TraceCollector

logger = logging.getLogger(__name__)


class AgentExecutor:
    def __init__(
        self,
        db: Session,
        project_id: int,
        model_name: str = "mock-model",
        model_provider: str = "mock",
        prompt_version_id: Optional[int] = None,
        dataset_id: Optional[int] = None,
        test_case_id: Optional[int] = None,
        chunk_size: int = 512,
        chunk_overlap: int = 50,
        top_k: int = 5,
        similarity_threshold: float = 0.2,
        tools_enabled: Optional[List[str]] = None
    ):
        self.db = db
        self.project_id = project_id
        self.model_name = model_name
        self.model_provider = model_provider
        self.prompt_version_id = prompt_version_id
        self.dataset_id = dataset_id
        self.test_case_id = test_case_id
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.top_k = top_k
        self.similarity_threshold = similarity_threshold
        self.tools_enabled = tools_enabled or ["knowledge_base", "college_info", "calculator"]

        self.retriever = get_retriever(project_id)
        self.llm = get_llm_provider(model_provider, model_name=model_name)

    def execute(self, query: str) -> AgentRun:
        collector = TraceCollector(
            db=self.db,
            project_id=self.project_id,
            query=query,
            model_name=self.model_name,
            model_provider=self.model_provider,
            dataset_id=self.dataset_id,
            test_case_id=self.test_case_id,
            prompt_version_id=self.prompt_version_id,
        )

        retrieval_latency = 0.0
        generation_latency = 0.0
        retrieved_chunks = []
        context_str = ""
        tool_results = []
        final_answer = ""

        try:
            # Stage 1: Query Analysis
            t0 = time.time()
            q_lower = query.lower()
            needs_calc = (any(c in q_lower for c in ["+", "-", "*", "/", "calculate", "calc", "sum", "total"]) and any(c.isdigit() for c in query))
            needs_college_tool = any(kw in q_lower for kw in ["tuition", "deadline", "admissions", "housing", "library", "department", "scholarship"])
            analysis_output = {
                "query_length": len(query),
                "intent": "informational_query",
                "detected_tools": [
                    t for t in [
                        "calculator" if needs_calc else None,
                        "college_info" if needs_college_tool else None
                    ] if t and t in self.tools_enabled
                ]
            }
            collector.record_step(
                step_name="Query Analysis",
                step_type="query_analysis",
                input_data={"query": query},
                output_data=analysis_output,
                latency_ms=(time.time() - t0) * 1000,
                status="completed"
            )

            # Stage 2: Document Retrieval
            t1 = time.time()
            retrieved_chunks = self.retriever.search(
                query=query,
                top_k=self.top_k,
                similarity_threshold=self.similarity_threshold,
            )
            retrieval_latency = (time.time() - t1) * 1000
            collector.record_step(
                step_name="Document Retrieval",
                step_type="retrieval",
                input_data={
                    "query": query,
                    "top_k": self.top_k,
                    "similarity_threshold": self.similarity_threshold
                },
                output_data={
                    "retrieved_count": len(retrieved_chunks),
                    "top_similarity": retrieved_chunks[0]["similarity_score"] if retrieved_chunks else 0.0,
                    "chunk_ids": [c["chunk_id"] for c in retrieved_chunks],
                },
                latency_ms=retrieval_latency,
                status="completed"
            )
            collector.record_retrieved_chunks(retrieved_chunks)

            # Stage 3: Context Preparation
            t2 = time.time()
            context_pieces = [c["content"] for c in retrieved_chunks]
            context_str = "\n---\n".join(context_pieces) if context_pieces else ""
            collector.record_step(
                step_name="Context Preparation",
                step_type="context_prep",
                input_data={"chunks_count": len(context_pieces)},
                output_data={
                    "context_length_chars": len(context_str),
                    "has_context": bool(context_str),
                },
                latency_ms=(time.time() - t2) * 1000,
                status="completed"
            )

            # Stage 4: Tool Execution (if triggered)
            if analysis_output["detected_tools"]:
                for tool_name in analysis_output["detected_tools"]:
                    if tool_name == "calculator":
                        import re
                        expr_match = re.search(r"[\d\s+\-*/().]{3,}", query)
                        expr = expr_match.group(0).strip() if expr_match else "0"
                        res = ToolRegistry.execute_tool("calculator", {"expression": expr})
                    elif tool_name == "college_info":
                        res = ToolRegistry.execute_tool("college_info", {"keyword": query})
                    else:
                        res = ToolRegistry.execute_tool(tool_name, {"query": query})

                    collector.record_tool_call(
                        tool_name=res.tool_name,
                        tool_input=res.input_data,
                        tool_output=res.output_data,
                        latency_ms=res.latency_ms,
                        status=res.status,
                        error_message=res.error
                    )
                    tool_results.append(res.to_dict())

                    # If tool returned useful info, append to context
                    if res.output_data:
                        context_str += f"\n[Tool:{tool_name}] {res.output_data}"

            # Stage 5: Generation
            t3 = time.time()
            system_prompt = "You are a factual, context-grounded AI assistant. Base your answers strictly on the retrieved context."
            if self.prompt_version_id:
                pv = self.db.query(PromptVersion).filter(PromptVersion.id == self.prompt_version_id).first()
                if pv and pv.system_prompt:
                    system_prompt = pv.system_prompt

            full_prompt = f"Context:\n{context_str}\n\nQuestion: {query}\nAnswer:"
            llm_res = self.llm.generate(full_prompt, system_prompt=system_prompt)
            generation_latency = llm_res.latency_ms
            final_answer = llm_res.content

            collector.record_step(
                step_name="LLM Generation",
                step_type="generation",
                input_data={
                    "prompt_length": len(full_prompt),
                    "provider": llm_res.provider,
                    "model": llm_res.model,
                },
                output_data={
                    "response": final_answer,
                    "prompt_tokens": llm_res.prompt_tokens,
                    "completion_tokens": llm_res.completion_tokens,
                },
                latency_ms=generation_latency,
                status="completed" if not llm_res.error else "completed",
                error_message=llm_res.error
            )

            # Stage 6: Finalize Run
            completed_run = collector.complete_run(
                response=final_answer,
                retrieval_latency_ms=retrieval_latency,
                generation_latency_ms=generation_latency,
                prompt_tokens=llm_res.prompt_tokens,
                completion_tokens=llm_res.completion_tokens,
                status="completed",
                error_message=llm_res.error
            )
            return completed_run

        except Exception as e:
            logger.error(f"Agent execution encountered an unhandled error: {e}", exc_info=True)
            collector.record_step(
                step_name="Execution Error",
                step_type="evaluation",
                input_data={"error": str(e)},
                output_data=None,
                latency_ms=0.0,
                status="failed",
                error_message=str(e)
            )
            return collector.complete_run(
                response=None,
                retrieval_latency_ms=retrieval_latency,
                generation_latency_ms=generation_latency,
                status="failed",
                error_message=str(e)
            )
