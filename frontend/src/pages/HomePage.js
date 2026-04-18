import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PlayCircle, Plus, User, Folder, X } from 'lucide-react';

function HomePage() {
  const [courses, setCourses] = useState([]);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [newCourse, setNewCourse] = useState({ title: '', description: '' });
  
  const role = localStorage.getItem('role');
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = () => {
    fetch('http://localhost:8080/courses')
      .then(res => res.json())
      .then(data => setCourses(data || []))
      .catch(err => console.error("Ошибка загрузки:", err));
  };

  const handleCreateCourse = async () => {
    try {
      const res = await fetch('http://localhost:8080/courses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newCourse)
      });
      if (res.ok) {
        setShowCourseModal(false);
        setNewCourse({ title: '', description: '' });
        fetchCourses(); // Перезагружаем список курсов
      } else {
        alert("Ошибка создания курса");
      }
    } catch (err) { alert("Ошибка соединения с сервером"); }
  };

  return (
    <div style={{ padding: '40px', background: '#1e1e1e', minHeight: '100vh', color: 'white', fontFamily: 'system-ui' }}>
      
      {/* МОДАЛКА СОЗДАНИЯ КУРСА */}
      {showCourseModal && (
        <div style={modalStyles.overlay}>
          <div style={modalStyles.modal}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#00add8' }}>Новый курс</h2>
              <button onClick={() => setShowCourseModal(false)} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer' }}><X size={20}/></button>
            </div>
            <input 
              placeholder="Название курса (например: Основы Go)" 
              value={newCourse.title}
              onChange={e => setNewCourse({...newCourse, title: e.target.value})}
              style={modalStyles.input}
            />
            <textarea 
              placeholder="Описание курса..." 
              value={newCourse.description}
              onChange={e => setNewCourse({...newCourse, description: e.target.value})}
              style={{...modalStyles.input, height: '100px', resize: 'none'}}
            />
            <div style={{display: 'flex', gap: '10px'}}>
              <button onClick={handleCreateCourse} style={modalStyles.btnSave}>Создать</button>
              <button onClick={() => setShowCourseModal(false)} style={modalStyles.btnCancel}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* ШАПКА */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333', paddingBottom: '20px', marginBottom: '30px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '32px' }}>Scrimba<span style={{color:'#00add8'}}>Go</span></h1>
          <p style={{ margin: '5px 0 0 0', color: '#888' }}>Интерактивная платформа для изучения Go</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          {token ? (
            <span style={{ color: '#aaa', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <User size={16}/> {role === 'teacher' ? 'Преподаватель' : 'Студент'}
            </span>
          ) : (
            <Link to="/auth" style={{ color: '#00add8', textDecoration: 'none' }}>Войти</Link>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><Folder size={24}/> Все курсы</h2>
        {role === 'teacher' && (
          <button onClick={() => setShowCourseModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '10px 15px', background: '#22c55e', border: 'none', color: 'white', cursor: 'pointer', borderRadius: '6px', fontWeight: 'bold' }}>
            <Plus size={18} /> Создать курс
          </button>
        )}
      </div>

      {/* КАРТОЧКИ КУРСОВ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
        {courses.length === 0 ? (
          <div style={{ color: '#666', marginTop: '20px' }}>Пока нет доступных курсов...</div>
        ) : (
          courses.map(course => (
            <div key={course.ID} style={{ background: '#252526', border: '1px solid #333', borderRadius: '8px', padding: '20px', transition: 'transform 0.2s', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ marginTop: 0, marginBottom: '10px', fontSize: '20px' }}>{course.Title}</h3>
              <p style={{ fontSize: '14px', color: '#aaa', flex: 1 }}>{course.Description}</p>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', paddingTop: '15px', borderTop: '1px solid #3c3c3c' }}>
                <span style={{ fontSize: '12px', color: '#666' }}>Автор: {course.Author?.Username || 'Неизвестен'}</span>
                <Link to={`/course/${course.ID}`} style={{ padding: '8px 15px', background: '#00add8', color: 'white', textDecoration: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: '500' }}>
                  Перейти
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const modalStyles = {
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: '#252526', padding: '30px', borderRadius: '12px', width: '400px', border: '1px solid #333' },
  input: { width: '100%', background: '#1e1e1e', border: '1px solid #444', color: 'white', padding: '12px', borderRadius: '6px', marginBottom: '15px', outline: 'none' },
  btnSave: { flex: 1, background: '#00add8', border: 'none', color: 'white', padding: '10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  btnCancel: { background: 'transparent', border: '1px solid #444', color: '#888', padding: '10px', borderRadius: '6px', cursor: 'pointer' }
};

export default HomePage;