import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Button,
  Grid,
  Paper,
  LinearProgress,
} from '@mui/material';
import {
  Description as DocumentIcon,
  Dataset as DatasetIcon,
  PlayCircle as RunIcon,
  SmartToy as AgentIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import { MetricCard } from '../components/MetricCard';
import { projectService, reportService } from '../services';

export const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        setLoading(true);
        const [pData, sData] = await Promise.all([
          projectService.get(id),
          projectService.getStats(id),
        ]);
        setProject(pData);
        setStats(sData);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) return <LinearProgress />;
  if (!project) return <Typography>Project not found.</Typography>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={800} color="#0F172A">
            {project.name}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {project.description || 'No description provided.'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            href={reportService.generateUrl(project.id, 'markdown')}
            target="_blank"
          >
            Export Report (MD)
          </Button>
          <Button
            variant="contained"
            startIcon={<AgentIcon />}
            onClick={() => navigate('/playground')}
          >
            Open Playground
          </Button>
        </Box>
      </Box>

      {/* KPI Stats */}
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard title="Indexed Documents" value={stats?.total_documents ?? 0} subtitle={`${stats?.total_chunks ?? 0} total chunks`} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard title="Evaluation Datasets" value={stats?.total_datasets ?? 0} subtitle={`${stats?.total_test_cases ?? 0} test cases`} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Avg Faithfulness"
            value={stats?.avg_faithfulness ? `${(stats.avg_faithfulness * 100).toFixed(1)}%` : 'N/A'}
            color="success"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Avg Latency"
            value={stats?.avg_latency_ms ? `${stats.avg_latency_ms.toFixed(0)} ms` : 'N/A'}
            color="warning"
          />
        </Grid>
      </Grid>

      {/* Quick Links */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Paper elevation={0} sx={{ p: 3, border: '1px solid #E2E8F0', borderRadius: 3 }}>
            <Typography variant="h6" fontWeight={700} gutterBottom>
              Documents & Vectors
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Upload and inspect indexed knowledge base documents and FAISS vector embeddings.
            </Typography>
            <Button variant="outlined" onClick={() => navigate('/documents')}>
              View Documents
            </Button>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper elevation={0} sx={{ p: 3, border: '1px solid #E2E8F0', borderRadius: 3 }}>
            <Typography variant="h6" fontWeight={700} gutterBottom>
              Evaluation Datasets
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Inspect and curate test queries, ground truth answers, and reference context chunks.
            </Typography>
            <Button variant="outlined" onClick={() => navigate('/datasets')}>
              View Datasets
            </Button>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper elevation={0} sx={{ p: 3, border: '1px solid #E2E8F0', borderRadius: 3 }}>
            <Typography variant="h6" fontWeight={700} gutterBottom>
              Execution Traces
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Explore end-to-end timeline logs for all previous agent executions in this project.
            </Typography>
            <Button variant="outlined" onClick={() => navigate('/runs')}>
              View Runs
            </Button>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};
