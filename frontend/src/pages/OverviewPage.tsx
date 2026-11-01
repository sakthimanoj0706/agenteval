import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Grid,
  Button,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Divider,
} from '@mui/material';
import {
  Folder as ProjectIcon,
  Description as DocumentIcon,
  PlayCircle as RunIcon,
  Speed as LatencyIcon,
  CheckCircle as SuccessIcon,
  AutoAwesome as SparkleIcon,
  ArrowForward as ArrowIcon,
} from '@mui/icons-material';
import { MetricCard } from '../components/MetricCard';
import { projectService, dashboardService, demoService } from '../services';

export const OverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [demoStatus, setDemoStatus] = useState<any>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [summary, demo] = await Promise.all([
        dashboardService.getSummary(),
        demoService.status(),
      ]);
      setStats(summary);
      setDemoStatus(demo);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSetupDemo = async () => {
    setLoading(true);
    try {
      await demoService.setup();
      await loadData();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      {/* Welcome Banner */}
      <Card
        elevation={0}
        sx={{
          mb: 4,
          borderRadius: 3,
          background: 'linear-gradient(135deg, #1565C0 0%, #283593 100%)',
          color: '#FFF',
          p: 2,
        }}
      >
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ maxWidth: 700 }}>
              <Chip
                label="AI Observability Platform"
                size="small"
                sx={{ bgcolor: 'rgba(255,255,255,0.18)', color: '#FFF', fontWeight: 600, mb: 1.5 }}
              />
              <Typography variant="h4" fontWeight={800} gutterBottom>
                Evaluate how AI agents retrieve, reason, and execute.
              </Typography>
              <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.85)', mb: 3 }}>
                "Do not evaluate only what an AI agent answers. Evaluate how it retrieves information, which tools it uses, how it executes, how reliable its answer is, and where failures happen."
              </Typography>
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  sx={{ bgcolor: '#FFF', color: '#1565C0', fontWeight: 700, '&:hover': { bgcolor: '#F1F5F9' } }}
                  onClick={() => navigate('/playground')}
                >
                  Open Agent Playground
                </Button>
                <Button
                  variant="outlined"
                  sx={{ borderColor: 'rgba(255,255,255,0.6)', color: '#FFF', fontWeight: 600, '&:hover': { borderColor: '#FFF' } }}
                  onClick={() => navigate('/dashboard')}
                >
                  View Observability Dashboard
                </Button>
                {!demoStatus?.has_demo_data && (
                  <Button
                    variant="text"
                    startIcon={<SparkleIcon />}
                    sx={{ color: '#FFD54F', fontWeight: 700 }}
                    onClick={handleSetupDemo}
                  >
                    Load Sample University Demo
                  </Button>
                )}
              </Box>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {loading && <LinearProgress sx={{ mb: 3 }} />}

      {/* Summary KPI Cards */}
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Total Evaluation Runs"
            value={stats?.total_runs ?? 0}
            subtitle="Recorded agent traces"
            icon={<RunIcon />}
            color="primary"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Average Faithfulness"
            value={stats?.avg_faithfulness ? `${(stats.avg_faithfulness * 100).toFixed(1)}%` : 'N/A'}
            subtitle="Grounded claims in context"
            icon={<SuccessIcon />}
            color="success"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Task Completion Rate"
            value={stats?.task_completion_rate ? `${(stats.task_completion_rate * 100).toFixed(1)}%` : 'N/A'}
            subtitle="Successful pipeline outputs"
            icon={<SparkleIcon />}
            color="info"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Average Latency"
            value={stats?.avg_latency_ms ? `${stats.avg_latency_ms.toFixed(0)} ms` : 'N/A'}
            subtitle="End-to-end execution time"
            icon={<LatencyIcon />}
            color="warning"
          />
        </Grid>
      </Grid>

      {/* Quick Navigation Cards */}
      <Typography variant="h6" fontWeight={700} color="#0F172A" sx={{ mb: 2 }}>
        Core Evaluation Workflows
      </Typography>

      <Grid container spacing={2.5}>
        <Grid item xs={12} md={4}>
          <Card elevation={0} sx={{ border: '1px solid #E2E8F0', borderRadius: 3, p: 1 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} color="#1565C0" gutterBottom>
                1. Knowledge & RAG Indexing
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                Upload PDF, DOCX, and TXT knowledge files. Configure chunk size, overlap, and embed into FAISS vector storage.
              </Typography>
              <Button endIcon={<ArrowIcon />} onClick={() => navigate('/documents')} size="small" sx={{ fontWeight: 600 }}>
                Manage Documents
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card elevation={0} sx={{ border: '1px solid #E2E8F0', borderRadius: 3, p: 1 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} color="#3949AB" gutterBottom>
                2. Test Cases & Ground Truth
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                Curate evaluation datasets with reference contexts, expected tools, and categorized test queries.
              </Typography>
              <Button endIcon={<ArrowIcon />} onClick={() => navigate('/datasets')} size="small" sx={{ fontWeight: 600 }}>
                Manage Datasets
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card elevation={0} sx={{ border: '1px solid #E2E8F0', borderRadius: 3, p: 1 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} color="#00838F" gutterBottom>
                3. Root Cause Failure Analysis
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                Automatically detect retrieval, tool selection, context quality, generation, and performance bottlenecks.
              </Typography>
              <Button endIcon={<ArrowIcon />} onClick={() => navigate('/failures')} size="small" sx={{ fontWeight: 600 }}>
                Explore Failures
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};
