import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LessonPage from './pages/LessonPage';
import CoursePage from './pages/CoursePage'; // Страница импортирована...
import { Toaster } from 'react-hot-toast';
import PricingPage from './pages/PricingPage';

function App() {
  return (
    <BrowserRouter>
    <Toaster position="top-right" toastOptions={{ style: { background: '#333', color: '#fff' } }} />
      <Routes>
        <Route path="/" element={<HomePage />} />
        
        {/* ...И ТЕПЕРЬ ОНА ИСПОЛЬЗУЕТСЯ ВОТ ЗДЕСЬ! */}
        <Route path="/course/:id" element={<CoursePage />} /> 
        
        <Route path="/lesson/:id" element={<LessonPage />} />
        <Route path="/pricing" element={<PricingPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;