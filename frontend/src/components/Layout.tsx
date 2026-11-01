import React, { useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Chip,
  Breadcrumbs,
  Link,
  useTheme,
} from '@mui/material';
import {
  Dashboard as OverviewIcon,
  Folder as ProjectsIcon,
  Description as DocumentsIcon,
  Dataset as DatasetsIcon,
  SmartToy as PlaygroundIcon,
  PlayCircle as RunsIcon,
  Timeline as TracesIcon,
  Analytics as DashboardIcon,
  Compare as ComparisonIcon,
  BugReport as FailuresIcon,
  TrendingUp as RegressionIcon,
  Settings as SettingsIcon,
  Menu as MenuIcon,
  ChevronLeft as ChevronLeftIcon,
  AutoAwesome as DemoIcon,
} from '@mui/icons-material';

const DRAWER_WIDTH = 260;
const COLLAPSED_DRAWER_WIDTH = 72;

const NAV_ITEMS = [
  { text: 'Overview', path: '/', icon: <OverviewIcon /> },
  { text: 'Projects', path: '/projects', icon: <ProjectsIcon /> },
  { text: 'Documents', path: '/documents', icon: <DocumentsIcon /> },
  { text: 'Evaluation Datasets', path: '/datasets', icon: <DatasetsIcon /> },
  { text: 'Agent Playground', path: '/playground', icon: <PlaygroundIcon /> },
  { text: 'Evaluation Runs', path: '/runs', icon: <RunsIcon /> },
  { text: 'Trace Explorer', path: '/traces', icon: <TracesIcon /> },
  { text: 'Analytics Dashboard', path: '/dashboard', icon: <DashboardIcon /> },
  { text: 'Model Comparison', path: '/comparison', icon: <ComparisonIcon /> },
  { text: 'Failure Analysis', path: '/failures', icon: <FailuresIcon /> },
  { text: 'Regression Testing', path: '/regression', icon: <RegressionIcon /> },
  { text: 'Settings', path: '/settings', icon: <SettingsIcon /> },
];

export const Layout: React.FC = () => {
  const [open, setOpen] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();

  const toggleDrawer = () => {
    setOpen(!open);
  };

  const currentNavItem = NAV_ITEMS.find(
    (item) => item.path === location.pathname || (item.path !== '/' && location.pathname.startsWith(item.path))
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#F5F6FA' }}>
      {/* Top AppBar */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { sm: `calc(100% - ${open ? DRAWER_WIDTH : COLLAPSED_DRAWER_WIDTH}px)` },
          ml: { sm: `${open ? DRAWER_WIDTH : COLLAPSED_DRAWER_WIDTH}px` },
          bgcolor: '#FFFFFF',
          borderBottom: '1px solid #E2E8F0',
          color: '#1A1A2E',
          transition: theme.transitions.create(['margin', 'width'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', px: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton
              color="inherit"
              aria-label="toggle drawer"
              onClick={toggleDrawer}
              edge="start"
              size="small"
              sx={{ border: '1px solid #E2E8F0', borderRadius: 2 }}
            >
              {open ? <ChevronLeftIcon /> : <MenuIcon />}
            </IconButton>

            <Breadcrumbs separator="›" aria-label="breadcrumb">
              <Link
                underline="hover"
                color="inherit"
                onClick={() => navigate('/')}
                sx={{ cursor: 'pointer', fontSize: '0.875rem' }}
              >
                Platform
              </Link>
              <Typography color="text.primary" sx={{ fontSize: '0.875rem', fontWeight: 600 }}>
                {currentNavItem?.text || 'Console'}
              </Typography>
            </Breadcrumbs>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Chip
              icon={<DemoIcon sx={{ fontSize: '1rem !important' }} />}
              label="v1.0 Reliable RAG"
              size="small"
              color="primary"
              variant="outlined"
              sx={{ fontWeight: 600, borderColor: '#1565C0' }}
            />
          </Box>
        </Toolbar>
      </AppBar>

      {/* Persistent Sidebar */}
      <Drawer
        variant="permanent"
        open={open}
        sx={{
          width: open ? DRAWER_WIDTH : COLLAPSED_DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: open ? DRAWER_WIDTH : COLLAPSED_DRAWER_WIDTH,
            boxSizing: 'border-box',
            bgcolor: '#FFFFFF',
            borderRight: '1px solid #E2E8F0',
            transition: theme.transitions.create('width', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
            overflowX: 'hidden',
          },
        }}
      >
        <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 2,
              bgcolor: '#1565C0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFF',
              fontWeight: 800,
              fontSize: '1.1rem',
            }}
          >
            AE
          </Box>
          {open && (
            <Box>
              <Typography variant="subtitle1" fontWeight={800} sx={{ lineHeight: 1.2, color: '#0F172A' }}>
                AI Observability
              </Typography>
              <Typography variant="caption" color="text.secondary" fontWeight={500}>
                RAG & Agent Evaluation
              </Typography>
            </Box>
          )}
        </Box>
        <Divider sx={{ borderColor: '#F1F5F9' }} />

        <List sx={{ px: 1, py: 1.5 }}>
          {NAV_ITEMS.map((item) => {
            const isSelected =
              item.path === location.pathname ||
              (item.path !== '/' && location.pathname.startsWith(item.path));

            return (
              <ListItem key={item.text} disablePadding sx={{ display: 'block', mb: 0.5 }}>
                <Tooltip title={!open ? item.text : ''} placement="right">
                  <ListItemButton
                    onClick={() => navigate(item.path)}
                    selected={isSelected}
                    sx={{
                      minHeight: 44,
                      justifyContent: open ? 'initial' : 'center',
                      px: 2,
                      borderRadius: 2,
                      color: isSelected ? '#1565C0' : '#475569',
                      bgcolor: isSelected ? '#E3F2FD' : 'transparent',
                      '&:hover': {
                        bgcolor: isSelected ? '#E3F2FD' : '#F8FAFC',
                      },
                      '&.Mui-selected': {
                        bgcolor: '#E3F2FD',
                        fontWeight: 600,
                      },
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: 0,
                        mr: open ? 2 : 'auto',
                        justifyContent: 'center',
                        color: isSelected ? '#1565C0' : '#64748B',
                      }}
                    >
                      {item.icon}
                    </ListItemIcon>
                    {open && (
                      <ListItemText
                        primary={item.text}
                        primaryTypographyProps={{
                          fontSize: '0.875rem',
                          fontWeight: isSelected ? 700 : 500,
                        }}
                      />
                    )}
                  </ListItemButton>
                </Tooltip>
              </ListItem>
            );
          })}
        </List>
      </Drawer>

      {/* Main Content Area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 3, md: 4 },
          mt: 8,
          width: { sm: `calc(100% - ${open ? DRAWER_WIDTH : COLLAPSED_DRAWER_WIDTH}px)` },
          overflowX: 'hidden',
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
};
