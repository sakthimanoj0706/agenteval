import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  LinearProgress,
} from '@mui/material';
import {
  PlayCircle as RunIcon,
  CheckCircle as SuccessIcon,
  Speed as LatencyIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { MetricCard } from '../components/MetricCard';
import { ChartCard } from '../components/ChartCard';
import { StatusChip } from '../components/StatusChip';
import { ScoreDisplay } from '../components/ScoreDisplay';
import { dashboardService, projectService } from '../services';

const PIE_COLORS = ['#C62828', '#E65100', '#F57C00', '#1565C0', '#3949AB', '#6A1B9A', '#00838F', '#2E7D32'];

export const AnalyticsDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | ''>('');
  const [summary, setSummary] = useState<any>(null);
  const [retrievalData, setRetrievalData] = useState<any[]>([]);
  const [faithfulnessData, setFaithfulnessData] = useState<any[]>([]);
  const [modelPerfData, setModelPerfData] = useState<any[]>([]);
  const [latencyTrendData, setLatencyTrendData] = useState<any[]>([]);
  const [tokenUsageData, setTokenUsageData] = useState<any[]>([]);
  const [failureData, setFailureData] = useState<any[]>([]);
  const [runsTable, setRunsTable] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const pList = await projectService.list();
        setProjects(pList);
      } catch (e) {
        console.error(e);
      }
    };
    init();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const pId = selectedProjectId ? Number(selectedProjectId) : undefined;
      const [sum, ret, faith, perf, lat, tok, fails, runs] = await Promise.all([
        dashboardService.getSummary(pId),
        dashboardService.getRetrievalQualityChart(pId),
        dashboardService.getFaithfulnessRelevanceChart(pId),
        dashboardService.getModelPerformanceChart(pId),
        dashboardService.getLatencyTrendChart(pId),
        dashboardService.getTokenUsageChart(pId),
        dashboardService.getFailureDistributionChart(pId),
        dashboardService.getRunsTable({ project_id: pId, limit: 10 }),
      ]);
      setSummary(sum);
      setRetrievalData(ret);
      setFaithfulnessData(faith);
      setModelPerfData(perf);
      setLatencyTrendData(lat);
      setTokenUsageData(tok);
      setFailureData(fails);
      setRunsTable(runs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [selectedProjectId]);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={800} color="#0F172A">
            RAG & Agent Analytics Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Multi-dimensional evaluation metrics, trend telemetry, and failure distribution
          </Typography>
        </Box>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel>Filter by Project</InputLabel>
          <Select
            value={selectedProjectId}
            label="Filter by Project"
            onChange={(e) => setSelectedProjectId(e.target.value === '' ? '' : Number(e.target.value))}
          >
            <MenuItem value="">All Workspaces</MenuItem>
            {projects.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {/* Summary Row */}
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Total Evaluation Runs"
            value={summary?.total_runs ?? 0}
            subtitle="Recorded traces"
            icon={<RunIcon />}
            color="primary"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Average Faithfulness"
            value={summary?.avg_faithfulness ? `${(summary.avg_faithfulness * 100).toFixed(1)}%` : 'N/A'}
            subtitle="Supported by context"
            icon={<SuccessIcon />}
            color="success"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Avg Answer Relevance"
            value={summary?.avg_answer_relevance ? `${(summary.avg_answer_relevance * 100).toFixed(1)}%` : 'N/A'}
            subtitle="Addresses test query"
            icon={<SuccessIcon />}
            color="info"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Failed Executions"
            value={summary?.failed_runs_count ?? 0}
            subtitle="Runtime & evaluation errors"
            icon={<WarningIcon />}
            color="error"
          />
        </Grid>
      </Grid>

      {/* Interactive Charts 2-Column Grid */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Chart 1: Faithfulness & Relevance Comparison */}
        <Grid item xs={12} md={6}>
          <ChartCard title="Faithfulness & Relevance" subtitle="Grounding quality across recent agent runs">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={faithfulnessData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="run_id" stroke="#64748B" fontSize={12} />
                <YAxis domain={[0, 1]} stroke="#64748B" fontSize={12} />
                <RechartsTooltip />
                <Legend />
                <Bar dataKey="faithfulness" fill="#2E7D32" name="Faithfulness" radius={[4, 4, 0, 0]} />
                <Bar dataKey="answer_relevance" fill="#1565C0" name="Answer Relevance" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>

        {/* Chart 2: Latency Trend */}
        <Grid item xs={12} md={6}>
          <ChartCard title="Latency Breakdown Trend" subtitle="End-to-end vs retrieval and generation time (ms)">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={latencyTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="timestamp" stroke="#64748B" fontSize={12} />
                <YAxis stroke="#64748B" fontSize={12} />
                <RechartsTooltip />
                <Legend />
                <Area type="monotone" dataKey="total_latency_ms" stroke="#E65100" fill="#FFE0B2" name="Total Latency (ms)" />
                <Area type="monotone" dataKey="generation_latency_ms" stroke="#1565C0" fill="#BBDEFB" name="Generation (ms)" />
                <Area type="monotone" dataKey="retrieval_latency_ms" stroke="#2E7D32" fill="#C8E6C9" name="Retrieval (ms)" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>

        {/* Chart 3: Model Performance Comparison */}
        <Grid item xs={12} md={6}>
          <ChartCard title="Model Performance Benchmark" subtitle="Metric scores grouped by model engine">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={modelPerfData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="model_name" stroke="#64748B" fontSize={12} />
                <YAxis domain={[0, 1]} stroke="#64748B" fontSize={12} />
                <RechartsTooltip />
                <Legend />
                <Bar dataKey="faithfulness" fill="#2E7D32" name="Faithfulness" />
                <Bar dataKey="answer_relevance" fill="#1565C0" name="Relevance" />
                <Bar dataKey="context_relevance" fill="#00838F" name="Context Rel" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>

        {/* Chart 4: Failure Distribution */}
        <Grid item xs={12} md={6}>
          <ChartCard title="Failure Modes Distribution" subtitle="Detected failure categories across pipeline stages">
            {failureData.length === 0 ? (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Typography variant="body2" color="text.secondary">
                  No execution failures detected.
                </Typography>
              </Box>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={failureData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                  >
                    {failureData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </Grid>
      </Grid>

      {/* Recent Runs Table */}
      <Typography variant="h6" fontWeight={700} color="#0F172A" sx={{ mb: 2 }}>
        Recent Evaluation Traces
      </Typography>
      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #E2E8F0', borderRadius: 3 }}>
        <Table>
          <TableHead sx={{ bgcolor: '#F8FAFC' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Run ID</TableCell>
              <TableCell sx={{ fontWeight: 700, width: '35%' }}>Query</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Model</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Faithfulness</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Relevance</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Latency</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {runsTable.map((r) => {
              const evalMap = (r.evaluation_results || []).reduce((acc: any, item: any) => {
                acc[item.metric_name] = item;
                return acc;
              }, {});

              return (
                <TableRow
                  key={r.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/traces?run_id=${r.run_id}`)}
                >
                  <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600, color: '#1565C0' }}>
                    {r.run_id.substring(0, 8)}...
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{r.query}</TableCell>
                  <TableCell>{r.model_name}</TableCell>
                  <TableCell>
                    <StatusChip status={r.status} />
                  </TableCell>
                  <TableCell>
                    <ScoreDisplay
                      score={evalMap['faithfulness']?.metric_value}
                      method={evalMap['faithfulness']?.evaluation_method}
                      isEvaluated={evalMap['faithfulness']?.is_evaluated}
                    />
                  </TableCell>
                  <TableCell>
                    <ScoreDisplay
                      score={evalMap['answer_relevance']?.metric_value}
                      method={evalMap['answer_relevance']?.evaluation_method}
                      isEvaluated={evalMap['answer_relevance']?.is_evaluated}
                    />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>
                    {r.total_latency_ms ? `${r.total_latency_ms.toFixed(0)} ms` : 'N/A'}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};
