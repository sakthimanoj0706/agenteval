import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  LinearProgress,
} from '@mui/material';
import {
  Compare as CompareIcon,
  PlayArrow as RunIcon,
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
} from 'recharts';
import { ChartCard } from '../components/ChartCard';
import { ScoreDisplay } from '../components/ScoreDisplay';
import { projectService, datasetService, comparisonService } from '../services';

export const ModelComparisonPage: React.FC = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | ''>('');
  const [datasets, setDatasets] = useState<any[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [comparisonResults, setComparisonResults] = useState<any[]>([]);

  useEffect(() => {
    const init = async () => {
      try {
        const pList = await projectService.list();
        setProjects(pList);
        if (pList.length > 0) setSelectedProjectId(pList[0].id);
      } catch (e) {
        console.error(e);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (!selectedProjectId) return;
    const loadDs = async () => {
      try {
        const dsList = await datasetService.list(selectedProjectId);
        setDatasets(dsList);
        if (dsList.length > 0) setSelectedDatasetId(dsList[0].id);
      } catch (e) {
        console.error(e);
      }
    };
    loadDs();
  }, [selectedProjectId]);

  const handleRunComparison = async () => {
    if (!selectedProjectId || !selectedDatasetId) return;
    try {
      setLoading(true);
      const res = await comparisonService.execute({
        project_id: Number(selectedProjectId),
        dataset_id: Number(selectedDatasetId),
        configurations: [
          {
            name: 'Grounded Engine (Top-K=3)',
            model_name: 'grounded-mock-v1',
            model_provider: 'mock',
            top_k: 3,
            chunk_size: 512,
          },
          {
            name: 'Grounded Engine (Top-K=5)',
            model_name: 'grounded-mock-v1',
            model_provider: 'mock',
            top_k: 5,
            chunk_size: 512,
          },
          {
            name: 'Local Llama 3.2 (Top-K=5)',
            model_name: 'llama3.2',
            model_provider: 'ollama',
            top_k: 5,
            chunk_size: 512,
          },
        ],
      });
      setComparisonResults(res.results || []);
    } catch (e: any) {
      alert(e.message || 'Comparison failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={800} color="#0F172A">
            Model & Prompt Configuration Comparison
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Execute identical test datasets across differing LLMs, chunk sizes, and retrieval depths
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Project</InputLabel>
            <Select
              value={selectedProjectId}
              label="Project"
              onChange={(e) => setSelectedProjectId(Number(e.target.value))}
            >
              {projects.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>Benchmark Dataset</InputLabel>
            <Select
              value={selectedDatasetId}
              label="Benchmark Dataset"
              onChange={(e) => setSelectedDatasetId(Number(e.target.value))}
            >
              {datasets.map((d) => (
                <MenuItem key={d.id} value={d.id}>
                  {d.name} ({d.test_case_count ?? 0} cases)
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button
            variant="contained"
            startIcon={<RunIcon />}
            onClick={handleRunComparison}
            disabled={loading || !selectedDatasetId}
          >
            {loading ? 'Running Benchmark...' : 'Run Comparison'}
          </Button>
        </Box>
      </Box>

      {loading && <LinearProgress sx={{ mb: 3 }} />}

      {comparisonResults.length > 0 && (
        <Box>
          {/* Grouped Bar Chart */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} md={7}>
              <ChartCard title="Quality Dimensions Comparison" subtitle="Scores by configuration (0.0 - 1.0)">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={comparisonResults}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis dataKey="config_name" stroke="#64748B" fontSize={11} />
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
            <Grid item xs={12} md={5}>
              <ChartCard title="Execution Latency" subtitle="Average latency in ms per configuration">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={comparisonResults}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis dataKey="config_name" stroke="#64748B" fontSize={11} />
                    <YAxis stroke="#64748B" fontSize={12} />
                    <RechartsTooltip />
                    <Bar dataKey="avg_latency_ms" fill="#E65100" name="Latency (ms)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </Grid>
          </Grid>

          {/* Detailed Side-by-Side Table */}
          <Typography variant="h6" fontWeight={700} color="#0F172A" sx={{ mb: 2 }}>
            Configuration Metrics Breakdown
          </Typography>
          <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #E2E8F0', borderRadius: 3 }}>
            <Table>
              <TableHead sx={{ bgcolor: '#F8FAFC' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Configuration</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Model / Provider</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Top-K</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Faithfulness</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Relevance</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Context Rel</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Avg Latency</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {comparisonResults.map((cfg, i) => (
                  <TableRow key={i} hover>
                    <TableCell sx={{ fontWeight: 700 }}>{cfg.config_name}</TableCell>
                    <TableCell>
                      <Chip label={`${cfg.model_name} (${cfg.model_provider})`} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>{cfg.top_k}</TableCell>
                    <TableCell>
                      <ScoreDisplay score={cfg.faithfulness} />
                    </TableCell>
                    <TableCell>
                      <ScoreDisplay score={cfg.answer_relevance} />
                    </TableCell>
                    <TableCell>
                      <ScoreDisplay score={cfg.context_relevance} />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{cfg.avg_latency_ms?.toFixed(0)} ms</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}
    </Box>
  );
};
