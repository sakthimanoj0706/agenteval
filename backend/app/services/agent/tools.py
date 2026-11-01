"""
Tool definitions and registry for Agent Execution.
Includes Knowledge Base Search, College Info Search, and Calculator.
"""

import time
from typing import Any, Dict, List, Optional


class ToolResult:
    def __init__(self, tool_name: str, input_data: Any, output_data: Any, latency_ms: float, status: str = "completed", error: Optional[str] = None):
        self.tool_name = tool_name
        self.input_data = input_data
        self.output_data = output_data
        self.latency_ms = latency_ms
        self.status = status
        self.error = error

    def to_dict(self) -> Dict[str, Any]:
        return {
            "tool_name": self.tool_name,
            "tool_input": str(self.input_data),
            "tool_output": str(self.output_data) if self.output_data is not None else None,
            "latency_ms": round(self.latency_ms, 2),
            "status": self.status,
            "error_message": self.error,
        }


class MockCollegeDatabase:
    """Mock database of academic information for deterministic evaluation."""
    DATA = {
        "tuition": "Undergraduate annual tuition is $14,500 for in-state and $28,200 for out-of-state students.",
        "admissions": "Application deadline for Fall intake is January 15th for Regular Decision, November 1st for Early Action.",
        "cs_department": "The Computer Science Department offers B.S., M.S., and Ph.D. degrees with specializations in AI, Systems, and Cybersecurity.",
        "financial_aid": "Over 75% of incoming freshmen receive merit-based or need-based institutional scholarships.",
        "campus_housing": "Freshmen are guaranteed on-campus dorm housing if application is submitted by May 1st.",
        "library_hours": "The Central Library is open 24/7 during midterm and final exam weeks; regular hours are 7:30 AM to midnight.",
    }

    @classmethod
    def query(cls, keyword: str) -> str:
        kw = keyword.lower()
        matches = []
        for key, text in cls.DATA.items():
            if any(term in key or term in text.lower() for term in kw.split()):
                matches.append(text)
        if matches:
            return " ".join(matches)
        return "No specific college records found matching the inquiry."


class ToolRegistry:
    @staticmethod
    def get_available_tools() -> List[Dict[str, Any]]:
        return [
            {
                "name": "knowledge_base",
                "description": "Searches indexed documents for project-specific information.",
                "parameters": {"query": "string (search terms)"},
            },
            {
                "name": "college_info",
                "description": "Searches institutional academic, admissions, tuition, and campus directory records.",
                "parameters": {"keyword": "string (topic to query)"},
            },
            {
                "name": "calculator",
                "description": "Performs mathematical arithmetic calculations safely.",
                "parameters": {"expression": "string (math expression, e.g. '14500 * 4')"},
            },
        ]

    @staticmethod
    def execute_tool(name: str, params: Dict[str, Any]) -> ToolResult:
        start_time = time.time()
        try:
            if name == "college_info":
                kw = params.get("keyword") or params.get("query", "")
                result = MockCollegeDatabase.query(kw)
                latency = (time.time() - start_time) * 1000
                return ToolResult(name, params, result, latency, status="completed")

            elif name == "calculator":
                expr = params.get("expression", "")
                # Safe evaluation of basic math
                allowed_chars = set("0123456789+-*/(). ")
                if not all(c in allowed_chars for c in expr):
                    raise ValueError("Disallowed characters in calculation.")
                # Evaluate expression safely
                val = eval(expr, {"__builtins__": {}}, {})
                latency = (time.time() - start_time) * 1000
                return ToolResult(name, params, f"Calculation result: {val}", latency, status="completed")

            elif name == "knowledge_base":
                # Knowledge base retrieval tool handler
                q = params.get("query", "")
                latency = (time.time() - start_time) * 1000
                return ToolResult(name, params, f"Search executed for '{q}'", latency, status="completed")

            else:
                latency = (time.time() - start_time) * 1000
                return ToolResult(name, params, None, latency, status="failed", error=f"Unknown tool '{name}'")

        except Exception as e:
            latency = (time.time() - start_time) * 1000
            return ToolResult(name, params, None, latency, status="failed", error=str(e))
