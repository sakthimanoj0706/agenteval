// ==================== API Response Wrappers ====================

export interface ApiResponse<T> {
  data: T;
  message?: string;
  status: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ApiError {
  detail: string;
  status_code: number;
}

// ==================== Project ====================

export interface Project {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  document_count?: number;
  dataset_count?: number;
  run_count?: number;
}

export interface ProjectStats {
  total_documents: number;
  total_chunks: number;
  total_datasets: number;
  total_test_cases: number;
  total_runs: number;
  avg_faithfulness: number | null;
  avg_relevance: number | null;
  avg_latency: number | null;
}

export interface CreateProjectRequest {
  name: string;
  description: string;
}

// ==================== Document ====================

export type DocumentStatus = 'uploaded' | 'processing' | 'indexed' | 'failed';

export interface Document {
  id: string;
  project_id: string;
  filename: string;
  file_type: string;
  file_size: number;
  status: DocumentStatus;
  chunk_count: number;
  uploaded_at: string;
  indexed_at: string | null;
  error_message: string | null;
}

export interface DocumentChunk {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  metadata: Record<string, unknown>;
  embedding_status: string;
  token_count: number;
}

// ==================== Evaluation Dataset ====================

export interface EvaluationDataset {
  id: string;
  project_id: string;
  name: string;
  description: string;
  test_case_count: number;
  created_at: string;
  updated_at: string;
}

export interface TestCase {
  id: string;
  dataset_id: string;
  query: string;
  expected_answer: string;
  reference_context: string;
  relevant_doc_ids: string[];
  expected_tool: string | null;
  category: TestCaseCategory;
  created_at: string;
  updated_at: string;
}

export type TestCaseCategory =
  | 'factual'
  | 'reasoning'
  | 'summarization'
  | 'comparison'
  | 'multi_hop'
  | 'temporal'
  | 'negation'
  | 'general';

export interface CreateTestCaseRequest {
  query: string;
  expected_answer: string;
  reference_context: string;
  relevant_doc_ids?: string[];
  expected_tool?: string;
  category?: TestCaseCategory;
}

export interface CreateDatasetRequest {
  name: string;
  description: string;
  project_id: string;
}

// ==================== Agent Run ====================

export type RunStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface AgentRun {
  id: string;
  project_id: string;
  dataset_id: string | null;
  test_case_id: string | null;
  query: string;
  response: string | null;
  model_name: string;
  prompt_version: string | null;
  status: RunStatus;
  latency_ms: number | null;
  total_tokens: number | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  chunk_size: number;
  chunk_overlap: number;
  top_k: number;
  similarity_threshold: number;
  created_at: string;
  completed_at: string | null;
  error_message: string | null;
  retrieved_chunks?: RetrievedChunk[];
  tool_calls?: ToolCall[];
  execution_trace?: ExecutionTrace[];
  evaluation_result?: EvaluationResult;
}

export interface RetrievedChunk {
  id: string;
  run_id: string;
  chunk_id: string;
  document_id: string;
  document_name: string;
  content: string;
  similarity_score: number;
  rank: number;
}

export interface ToolCall {
  id: string;
  run_id: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_output: string | null;
  status: 'pending' | 'running' | 'completed' | 'failed';
  latency_ms: number | null;
  timestamp: string;
}

export interface ExecutionTrace {
  id: string;
  run_id: string;
  step_name: string;
  step_type: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  input_data: Record<string, unknown> | null;
  output_data: Record<string, unknown> | null;
  error_message: string | null;
  latency_ms: number | null;
  timestamp: string;
  order_index: number;
}

export interface RunAgentRequest {
  project_id: string;
  query: string;
  model_name: string;
  prompt_version?: string;
  chunk_size?: number;
  chunk_overlap?: number;
  top_k?: number;
  similarity_threshold?: number;
  dataset_id?: string;
  test_case_id?: string;
}

// ==================== Evaluation ====================

export type EvaluationMethod = 'deterministic' | 'llm_judge' | 'human';

export interface EvaluationResult {
  id: string;
  run_id: string;
  faithfulness_score: number | null;
  answer_relevance_score: number | null;
  context_relevance_score: number | null;
  context_precision_score: number | null;
  context_recall_score: number | null;
  semantic_similarity_score: number | null;
  bleu_score: number | null;
  rouge_score: number | null;
  task_completion: boolean | null;
  tool_accuracy: boolean | null;
  evaluation_method: EvaluationMethod;
  evaluated_at: string;
  evaluation_metadata: Record<string, unknown> | null;
}

export interface MetricSummary {
  metric_name: string;
  avg_score: number;
  min_score: number;
  max_score: number;
  median_score: number;
  std_dev: number;
  count: number;
}

export interface EvaluateRequest {
  run_id: string;
  method?: EvaluationMethod;
}

export interface BatchEvaluateRequest {
  dataset_id: string;
  project_id: string;
  model_name: string;
  prompt_version?: string;
  chunk_size?: number;
  chunk_overlap?: number;
  top_k?: number;
  similarity_threshold?: number;
}

// ==================== Model Configuration ====================

export interface ModelConfiguration {
  id: string;
  name: string;
  provider: string;
  model_id: string;
  endpoint_url: string | null;
  is_default: boolean;
  parameters: Record<string, unknown>;
  created_at: string;
}

export interface PromptVersion {
  id: string;
  project_id: string;
  version: string;
  name: string;
  system_prompt: string;
  user_prompt_template: string;
  created_at: string;
  is_active: boolean;
}

// ==================== Regression Testing ====================

export interface RegressionRun {
  id: string;
  project_id: string;
  dataset_id: string;
  baseline_config: RegressionConfig;
  comparison_config: RegressionConfig;
  status: RunStatus;
  created_at: string;
  completed_at: string | null;
  results?: RegressionResult;
}

export interface RegressionConfig {
  model_name: string;
  prompt_version?: string;
  chunk_size: number;
  chunk_overlap: number;
  top_k: number;
  similarity_threshold: number;
}

export interface RegressionResult {
  id: string;
  regression_run_id: string;
  baseline_metrics: MetricSummary[];
  comparison_metrics: MetricSummary[];
  improved_metrics: MetricDelta[];
  declined_metrics: MetricDelta[];
  unchanged_metrics: MetricDelta[];
  new_failures: FailureDetail[];
  resolved_failures: FailureDetail[];
  baseline_avg_latency: number;
  comparison_avg_latency: number;
  baseline_total_tokens: number;
  comparison_total_tokens: number;
}

export interface MetricDelta {
  metric_name: string;
  baseline_value: number;
  comparison_value: number;
  delta: number;
  delta_percentage: number;
}

// ==================== Failure Analysis ====================

export type FailureCategoryType =
  | 'retrieval_failure'
  | 'hallucination'
  | 'incomplete_answer'
  | 'wrong_tool_usage'
  | 'context_overflow'
  | 'latency_timeout'
  | 'model_error'
  | 'parsing_error';

export interface FailureCategory {
  category: FailureCategoryType;
  count: number;
  percentage: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface FailureDetail {
  id: string;
  run_id: string;
  test_case_id: string | null;
  category: FailureCategoryType;
  query: string;
  expected_answer: string | null;
  actual_answer: string | null;
  error_message: string | null;
  root_cause: string | null;
  suggestion: string | null;
  created_at: string;
}

export interface FailureTrend {
  date: string;
  category: FailureCategoryType;
  count: number;
}

// ==================== Model Comparison ====================

export interface ComparisonExperiment {
  id: string;
  name: string;
  dataset_id: string;
  configurations: ComparisonConfig[];
  status: RunStatus;
  created_at: string;
  completed_at: string | null;
  results?: ComparisonResult[];
}

export interface ComparisonConfig {
  id: string;
  model_name: string;
  prompt_version?: string;
  chunk_size: number;
  chunk_overlap: number;
  top_k: number;
}

export interface ComparisonResult {
  config_id: string;
  model_name: string;
  metrics: Record<string, number>;
  avg_latency: number;
  total_tokens: number;
  success_rate: number;
}

export interface CreateComparisonRequest {
  name: string;
  dataset_id: string;
  configurations: Omit<ComparisonConfig, 'id'>[];
}

// ==================== Dashboard ====================

export interface DashboardSummary {
  total_projects: number;
  total_documents: number;
  total_runs: number;
  total_evaluations: number;
  avg_faithfulness: number | null;
  avg_answer_relevance: number | null;
  avg_context_relevance: number | null;
  avg_latency: number | null;
  task_completion_rate: number | null;
  total_failed_runs: number;
  recent_activity: RecentActivity[];
}

export interface RecentActivity {
  id: string;
  type: 'run' | 'evaluation' | 'document' | 'dataset' | 'project';
  description: string;
  timestamp: string;
  status?: string;
}

export interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

export interface ChartDataset {
  label: string;
  data: number[];
  color?: string;
}

export interface TimeSeriesData {
  timestamp: string;
  value: number;
  label?: string;
}

export interface DistributionData {
  name: string;
  value: number;
  color?: string;
}

// ==================== Settings ====================

export interface ProviderSettings {
  ollama: OllamaSettings;
  huggingface: HuggingFaceSettings;
  embedding: EmbeddingSettings;
  vector_store: VectorStoreSettings;
}

export interface OllamaSettings {
  endpoint_url: string;
  is_connected: boolean;
  available_models: string[];
}

export interface HuggingFaceSettings {
  model_name: string;
  api_key?: string;
  is_connected: boolean;
}

export interface EmbeddingSettings {
  model_name: string;
  provider: string;
  dimension: number;
}

export interface VectorStoreSettings {
  type: string;
  path: string;
  collection_name: string;
}

export interface GeneralSettings {
  default_chunk_size: number;
  default_chunk_overlap: number;
  default_top_k: number;
  default_similarity_threshold: number;
  max_upload_size_mb: number;
  allowed_file_types: string[];
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  latency_ms?: number;
}

// ==================== Demo Data ====================

export interface DemoSetupResponse {
  message: string;
  project_id: string;
  documents_created: number;
  datasets_created: number;
  runs_created: number;
}

// ==================== Report ====================

export interface ReportRequest {
  project_id?: string;
  dataset_id?: string;
  format: 'csv' | 'json';
  include_metrics?: boolean;
  include_traces?: boolean;
  date_from?: string;
  date_to?: string;
}
