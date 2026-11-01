import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Chip,
  LinearProgress,
  Divider,
} from '@mui/material';
import {
  Timeline as TimelineIcon,
  SmartToy as AgentIcon,
  Build as ToolIcon,
} from '@mui/icons-material';
import { StatusChip } from '../components/StatusChip';
import { TraceTimeline } from '../components/TraceTimeline';
import { ScoreDisplay } from '../components/ScoreDisplay';
import { agentService } from '../services';

export const TraceExplorerPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [runs, setRuns] = useState<any[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [runData, setRunData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const rList = await agentService.listRuns({ limit: 50 });
        setRuns(rList);
        const queryRunId = searchParams.get('run_id');
        if (queryRunId) {
          setSelectedRunId(queryRunId);
        } else if (rList.length > 0) {
          setSelectedRunId(rList[0].run_id);
        }
      } catch (e) {
        console.error(e);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (!selectedRunId) return;
    const loadRunDetails = async () => {
      try {
        setLoading(true);
        const data = await agentService.getRun(selectedRunId);
        setRunData(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadRunDetails();
  }, [selectedRunId]);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={800} color="#0F172A">
            Trace Explorer & Execution Timeline
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Inspect step-level timing, inputs, outputs, tool invocations, and failure states
          </Typography>
        </Box>
        <FormControl size="small" sx={{ minWidth: 320 }}>
          <InputLabel>Select Execution Run</InputLabel>
          <Select
            value={selectedRunId}
            label="Select Execution Run"
            onChange={(e) => {
              setSelectedRunId(e.target.value);
              setSearchParams({ run_id: e.target.value });
            }}
          >
            {runs.map((r) => (
              <MenuItem key={r.id} value={r.run_id}>
                {r.run_id.substring(0, 8)}... - {r.query.substring(0, 35)}...
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {runData && (
        <Grid container spacing={3}>
          {/* Metadata & Overview Header */}
          <Grid item xs={12}>
            <Paper elevation={0} sx={{ p: 3, border: '1px solid #E2E8F0', borderRadius: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                    <Typography variant="h6" fontWeight={700} color="#0F172A">
                      {runData.query}
                    </Typography>
                    <StatusChip status={runData.status} />
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    Run UUID: <code>{runData.run_id}</code> • Model: <b>{runData.model_name}</b> ({runData.model_provider})
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>
                      TOTAL LATENCY
                    </Typography>
                    <Typography variant="subtitle1" fontWeight={700} color="#1565C0">
                      {runData.total_latency_ms?.toFixed(0) ?? 'N/A'} ms
                    </Typography>
                  </Paper>
                  <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>
                      RETRIEVAL
                    </Typography>
                    <Typography variant="subtitle1" fontWeight={700} color="#283593">
                      {runData.retrieval_latency_ms?.toFixed(0) ?? 'N/A'} ms
                    </Typography>
                  </Paper>
                  <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>
                      GENERATION
                    </Typography>
                    <Typography variant="subtitle1" fontWeight={700} color="#00838F">
                      {runData.generation_latency_ms?.toFixed(0) ?? 'N/A'} ms
                    </Typography>
                  </Paper>
                </Box>
              </Box>

              {/* Evaluation summary */}
              <Divider sx={{ my: 2 }} />
              <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                {runData.evaluation_results?.map((e: any) => (
                  <Box key={e.id}>
                    <Typography variant="caption" color="text.secondary" fontWeight={600} display="block">
                      {e.metric_name.replace(/_/g, ' ').toUpperCase()}
                    </Typography>
                    <ScoreDisplay score={e.metric_value} method={e.evaluation_method} isEvaluated={e.is_evaluated} reason={e.reason} />
                  </Box>
                ))}
              </Box>
            </Paper>
          </Grid>

          {/* Left Timeline */}
          <Grid item xs={12} md={7}>
            <Paper elevation={0} sx={{ p: 3, border: '1px solid #E2E8F0', borderRadius: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
                <TimelineIcon color="primary" />
                <Typography variant="subtitle1" fontWeight={700}>
                  Step-by-Step Execution Graph
                </Typography>
              </Box>
              <TraceTimeline traces={runData.traces || []} />
            </Paper>
          </Grid>

          {/* Right Artifacts (Retrieved context & Tools) */}
          <Grid item xs={12} md={5}>
            {/* Generated Answer */}
            <Paper elevation={0} sx={{ p: 3, border: '1px solid #E2E8F0', borderRadius: 3, mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <AgentIcon color="primary" />
                <Typography variant="subtitle1" fontWeight={700}>
                  Final LLM Generation
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, color: '#1E293B' }}>
                {runData.response || <span style={{ color: '#94A3B8' }}>No answer generated</span>}
              </Typography>
            </Paper>

            {/* Tool Calls */}
            {runData.tool_calls && runData.tool_calls.length > 0 && (
              <Paper elevation={0} sx={{ p: 3, border: '1px solid #E2E8F0', borderRadius: 3, mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <ToolIcon color="secondary" />
                  <Typography variant="subtitle1" fontWeight={700}>
                    Tool Calls ({runData.tool_calls.length})
                  </Typography>
                </Box>
                {runData.tool_calls.map((tc: any) => (
                  <Paper key={tc.id} variant="outlined" sx={{ p: 2, mb: 1.5, borderRadius: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Chip label={tc.tool_name} size="small" color="secondary" sx={{ fontWeight: 700 }} />
                      <StatusChip status={tc.status} />
                    </Box>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Input: <code>{tc.tool_input}</code>
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Output: <code>{tc.tool_output}</code>
                    </Typography>
                  </Paper>
                ))}
              </Paper>
            )}

            {/* Retrieved Chunks */}
            <Paper elevation={0} sx={{ p: 3, border: '1px solid #E2E8F0', borderRadius: 3 }}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
                Retrieved Chunks ({runData.retrieved_chunks?.length ?? 0})
              </Typography>
              {runData.retrieved_chunks?.map((chunk: any) => (
                <Paper key={chunk.id} variant="outlined" sx={{ p: 2, mb: 1.5, borderRadius: 2, bgcolor: '#F8FAFC' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="caption" fontWeight={700} color="primary">
                      Rank #{chunk.rank_position} • {chunk.document_name || 'Chunk'}
                    </Typography>
                    <Typography variant="caption" fontWeight={600} color="#2E7D32">
                      Sim: {chunk.similarity_score.toFixed(3)}
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ fontSize: '0.8rem', color: '#334155' }}>
                    {chunk.content}
                  </Typography>
                </Paper>
              ))}
            </Paper>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};
