import { createBrowserRouter } from 'react-router-dom';
import AppLayout from './layout/AppLayout';
import HomePage from './pages/HomePage';
import ExperimentPage from './pages/ExperimentPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout/>,
    children: [
      { index: true, element: <HomePage/> },
      { path: 'experiment', element: <ExperimentPage/> },
    ],
  },
]);


