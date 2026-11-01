import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  IconButton,
  LinearProgress,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Folder as FolderIcon,
  Description as DocumentIcon,
  Dataset as DatasetIcon,
  PlayCircle as RunIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { projectService, demoService } from '../services';

export const ProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCreate, setOpenCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await projectService.list();
      setProjects(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      await projectService.create({ name, description });
      setOpenCreate(false);
      setName('');
      setDescription('');
      loadProjects();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this project and all indexed data?')) return;
    try {
      await projectService.delete(id);
      loadProjects();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={800} color="#0F172A">
            Evaluation Projects
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage your knowledge base domains, evaluation sets, and test benchmarks
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpenCreate(true)}
          sx={{ borderRadius: 2 }}
        >
          New Project
        </Button>
      </Box>

      {loading && <LinearProgress sx={{ mb: 3 }} />}

      <Grid container spacing={3}>
        {projects.map((p) => {
          const isDemo = p.name.includes('[DEMO]');
          return (
            <Grid item xs={12} sm={6} md={4} key={p.id}>
              <Card
                elevation={0}
                onClick={() => navigate(`/projects/${p.id}`)}
                sx={{
                  border: isDemo ? '1px solid #BBDEFB' : '1px solid #E2E8F0',
                  borderRadius: 3,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  bgcolor: isDemo ? '#F8FAFF' : '#FFF',
                  '&:hover': {
                    transform: 'translateY(-3px)',
                    boxShadow: '0 8px 20px rgba(0,0,0,0.06)',
                  },
                }}
              >
                <CardContent sx={{ p: 2.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <FolderIcon color="primary" />
                      <Typography variant="h6" fontWeight={700} color="#0F172A">
                        {p.name}
                      </Typography>
                    </Box>
                    {isDemo && (
                      <Chip label="DEMO" size="small" color="primary" sx={{ fontWeight: 700, fontSize: '0.65rem' }} />
                    )}
                  </Box>

                  <Typography variant="body2" color="text.secondary" sx={{ minHeight: 40, mb: 2 }}>
                    {p.description || 'No description provided.'}
                  </Typography>

                  <Box sx={{ display: 'flex', gap: 2, py: 1, borderTop: '1px solid #F1F5F9' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <DocumentIcon sx={{ fontSize: 16, color: '#64748B' }} />
                      <Typography variant="caption" fontWeight={600} color="text.secondary">
                        {p.document_count ?? 0} docs
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <DatasetIcon sx={{ fontSize: 16, color: '#64748B' }} />
                      <Typography variant="caption" fontWeight={600} color="text.secondary">
                        {p.dataset_count ?? 0} datasets
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <RunIcon sx={{ fontSize: 16, color: '#64748B' }} />
                      <Typography variant="caption" fontWeight={600} color="text.secondary">
                        {p.run_count ?? 0} runs
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>

                <CardActions sx={{ px: 2.5, pb: 2, pt: 0, justifyContent: 'space-between' }}>
                  <Button size="small" sx={{ fontWeight: 600 }}>
                    Open Workspace
                  </Button>
                  <Tooltip title="Delete Project">
                    <IconButton size="small" color="error" onClick={(e) => handleDelete(p.id, e)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </CardActions>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Create Dialog */}
      <Dialog open={openCreate} onClose={() => setOpenCreate(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Create Evaluation Project</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Project Name"
            fullWidth
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Description & Context"
            fullWidth
            multiline
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setOpenCreate(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={!name.trim()}>
            Create Project
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
