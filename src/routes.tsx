import { createBrowserRouter } from 'react-router-dom';
import AppLayout from './layout/AppLayout';
import HomePage from './pages/HomePage';
import ExperimentPage from './pages/ExperimentPage';
import StabilizationPage from './pages/StabilizationPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout/>,
    children: [
      { index: true, element: <HomePage/> },
      // LEGACY: Experiment page kept for future version, not currently linked
      { path: 'experiment', element: <ExperimentPage/> },
      { path: 'dashboard', element: <StabilizationPage/> },
      // TODO: Add 'lab' route for new Lab page
      // TODO: Update landing page (home/index) as needed
    ],
  },
]);


