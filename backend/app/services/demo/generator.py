"""
Demo Data Generator Service.
Creates a complete demo workspace with sample project, documents, test cases, agent runs, traces, and evaluations.
Includes clean teardown function.
"""

import json
import os
import uuid
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session

from app.config import settings
from app.models.models import (
    Project, Document, DocumentChunk, EvaluationDataset, TestCase,
    AgentRun, ExecutionTrace, RetrievedChunk, ToolCall, EvaluationResult
)
from app.services.rag.document_processor import DocumentProcessor
from app.services.rag.retriever import get_retriever

def utcnow():
    return datetime.now(timezone.utc)


class DemoGenerator:
    SAMPLE_DOCS = [
        {
            "filename": "Academic_Admissions_Guide_2025.txt",
            "content": """
University Admissions and Enrollment Policies - Academic Year 2025-2026.
Undergraduate admissions operate under two primary application cycles:
1. Early Action (EA): Applications must be submitted by November 1st. Notifications are released by December 15th. Early Action is non-binding.
2. Regular Decision (RD): Applications are due by January 15th, with decision releases scheduled for March 30th.
Tuition and Cost of Attendance:
Annual undergraduate tuition is $14,500 for state residents and $28,200 for out-of-state students. Mandatory campus student fees total $1,200 per year.
Financial Aid and Scholarships:
Over 75% of incoming undergraduate students receive institutional merit or need-based grants. The Priority FAFSA filing deadline is February 15th. Presidential Merit Scholarships provide full-tuition awards to candidates with exemplary academic credentials.
Admission Requirements:
Minimum GPA recommendation is 3.5 on a 4.0 unweighted scale. Standardized testing (SAT/ACT) remains test-optional for the 2025-2026 academic calendar.
Transfer applicants require a minimum of 24 transferable college semester credits with at least a 3.0 cumulative GPA.
            """.strip()
        },
        {
            "filename": "Computer_Science_Curriculum.txt",
            "content": """
Department of Computer Science & Engineering - Degree Program Specifications.
The Bachelor of Science in Computer Science requires completion of 120 credit hours, structured as:
- Core Mathematics and Science: Calculus I-III, Linear Algebra, Discrete Mathematics, Probability & Statistics (16 credits).
- Computer Science Core: CS101 Introduction to Programming (Python), CS102 Data Structures and Algorithms (C++), CS201 Computer Systems & Architecture, CS202 Operating Systems, CS301 Database Management Systems (24 credits).
- Advanced Specializations: Students must select an approved concentration in Artificial Intelligence & Machine Learning, Distributed Cloud Systems, or Cybersecurity.
- Capstone Project: A two-semester industry-sponsored Senior Design sequence (CS491 & CS492) is mandatory for graduation.
Academic Advising and Minimum Grades:
A grade of 'C' or higher is required in all CS prerequisite courses before registering for advanced 300- and 400-level electives.
            """.strip()
        },
        {
            "filename": "Campus_Life_and_Housing.txt",
            "content": """
Student Affairs and Residential Living Regulations.
Housing Guarantee:
First-year undergraduate students are guaranteed campus housing if the residential deposit and housing preferences are received by May 1st.
Dormitory Styles:
1. Traditional Double and Quad suites in North Quad with shared communal bathrooms.
2. Apartment-style living in South Campus Towers for upperclassmen, featuring single bedrooms, shared kitchenette, and living room.
Dining Services:
Unlimited meal plans provide unrestricted access to the Central Commons Dining Hall from 7:00 AM to 10:00 PM daily. Dining dollars are accepted at campus cafes and student union franchises.
Health & Recreation:
The Student Recreation Center is open daily from 6:00 AM to 11:00 PM, offering Olympic swimming facilities, bouldering walls, and cardio centers.
            """.strip()
        }
    ]

    SAMPLE_TEST_CASES = [
        {
            "query": "What is the tuition fee for an in-state student and what is the Regular Decision deadline?",
            "expected_answer": "In-state tuition is $14,500 per year. The Regular Decision application deadline is January 15th.",
            "reference_context": "Annual undergraduate tuition is $14,500 for state residents... Regular Decision (RD): Applications are due by January 15th.",
            "expected_tool": None,
            "category": "normal"
        },
        {
            "query": "How many credits are required for the Computer Science degree and what is the capstone requirement?",
            "expected_answer": "120 credit hours are required, along with a two-semester capstone sequence (CS491 & CS492).",
            "reference_context": "The Bachelor of Science in Computer Science requires completion of 120 credit hours... Capstone Project: A two-semester industry-sponsored Senior Design sequence",
            "expected_tool": None,
            "category": "normal"
        },
        {
            "query": "Can freshmen get dorm housing, and what is the deadline?",
            "expected_answer": "First-year students are guaranteed campus housing if the deposit is received by May 1st.",
            "reference_context": "First-year undergraduate students are guaranteed campus housing if the residential deposit and housing preferences are received by May 1st.",
            "expected_tool": None,
            "category": "normal"
        },
        {
            "query": "Calculate the total 4-year tuition for an out-of-state student paying $28,200 annually.",
            "expected_answer": "The total 4-year tuition is $112,800 ($28,200 * 4).",
            "reference_context": "tuition is $28,200 for out-of-state students.",
            "expected_tool": "calculator",
            "category": "tool_dependent"
        },
        {
            "query": "What are the requirements for aerospace engineering students?",
            "expected_answer": "The provided documentation does not contain information regarding aerospace engineering.",
            "reference_context": "",
            "expected_tool": None,
            "category": "irrelevant"
        },
        {
            "query": "What are the admissions details and which courses should I take in freshmen year?",
            "expected_answer": "Admissions deadlines are Nov 1 (EA) and Jan 15 (RD). Freshmen take CS101 and CS102 along with Calculus.",
            "reference_context": "Early Action deadline Nov 1, RD Jan 15... CS101, CS102, Calculus",
            "expected_tool": None,
            "category": "multi_step"
        },
        {
            "query": "Are SAT scores mandatory for 2025 admissions?",
            "expected_answer": "No, standardized testing (SAT/ACT) is test-optional for the 2025-2026 academic calendar.",
            "reference_context": "Standardized testing (SAT/ACT) remains test-optional for the 2025-2026 academic calendar.",
            "expected_tool": None,
            "category": "challenging"
        }
    ]

    @classmethod
    def setup_demo_data(cls, db: Session) -> Dict[str, Any]:
        """Generate demo project, indexed documents, datasets, runs, traces, and evals."""
        # Check if demo project already exists
        demo_proj = db.query(Project).filter(Project.name == "CampusAI Student Assistant [DEMO]").first()
        if demo_proj:
            return {"message": "Demo project already exists", "project_id": demo_proj.id}

        # 1. Create Project
        project = Project(
            name="CampusAI Student Assistant [DEMO]",
            description="[DEMO DATA] Comprehensive university student advisory assistant demonstrating RAG retrieval, tool calling, and multi-dimensional evaluation.",
            status="active",
            created_at=utcnow() - timedelta(days=7),
            updated_at=utcnow()
        )
        db.add(project)
        db.commit()
        db.refresh(project)

        # 2. Write and Index Sample Documents
        docs_created = []
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
        retriever = get_retriever(project.id)
        retriever.reset()

        for s_doc in cls.SAMPLE_DOCS:
            file_path = os.path.join(settings.UPLOAD_DIR, f"demo_{project.id}_{s_doc['filename']}")
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(s_doc["content"])

            doc = Document(
                project_id=project.id,
                filename=s_doc["filename"],
                file_type="txt",
                file_size=len(s_doc["content"].encode("utf-8")),
                file_path=file_path,
                status="indexed",
                created_at=utcnow() - timedelta(days=6)
            )
            db.add(doc)
            db.commit()
            db.refresh(doc)

            # Chunk and Index
            chunks_data = DocumentProcessor.chunk_text(s_doc["content"], chunk_size=300, chunk_overlap=30)
            chunk_objs = []
            for idx, (content, s_char, e_char) in enumerate(chunks_data):
                chunk = DocumentChunk(
                    document_id=doc.id,
                    chunk_index=idx,
                    content=content,
                    start_char=s_char,
                    end_char=e_char,
                    metadata_json=json.dumps({"demo": True, "source": s_doc["filename"]})
                )
                db.add(chunk)
                chunk_objs.append(chunk)

            db.commit()
            for c in chunk_objs:
                db.refresh(c)

            retriever.add_chunks([
                {"id": c.id, "content": c.content, "document_id": doc.id}
                for c in chunk_objs
            ])

            doc.chunk_count = len(chunk_objs)
            db.commit()
            docs_created.append(doc)

        # 3. Create Evaluation Dataset
        dataset = EvaluationDataset(
            project_id=project.id,
            name="University Benchmark Dataset [DEMO]",
            description="[DEMO DATA] Curated test cases evaluating factual recall, mathematical tool use, multi-step queries, and out-of-domain rejection.",
            created_at=utcnow() - timedelta(days=5)
        )
        db.add(dataset)
        db.commit()
        db.refresh(dataset)

        test_cases_created = []
        for tc in cls.SAMPLE_TEST_CASES:
            rel_docs = [docs_created[0].id] if "Admissions" in tc.get("reference_context", "") else [docs_created[1].id] if "Computer Science" in tc.get("reference_context", "") else []
            t_obj = TestCase(
                dataset_id=dataset.id,
                query=tc["query"],
                expected_answer=tc["expected_answer"],
                reference_context=tc["reference_context"],
                relevant_doc_ids=json.dumps(rel_docs),
                expected_tool=tc["expected_tool"],
                category=tc["category"],
                created_at=utcnow() - timedelta(days=4)
            )
            db.add(t_obj)
            test_cases_created.append(t_obj)
        db.commit()
        for t in test_cases_created:
            db.refresh(t)

        # 4. Generate Realistic Agent Runs with Traces & Evals
        # Run 1: High quality RAG response
        tc1 = test_cases_created[0]
        r1 = AgentRun(
            project_id=project.id,
            dataset_id=dataset.id,
            test_case_id=tc1.id,
            run_id=str(uuid.uuid4()),
            query=tc1.query,
            response="Undergraduate annual tuition is $14,500 for in-state students. The Regular Decision application deadline is January 15th, with decision notifications on March 30th.",
            model_name="llama-3-8b-instruct",
            model_provider="ollama",
            status="completed",
            total_latency_ms=1240.5,
            retrieval_latency_ms=85.2,
            generation_latency_ms=1155.3,
            token_usage_prompt=180,
            token_usage_completion=42,
            is_demo=True,
            created_at=utcnow() - timedelta(days=2),
            completed_at=utcnow() - timedelta(days=2) + timedelta(seconds=1)
        )
        db.add(r1)
        db.commit()
        db.refresh(r1)

        # Traces for R1
        cls._add_demo_traces(db, r1, has_tool=False)
        cls._add_demo_evals(db, r1, faith=0.96, ans_rel=0.94, ctx_rel=0.91, recall=1.0)

        # Run 2: Tool execution (Calculator)
        tc4 = test_cases_created[3]
        r2 = AgentRun(
            project_id=project.id,
            dataset_id=dataset.id,
            test_case_id=tc4.id,
            run_id=str(uuid.uuid4()),
            query=tc4.query,
            response="For an out-of-state student paying $28,200 annually, the total 4-year undergraduate tuition is $112,800 ($28,200 × 4).",
            model_name="llama-3-8b-instruct",
            model_provider="ollama",
            status="completed",
            total_latency_ms=1420.0,
            retrieval_latency_ms=90.0,
            generation_latency_ms=1280.0,
            token_usage_prompt=195,
            token_usage_completion=35,
            is_demo=True,
            created_at=utcnow() - timedelta(days=1),
            completed_at=utcnow() - timedelta(days=1) + timedelta(seconds=2)
        )
        db.add(r2)
        db.commit()
        db.refresh(r2)

        tc_tool = ToolCall(
            agent_run_id=r2.id,
            tool_name="calculator",
            tool_input='{"expression": "28200 * 4"}',
            tool_output='{"result": 112800}',
            status="completed",
            latency_ms=12.4,
            created_at=utcnow() - timedelta(days=1)
        )
        db.add(tc_tool)
        db.commit()

        cls._add_demo_traces(db, r2, has_tool=True, tool_name="calculator")
        cls._add_demo_evals(db, r2, faith=1.0, ans_rel=0.98, ctx_rel=0.88, recall=1.0, tool_acc=1.0)

        # Run 3: Failure scenario (Irrelevant query / low similarity)
        tc5 = test_cases_created[4]
        r3 = AgentRun(
            project_id=project.id,
            dataset_id=dataset.id,
            test_case_id=tc5.id,
            run_id=str(uuid.uuid4()),
            query=tc5.query,
            response="I apologize, but the institutional repository does not contain records concerning aerospace engineering degrees.",
            model_name="llama-3-8b-instruct",
            model_provider="ollama",
            status="completed",
            total_latency_ms=980.0,
            retrieval_latency_ms=78.0,
            generation_latency_ms=902.0,
            token_usage_prompt=110,
            token_usage_completion=22,
            is_demo=True,
            created_at=utcnow() - timedelta(hours=14),
            completed_at=utcnow() - timedelta(hours=14) + timedelta(seconds=1)
        )
        db.add(r3)
        db.commit()
        db.refresh(r3)

        cls._add_demo_traces(db, r3, has_tool=False)
        cls._add_demo_evals(db, r3, faith=0.90, ans_rel=0.85, ctx_rel=0.15, recall=None)

        return {
            "message": "Demo workspace successfully configured with 3 documents, 7 test cases, and evaluated runs.",
            "project_id": project.id,
            "dataset_id": dataset.id,
            "document_count": len(docs_created),
            "test_case_count": len(test_cases_created)
        }

    @classmethod
    def _add_demo_traces(cls, db: Session, run: AgentRun, has_tool: bool = False, tool_name: str = "calculator"):
        steps = [
            ("Query Analysis", "query_analysis", {"query": run.query}, {"intent": "qa", "needs_retrieval": True}, 25.0),
            ("Document Retrieval", "retrieval", {"query": run.query, "top_k": 3}, {"retrieved_count": 3, "top_score": 0.89}, run.retrieval_latency_ms or 80.0),
            ("Context Preparation", "context_prep", {"chunks": 3}, {"prepared_context_length": 620}, 15.0),
        ]
        if has_tool:
            steps.append(("Tool Execution", "tool_exec", {"tool": tool_name}, {"result": "success"}, 18.0))
        steps.append(("LLM Generation", "generation", {"model": run.model_name}, {"completion": run.response}, run.generation_latency_ms or 1100.0))

        for idx, (s_name, s_type, inp, out, lat) in enumerate(steps, start=1):
            t = ExecutionTrace(
                agent_run_id=run.id,
                step_index=idx,
                step_name=s_name,
                step_type=s_type,
                status="completed",
                input_data=json.dumps(inp),
                output_data=json.dumps(out),
                latency_ms=lat,
                created_at=run.created_at
            )
            db.add(t)
        db.commit()

    @classmethod
    def _add_demo_evals(cls, db: Session, run: AgentRun, faith: float, ans_rel: float, ctx_rel: float, recall: Optional[float] = None, tool_acc: Optional[float] = None):
        evals = [
            EvaluationResult(agent_run_id=run.id, eval_type="answer", metric_name="faithfulness", metric_value=faith, evaluation_method="deterministic", is_evaluated=True),
            EvaluationResult(agent_run_id=run.id, eval_type="answer", metric_name="answer_relevance", metric_value=ans_rel, evaluation_method="deterministic", is_evaluated=True),
            EvaluationResult(agent_run_id=run.id, eval_type="retrieval", metric_name="context_relevance", metric_value=ctx_rel, evaluation_method="deterministic", is_evaluated=True),
            EvaluationResult(agent_run_id=run.id, eval_type="agent", metric_name="task_completion", metric_value=1.0, evaluation_method="deterministic", is_evaluated=True),
            EvaluationResult(agent_run_id=run.id, eval_type="performance", metric_name="total_latency_ms", metric_value=run.total_latency_ms, evaluation_method="deterministic", is_evaluated=True),
        ]
        if recall is not None:
            evals.append(EvaluationResult(agent_run_id=run.id, eval_type="retrieval", metric_name="recall_at_k", metric_value=recall, evaluation_method="deterministic", is_evaluated=True))
        if tool_acc is not None:
            evals.append(EvaluationResult(agent_run_id=run.id, eval_type="agent", metric_name="tool_selection_accuracy", metric_value=tool_acc, evaluation_method="deterministic", is_evaluated=True))

        for e in evals:
            db.add(e)
        db.commit()

    @classmethod
    def cleanup_demo_data(cls, db: Session) -> Dict[str, Any]:
        """Remove all demo projects, documents, runs, and datasets."""
        demo_projects = db.query(Project).filter(Project.name.like("%[DEMO]%")).all()
        count = len(demo_projects)
        for p in demo_projects:
            # Delete vector index files
            retriever = get_retriever(p.id)
            retriever.reset()
            db.delete(p)
        db.commit()
        return {"message": f"Successfully purged {count} demo workspace(s)."}
