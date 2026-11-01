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
  Chip,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  PlayArrow as RunIcon,
  ArrowUpward as UpIcon,
  ArrowDownward as DownIcon,
  Download as ExportIcon,
} from '@mui/icons-material';
import { MetricCard } from '../components/MetricCard';
import { projectService, datasetService, regressionService } from '../services';

export const RegressionTestingPage: React.FC = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | ''>('');
  const [datasets, setDatasets] = useState<any[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [regressionResult, setRegressionResult] = useState<any>(null);

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

  const handleRunRegression = async () => {
    if (!selectedProjectId || !selectedDatasetId) return;
    try {
      setLoading(true);
      const res = await regressionService.run({
        project_id: Number(selectedProjectId),
        dataset_id: Number(selectedDatasetId),
        baseline_config: {
          name: 'Baseline V1 (Top-K=3)',
          model_name: 'grounded-mock-v1',
          model_provider: 'mock',
          top_k: 3,
        },
        comparison_config: {
          name: 'Candidate V2 (Top-K=5)',
          model_name: 'grounded-mock-v1',
          model_provider: 'mock',
          top_k: 5,
        },
      });
      setRegressionResult(res);
    } catch (e: any) {
      alert(e.message || 'Regression test failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={800} color="#0F172A">
            Repeatable Regression Testing
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Execute candidate updates against baseline configurations to catch quality regressions before release
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
            <InputLabel>Evaluation Dataset</InputLabel>
            <Select
              value={selectedDatasetId}
              label="Evaluation Dataset"
              onChange={(e) => setSelectedDatasetId(Number(e.target.value))}
            >
              {datasets.map((d) => (
                <MenuItem key={d.id} value={d.id}>
                  {d.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button
            variant="contained"
            startIcon={<RunIcon />}
            onClick={handleRunRegression}
            disabled={loading || !selectedDatasetId}
          >
            {loading ? 'Evaluating Regression...' : 'Run Regression Test'}
          </Button>
        </Box>
      </Box>

      {loading && <LinearProgress sx={{ mb: 3 }} />}

      {regressionResult && (
        <Box>
          {/* Summary KPIs */}
          <Grid container spacing={2.5} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                title="Improved Metrics"
                value={regressionResult.improved_metrics?.length ?? 0}
                subtitle="Positive score deltas"
                color="success"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                title="Declined Metrics"
                value={regressionResult.declined_metrics?.length ?? 0}
                subtitle="Potential regressions"
                color="error"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                title="New Failures"
                value={regressionResult.new_failures?.length ?? 0}
                subtitle="Cases failing in candidate"
                color="warning"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                title="Latency Delta"
                value={`${regressionResult.latency_delta_ms > 0 ? '+' : ''}${regressionResult.latency_delta_ms} ms`}
                subtitle="Change in average duration"
                color={regressionResult.latency_delta_ms > 0 ? 'warning' : 'success'}
              />
            </Grid>
          </Grid>

          {/* Metric Comparison Table */}
          <Paper elevation={0} sx={{ p: 3, border: '1px solid #E2E8F0', borderRadius: 3, mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" fontWeight={700} color="#0F172A">
                Metric Changes: Baseline vs Candidate
              </Typography>
              <Button
                size="small"
                variant="outlined"
                startIcon={<ExportIcon />}
                href={regressionService.exportUrl(regressionResult.id, 'json')}
                target="_blank"
              >
                Export JSON Report
              </Button>
            </Box>

            <TableContainer>
              <Table>
                <TableHead sx={{ bgcolor: '#F8FAFC' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Evaluation Metric</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Baseline Score</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Candidate Score</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Delta</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {regressionResult.improved_metrics?.map((m: any, i: number) => (
                    <TableRow key={`imp-${i}`} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{m.metric_name.replace(/_/g, ' ').toUpperCase()}</TableCell>
                      <TableCell>{(m.baseline_value * 100).toFixed(1)}%</TableCell>
                      <TableCell>{(m.comparison_value * 100).toFixed(1)}%</TableCell>
                      <TableCell sx={{ color: '#2E7D32', fontWeight: 700 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <UpIcon fontSize="small" /> +{(m.delta * 100).toFixed(1)}%
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip label="IMPROVED" size="small" color="success" sx={{ fontWeight: 700 }} />
                      </TableCell>
                    </TableRow>
                  ))}

                  {regressionResult.declined_metrics?.map((m: any, i: number) => (
                    <TableRow key={`dec-${i}`} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{m.metric_name.replace(/_/g, ' ').toUpperCase()}</TableCell>
                      <TableCell>{(m.baseline_value * 100).toFixed(1)}%</TableCell>
                      <TableCell>{(m.comparison_value * 100).toFixed(1)}%</TableCell>
                      <TableCell sx={{ color: '#D32F2F', fontWeight: 700 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <DownIcon fontSize="small" /> {(m.delta * 100).toFixed(1)}%
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip label="DECLINED" size="small" color="error" sx={{ fontWeight: 700 }} />
                      </TableCell>
                    </TableRow>
                  ))}

                  {regressionResult.unchanged_metrics?.map((m: any, i: number) => (
                    <TableRow key={`unc-${i}`} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{m.metric_name.replace(/_/g, ' ').toUpperCase()}</TableCell>
                      <TableCell>{(m.baseline_value * 100).toFixed(1)}%</TableCell>
                      <TableCell>{(m.comparison_value * 100).toFixed(1)}%</TableCell>
                      <TableCell sx={{ color: '#64748B' }}>0.0%</TableCell>
                      <TableCell>
                        <Chip label="UNCHANGED" size="small" variant="outlined" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>
      )}
    </Box>
  );
};
