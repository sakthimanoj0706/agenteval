"""
Regression Testing and Comparison Service.
Compares evaluation metrics and failure states between baseline and candidate configurations.
"""

import json
from typing import Any, Dict, List
from sqlalchemy.orm import Session

from app.models.models import AgentRun, EvaluationResult, RegressionRun


class RegressionService:
    @staticmethod
    def compare_runs(
        db: Session,
        baseline_run_ids: List[int],
        comparison_run_ids: List[int]
    ) -> Dict[str, Any]:
        """
        Compare two sets of agent runs and calculate performance regression / improvement.
        """
        def get_avg_metrics(run_ids: List[int]) -> Dict[str, float]:
            evals = db.query(EvaluationResult).filter(
                EvaluationResult.agent_run_id.in_(run_ids),
                EvaluationResult.is_evaluated == True,
                EvaluationResult.metric_value.isnot(None)
            ).all()

            metric_sums: Dict[str, float] = {}
            metric_counts: Dict[str, int] = {}

            for e in evals:
                metric_sums[e.metric_name] = metric_sums.get(e.metric_name, 0.0) + e.metric_value
                metric_counts[e.metric_name] = metric_counts.get(e.metric_name, 0) + 1

            return {
                name: round(metric_sums[name] / metric_counts[name], 4)
                for name in metric_sums
            }

        baseline_metrics = get_avg_metrics(baseline_run_ids)
        comparison_metrics = get_avg_metrics(comparison_run_ids)

        improved = []
        declined = []
        unchanged = []

        all_keys = set(baseline_metrics.keys()).union(comparison_metrics.keys())
        for k in all_keys:
            b_val = baseline_metrics.get(k)
            c_val = comparison_metrics.get(k)
            if b_val is not None and c_val is not None:
                delta = round(c_val - b_val, 4)
                # Lower is better for latency and failure rates
                lower_is_better = "latency" in k or "failure" in k
                if lower_is_better:
                    is_improved = delta < -0.01
                    is_declined = delta > 0.01
                else:
                    is_improved = delta > 0.01
                    is_declined = delta < -0.01

                item = {
                    "metric_name": k,
                    "baseline_value": b_val,
                    "comparison_value": c_val,
                    "delta": delta,
                }

                if is_improved:
                    improved.append(item)
                elif is_declined:
                    declined.append(item)
                else:
                    unchanged.append(item)

        # Failure delta
        baseline_runs = db.query(AgentRun).filter(AgentRun.id.in_(baseline_run_ids)).all()
        comparison_runs = db.query(AgentRun).filter(AgentRun.id.in_(comparison_run_ids)).all()

        baseline_fails = {r.query: r for r in baseline_runs if r.status == "failed"}
        comparison_fails = {r.query: r for r in comparison_runs if r.status == "failed"}

        new_failures = [
            {"query": q, "error": r.error_message}
            for q, r in comparison_fails.items() if q not in baseline_fails
        ]
        resolved_failures = [
            {"query": q, "error": r.error_message}
            for q, r in baseline_fails.items() if q not in comparison_fails
        ]

        # Latency delta
        b_lat = [r.total_latency_ms for r in baseline_runs if r.total_latency_ms]
        c_lat = [r.total_latency_ms for r in comparison_runs if r.total_latency_ms]
        avg_b_lat = sum(b_lat) / len(b_lat) if b_lat else 0.0
        avg_c_lat = sum(c_lat) / len(c_lat) if c_lat else 0.0

        return {
            "improved_metrics": improved,
            "declined_metrics": declined,
            "unchanged_metrics": unchanged,
            "new_failures": new_failures,
            "resolved_failures": resolved_failures,
            "baseline_avg_latency_ms": round(avg_b_lat, 2),
            "comparison_avg_latency_ms": round(avg_c_lat, 2),
            "latency_delta_ms": round(avg_c_lat - avg_b_lat, 2),
        }
