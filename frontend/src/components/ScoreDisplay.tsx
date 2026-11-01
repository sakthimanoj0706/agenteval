import React from 'react';
import { Box, Typography, Chip, Tooltip } from '@mui/material';

interface ScoreDisplayProps {
  score: number | null | undefined;
  method?: string;
  label?: string;
  isEvaluated?: boolean;
  reason?: string;
}

export const ScoreDisplay: React.FC<ScoreDisplayProps> = ({
  score,
  method = 'deterministic',
  label,
  isEvaluated = true,
  reason,
}) => {
  if (!isEvaluated || score === null || score === undefined) {
    return (
      <Tooltip title={reason || 'Not evaluated or insufficient ground truth'}>
        <Chip
          label="Not Evaluated"
          size="small"
          variant="outlined"
          sx={{ color: '#94A3B8', borderColor: '#CBD5E1', fontSize: '0.72rem', fontWeight: 500 }}
        />
      </Tooltip>
    );
  }

  // Color scale: 0.0 - 1.0
  let color = '#2E7D32'; // green
  if (score < 0.5) {
    color = '#D32F2F'; // red
  } else if (score < 0.75) {
    color = '#ED6C02'; // orange
  }

  const methodColorMap: Record<string, 'default' | 'primary' | 'secondary' | 'info'> = {
    deterministic: 'default',
    llm_judge: 'primary',
    human: 'secondary',
  };

  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
      {label && (
        <Typography variant="body2" color="text.secondary" fontWeight={500}>
          {label}:
        </Typography>
      )}
      <Typography variant="body2" fontWeight={700} sx={{ color }}>
        {(score * 100).toFixed(1)}%
      </Typography>
      <Tooltip title={`Evaluated via ${method}`}>
        <Chip
          label={method}
          size="small"
          color={methodColorMap[method] || 'default'}
          sx={{ height: 20, fontSize: '0.65rem', textTransform: 'capitalize' }}
        />
      </Tooltip>
    </Box>
  );
};
