import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { Plus, User, Folder, X, Loader2, Trash2, LogOut } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import api from '../api';
import toast from 'react-hot-toast';

function HomePage() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newCourse, setNewCourse] = useState({ title: '', description: '' });
  
  // --- ДОБАВИЛИ АВТОРИЗАЦИЮ ИЗ КОНТЕКСТА ---
  const { user, login, logout } = useContext(AuthContext);
  const [authMode, setAuthMode] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [regRole, setRegRole] = useState('student');

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
      const errorMsg = err.response?.data || err.message || "Неизвестная ошибка";
      toast.error(`Ошибка: ${errorMsg}`);
    }
  };

  const deleteCourse = async (e, courseId) => {
    e.preventDefault(); 
    if (!window.confirm("Удалить курс и ВСЕ его уроки навсегда?")) return;
    
    try {
      await api.delete(`/courses/${courseId}`);
      toast.success("Курс успешно удален");
      fetchCourses();
    } catch (err) {
      toast.error("Ошибка при удалении курса");
    }
  };

  // --- ЛОГИКА АВТОРИЗАЦИИ (КАК В УРОКЕ) ---
  const handleAuth = async (isLogin) => {
    const endpoint = isLogin ? '/login' : '/register';
    const bodyData = isLogin ? { username, password } : { username, password, role: regRole };

    try {
      const res = await api.post(endpoint, bodyData);
      if (isLogin) {
        login(res.data.token, res.data.role);
        setAuthMode(null);
        toast.success("Успешный вход!");
      } else {
        handleAuth(true); // Авто-логин после регистрации
      }
      setUsername('');
      setPassword('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Ошибка авторизации');
    }
  };

  const handleLogout = () => {
    logout();
    toast.success("Вы вышли из системы");
  };

  return (
    <div className="p-10 min-h-screen">
      
      {/* --- МОДАЛКА АВТОРИЗАЦИИ --- */}
      {authMode && (
        <div className="fixed inset-0 bg-black/70 z-[999] flex items-center justify-center backdrop-blur-sm">
          <div className="bg-[#252526] p-8 rounded-xl w-[350px] border border-[#3c3c3c] shadow-2xl flex flex-col">
            <div className="flex justify-between mb-5">
              <h2 className="m-0 text-[#00add8] text-xl font-bold">{authMode === 'login' ? 'Вход' : 'Регистрация'}</h2>
              <button onClick={() => setAuthMode(null)} className="text-gray-500 hover:text-white"><X size={20}/></button>
            </div>
            <input className="bg-[#1e1e1e] border border-[#444] text-white p-3 rounded-md mb-4 outline-none focus:border-[#00add8]" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
            <input className="bg-[#1e1e1e] border border-[#444] text-white p-3 rounded-md mb-4 outline-none focus:border-[#00add8]" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
            {authMode === 'register' && (
              <select className="bg-[#1e1e1e] border border-[#444] text-white p-3 rounded-md mb-4 outline-none cursor-pointer" value={regRole} onChange={e => setRegRole(e.target.value)}>
                <option value="student">Я ученик (Student)</option>
                <option value="teacher">Я преподаватель (Teacher)</option>
              </select>
            )}
            <button onClick={() => handleAuth(authMode === 'login')} className="bg-[#00add8] text-white p-3 rounded-md font-bold mt-2 hover:bg-[#008db1] transition-colors">
              {authMode === 'login' ? 'Войти' : 'Зарегистрироваться'}
            </button>
            <div className="mt-4 text-center text-[13px] text-gray-400">
              {authMode === 'login' ? 'Нет аккаунта? ' : 'Уже есть аккаунт? '}
              <span onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="text-[#00add8] cursor-pointer hover:underline">
                {authMode === 'login' ? 'Создать' : 'Войти'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* МОДАЛЬНОЕ ОКНО СОЗДАНИЯ КУРСА */}
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
        
        {/* --- ОБНОВЛЕННЫЙ БЛОК ПОЛЬЗОВАТЕЛЯ --- */}
        {user ? (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-gray-800/50 px-4 py-2 rounded-full border border-gray-700">
              <User size={18} className="text-[#00add8]"/>
              <span className="text-gray-300 font-medium text-sm">
                {user.role === 'teacher' ? 'Преподаватель' : 'Студент'}
              </span>
            </div>
            <button onClick={handleLogout} className="text-gray-500 hover:text-white transition-colors p-2" title="Выйти">
              <LogOut size={20} />
            </button>
          </div>
        ) : (
          <button 
            onClick={() => setAuthMode('login')} 
            className="bg-[#00add8] hover:bg-[#008db1] text-white px-6 py-2.5 rounded-full font-bold transition-all shadow-lg shadow-[#00add8]/20 active:scale-95"
          >
            Войти
          </button>
        )}
      </header>

      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold flex items-center gap-3"><Folder className="text-[#00add8]"/> Наши курсы</h2>
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
                  <div className="flex gap-2 items-center">
                    {user?.role === 'teacher' && (
                      <button onClick={(e) => deleteCourse(e, course.ID)} className="text-gray-500 hover:text-red-500 bg-[#1e1e1e] hover:bg-red-500/10 p-2 rounded-lg transition-colors">
                        <Trash2 size={18} />
                      </button>
                    )}
                    <Link to={`/course/${course.ID}`} className="bg-[#00add8] hover:bg-[#008db1] px-6 py-2 rounded-lg text-sm font-bold transition-all active:scale-95">
                      Открыть
                    </Link>
                  </div>
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