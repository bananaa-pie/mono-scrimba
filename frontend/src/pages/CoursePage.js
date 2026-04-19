import React, { useState, useEffect, useContext } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { PlayCircle, Plus, BookOpen, ArrowLeft, Loader2 } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import api from '../api';
import toast from 'react-hot-toast';

function CoursePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Пока у нас нет отдельного роута для инфы о курсе, делаем заглушку
  const courseInfo = { Title: `Курс #${id}`, Description: 'Список уроков' };

  useEffect(() => {
    const fetchLessons = async () => {
      try {
        const res = await api.get(`/courses/${id}/lessons`);
        setLessons(res.data || []);
      } catch (err) {
        toast.error("Ошибка при загрузке уроков");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchLessons();
  }, [id]);

  return (
    <div className="p-10 min-h-screen bg-[#1e1e1e] text-white font-sans">
      
      {/* Навигация назад */}
      <button 
        onClick={() => navigate('/')} 
        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6 group"
      >
        <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" /> 
        Назад к курсам
      </button>

      {/* Шапка курса */}
      <div className="border-b border-gray-800 pb-8 mb-10">
        <h1 className="text-4xl font-black mb-2">{courseInfo.Title}</h1>
        <p className="text-gray-500 text-lg">{courseInfo.Description}</p>
      </div>

      {/* Панель управления уроками */}
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <BookOpen className="text-[#00add8]" size={28}/> 
          Уроки курса
        </h2>
        
        {user?.role === 'teacher' && (
          <Link 
            to={`/lesson/new?courseId=${id}`} 
            className="bg-[#00add8] hover:bg-[#008db1] px-6 py-3 rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-[#00add8]/20 transition-all active:scale-95"
          >
            <Plus size={20} /> Записать урок
          </Link>
        )}
      </div>

      {/* Список уроков (со скелетоном загрузки) */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <Loader2 className="animate-spin mb-4 text-[#00add8]" size={48}/>
          <p>Загружаем программу курса...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {lessons.length === 0 ? (
            <div className="col-span-full text-center py-12 bg-[#252526] rounded-xl border border-gray-800 border-dashed">
              <p className="text-gray-400 text-lg">В этом курсе пока нет уроков.</p>
              {user?.role === 'teacher' && <p className="text-sm mt-2 text-gray-500">Нажмите «Записать урок», чтобы добавить первый.</p>}
            </div>
          ) : (
            lessons.map((lesson, index) => (
              <div key={lesson.ID} className="bg-[#252526] border border-gray-800 rounded-xl p-6 flex flex-col hover:border-gray-600 transition-colors">
                <div className="flex items-center gap-3 mb-4 text-gray-400">
                  <span className="bg-gray-800 px-3 py-1 rounded-md text-sm font-bold">Урок {index + 1}</span>
                </div>
                <h3 className="text-xl font-bold mb-6 flex-1">{lesson.Title}</h3>
                <Link 
                  to={`/lesson/${lesson.ID}`} 
                  className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-lg font-medium transition-colors"
                >
                  <PlayCircle size={18} className="text-[#22c55e]" /> Смотреть
                </Link>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default CoursePage;