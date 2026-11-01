import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from './theme/theme';
import { Layout } from './components/Layout';

import { OverviewPage } from './pages/OverviewPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { DatasetsPage } from './pages/DatasetsPage';
import { AgentPlaygroundPage } from './pages/AgentPlaygroundPage';
import { EvaluationRunsPage } from './pages/EvaluationRunsPage';
import { TraceExplorerPage } from './pages/TraceExplorerPage';
import { AnalyticsDashboardPage } from './pages/AnalyticsDashboardPage';
import { ModelComparisonPage } from './pages/ModelComparisonPage';
import { FailureAnalysisPage } from './pages/FailureAnalysisPage';
import { RegressionTestingPage } from './pages/RegressionTestingPage';
import { SettingsPage } from './pages/SettingsPage';

export const App: React.FC = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<OverviewPage />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="projects/:id" element={<ProjectDetailPage />} />
            <Route path="documents" element={<DocumentsPage />} />
            <Route path="datasets" element={<DatasetsPage />} />
            <Route path="playground" element={<AgentPlaygroundPage />} />
            <Route path="runs" element={<EvaluationRunsPage />} />
            <Route path="traces" element={<TraceExplorerPage />} />
            <Route path="dashboard" element={<AnalyticsDashboardPage />} />
            <Route path="comparison" element={<ModelComparisonPage />} />
            <Route path="failures" element={<FailureAnalysisPage />} />
            <Route path="regression" element={<RegressionTestingPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
};

export default App;
