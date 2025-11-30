import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppLayout from './layout/AppLayout';
import StabilizationPage from './pages/StabilizationPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout/>,
    children: [
      { index: true, element: <StabilizationPage/> },
      // Catch-all route: redirect any other path to homepage
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);


