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
  Divider,
} from '@mui/material';
import {
  UploadFile as UploadIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  SettingsSuggest as IndexIcon,
} from '@mui/icons-material';
import { StatusChip } from '../components/StatusChip';
import { EmptyState } from '../components/EmptyState';
import { projectService, documentService } from '../services';

export const DocumentsPage: React.FC = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | ''>('');
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Upload Dialog
  const [openUpload, setOpenUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Chunks Dialog
  const [openChunks, setOpenChunks] = useState(false);
  const [selectedDocChunks, setSelectedDocChunks] = useState<any[]>([]);
  const [chunkDocTitle, setChunkDocTitle] = useState('');

  // Re-index Dialog
  const [openIndexDialog, setOpenIndexDialog] = useState(false);
  const [reindexDocId, setReindexDocId] = useState<number | null>(null);
  const [chunkSize, setChunkSize] = useState(512);
  const [chunkOverlap, setChunkOverlap] = useState(50);

  useEffect(() => {
    const init = async () => {
      try {
        const pList = await projectService.list();
        setProjects(pList);
        if (pList.length > 0) {
          setSelectedProjectId(pList[0].id);
        }
      } catch (e) {
        console.error(e);
      }
    };
    init();
  }, []);

  const loadDocuments = async () => {
    if (!selectedProjectId) return;
    try {
      setLoading(true);
      const docs = await documentService.list(selectedProjectId);
      setDocuments(docs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [selectedProjectId]);

  const handleUpload = async () => {
    if (!selectedProjectId || !uploadFile) return;
    try {
      setUploading(true);
      await documentService.upload(selectedProjectId, uploadFile, true);
      setOpenUpload(false);
      setUploadFile(null);
      loadDocuments();
    } catch (e: any) {
      alert(e.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this document and all associated vector embeddings?')) return;
    try {
      await documentService.delete(id);
      loadDocuments();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleViewChunks = async (doc: any) => {
    try {
      setChunkDocTitle(doc.filename);
      const chunks = await documentService.getChunks(doc.id);
      setSelectedDocChunks(chunks);
      setOpenChunks(true);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleReindex = async () => {
    if (!reindexDocId) return;
    try {
      await documentService.index(reindexDocId, { chunk_size: chunkSize, chunk_overlap: chunkOverlap });
      setOpenIndexDialog(false);
      loadDocuments();
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={800} color="#0F172A">
            Document Repository & Vector Indexes
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Ingest, extract, chunk, and index domain knowledge into FAISS vector space
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 220 }}>
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

          <Button
            variant="contained"
            startIcon={<UploadIcon />}
            onClick={() => setOpenUpload(true)}
            disabled={!selectedProjectId}
          >
            Upload Document
          </Button>
        </Box>
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {documents.length === 0 && !loading ? (
        <Paper elevation={0} sx={{ border: '1px solid #E2E8F0', borderRadius: 3 }}>
          <EmptyState
            title="No Documents Indexed"
            description="Upload PDF, DOCX, or TXT documents to build a searchable knowledge base for your AI agent."
            actionText="Upload First Document"
            onAction={() => setOpenUpload(true)}
          />
        </Paper>
      ) : (
        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #E2E8F0', borderRadius: 3 }}>
          <Table>
            <TableHead sx={{ bgcolor: '#F8FAFC' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Filename</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>File Size</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Chunks</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Uploaded</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {documents.map((doc) => (
                <TableRow key={doc.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{doc.filename}</TableCell>
                  <TableCell>
                    <Chip label={doc.file_type.toUpperCase()} size="small" variant="outlined" sx={{ fontWeight: 600 }} />
                  </TableCell>
                  <TableCell>{(doc.file_size / 1024).toFixed(1)} KB</TableCell>
                  <TableCell>{doc.chunk_count} chunks</TableCell>
                  <TableCell>
                    <StatusChip status={doc.status} />
                    {doc.error_message && (
                      <Typography variant="caption" color="error" display="block" sx={{ mt: 0.5 }}>
                        {doc.error_message}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{new Date(doc.created_at).toLocaleDateString()}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="View Chunks">
                      <IconButton size="small" onClick={() => handleViewChunks(doc)}>
                        <ViewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Configure & Re-index">
                      <IconButton
                        size="small"
                        onClick={() => {
                          setReindexDocId(doc.id);
                          setOpenIndexDialog(true);
                        }}
                      >
                        <IndexIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={() => handleDelete(doc.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Upload Modal */}
      <Dialog open={openUpload} onClose={() => setOpenUpload(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Upload & Index Document</DialogTitle>
        <DialogContent>
          <Box
            sx={{
              border: '2px dashed #90CAF9',
              borderRadius: 2,
              p: 4,
              textAlign: 'center',
              bgcolor: '#F8FAFF',
              cursor: 'pointer',
              mt: 1,
            }}
            onClick={() => document.getElementById('file-upload-input')?.click()}
          >
            <input
              id="file-upload-input"
              type="file"
              accept=".pdf,.docx,.doc,.txt"
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setUploadFile(e.target.files[0]);
                }
              }}
            />
            <UploadIcon sx={{ fontSize: 40, color: '#1565C0', mb: 1 }} />
            <Typography variant="subtitle1" fontWeight={700}>
              {uploadFile ? uploadFile.name : 'Click to select or drag document here'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Supports PDF, DOCX, TXT up to 50MB
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setOpenUpload(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleUpload} disabled={!uploadFile || uploading}>
            {uploading ? 'Processing & Indexing...' : 'Upload & Index'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Chunks Modal */}
      <Dialog open={openChunks} onClose={() => setOpenChunks(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          Document Chunks: {chunkDocTitle} ({selectedDocChunks.length} chunks)
        </DialogTitle>
        <DialogContent dividers sx={{ maxHeight: 500 }}>
          {selectedDocChunks.map((chunk, idx) => (
            <Paper key={chunk.id} elevation={0} sx={{ p: 2, mb: 2, bgcolor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="subtitle2" fontWeight={700} color="#1565C0">
                  Chunk #{chunk.chunk_index}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Chars: {chunk.start_char} - {chunk.end_char} ({chunk.content.length} chars)
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: '#1E293B', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                {chunk.content}
              </Typography>
            </Paper>
          ))}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenChunks(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Re-index Settings Dialog */}
      <Dialog open={openIndexDialog} onClose={() => setOpenIndexDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Configure Chunking</DialogTitle>
        <DialogContent>
          <TextField
            margin="dense"
            label="Chunk Size (chars)"
            type="number"
            fullWidth
            value={chunkSize}
            onChange={(e) => setChunkSize(Number(e.target.value))}
            sx={{ mb: 2, mt: 1 }}
          />
          <TextField
            margin="dense"
            label="Chunk Overlap (chars)"
            type="number"
            fullWidth
            value={chunkOverlap}
            onChange={(e) => setChunkOverlap(Number(e.target.value))}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setOpenIndexDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleReindex}>
            Re-index
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
