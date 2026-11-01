import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  IconButton,
  Collapse,
  Divider,
} from '@mui/material';
import {
  KeyboardArrowDown as ExpandMoreIcon,
  KeyboardArrowUp as ExpandLessIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Schedule as PendingIcon,
} from '@mui/icons-material';
import { StatusChip } from './StatusChip';

interface TraceStep {
  id: number;
  step_index: number;
  step_name: string;
  step_type: string;
  status: string;
  input_data: string;
  output_data?: string | null;
  latency_ms?: number | null;
  error_message?: string | null;
  created_at: string;
}

interface TraceTimelineProps {
  traces: TraceStep[];
}

export const TraceTimeline: React.FC<TraceTimelineProps> = ({ traces }) => {
  const [expandedSteps, setExpandedSteps] = useState<Record<number, boolean>>({});

  const toggleStep = (index: number) => {
    setExpandedSteps((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const formatJson = (data: string | null | undefined) => {
    if (!data) return 'None';
    try {
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      return JSON.stringify(parsed, null, 2);
    } catch {
      return data;
    }
  };

  if (!traces || traces.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
        No execution trace recorded.
      </Typography>
    );
  }

  return (
    <Box sx={{ position: 'relative', pl: 2, '&::before': {
      content: '""',
      position: 'absolute',
      left: 19,
      top: 14,
      bottom: 24,
      width: 2,
      bgcolor: '#CBD5E1',
    } }}>
      {traces.map((trace) => {
        const isFailed = trace.status === 'failed';
        const isExpanded = !!expandedSteps[trace.step_index];

        return (
          <Box key={trace.id || trace.step_index} sx={{ position: 'relative', mb: 2.5, pl: 3.5 }}>
            {/* Timeline bullet */}
            <Box
              sx={{
                position: 'absolute',
                left: -19,
                top: 8,
                width: 24,
                height: 24,
                borderRadius: '50%',
                bgcolor: isFailed ? '#D32F2F' : '#1565C0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFF',
                zIndex: 2,
                boxShadow: '0 0 0 3px #FFF',
              }}
            >
              {isFailed ? <ErrorIcon sx={{ fontSize: 16 }} /> : <SuccessIcon sx={{ fontSize: 16 }} />}
            </Box>

            <Paper
              elevation={0}
              sx={{
                border: isFailed ? '1px solid #FFCDD2' : '1px solid #E2E8F0',
                bgcolor: isFailed ? '#FFF8F8' : '#FFF',
                borderRadius: 2.5,
                p: 2,
                transition: 'all 0.2s ease',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Typography variant="subtitle2" fontWeight={700} color={isFailed ? '#C62828' : '#0F172A'}>
                    Step {trace.step_index}: {trace.step_name}
                  </Typography>
                  <StatusChip status={trace.status} size="small" />
                  <Chip
                    label={trace.step_type}
                    size="small"
                    variant="outlined"
                    sx={{ height: 20, fontSize: '0.68rem', color: '#64748B' }}
                  />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {trace.latency_ms !== null && trace.latency_ms !== undefined && (
                    <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>
                      {trace.latency_ms.toFixed(1)} ms
                    </Typography>
                  )}
                  <IconButton size="small" onClick={() => toggleStep(trace.step_index)}>
                    {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                  </IconButton>
                </Box>
              </Box>

              {trace.error_message && (
                <Box sx={{ mt: 1, p: 1.5, bgcolor: '#FFEBEE', borderRadius: 1.5, color: '#C62828' }}>
                  <Typography variant="body2" fontWeight={600}>
                    Error: {trace.error_message}
                  </Typography>
                </Box>
              )}

              <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                <Divider sx={{ my: 1.5 }} />
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
                  <Box>
                    <Typography variant="caption" fontWeight={700} color="text.secondary">
                      INPUT DATA
                    </Typography>
                    <Box
                      component="pre"
                      sx={{
                        p: 1.5,
                        bgcolor: '#F8FAFC',
                        borderRadius: 1.5,
                        fontSize: '0.75rem',
                        overflowX: 'auto',
                        mt: 0.5,
                        border: '1px solid #E2E8F0',
                      }}
                    >
                      {formatJson(trace.input_data)}
                    </Box>
                  </Box>
                  <Box>
                    <Typography variant="caption" fontWeight={700} color="text.secondary">
                      OUTPUT DATA
                    </Typography>
                    <Box
                      component="pre"
                      sx={{
                        p: 1.5,
                        bgcolor: '#F8FAFC',
                        borderRadius: 1.5,
                        fontSize: '0.75rem',
                        overflowX: 'auto',
                        mt: 0.5,
                        border: '1px solid #E2E8F0',
                      }}
                    >
                      {formatJson(trace.output_data)}
                    </Box>
                  </Box>
                </Box>
              </Collapse>
            </Paper>
          </Box>
        );
      })}
    </Box>
  );
};
