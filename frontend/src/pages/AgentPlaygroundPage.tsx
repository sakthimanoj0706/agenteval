import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Grid,
  Paper,
  Slider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormGroup,
  FormControlLabel,
  Checkbox,
  LinearProgress,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
} from '@mui/material';
import {
  PlayArrow as ExecuteIcon,
  ExpandMore as ExpandMoreIcon,
  SmartToy as AgentIcon,
  CheckCircle as SuccessIcon,
  Tune as TuneIcon,
} from '@mui/icons-material';
import { StatusChip } from '../components/StatusChip';
import { ScoreDisplay } from '../components/ScoreDisplay';
import { TraceTimeline } from '../components/TraceTimeline';
import { projectService, agentService } from '../services';

export const AgentPlaygroundPage: React.FC = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | ''>('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Configuration
  const [modelName, setModelName] = useState('mock-model');
  const [modelProvider, setModelProvider] = useState('mock');
  const [topK, setTopK] = useState(5);
  const [similarityThreshold, setSimilarityThreshold] = useState(0.2);
  const [toolsEnabled, setToolsEnabled] = useState<Record<string, boolean>>({
    knowledge_base: true,
    college_info: true,
    calculator: true,
  });

  // Results
  const [runResult, setRunResult] = useState<any>(null);

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

  const handleExecute = async () => {
    if (!selectedProjectId || !query.trim()) return;
    try {
      setLoading(true);
      setRunResult(null);

      const activeTools = Object.keys(toolsEnabled).filter((t) => toolsEnabled[t]);
      const res = await agentService.execute({
        project_id: Number(selectedProjectId),
        query,
        model_name: modelName,
        model_provider: modelProvider,
        top_k: topK,
        similarity_threshold: similarityThreshold,
        tools_enabled: activeTools,
      });
      setRunResult(res);
    } catch (e: any) {
      alert(e.message || 'Execution error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={800} color="#0F172A">
          Agent Execution Playground
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Interact directly with the LangGraph-orchestrated RAG agent and observe live step-by-step traces
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Left Form & Config Panel */}
        <Grid item xs={12} md={4}>
          <Paper elevation={0} sx={{ p: 3, border: '1px solid #E2E8F0', borderRadius: 3, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <TuneIcon color="primary" />
              <Typography variant="subtitle1" fontWeight={700}>
                Pipeline Configuration
              </Typography>
            </Box>

            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel>Active Project</InputLabel>
              <Select
                value={selectedProjectId}
                label="Active Project"
                onChange={(e) => setSelectedProjectId(Number(e.target.value))}
              >
                {projects.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel>LLM Provider & Engine</InputLabel>
              <Select
                value={`${modelProvider}:${modelName}`}
                label="LLM Provider & Engine"
                onChange={(e) => {
                  const [prov, mod] = e.target.value.split(':');
                  setModelProvider(prov);
                  setModelName(mod);
                }}
              >
                <MenuItem value="mock:mock-model">Deterministic Grounded Engine</MenuItem>
                <MenuItem value="ollama:llama3.2">Ollama (Local Llama 3.2)</MenuItem>
                <MenuItem value="huggingface:google/flan-t5-base">Hugging Face (Flan-T5)</MenuItem>
              </Select>
            </FormControl>

            <Typography variant="caption" fontWeight={700} color="text.secondary">
              TOP-K RETRIEVAL: {topK}
            </Typography>
            <Slider
              value={topK}
              min={1}
              max={10}
              step={1}
              onChange={(_, val) => setTopK(val as number)}
              sx={{ mb: 2 }}
            />

            <Typography variant="caption" fontWeight={700} color="text.secondary">
              SIMILARITY THRESHOLD: {similarityThreshold.toFixed(2)}
            </Typography>
            <Slider
              value={similarityThreshold}
              min={0.0}
              max={0.9}
              step={0.05}
              onChange={(_, val) => setSimilarityThreshold(val as number)}
              sx={{ mb: 2 }}
            />

            <Divider sx={{ my: 1.5 }} />

            <Typography variant="caption" fontWeight={700} color="text.secondary">
              ENABLED AGENT TOOLS
            </Typography>
            <FormGroup sx={{ mt: 0.5 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={toolsEnabled.knowledge_base}
                    onChange={(e) => setToolsEnabled({ ...toolsEnabled, knowledge_base: e.target.checked })}
                  />
                }
                label={<Typography variant="body2">Knowledge Base Search</Typography>}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={toolsEnabled.college_info}
                    onChange={(e) => setToolsEnabled({ ...toolsEnabled, college_info: e.target.checked })}
                  />
                }
                label={<Typography variant="body2">College Directory Search</Typography>}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={toolsEnabled.calculator}
                    onChange={(e) => setToolsEnabled({ ...toolsEnabled, calculator: e.target.checked })}
                  />
                }
                label={<Typography variant="body2">Arithmetic Calculator</Typography>}
              />
            </FormGroup>
          </Paper>
        </Grid>

        {/* Center / Right Execution & Results */}
        <Grid item xs={12} md={8}>
          {/* Query Box */}
          <Paper elevation={0} sx={{ p: 3, border: '1px solid #E2E8F0', borderRadius: 3, mb: 3 }}>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
              User Query
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={3}
              placeholder="e.g., What are the undergraduate tuition fees and Regular Decision deadlines?"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              sx={{ mb: 2 }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                Shift + Enter for newline
              </Typography>
              <Button
                variant="contained"
                size="large"
                startIcon={<ExecuteIcon />}
                onClick={handleExecute}
                disabled={loading || !query.trim() || !selectedProjectId}
                sx={{ px: 4, borderRadius: 2 }}
              >
                {loading ? 'Executing Pipeline...' : 'Run Agent'}
              </Button>
            </Box>
          </Paper>

          {loading && <LinearProgress sx={{ mb: 3, borderRadius: 1 }} />}

          {/* Results Area */}
          {runResult && (
            <Box>
              {/* Answer Card */}
              <Paper elevation={0} sx={{ p: 3, border: '1px solid #E2E8F0', borderRadius: 3, mb: 3, bgcolor: '#FFF' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AgentIcon color="primary" />
                    <Typography variant="h6" fontWeight={700}>
                      Generated Agent Response
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <StatusChip status={runResult.status} />
                    <Chip label={`${runResult.total_latency_ms?.toFixed(0) ?? 0} ms`} size="small" variant="outlined" sx={{ fontWeight: 600 }} />
                  </Box>
                </Box>

                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, color: '#0F172A', mb: 2 }}>
                  {runResult.response || 'No response generated.'}
                </Typography>

                {/* Score Badges */}
                <Divider sx={{ my: 2 }} />
                <Typography variant="caption" fontWeight={700} color="text.secondary" display="block" sx={{ mb: 1.5 }}>
                  EVALUATION DIMENSIONS
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  {runResult.evaluation_results?.map((e: any) => (
                    <Paper key={e.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2, bgcolor: '#F8FAFC' }}>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ fontWeight: 600, textTransform: 'capitalize' }}>
                        {e.metric_name.replace(/_/g, ' ')}
                      </Typography>
                      <ScoreDisplay score={e.metric_value} method={e.evaluation_method} isEvaluated={e.is_evaluated} reason={e.reason} />
                    </Paper>
                  ))}
                </Box>
              </Paper>

              {/* Retrieved Chunks Accordion */}
              <Accordion elevation={0} sx={{ border: '1px solid #E2E8F0', borderRadius: '12px !important', mb: 3, '&:before': { display: 'none' } }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle1" fontWeight={700}>
                    Retrieved Knowledge Chunks ({runResult.retrieved_chunks?.length ?? 0})
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  {runResult.retrieved_chunks?.map((chunk: any, i: number) => (
                    <Paper key={chunk.id || i} elevation={0} sx={{ p: 2, mb: 1.5, bgcolor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="caption" fontWeight={700} color="primary">
                          #{chunk.rank_position} • {chunk.document_name || 'Document Chunk'}
                        </Typography>
                        <Chip
                          label={`Cosine Sim: ${chunk.similarity_score.toFixed(3)}`}
                          size="small"
                          color="primary"
                          variant="outlined"
                          sx={{ height: 20, fontSize: '0.7rem', fontWeight: 600 }}
                        />
                      </Box>
                      <Typography variant="body2" sx={{ color: '#334155', fontSize: '0.825rem' }}>
                        {chunk.content}
                      </Typography>
                    </Paper>
                  ))}
                </AccordionDetails>
              </Accordion>

              {/* Execution Trace Timeline */}
              <Paper elevation={0} sx={{ p: 3, border: '1px solid #E2E8F0', borderRadius: 3 }}>
                <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
                  Execution Trace Timeline
                </Typography>
                <TraceTimeline traces={runResult.traces || []} />
              </Paper>
            </Box>
          )}
        </Grid>
      </Grid>
    </Box>
  );
};
