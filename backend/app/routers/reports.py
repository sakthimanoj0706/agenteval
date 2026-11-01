"""
Reports Router.
Generates comprehensive downloadable evaluation reports in JSON and Markdown formats.
"""

import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import Project, Document, EvaluationDataset, AgentRun, EvaluationResult
from app.services.eval.failure_analyzer import FailureAnalyzer

router = APIRouter(prefix="/api/reports", tags=["Reports"])


@router.get("/generate/{project_id}")
def generate_project_report(
    project_id: int,
    format: str = Query("json", enum=["json", "markdown"]),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    docs = db.query(Document).filter(Document.project_id == project_id).all()
    datasets = db.query(EvaluationDataset).filter(EvaluationDataset.project_id == project_id).all()
    runs = db.query(AgentRun).filter(AgentRun.project_id == project_id).all()

    run_ids = [r.id for r in runs]
    evals = db.query(EvaluationResult).filter(
        EvaluationResult.agent_run_id.in_(run_ids),
        EvaluationResult.is_evaluated == True,
        EvaluationResult.metric_value.isnot(None)
    ).all() if run_ids else []

    def avg_m(metric_name: str) -> Optional[float]:
        vals = [e.metric_value for e in evals if e.metric_name == metric_name]
        return round(sum(vals) / len(vals), 4) if vals else None

    lats = [r.total_latency_ms for r in runs if r.total_latency_ms]
    failures = FailureAnalyzer.analyze_project_failures(db, project_id=project_id)

    report_data = {
        "report_title": f"RAG & Agent Evaluation Report - {project.name}",
        "generated_at": project.updated_at.isoformat() if project.updated_at else "",
        "project": {
            "id": project.id,
            "name": project.name,
            "description": project.description,
            "status": project.status,
        },
        "knowledge_base": {
            "total_documents": len(docs),
            "documents": [{"id": d.id, "filename": d.filename, "status": d.status, "chunks": d.chunk_count} for d in docs]
        },
        "datasets": {
            "total_datasets": len(datasets),
            "datasets": [{"id": ds.id, "name": ds.name} for ds in datasets]
        },
        "evaluation_metrics": {
            "total_evaluated_runs": len(runs),
            "avg_faithfulness": avg_m("faithfulness"),
            "avg_answer_relevance": avg_m("answer_relevance"),
            "avg_context_relevance": avg_m("context_relevance"),
            "avg_recall_at_k": avg_m("recall_at_k"),
            "avg_latency_ms": round(sum(lats) / len(lats), 2) if lats else None,
            "task_completion_rate": avg_m("task_completion"),
        },
        "failure_summary": {
            "total_failures_detected": failures["total_failures"],
            "breakdown": [
                {"category": c["title"], "count": c["count"], "guidance": c["debugging_guidance"]}
                for c in failures["categories"] if c["count"] > 0
            ]
        }
    }

    if format == "markdown":
        md = f"""# {report_data['report_title']}

**Project**: {project.name}
**Description**: {project.description}
**Generated**: {report_data['generated_at']}

---

## 1. Knowledge Base
- **Total Indexed Documents**: {len(docs)}
"""
        for d in docs:
            md += f"- `{d.filename}` ({d.status}, {d.chunk_count} chunks)\n"

        md += f"""
---

## 2. Evaluation Metrics Summary
- **Total Agent Executions**: {len(runs)}
- **Average Faithfulness**: {report_data['evaluation_metrics']['avg_faithfulness'] or 'N/A'}
- **Average Answer Relevance**: {report_data['evaluation_metrics']['avg_answer_relevance'] or 'N/A'}
- **Average Context Relevance**: {report_data['evaluation_metrics']['avg_context_relevance'] or 'N/A'}
- **Average Recall@K**: {report_data['evaluation_metrics']['avg_recall_at_k'] or 'N/A'}
- **Average Latency**: {report_data['evaluation_metrics']['avg_latency_ms'] or 'N/A'} ms

---

## 3. Failure Analysis
**Total Failures Detected**: {failures['total_failures']}

"""
        for c in failures["categories"]:
            if c["count"] > 0:
                md += f"### {c['title']} (Count: {c['count']})\n"
                md += f"*{c['description']}*\n"
                md += f"> **Debugging Action**: {c['debugging_guidance']}\n\n"

        return Response(
            content=md,
            media_type="text/markdown",
            headers={"Content-Disposition": f"attachment; filename=eval_report_project_{project_id}.md"}
        )

    return report_data
