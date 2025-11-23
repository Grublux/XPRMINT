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
      { path: 'experiment', element: <ExperimentPage/> },
            { path: 'dashboard', element: <StabilizationPage/> },
    ],
  },
]);


