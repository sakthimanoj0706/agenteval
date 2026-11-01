import React from 'react';
import { Chip } from '@mui/material';

interface StatusChipProps {
  status: string;
  size?: 'small' | 'medium';
}

export const StatusChip: React.FC<StatusChipProps> = ({ status, size = 'small' }) => {
  const s = (status || '').toLowerCase();
  let color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' = 'default';

  if (s === 'completed' || s === 'indexed' || s === 'active') {
    color = 'success';
  } else if (s === 'running' || s === 'processing') {
    color = 'info';
  } else if (s === 'failed' || s === 'error') {
    color = 'error';
  } else if (s === 'pending' || s === 'uploaded') {
    color = 'warning';
  }

  return (
    <Chip
      label={status.toUpperCase()}
      color={color}
      size={size}
      sx={{ fontWeight: 600, fontSize: '0.72rem', textTransform: 'capitalize' }}
    />
  );
};
