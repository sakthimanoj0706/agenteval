"""
Evaluation Engine.
Calculates Retrieval, Answer, Agent, and Performance evaluation metrics.
Supports Deterministic, LLM-as-a-Judge, and Human annotation methods.
"""

import json
import logging
import math
import re
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app.models.models import AgentRun, EvaluationResult, TestCase, RetrievedChunk, DocumentChunk, ToolCall

logger = logging.getLogger(__name__)


class EvaluationEngine:
    @staticmethod
    def evaluate_run(db: Session, run_id: int) -> List[EvaluationResult]:
        """
        Evaluate a single agent run across all 4 dimensions.
        Saves and returns the EvaluationResult records.
        """
        run = db.query(AgentRun).filter(AgentRun.id == run_id).first()
        if not run:
            raise ValueError(f"AgentRun with id {run_id} not found.")

        # Delete any previous evaluation results for re-evaluation
        db.query(EvaluationResult).filter(EvaluationResult.agent_run_id == run_id).delete()

        results: List[EvaluationResult] = []

        # Load linked test case (ground truth) if available
        test_case = None
        if run.test_case_id:
            test_case = db.query(TestCase).filter(TestCase.id == run.test_case_id).first()

        # Load retrieved chunks
        retrieved = db.query(RetrievedChunk).filter(RetrievedChunk.agent_run_id == run_id).order_by(RetrievedChunk.rank_position).all()
        tool_calls = db.query(ToolCall).filter(ToolCall.agent_run_id == run_id).all()

        retrieved_texts = []
        retrieved_doc_ids = set()
        for r in retrieved:
            chunk = db.query(DocumentChunk).filter(DocumentChunk.id == r.chunk_id).first()
            if chunk:
                retrieved_texts.append(chunk.content)
                retrieved_doc_ids.add(chunk.document_id)

        all_context = " ".join(retrieved_texts)

        # ==================== DIMENSION A: RETRIEVAL EVALUATION ====================

        # 1. Recall@K (if expected relevant_doc_ids exist)
        if test_case and test_case.relevant_doc_ids:
            try:
                expected_doc_ids = json.loads(test_case.relevant_doc_ids)
                if expected_doc_ids and isinstance(expected_doc_ids, list):
                    hits = sum(1 for did in expected_doc_ids if did in retrieved_doc_ids)
                    recall_val = hits / len(expected_doc_ids)
                    results.append(EvaluationResult(
                        agent_run_id=run.id,
                        eval_type="retrieval",
                        metric_name="recall_at_k",
                        metric_value=round(recall_val, 4),
                        evaluation_method="deterministic",
                        details=json.dumps({"expected_doc_ids": expected_doc_ids, "retrieved_doc_ids": list(retrieved_doc_ids)}),
                        is_evaluated=True,
                    ))
                else:
                    results.append(EvaluationResult(
                        agent_run_id=run.id,
                        eval_type="retrieval",
                        metric_name="recall_at_k",
                        metric_value=None,
                        evaluation_method="deterministic",
                        is_evaluated=False,
                        reason="No valid expected document IDs specified in test case",
                    ))
            except Exception:
                pass
        else:
            results.append(EvaluationResult(
                agent_run_id=run.id,
                eval_type="retrieval",
                metric_name="recall_at_k",
                metric_value=None,
                evaluation_method="deterministic",
                is_evaluated=False,
                reason="No relevant document ground truth provided for this query",
            ))

        # 2. Similarity Score Distribution
        if retrieved:
            scores = [r.similarity_score for r in retrieved]
            avg_sim = sum(scores) / len(scores)
            results.append(EvaluationResult(
                agent_run_id=run.id,
                eval_type="retrieval",
                metric_name="avg_similarity_score",
                metric_value=round(avg_sim, 4),
                evaluation_method="deterministic",
                details=json.dumps({"min": min(scores), "max": max(scores), "count": len(scores)}),
                is_evaluated=True,
            ))
        else:
            results.append(EvaluationResult(
                agent_run_id=run.id,
                eval_type="retrieval",
                metric_name="avg_similarity_score",
                metric_value=0.0,
                evaluation_method="deterministic",
                is_evaluated=True,
                reason="Zero chunks retrieved above similarity threshold",
            ))

        # 3. Context Relevance (Deterministic token/ngram relevance between query and context)
        if all_context:
            q_tokens = set(re.findall(r"\w+", run.query.lower()))
            c_tokens = set(re.findall(r"\w+", all_context.lower()))
            overlap = len(q_tokens.intersection(c_tokens))
            context_rel = min(1.0, overlap / max(1, len(q_tokens)))
            results.append(EvaluationResult(
                agent_run_id=run.id,
                eval_type="retrieval",
                metric_name="context_relevance",
                metric_value=round(context_rel, 4),
                evaluation_method="deterministic",
                details=json.dumps({"query_tokens": len(q_tokens), "overlap": overlap}),
                is_evaluated=True,
            ))
        else:
            results.append(EvaluationResult(
                agent_run_id=run.id,
                eval_type="retrieval",
                metric_name="context_relevance",
                metric_value=0.0,
                evaluation_method="deterministic",
                is_evaluated=True,
                reason="No context retrieved",
            ))

        # ==================== DIMENSION B: ANSWER EVALUATION ====================

        response_text = run.response or ""

        # 1. Faithfulness (Checks if claims/tokens in generated response are supported by retrieved context)
        if response_text and all_context:
            resp_sentences = [s.strip() for s in re.split(r"[.\n]", response_text) if len(s.strip()) > 10]
            if resp_sentences:
                supported_count = 0
                c_lower = all_context.lower()
                for s in resp_sentences:
                    words = [w for w in re.findall(r"\w+", s.lower()) if len(w) > 3]
                    if not words:
                        supported_count += 1
                        continue
                    # Check token presence in context
                    hits = sum(1 for w in words if w in c_lower)
                    if hits / len(words) >= 0.5:
                        supported_count += 1
                faithfulness = supported_count / len(resp_sentences)
            else:
                faithfulness = 1.0

            results.append(EvaluationResult(
                agent_run_id=run.id,
                eval_type="answer",
                metric_name="faithfulness",
                metric_value=round(faithfulness, 4),
                evaluation_method="deterministic",
                details=json.dumps({"analyzed_sentences": len(resp_sentences) if 'resp_sentences' in locals() else 0}),
                is_evaluated=True,
            ))
        elif not all_context and response_text:
            # Generated without context: cannot be grounded
            results.append(EvaluationResult(
                agent_run_id=run.id,
                eval_type="answer",
                metric_name="faithfulness",
                metric_value=0.0,
                evaluation_method="deterministic",
                is_evaluated=True,
                reason="Response generated with zero retrieved context",
            ))
        else:
            results.append(EvaluationResult(
                agent_run_id=run.id,
                eval_type="answer",
                metric_name="faithfulness",
                metric_value=None,
                evaluation_method="deterministic",
                is_evaluated=False,
                reason="No generated response to evaluate",
            ))

        # 2. Answer Relevance (Evaluates if answer directly addresses user query and reference answer)
        if response_text:
            q_words = set(re.findall(r"\w+", run.query.lower()))
            ans_words = set(re.findall(r"\w+", response_text.lower()))
            overlap = len(q_words.intersection(ans_words))
            ans_rel = min(1.0, (overlap / max(1, len(q_words))) * 1.2)

            # If expected answer is provided in ground truth, calculate similarity
            if test_case and test_case.expected_answer:
                exp_words = set(re.findall(r"\w+", test_case.expected_answer.lower()))
                gt_overlap = len(exp_words.intersection(ans_words))
                gt_score = gt_overlap / max(1, len(exp_words))
                ans_rel = (ans_rel * 0.4) + (gt_score * 0.6)

            results.append(EvaluationResult(
                agent_run_id=run.id,
                eval_type="answer",
                metric_name="answer_relevance",
                metric_value=round(ans_rel, 4),
                evaluation_method="deterministic",
                details=json.dumps({"has_ground_truth": bool(test_case and test_case.expected_answer)}),
                is_evaluated=True,
            ))
        else:
            results.append(EvaluationResult(
                agent_run_id=run.id,
                eval_type="answer",
                metric_name="answer_relevance",
                metric_value=0.0,
                evaluation_method="deterministic",
                is_evaluated=True,
                reason="Empty response generated",
            ))

        # ==================== DIMENSION C: AGENT EVALUATION ====================

        # 1. Tool Selection Correctness
        if test_case and test_case.expected_tool:
            expected_tool = test_case.expected_tool.strip().lower()
            actual_tools = [tc.tool_name.lower() for tc in tool_calls]
            tool_correct = 1.0 if expected_tool in actual_tools else 0.0
            results.append(EvaluationResult(
                agent_run_id=run.id,
                eval_type="agent",
                metric_name="tool_selection_accuracy",
                metric_value=tool_correct,
                evaluation_method="deterministic",
                details=json.dumps({"expected": expected_tool, "actual": actual_tools}),
                is_evaluated=True,
            ))
        elif tool_calls:
            results.append(EvaluationResult(
                agent_run_id=run.id,
                eval_type="agent",
                metric_name="tool_selection_accuracy",
                metric_value=None,
                evaluation_method="deterministic",
                is_evaluated=False,
                reason="No expected tool specified in ground truth",
            ))

        # 2. Failed Tool-Call Rate
        if tool_calls:
            failed_tools = sum(1 for tc in tool_calls if tc.status == "failed")
            fail_rate = failed_tools / len(tool_calls)
            results.append(EvaluationResult(
                agent_run_id=run.id,
                eval_type="agent",
                metric_name="tool_failure_rate",
                metric_value=round(fail_rate, 4),
                evaluation_method="deterministic",
                details=json.dumps({"total_tools": len(tool_calls), "failed": failed_tools}),
                is_evaluated=True,
            ))

        # 3. Task Completion
        is_completed = (run.status == "completed" and bool(run.response))
        results.append(EvaluationResult(
            agent_run_id=run.id,
            eval_type="agent",
            metric_name="task_completion",
            metric_value=1.0 if is_completed else 0.0,
            evaluation_method="deterministic",
            details=json.dumps({"run_status": run.status, "has_response": bool(run.response)}),
            is_evaluated=True,
        ))

        # ==================== DIMENSION D: PERFORMANCE EVALUATION ====================

        # 1. Total Latency
        if run.total_latency_ms is not None:
            results.append(EvaluationResult(
                agent_run_id=run.id,
                eval_type="performance",
                metric_name="total_latency_ms",
                metric_value=float(run.total_latency_ms),
                evaluation_method="deterministic",
                is_evaluated=True,
            ))

        # 2. Retrieval Latency
        if run.retrieval_latency_ms is not None:
            results.append(EvaluationResult(
                agent_run_id=run.id,
                eval_type="performance",
                metric_name="retrieval_latency_ms",
                metric_value=float(run.retrieval_latency_ms),
                evaluation_method="deterministic",
                is_evaluated=True,
            ))

        # 3. Generation Latency
        if run.generation_latency_ms is not None:
            results.append(EvaluationResult(
                agent_run_id=run.id,
                eval_type="performance",
                metric_name="generation_latency_ms",
                metric_value=float(run.generation_latency_ms),
                evaluation_method="deterministic",
                is_evaluated=True,
            ))

        # Save all results to DB
        for r in results:
            db.add(r)
        db.commit()

        return results
