import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { PlayCircle, Plus, BookOpen, ArrowLeft } from 'lucide-react';

function CoursePage() {
  const { id } = useParams(); // ID курса из URL
  const navigate = useNavigate();
  const [lessons, setLessons] = useState([]);
  const [courseInfo, setCourseInfo] = useState({ Title: 'Загрузка...', Description: '' });
  const role = localStorage.getItem('role');

  useEffect(() => {
    // 1. В идеале тут должен быть запрос информации о самом курсе (GET /courses/:id)
    // Пока просто ставим заглушку для названия
    setCourseInfo({ Title: `Курс #${id}`, Description: 'Список уроков' });

    // 2. Запрашиваем уроки ТОЛЬКО для этого курса
    fetch(`http://localhost:8080/courses/${id}/lessons`)
      .then(res => res.json())
      .then(data => setLessons(data || []))
      .catch(err => console.error("Ошибка загрузки:", err));
  }, [id]);

  return (
    <div style={{ padding: '40px', background: '#1e1e1e', minHeight: '100vh', color: 'white', fontFamily: 'system-ui' }}>
      
      {/* Навигация назад */}
      <button onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', marginBottom: '20px', fontSize: '14px' }}>
        <ArrowLeft size={16} /> На главную
      </button>

      <div style={{ borderBottom: '1px solid #333', paddingBottom: '20px', marginBottom: '30px' }}>
        <h1 style={{ margin: 0, fontSize: '32px' }}>{courseInfo.Title}</h1>
        <p style={{ margin: '5px 0 0 0', color: '#888' }}>{courseInfo.Description}</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><BookOpen size={24}/> Уроки курса</h2>
        
        {/* Кнопка записи урока (передаем ID курса в URL, чтобы LessonPage знал, куда сохранять) */}
        {role === 'teacher' && (
          <Link to={`/lesson/new?courseId=${id}`} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '10px 15px', background: '#22c55e', color: 'white', textDecoration: 'none', borderRadius: '6px', fontWeight: 'bold' }}>
            <Plus size={18} /> Записать урок
          </Link>
        )}
      </div>

      {/* Список УРОКОВ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
        {lessons.length === 0 ? (
          <div style={{ color: '#666', marginTop: '20px' }}>В этом курсе пока нет уроков.</div>
        ) : (
          lessons.map((lesson, index) => (
            <Link key={lesson.ID} to={`/lesson/${lesson.ID}?courseId=${id}`} style={{ background: '#252526', border: '1px solid #333', borderRadius: '8px', padding: '20px', textDecoration: 'none', color: 'white', display: 'flex', alignItems: 'center', gap: '15px', transition: 'background 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#2a2a2b'}
                  onMouseLeave={e => e.currentTarget.style.background = '#252526'}>
              
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#00add8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <PlayCircle size={20} color="white" />
              </div>
              
              <div>
                <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>Урок {index + 1}</div>
                <h3 style={{ margin: 0, fontSize: '16px' }}>{lesson.Title}</h3>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

export default CoursePage;