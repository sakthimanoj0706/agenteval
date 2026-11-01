import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
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
  Button,
  Chip,
  LinearProgress,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Visibility as ViewIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { StatusChip } from '../components/StatusChip';
import { ScoreDisplay } from '../components/ScoreDisplay';
import { agentService, projectService } from '../services';

export const EvaluationRunsPage: React.FC = () => {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | ''>('');
  const [statusFilter, setStatusFilter] = useState('all');

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

  const loadRuns = async () => {
    try {
      setLoading(true);
      const data = await agentService.listRuns({
        project_id: selectedProjectId ? Number(selectedProjectId) : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        limit: 100,
      });
      setRuns(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRuns();
  }, [selectedProjectId, statusFilter]);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={800} color="#0F172A">
            Agent Evaluation Runs
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Inspect all historical agent invocations, latency breakdowns, and evaluated scores
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Filter by Project</InputLabel>
            <Select
              value={selectedProjectId}
              label="Filter by Project"
              onChange={(e) => setSelectedProjectId(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <MenuItem value="">All Projects</MenuItem>
              {projects.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="all">All Statuses</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="failed">Failed</MenuItem>
              <MenuItem value="running">Running</MenuItem>
            </Select>
          </FormControl>

          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadRuns}>
            Refresh
          </Button>
        </Box>
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #E2E8F0', borderRadius: 3 }}>
        <Table>
          <TableHead sx={{ bgcolor: '#F8FAFC' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Run ID</TableCell>
              <TableCell sx={{ fontWeight: 700, width: '30%' }}>Query</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Model</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Faithfulness</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Answer Relevance</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Latency</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Timestamp</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Trace</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {runs.map((r) => {
              const evalMap = (r.evaluation_results || []).reduce((acc: any, item: any) => {
                acc[item.metric_name] = item;
                return acc;
              }, {});

              const faith = evalMap['faithfulness'];
              const rel = evalMap['answer_relevance'];

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
                  <TableCell>
                    <Chip label={r.model_name} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <StatusChip status={r.status} />
                  </TableCell>
                  <TableCell>
                    <ScoreDisplay
                      score={faith?.metric_value}
                      method={faith?.evaluation_method}
                      isEvaluated={faith?.is_evaluated}
                      reason={faith?.reason}
                    />
                  </TableCell>
                  <TableCell>
                    <ScoreDisplay
                      score={rel?.metric_value}
                      method={rel?.evaluation_method}
                      isEvaluated={rel?.is_evaluated}
                      reason={rel?.reason}
                    />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, color: '#475569' }}>
                    {r.total_latency_ms ? `${r.total_latency_ms.toFixed(0)} ms` : 'N/A'}
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.8rem', color: '#64748B' }}>
                    {new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Inspect Trace Timeline">
                      <IconButton size="small" color="primary">
                        <ViewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
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
