import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { preloadAllImages } from './utils/preloadImages';

// Preload all images immediately when app starts
preloadAllImages();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App/></React.StrictMode>
);
