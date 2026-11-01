import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  LinearProgress,
  Chip,
  TextField,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Add as AddIcon,
  UploadFile as ImportIcon,
  Download as ExportIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  ContentCopy as DuplicateIcon,
} from '@mui/icons-material';
import { projectService, datasetService } from '../services';

const CATEGORIES = [
  'all',
  'normal',
  'ambiguous',
  'irrelevant',
  'multi_step',
  'tool_dependent',
  'challenging',
];

export const DatasetsPage: React.FC = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | ''>('');
  const [datasets, setDatasets] = useState<any[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<number | ''>('');
  const [testCases, setTestCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Create Dataset Dialog
  const [openCreateDataset, setOpenCreateDataset] = useState(false);
  const [dsName, setDsName] = useState('');
  const [dsDesc, setDsDesc] = useState('');

  // Add / Edit Test Case Dialog
  const [openTestCaseDialog, setOpenTestCaseDialog] = useState(false);
  const [editingCaseId, setEditingCaseId] = useState<number | null>(null);
  const [tcQuery, setTcQuery] = useState('');
  const [tcExpectedAnswer, setTcExpectedAnswer] = useState('');
  const [tcReferenceContext, setTcReferenceContext] = useState('');
  const [tcExpectedTool, setTcExpectedTool] = useState('');
  const [tcCategory, setTcCategory] = useState('normal');

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

  const loadDatasets = async () => {
    if (!selectedProjectId) return;
    try {
      setLoading(true);
      const dsList = await datasetService.list(selectedProjectId);
      setDatasets(dsList);
      if (dsList.length > 0) {
        setSelectedDatasetId(dsList[0].id);
      } else {
        setSelectedDatasetId('');
        setTestCases([]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDatasets();
  }, [selectedProjectId]);

  const loadTestCases = async () => {
    if (!selectedDatasetId) return;
    try {
      setLoading(true);
      const ds = await datasetService.get(selectedDatasetId);
      setTestCases(ds.test_cases || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTestCases();
  }, [selectedDatasetId]);

  const handleCreateDataset = async () => {
    if (!selectedProjectId || !dsName.trim()) return;
    try {
      await datasetService.create(selectedProjectId, { name: dsName, description: dsDesc });
      setOpenCreateDataset(false);
      setDsName('');
      setDsDesc('');
      loadDatasets();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveTestCase = async () => {
    if (!selectedDatasetId || !tcQuery.trim()) return;
    const payload = {
      query: tcQuery,
      expected_answer: tcExpectedAnswer,
      reference_context: tcReferenceContext,
      expected_tool: tcExpectedTool || null,
      category: tcCategory,
    };

    try {
      if (editingCaseId) {
        await datasetService.updateTestCase(editingCaseId, payload);
      } else {
        await datasetService.addTestCase(selectedDatasetId, payload);
      }
      setOpenTestCaseDialog(false);
      resetTestCaseForm();
      loadTestCases();
    } catch (e) {
      console.error(e);
    }
  };

  const resetTestCaseForm = () => {
    setEditingCaseId(null);
    setTcQuery('');
    setTcExpectedAnswer('');
    setTcReferenceContext('');
    setTcExpectedTool('');
    setTcCategory('normal');
  };

  const handleEditCase = (tc: any) => {
    setEditingCaseId(tc.id);
    setTcQuery(tc.query);
    setTcExpectedAnswer(tc.expected_answer || '');
    setTcReferenceContext(tc.reference_context || '');
    setTcExpectedTool(tc.expected_tool || '');
    setTcCategory(tc.category || 'normal');
    setOpenTestCaseDialog(true);
  };

  const handleDeleteCase = async (id: number) => {
    if (!window.confirm('Delete this test case?')) return;
    try {
      await datasetService.deleteTestCase(id);
      loadTestCases();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDuplicateCase = async (id: number) => {
    try {
      await datasetService.duplicateTestCase(id);
      loadTestCases();
    } catch (e) {
      console.error(e);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedDatasetId || !e.target.files || !e.target.files[0]) return;
    try {
      setLoading(true);
      await datasetService.importCases(selectedDatasetId, e.target.files[0]);
      loadTestCases();
    } catch (err: any) {
      alert(err.message || 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  const filteredCases = testCases.filter(
    (tc) => categoryFilter === 'all' || tc.category === categoryFilter
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={800} color="#0F172A">
            Evaluation Datasets & Ground Truth
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Curate questions, reference contexts, and ground-truth answer benchmarks
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
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

          <Button variant="outlined" onClick={() => setOpenCreateDataset(true)}>
            New Dataset
          </Button>
        </Box>
      </Box>

      {/* Dataset Selection Bar */}
      {datasets.length > 0 && (
        <Paper elevation={0} sx={{ p: 2, mb: 3, border: '1px solid #E2E8F0', borderRadius: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 260 }}>
            <InputLabel>Select Dataset</InputLabel>
            <Select
              value={selectedDatasetId}
              label="Select Dataset"
              onChange={(e) => setSelectedDatasetId(Number(e.target.value))}
            >
              {datasets.map((d) => (
                <MenuItem key={d.id} value={d.id}>
                  {d.name} ({d.test_case_count ?? 0} cases)
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<ImportIcon />}
              onClick={() => document.getElementById('dataset-import-input')?.click()}
            >
              Import CSV/JSON
            </Button>
            <input
              id="dataset-import-input"
              type="file"
              accept=".csv,.json"
              style={{ display: 'none' }}
              onChange={handleImport}
            />

            <Button
              variant="outlined"
              size="small"
              startIcon={<ExportIcon />}
              href={selectedDatasetId ? datasetService.exportUrl(selectedDatasetId, 'json') : '#'}
              target="_blank"
              disabled={!selectedDatasetId}
            >
              Export JSON
            </Button>

            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => {
                resetTestCaseForm();
                setOpenTestCaseDialog(true);
              }}
              disabled={!selectedDatasetId}
            >
              Add Test Case
            </Button>
          </Box>
        </Paper>
      )}

      {/* Category Filter Chips */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2.5, overflowX: 'auto', pb: 0.5 }}>
        {CATEGORIES.map((cat) => (
          <Chip
            key={cat}
            label={cat.replace('_', ' ').toUpperCase()}
            clickable
            color={categoryFilter === cat ? 'primary' : 'default'}
            variant={categoryFilter === cat ? 'filled' : 'outlined'}
            onClick={() => setCategoryFilter(cat)}
            sx={{ fontWeight: 600, fontSize: '0.75rem' }}
          />
        ))}
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #E2E8F0', borderRadius: 3 }}>
        <Table>
          <TableHead sx={{ bgcolor: '#F8FAFC' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, width: '35%' }}>Test Query</TableCell>
              <TableCell sx={{ fontWeight: 700, width: '25%' }}>Expected Answer</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Expected Tool</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredCases.map((tc) => (
              <TableRow key={tc.id} hover>
                <TableCell sx={{ fontWeight: 600 }}>{tc.query}</TableCell>
                <TableCell sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>
                  {tc.expected_answer || <span style={{ color: '#94A3B8' }}>None provided</span>}
                </TableCell>
                <TableCell>
                  <Chip label={tc.category} size="small" variant="outlined" sx={{ textTransform: 'capitalize' }} />
                </TableCell>
                <TableCell>
                  {tc.expected_tool ? (
                    <Chip label={tc.expected_tool} size="small" color="secondary" sx={{ fontWeight: 600 }} />
                  ) : (
                    <span style={{ color: '#94A3B8', fontSize: '0.85rem' }}>None</span>
                  )}
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => handleEditCase(tc)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Duplicate">
                    <IconButton size="small" onClick={() => handleDuplicateCase(tc.id)}>
                      <DuplicateIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton size="small" color="error" onClick={() => handleDeleteCase(tc.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add / Edit Dialog */}
      <Dialog open={openTestCaseDialog} onClose={() => setOpenTestCaseDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editingCaseId ? 'Edit Test Case' : 'Add Benchmark Test Case'}
        </DialogTitle>
        <DialogContent>
          <TextField
            margin="dense"
            label="User Query / Question"
            fullWidth
            required
            multiline
            rows={2}
            value={tcQuery}
            onChange={(e) => setTcQuery(e.target.value)}
            sx={{ mb: 2, mt: 1 }}
          />
          <TextField
            margin="dense"
            label="Expected Answer (Ground Truth)"
            fullWidth
            multiline
            rows={2}
            value={tcExpectedAnswer}
            onChange={(e) => setTcExpectedAnswer(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Reference Context (Ground Truth passage)"
            fullWidth
            multiline
            rows={2}
            value={tcReferenceContext}
            onChange={(e) => setTcReferenceContext(e.target.value)}
            sx={{ mb: 2 }}
          />
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <FormControl fullWidth margin="dense">
              <InputLabel>Category</InputLabel>
              <Select
                value={tcCategory}
                label="Category"
                onChange={(e) => setTcCategory(e.target.value)}
              >
                {CATEGORIES.filter((c) => c !== 'all').map((c) => (
                  <MenuItem key={c} value={c}>
                    {c.replace('_', ' ')}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth margin="dense">
              <InputLabel>Expected Tool</InputLabel>
              <Select
                value={tcExpectedTool}
                label="Expected Tool"
                onChange={(e) => setTcExpectedTool(e.target.value)}
              >
                <MenuItem value="">None</MenuItem>
                <MenuItem value="calculator">calculator</MenuItem>
                <MenuItem value="college_info">college_info</MenuItem>
                <MenuItem value="knowledge_base">knowledge_base</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setOpenTestCaseDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveTestCase} disabled={!tcQuery.trim()}>
            {editingCaseId ? 'Update Case' : 'Add Test Case'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Dataset Dialog */}
      <Dialog open={openCreateDataset} onClose={() => setOpenCreateDataset(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>New Evaluation Dataset</DialogTitle>
        <DialogContent>
          <TextField
            margin="dense"
            label="Dataset Name"
            fullWidth
            required
            value={dsName}
            onChange={(e) => setDsName(e.target.value)}
            sx={{ mb: 2, mt: 1 }}
          />
          <TextField
            margin="dense"
            label="Description"
            fullWidth
            multiline
            rows={3}
            value={dsDesc}
            onChange={(e) => setDsDesc(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setOpenCreateDataset(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateDataset} disabled={!dsName.trim()}>
            Create Dataset
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
