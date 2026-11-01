import React from 'react';
import { Card, CardContent, Typography, Box, Avatar } from '@mui/material';

interface MetricCardProps {
  title: string;
  value: string | number | null | undefined;
  subtitle?: string;
  icon?: React.ReactNode;
  color?: 'primary' | 'success' | 'warning' | 'error' | 'info';
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  color = 'primary',
}) => {
  const colorMap = {
    primary: { bg: '#E3F2FD', text: '#1565C0' },
    success: { bg: '#E8F5E9', text: '#2E7D32' },
    warning: { bg: '#FFF3E0', text: '#E65100' },
    error: { bg: '#FFEBEE', text: '#C62828' },
    info: { bg: '#E0F7FA', text: '#00838F' },
  };

  const themeColors = colorMap[color];

  return (
    <Card
      elevation={0}
      sx={{
        border: '1px solid #E2E8F0',
        borderRadius: 3,
        height: '100%',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 8px 16px rgba(0,0,0,0.06)',
        },
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Typography variant="body2" color="text.secondary" fontWeight={600}>
            {title}
          </Typography>
          {icon && (
            <Avatar
              sx={{
                bgcolor: themeColors.bg,
                color: themeColors.text,
                width: 38,
                height: 38,
              }}
            >
              {icon}
            </Avatar>
          )}
        </Box>
        <Typography variant="h4" fontWeight={700} sx={{ color: '#0F172A', mb: 0.5 }}>
          {value !== null && value !== undefined ? value : 'N/A'}
        </Typography>
        {subtitle && (
          <Typography variant="caption" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};
