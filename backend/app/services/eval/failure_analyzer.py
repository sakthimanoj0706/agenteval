"""
Failure Analysis Service.
Categorizes execution failures across 8 standard failure modes and provides debugging guidance.
"""

from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app.models.models import AgentRun, EvaluationResult, ExecutionTrace, ToolCall, TestCase


class FailureAnalyzer:
    CATEGORIES = {
        "retrieval_failure": {
            "title": "Retrieval Failure",
            "description": "Retriever returned zero chunks or failed to locate relevant reference documents.",
            "debugging_guidance": "Check chunk size and overlap; verify embeddings model; examine query preprocessing or increase top_k retrieval.",
        },
        "context_quality_failure": {
            "title": "Context Quality Failure",
            "description": "Retrieved chunks had low semantic similarity or poor relevance to the query.",
            "debugging_guidance": "Clean source document formatting; adjust similarity threshold; test hybrid sparse/dense retrieval.",
        },
        "generation_failure": {
            "title": "Generation Failure",
            "description": "Generated answer hallucinated claims unsupported by context, or produced empty output.",
            "debugging_guidance": "Refine system prompt constraints; enforce strict citation grounding; reduce LLM temperature.",
        },
        "tool_selection_failure": {
            "title": "Tool Selection Failure",
            "description": "Agent failed to trigger the expected tool or selected an incorrect tool.",
            "debugging_guidance": "Clarify tool descriptions and parameter schemas; provide tool-calling few-shot demonstrations.",
        },
        "tool_execution_failure": {
            "title": "Tool Execution Failure",
            "description": "Tool was invoked but threw a runtime exception or timed out.",
            "debugging_guidance": "Inspect tool input arguments; validate external service health and timeout tolerances.",
        },
        "task_completion_failure": {
            "title": "Task Completion Failure",
            "description": "The overall run did not complete successfully or answer the user prompt.",
            "debugging_guidance": "Check graph execution flow; inspect unhandled exception in trace timeline.",
        },
        "performance_failure": {
            "title": "Performance Failure",
            "description": "Execution latency exceeded acceptable thresholds (>5000ms).",
            "debugging_guidance": "Optimize document chunking; use faster embedding models or quantize local LLM weights.",
        },
        "infrastructure_failure": {
            "title": "Infrastructure Failure",
            "description": "Underlying connection to local LLM, database, or filesystem failed.",
            "debugging_guidance": "Ensure Ollama/LLM daemon is running; verify disk space and file read permissions.",
        },
    }

    @classmethod
    def analyze_project_failures(cls, db: Session, project_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Analyze all runs and group detected failures by the 8 categories.
        """
        query = db.query(AgentRun)
        if project_id:
            query = query.filter(AgentRun.project_id == project_id)
        runs = query.all()

        category_counts = {cat: 0 for cat in cls.CATEGORIES}
        affected_cases: Dict[str, List[Dict[str, Any]]] = {cat: [] for cat in cls.CATEGORIES}

        for run in runs:
            # 1. Infrastructure Failure
            if run.status == "failed" and run.error_message and any(
                w in run.error_message.lower() for w in ["connection", "timeout", "offline", "unavailable", "sqlite", "refused"]
            ):
                category_counts["infrastructure_failure"] += 1
                affected_cases["infrastructure_failure"].append({
                    "run_id": run.run_id,
                    "query": run.query,
                    "error": run.error_message,
                    "created_at": run.created_at.isoformat() if run.created_at else None,
                })
                continue

            # 2. Task Completion Failure
            if run.status == "failed" or not run.response:
                category_counts["task_completion_failure"] += 1
                affected_cases["task_completion_failure"].append({
                    "run_id": run.run_id,
                    "query": run.query,
                    "error": run.error_message or "Run produced no final response",
                    "created_at": run.created_at.isoformat() if run.created_at else None,
                })

            # Check tool execution failure
            tool_calls = db.query(ToolCall).filter(ToolCall.agent_run_id == run.id).all()
            failed_tools = [tc for tc in tool_calls if tc.status == "failed"]
            if failed_tools:
                category_counts["tool_execution_failure"] += 1
                affected_cases["tool_execution_failure"].append({
                    "run_id": run.run_id,
                    "query": run.query,
                    "tool": failed_tools[0].tool_name,
                    "error": failed_tools[0].error_message,
                    "created_at": run.created_at.isoformat() if run.created_at else None,
                })

            # Check evaluation results for this run
            evals = db.query(EvaluationResult).filter(EvaluationResult.agent_run_id == run.id).all()
            eval_map = {e.metric_name: e for e in evals}

            # 3. Retrieval Failure
            recall = eval_map.get("recall_at_k")
            if recall and recall.is_evaluated and recall.metric_value is not None and recall.metric_value < 0.5:
                category_counts["retrieval_failure"] += 1
                affected_cases["retrieval_failure"].append({
                    "run_id": run.run_id,
                    "query": run.query,
                    "metric_value": recall.metric_value,
                    "error": f"Recall@K is {recall.metric_value:.2f} (below 0.50 threshold)",
                    "created_at": run.created_at.isoformat() if run.created_at else None,
                })

            # 4. Context Quality Failure
            sim = eval_map.get("avg_similarity_score")
            c_rel = eval_map.get("context_relevance")
            if (sim and sim.is_evaluated and sim.metric_value is not None and sim.metric_value < 0.25) or \
               (c_rel and c_rel.is_evaluated and c_rel.metric_value is not None and c_rel.metric_value < 0.2):
                category_counts["context_quality_failure"] += 1
                affected_cases["context_quality_failure"].append({
                    "run_id": run.run_id,
                    "query": run.query,
                    "error": "Low context relevance or similarity score",
                    "created_at": run.created_at.isoformat() if run.created_at else None,
                })

            # 5. Generation Failure (Faithfulness < 0.6)
            faith = eval_map.get("faithfulness")
            if faith and faith.is_evaluated and faith.metric_value is not None and faith.metric_value < 0.6:
                category_counts["generation_failure"] += 1
                affected_cases["generation_failure"].append({
                    "run_id": run.run_id,
                    "query": run.query,
                    "metric_value": faith.metric_value,
                    "error": f"Faithfulness score {faith.metric_value:.2f} indicates unsupported hallucination",
                    "created_at": run.created_at.isoformat() if run.created_at else None,
                })

            # 6. Tool Selection Failure
            tool_sel = eval_map.get("tool_selection_accuracy")
            if tool_sel and tool_sel.is_evaluated and tool_sel.metric_value is not None and tool_sel.metric_value == 0.0:
                category_counts["tool_selection_failure"] += 1
                affected_cases["tool_selection_failure"].append({
                    "run_id": run.run_id,
                    "query": run.query,
                    "error": "Agent did not select the expected ground truth tool",
                    "created_at": run.created_at.isoformat() if run.created_at else None,
                })

            # 7. Performance Failure (> 5000ms latency)
            if run.total_latency_ms and run.total_latency_ms > 5000.0:
                category_counts["performance_failure"] += 1
                affected_cases["performance_failure"].append({
                    "run_id": run.run_id,
                    "query": run.query,
                    "latency_ms": run.total_latency_ms,
                    "error": f"Latency {run.total_latency_ms:.0f}ms exceeded 5000ms threshold",
                    "created_at": run.created_at.isoformat() if run.created_at else None,
                })

        # Format output
        items = []
        for cat_key, meta in cls.CATEGORIES.items():
            count = category_counts[cat_key]
            items.append({
                "category": cat_key,
                "title": meta["title"],
                "description": meta["description"],
                "count": count,
                "debugging_guidance": meta["debugging_guidance"],
                "affected_cases": affected_cases[cat_key][:10],  # sample top 10
            })

        total_failures = sum(category_counts.values())
        return {
            "total_failures": total_failures,
            "total_runs_analyzed": len(runs),
            "categories": items,
        }
