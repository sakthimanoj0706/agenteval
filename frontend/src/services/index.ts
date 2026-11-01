import { api } from './api';

export const projectService = {
  list: async () => (await api.get('/projects')).data,
  get: async (id: number | string) => (await api.get(`/projects/${id}`)).data,
  create: async (data: { name: string; description?: string }) => (await api.post('/projects', data)).data,
  update: async (id: number | string, data: { name?: string; description?: string; status?: string }) => (await api.put(`/projects/${id}`, data)).data,
  delete: async (id: number | string) => (await api.delete(`/projects/${id}`)).data,
  getStats: async (id: number | string) => (await api.get(`/projects/${id}/stats`)).data,
};

export const documentService = {
  list: async (projectId: number | string) => (await api.get(`/projects/${projectId}/documents`)).data,
  get: async (id: number | string) => (await api.get(`/documents/${id}`)).data,
  upload: async (projectId: number | string, file: File, autoIndex = true) => {
    const formData = new FormData();
    formData.append('file', file);
    return (await api.post(`/projects/${projectId}/documents?auto_index=${autoIndex}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })).data;
  },
  delete: async (id: number | string) => (await api.delete(`/documents/${id}`)).data,
  index: async (id: number | string, config?: { chunk_size?: number; chunk_overlap?: number }) => (await api.post(`/documents/${id}/index`, config || {})).data,
  getChunks: async (id: number | string) => (await api.get(`/documents/${id}/chunks`)).data,
};

export const datasetService = {
  list: async (projectId: number | string) => (await api.get(`/projects/${projectId}/datasets`)).data,
  get: async (id: number | string) => (await api.get(`/datasets/${id}`)).data,
  create: async (projectId: number | string, data: { name: string; description?: string }) => (await api.post(`/projects/${projectId}/datasets`, data)).data,
  update: async (id: number | string, data: { name?: string; description?: string }) => (await api.put(`/datasets/${id}`, data)).data,
  delete: async (id: number | string) => (await api.delete(`/datasets/${id}`)).data,
  addTestCase: async (datasetId: number | string, data: any) => (await api.post(`/datasets/${datasetId}/test-cases`, data)).data,
  updateTestCase: async (caseId: number | string, data: any) => (await api.put(`/test-cases/${caseId}`, data)).data,
  deleteTestCase: async (caseId: number | string) => (await api.delete(`/test-cases/${caseId}`)).data,
  duplicateTestCase: async (caseId: number | string) => (await api.post(`/test-cases/${caseId}/duplicate`)).data,
  importCases: async (datasetId: number | string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return (await api.post(`/datasets/${datasetId}/import`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })).data;
  },
  exportUrl: (datasetId: number | string, format: 'json' | 'csv' = 'json') => `${api.defaults.baseURL}/datasets/${datasetId}/export?format=${format}`,
};

export const agentService = {
  execute: async (data: {
    project_id: number;
    query: string;
    model_name?: string;
    model_provider?: string;
    prompt_version_id?: number;
    dataset_id?: number;
    test_case_id?: number;
    chunk_size?: number;
    chunk_overlap?: number;
    top_k?: number;
    similarity_threshold?: number;
    tools_enabled?: string[];
  }) => (await api.post('/agent/execute', data)).data,
  executeDataset: async (data: { project_id: number; dataset_id: number; model_name?: string; model_provider?: string; top_k?: number }) =>
    (await api.post('/agent/execute-dataset', data)).data,
  listRuns: async (params?: { project_id?: number; dataset_id?: number; status?: string; limit?: number }) =>
    (await api.get('/agent/runs', { params })).data,
  getRun: async (runId: string | number) => (await api.get(`/agent/runs/${runId}`)).data,
  getTrace: async (runId: string | number) => (await api.get(`/agent/runs/${runId}/trace`)).data,
};

export const evaluationService = {
  evaluateRun: async (runId: number | string) => (await api.post(`/evaluation/run/${runId}`)).data,
  evaluateDataset: async (datasetId: number | string) => (await api.post(`/evaluation/dataset/${datasetId}`)).data,
  getResults: async (runId: number | string) => (await api.get(`/evaluation/results/${runId}`)).data,
  submitHumanReview: async (data: { agent_run_id: number; faithfulness_score?: number; relevance_score?: number; notes?: string }) =>
    (await api.post('/evaluation/human-review', data)).data,
  getMetricsSummary: async (projectId?: number) => (await api.get('/evaluation/metrics/summary', { params: { project_id: projectId } })).data,
};

export const dashboardService = {
  getSummary: async (projectId?: number) => (await api.get('/dashboard/summary', { params: { project_id: projectId } })).data,
  getRetrievalQualityChart: async (projectId?: number) => (await api.get('/dashboard/charts/retrieval-quality', { params: { project_id: projectId } })).data,
  getFaithfulnessRelevanceChart: async (projectId?: number) => (await api.get('/dashboard/charts/faithfulness-relevance', { params: { project_id: projectId } })).data,
  getModelPerformanceChart: async (projectId?: number) => (await api.get('/dashboard/charts/model-performance', { params: { project_id: projectId } })).data,
  getLatencyTrendChart: async (projectId?: number) => (await api.get('/dashboard/charts/latency-trend', { params: { project_id: projectId } })).data,
  getTokenUsageChart: async (projectId?: number) => (await api.get('/dashboard/charts/token-usage', { params: { project_id: projectId } })).data,
  getFailureDistributionChart: async (projectId?: number) => (await api.get('/dashboard/charts/failure-distribution', { params: { project_id: projectId } })).data,
  getRunsTable: async (params?: any) => (await api.get('/dashboard/runs', { params })).data,
};

export const comparisonService = {
  execute: async (data: { project_id: number; dataset_id: number; configurations: any[] }) =>
    (await api.post('/comparison/execute', data)).data,
};

export const failureService = {
  getAnalysis: async (projectId?: number) => (await api.get('/failures/analysis', { params: { project_id: projectId } })).data,
  getByCategory: async (category: string, projectId?: number) => (await api.get(`/failures/category/${category}`, { params: { project_id: projectId } })).data,
  getRunFailures: async (runId: string | number) => (await api.get(`/failures/run/${runId}`)).data,
};

export const regressionService = {
  run: async (data: { project_id: number; dataset_id: number; baseline_config: any; comparison_config: any }) =>
    (await api.post('/regression/run', data)).data,
  list: async (projectId?: number) => (await api.get('/regression/list', { params: { project_id: projectId } })).data,
  get: async (id: number) => (await api.get(`/regression/${id}`)).data,
  exportUrl: (id: number, format: 'json' | 'csv' = 'json') => `${api.defaults.baseURL}/regression/${id}/export?format=${format}`,
};

export const settingsService = {
  getProviders: async () => (await api.get('/settings/providers')).data,
  testProvider: async (data: { provider: string; endpoint_url?: string; api_key?: string; model_name?: string }) =>
    (await api.post('/settings/providers/test', data)).data,
  listModels: async () => (await api.get('/settings/models')).data,
  addModel: async (data: any) => (await api.post('/settings/models', data)).data,
  getGeneral: async () => (await api.get('/settings/general')).data,
};

export const demoService = {
  setup: async () => (await api.post('/demo/setup')).data,
  cleanup: async () => (await api.delete('/demo/cleanup')).data,
  status: async () => (await api.get('/demo/status')).data,
};

export const reportService = {
  generateUrl: (projectId: number, format: 'json' | 'markdown' = 'markdown') =>
    `${api.defaults.baseURL}/reports/generate/${projectId}?format=${format}`,
};
