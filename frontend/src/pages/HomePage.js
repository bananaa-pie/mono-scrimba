import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { Plus, User, Folder, X, Loader2 } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import api from '../api';
import toast from 'react-hot-toast';

function HomePage() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newCourse, setNewCourse] = useState({ title: '', description: '' });
  
  const { user } = useContext(AuthContext);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      const res = await api.get('/courses');
      setCourses(res.data || []);
    } catch (err) {
      toast.error("Не удалось загрузить курсы");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCourse = async () => {
    try {
      await api.post('/courses', newCourse);
      toast.success("Курс успешно создан!");
      setShowModal(false);
      setNewCourse({ title: '', description: '' });
      fetchCourses();
    } catch (err) {
      toast.error("Ошибка при создании курса");
    }
  };

  return (
    <div className="p-10 min-h-screen">
      {/* МОДАЛЬНОЕ ОКНО */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#252526] p-8 rounded-xl w-full max-w-md border border-gray-700 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-[#00add8]">Новый курс</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white transition-colors">
                <X size={24}/>
              </button>
            </div>
            <input 
              className="w-full bg-[#1e1e1e] border border-gray-600 p-3 rounded-lg mb-4 focus:border-[#00add8] outline-none transition-all"
              placeholder="Название курса" 
              value={newCourse.title}
              onChange={e => setNewCourse({...newCourse, title: e.target.value})}
            />
            <textarea 
              className="w-full bg-[#1e1e1e] border border-gray-600 p-3 rounded-lg mb-6 h-32 resize-none focus:border-[#00add8] outline-none transition-all"
              placeholder="Описание курса..." 
              value={newCourse.description}
              onChange={e => setNewCourse({...newCourse, description: e.target.value})}
            />
            <div className="flex gap-3">
              <button onClick={handleCreateCourse} className="flex-1 bg-[#00add8] hover:bg-[#008db1] py-3 rounded-lg font-bold transition-colors">Создать</button>
              <button onClick={() => setShowModal(false)} className="px-6 py-3 border border-gray-600 rounded-lg hover:bg-gray-700 transition-colors">Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* ШАПКА */}
      <header className="flex justify-between items-center border-b border-gray-800 pb-8 mb-10">
        <div>
          <h1 className="text-4xl font-black">Scrimba<span className="text-[#00add8]">Go</span></h1>
          <p className="text-gray-500 mt-2 text-lg">Интерактивная платформа для изучения Go</p>
        </div>
        <div className="flex items-center gap-4 bg-gray-800/50 px-4 py-2 rounded-full border border-gray-700">
          <User size={20} className="text-[#00add8]"/>
          <span className="text-gray-300 font-medium">
            {user ? (user.role === 'teacher' ? 'Преподаватель' : 'Студент') : 'Гость'}
          </span>
        </div>
      </header>

      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold flex items-center gap-3"><Folder className="text-[#00add8]"/> Ваши курсы</h2>
        {user?.role === 'teacher' && (
          <button onClick={() => setShowModal(true)} className="bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-green-900/20 transition-all active:scale-95">
            <Plus size={20}/> Создать курс
          </button>
        )}
      </div>

      {/* СПИСОК КУРСОВ */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <Loader2 className="animate-spin mb-4" size={48}/>
          <p>Загрузка курсов...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.length === 0 ? (
            <p className="text-gray-600 col-span-full text-center py-10">Курсов пока нет. Самое время создать первый!</p>
          ) : (
            courses.map(course => (
              <div key={course.ID} className="bg-[#252526] border border-gray-800 rounded-xl p-6 hover:border-[#00add8]/50 hover:shadow-xl hover:shadow-[#00add8]/5 transition-all group">
                <h3 className="text-xl font-bold mb-3 group-hover:text-[#00add8] transition-colors">{course.Title}</h3>
                <p className="text-gray-400 text-sm mb-6 line-clamp-3 h-12">{course.Description}</p>
                <div className="flex justify-between items-center pt-6 border-t border-gray-800">
                  <span className="text-xs text-gray-600 font-medium uppercase tracking-wider">
                    ID: {course.ID}
                  </span>
                  <Link to={`/course/${course.ID}`} className="bg-[#00add8] hover:bg-[#008db1] px-6 py-2 rounded-lg text-sm font-bold transition-all active:scale-95">
                    Открыть
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default HomePage;