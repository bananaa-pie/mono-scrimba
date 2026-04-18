import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LessonPage from './pages/LessonPage';
import CoursePage from './pages/CoursePage'; // Страница импортирована...

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        
        {/* ...И ТЕПЕРЬ ОНА ИСПОЛЬЗУЕТСЯ ВОТ ЗДЕСЬ! */}
        <Route path="/course/:id" element={<CoursePage />} /> 
        
        <Route path="/lesson/:id" element={<LessonPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;