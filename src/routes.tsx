import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppLayout from './layout/AppLayout';
import StabilizationPage from './pages/StabilizationPage';
import LeaderPage from './pages/LeaderPage';
import LeaderPage2 from './pages/LeaderPage2';
import ForgePage from './pages/ForgePage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout/>,
    children: [
      { index: true, element: <StabilizationPage/> },
      { path: 'leader', element: <LeaderPage/> },
      { path: 'leader2', element: <LeaderPage2/> },
      { path: 'forge', element: <ForgePage/> },
      // Catch-all route: redirect any other path to homepage
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);


