import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Paper,
  TextField,
  Button,
  Grid,
  Chip,
  LinearProgress,
  Divider,
  Alert,
} from '@mui/material';
import {
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  PlayArrow as TestIcon,
  AutoAwesome as DemoIcon,
  DeleteForever as PurgeIcon,
} from '@mui/icons-material';
import { settingsService, demoService } from '../services';

export const SettingsPage: React.FC = () => {
  const [tabIndex, setTabIndex] = useState(0);
  const [providersData, setProvidersData] = useState<any>(null);
  const [generalSettings, setGeneralSettings] = useState<any>(null);
  const [demoStatus, setDemoStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Test states
  const [ollamaStatus, setOllamaStatus] = useState<any>(null);
  const [hfStatus, setHfStatus] = useState<any>(null);
  const [testingOllama, setTestingOllama] = useState(false);
  const [testingHf, setTestingHf] = useState(false);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [prov, gen, demo] = await Promise.all([
        settingsService.getProviders(),
        settingsService.getGeneral(),
        demoService.status(),
      ]);
      setProvidersData(prov);
      setGeneralSettings(gen);
      setDemoStatus(demo);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleTestOllama = async () => {
    try {
      setTestingOllama(true);
      const res = await settingsService.testProvider({
        provider: 'ollama',
        endpoint_url: 'http://localhost:11434',
      });
      setOllamaStatus(res);
    } catch (e: any) {
      setOllamaStatus({ available: false, status_message: e.message });
    } finally {
      setTestingOllama(false);
    }
  };

  const handleTestHf = async () => {
    try {
      setTestingHf(true);
      const res = await settingsService.testProvider({
        provider: 'huggingface',
        model_name: 'google/flan-t5-base',
      });
      setHfStatus(res);
    } catch (e: any) {
      setHfStatus({ available: false, status_message: e.message });
    } finally {
      setTestingHf(false);
    }
  };

  const handleSetupDemo = async () => {
    try {
      setLoading(true);
      await demoService.setup();
      await loadAll();
    } catch (e: any) {
      alert(e.message || 'Demo setup error');
    } finally {
      setLoading(false);
    }
  };

  const handleCleanupDemo = async () => {
    if (!window.confirm('Remove all sample demo documents and evaluation runs?')) return;
    try {
      setLoading(true);
      await demoService.cleanup();
      await loadAll();
    } catch (e: any) {
      alert(e.message || 'Cleanup error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={800} color="#0F172A">
          Platform Settings & Provider Configuration
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Configure local Ollama, Hugging Face pipelines, vector indexes, and sample workspaces
        </Typography>
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      <Paper elevation={0} sx={{ border: '1px solid #E2E8F0', borderRadius: 3, mb: 3 }}>
        <Tabs
          value={tabIndex}
          onChange={(_, val) => setTabIndex(val)}
          sx={{ borderBottom: '1px solid #E2E8F0', px: 2 }}
        >
          <Tab label="LLM & Inference Providers" sx={{ fontWeight: 600 }} />
          <Tab label="Vector Store & Retrieval" sx={{ fontWeight: 600 }} />
          <Tab label="Demo Data Management" sx={{ fontWeight: 600 }} />
        </Tabs>

        {/* Tab 1: Providers */}
        {tabIndex === 0 && (
          <Box sx={{ p: 3 }}>
            <Grid container spacing={3}>
              {/* Ollama Local Provider Card */}
              <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                    <Typography variant="subtitle1" fontWeight={700}>
                      Ollama (Local LLM Daemon)
                    </Typography>
                    <Chip label="Default Free Runner" size="small" color="primary" sx={{ fontWeight: 600 }} />
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Connects to Ollama's local HTTP API to run quantized models (Llama 3.2, Mistral, Gemma) on your device with no API keys.
                  </Typography>
                  <TextField
                    label="Ollama Base Endpoint"
                    fullWidth
                    size="small"
                    defaultValue="http://localhost:11434"
                    sx={{ mb: 2 }}
                  />
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<TestIcon />}
                      onClick={handleTestOllama}
                      disabled={testingOllama}
                    >
                      {testingOllama ? 'Connecting...' : 'Test Connection'}
                    </Button>
                    {ollamaStatus && (
                      <Chip
                        icon={ollamaStatus.available ? <SuccessIcon /> : <ErrorIcon />}
                        label={ollamaStatus.status_message}
                        color={ollamaStatus.available ? 'success' : 'error'}
                        size="small"
                      />
                    )}
                  </Box>
                </Paper>
              </Grid>

              {/* Hugging Face Transformers Provider Card */}
              <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                    <Typography variant="subtitle1" fontWeight={700}>
                      Hugging Face Transformers
                    </Typography>
                    <Chip label="Alternative Pipeline" size="small" variant="outlined" />
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Local CPU/GPU inference using Hugging Face pipelines (e.g. google/flan-t5-base) without sending data externally.
                  </Typography>
                  <TextField
                    label="Model Name"
                    fullWidth
                    size="small"
                    defaultValue="google/flan-t5-base"
                    sx={{ mb: 2 }}
                  />
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<TestIcon />}
                      onClick={handleTestHf}
                      disabled={testingHf}
                    >
                      {testingHf ? 'Validating...' : 'Check Model'}
                    </Button>
                    {hfStatus && (
                      <Chip
                        icon={hfStatus.available ? <SuccessIcon /> : <ErrorIcon />}
                        label={hfStatus.status_message}
                        color={hfStatus.available ? 'success' : 'error'}
                        size="small"
                      />
                    )}
                  </Box>
                </Paper>
              </Grid>

              {/* Deterministic Grounded Fallback Engine Card */}
              <Grid item xs={12}>
                <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2.5, bgcolor: '#F8FAFF', borderColor: '#BBDEFB' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle1" fontWeight={700} color="#1565C0">
                      Deterministic Grounded Engine (Active)
                    </Typography>
                    <Chip label="Zero Configuration" size="small" color="success" sx={{ fontWeight: 700 }} />
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Always available. Ensures that evaluation benchmarks, RAG retrieval tests, and trace telemetry function reliably even when no external or local LLM server is booted up.
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* Tab 2: Vector Store */}
        {tabIndex === 1 && (
          <Box sx={{ p: 3 }}>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
              Vector Store & Embeddings Configuration
            </Typography>
            <Grid container spacing={2.5}>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Vector Index Backend"
                  fullWidth
                  disabled
                  value="FAISS (Facebook AI Similarity Search - IndexFlatIP)"
                  sx={{ mb: 2 }}
                />
                <TextField
                  label="Sentence Transformer Embedding Model"
                  fullWidth
                  disabled
                  value="all-MiniLM-L6-v2 (384 dimensions)"
                  sx={{ mb: 2 }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Default Chunk Size (characters)"
                  fullWidth
                  disabled
                  value={generalSettings?.chunk_size ?? 512}
                  sx={{ mb: 2 }}
                />
                <TextField
                  label="Default Chunk Overlap (characters)"
                  fullWidth
                  disabled
                  value={generalSettings?.chunk_overlap ?? 50}
                  sx={{ mb: 2 }}
                />
              </Grid>
            </Grid>
          </Box>
        )}

        {/* Tab 3: Demo Management */}
        {tabIndex === 2 && (
          <Box sx={{ p: 3 }}>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
              Sample University Workspace [DEMO]
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Quickly seed sample knowledge base documents (Admissions, Curriculum, Campus Housing), 7 categorized benchmark test cases, and evaluated runs with step-by-step traces.
            </Typography>

            {demoStatus?.has_demo_data ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Chip label="Demo Data Currently Loaded" color="primary" sx={{ fontWeight: 600 }} />
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<PurgeIcon />}
                  onClick={handleCleanupDemo}
                >
                  Remove Demo Data
                </Button>
              </Box>
            ) : (
              <Button
                variant="contained"
                startIcon={<DemoIcon />}
                onClick={handleSetupDemo}
              >
                Load Sample University Demo
              </Button>
            )}
          </Box>
        )}
      </Paper>
    </Box>
  );
};
