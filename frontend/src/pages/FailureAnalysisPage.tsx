import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Card,
  CardContent,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Button,
  LinearProgress,
  Divider,
} from '@mui/material';
import {
  BugReport as BugIcon,
  ExpandMore as ExpandMoreIcon,
  SearchOff as RetrievalIcon,
  FindInPage as QualityIcon,
  PsychologyAlt as GenerationIcon,
  Handyman as ToolSelectIcon,
  ReportProblem as ToolExecIcon,
  CancelOutlined as TaskFailIcon,
  TimerOff as PerformanceIcon,
  Dns as InfraIcon,
  ArrowForward as ArrowIcon,
} from '@mui/icons-material';
import { failureService } from '../services';

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  retrieval_failure: <RetrievalIcon />,
  context_quality_failure: <QualityIcon />,
  generation_failure: <GenerationIcon />,
  tool_selection_failure: <ToolSelectIcon />,
  tool_execution_failure: <ToolExecIcon />,
  task_completion_failure: <TaskFailIcon />,
  performance_failure: <PerformanceIcon />,
  infrastructure_failure: <InfraIcon />,
};

export const FailureAnalysisPage: React.FC = () => {
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFailures = async () => {
      try {
        setLoading(true);
        const data = await failureService.getAnalysis();
        setAnalysis(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadFailures();
  }, []);

  if (loading) return <LinearProgress />;

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={800} color="#0F172A">
          Root Cause Failure Analysis
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Automatic categorization across 8 standard failure modes with actionable debugging guidance
        </Typography>
      </Box>

      {/* Summary Alert */}
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          mb: 4,
          borderRadius: 3,
          border: '1px solid #FFCDD2',
          bgcolor: '#FFF8F8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <BugIcon sx={{ color: '#D32F2F', fontSize: 32 }} />
          <Box>
            <Typography variant="subtitle1" fontWeight={700} color="#C62828">
              {analysis?.total_failures ?? 0} Failures Identified Across {analysis?.total_runs_analyzed ?? 0} Invocations
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Review categories below to locate bottlenecks in chunking, grounding, or tool-calling.
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* 8 Categories Grid */}
      <Grid container spacing={3}>
        {analysis?.categories?.map((cat: any) => {
          const hasFailures = cat.count > 0;
          return (
            <Grid item xs={12} md={6} key={cat.category}>
              <Paper
                elevation={0}
                sx={{
                  border: hasFailures ? '1px solid #EF9A9A' : '1px solid #E2E8F0',
                  borderRadius: 3,
                  bgcolor: hasFailures ? '#FFFDFD' : '#FFF',
                  p: 2.5,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box sx={{ color: hasFailures ? '#D32F2F' : '#64748B' }}>
                      {CATEGORY_ICONS[cat.category] || <BugIcon />}
                    </Box>
                    <Typography variant="subtitle1" fontWeight={700} color="#0F172A">
                      {cat.title}
                    </Typography>
                  </Box>
                  <Chip
                    label={`${cat.count} Failures`}
                    color={hasFailures ? 'error' : 'default'}
                    size="small"
                    sx={{ fontWeight: 700 }}
                  />
                </Box>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {cat.description}
                </Typography>

                {/* Debugging Action Box */}
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: '#F1F5F9',
                    borderLeft: '4px solid #1565C0',
                    mb: 2,
                    mt: 'auto',
                  }}
                >
                  <Typography variant="caption" fontWeight={700} color="#1565C0" display="block">
                    SUGGESTED DEBUGGING AREA:
                  </Typography>
                  <Typography variant="caption" color="#334155" fontWeight={500}>
                    {cat.debugging_guidance}
                  </Typography>
                </Box>

                {/* Affected Cases Accordion */}
                {hasFailures && cat.affected_cases?.length > 0 && (
                  <Accordion elevation={0} sx={{ border: '1px solid #E2E8F0', borderRadius: '8px !important', '&:before': { display: 'none' } }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="caption" fontWeight={700} color="text.secondary">
                        View Affected Cases ({cat.affected_cases.length})
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails sx={{ p: 1.5 }}>
                      {cat.affected_cases.map((caseItem: any, idx: number) => (
                        <Box
                          key={idx}
                          sx={{
                            p: 1.5,
                            mb: 1,
                            bgcolor: '#F8FAFC',
                            borderRadius: 1.5,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <Box sx={{ maxWidth: '80%' }}>
                            <Typography variant="body2" fontWeight={600} noWrap>
                              {caseItem.query}
                            </Typography>
                            <Typography variant="caption" color="error">
                              {caseItem.error}
                            </Typography>
                          </Box>
                          <Button
                            size="small"
                            endIcon={<ArrowIcon />}
                            onClick={() => navigate(`/traces?run_id=${caseItem.run_id}`)}
                          >
                            Trace
                          </Button>
                        </Box>
                      ))}
                    </AccordionDetails>
                  </Accordion>
                )}
              </Paper>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
};
