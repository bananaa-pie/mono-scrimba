import React, { useState, useRef, useEffect, useCallback, useContext } from 'react';
import Editor from '@monaco-editor/react';
import { Play, Mic, SendHorizonal, MessageSquare, Pause, Terminal, Trash2, BookOpen, X, Maximize2, Minimize2, User, LogOut, ArrowLeft } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useParams, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../api';
import toast from 'react-hot-toast';

import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'; // Тёмная тема в стиле VS Code


function LessonPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // --- АВТОРИЗАЦИЯ ИЗ КОНТЕКСТА ---
  const { user, login, logout } = useContext(AuthContext);
  const [authMode, setAuthMode] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [regRole, setRegRole] = useState('student');

  // --- ОСНОВНЫЕ СОСТОЯНИЯ ---
  const [mode, setMode] = useState('idle'); 
  const [code, setCode] = useState('package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("Hello, ScrimbaGo!")\n}');
  const [output, setOutput] = useState('');
  const [chatMode, setChatMode] = useState('hidden'); 
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  
  const [currentTime, setCurrentTime] = useState(0); 
  const [duration, setDuration] = useState(0); 
  const [audioUrl, setAudioUrl] = useState(null);
  const [lessons, setLessons] = useState([]);

  // --- РЕФЫ ---
  const timelineRef = useRef([]); 
  const startTimeRef = useRef(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioRef = useRef(new Audio());
  const playAnimationRef = useRef(null);

  useEffect(() => {
    fetchLessons();
  }, [id]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audioUrl) {
      audio.src = audioUrl;
      audio.load();
    }
  }, [audioUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    const setMeta = () => setDuration(audio.duration * 1000);
    audio.addEventListener('loadedmetadata', setMeta);
    return () => audio.removeEventListener('loadedmetadata', setMeta);
  }, [audioUrl]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' && 
          e.target.tagName !== 'INPUT' && 
          e.target.tagName !== 'TEXTAREA' &&
          !e.target.classList.contains('view-lines')) { 
        e.preventDefault();
        togglePlayback();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, audioUrl]); 

  // Защита маршрута создания урока
  useEffect(() => {
    if (id === 'new' && (!user || user.role !== 'teacher')) {
      toast.error("Доступ запрещен: только для преподавателей");
      navigate('/');
    }
  }, [id, user, navigate]);

  // --- ЛОГИКА АВТОРИЗАЦИИ ЧЕРЕЗ AXIOS ---
  const handleAuth = async (isLogin) => {
    const endpoint = isLogin ? '/login' : '/register';
    const bodyData = isLogin ? { username, password } : { username, password, role: regRole };

    try {
      const res = await api.post(endpoint, bodyData);
      if (isLogin) {
        login(res.data.token, res.data.role); // Используем метод из контекста
        setAuthMode(null);
        toast.success("Успешный вход!");
      } else {
        handleAuth(true);
      }
      setUsername('');
      setPassword('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Ошибка авторизации');
    }
  };

  const handleLogout = () => {
    logout();
    setMessages([]);
    toast.success("Вы вышли из системы");
  };

  // --- ЗАГРУЗКА И API ЧЕРЕЗ AXIOS ---
  const fetchLessons = async () => {
    try {
      const res = await api.get('/lessons');
      const allLessons = res.data || [];

      if (id && id !== 'new') {
        const targetLesson = allLessons.find(l => l.ID === parseInt(id));
        if (targetLesson) {
          // Фильтруем: оставляем только уроки текущего курса
          const courseLessons = allLessons.filter(l => l.CourseID === targetLesson.CourseID);
          setLessons(courseLessons);
          loadLesson(targetLesson);
        }
      } else {
        setLessons(allLessons);
      }
    } catch (err) { toast.error("Ошибка загрузки уроков"); }
  };

  const runCode = async () => {
    if (!user) return setAuthMode('login');
    setOutput("Running...");
    try {
      const res = await api.post('/run', { code });
      const resultText = res.data.output || res.data.error || "No output";
      setOutput(resultText);
      
      if (mode === 'recording') {
        const elapsed = Date.now() - startTimeRef.current;
        timelineRef.current.push({ time: elapsed, type: 'output', value: resultText });
      }
    } catch (err) { setOutput("Backend error."); }
  };

  const sendChat = async () => {
    if (!user) return setAuthMode('login');
    if (!chatInput.trim()) return;
    
    const userMsg = chatInput;
    setMessages(prev => [...prev, { role: 'You', text: userMsg }]);
    setChatInput('');
    if (chatMode === 'hidden') setChatMode('side');

    try {
      const res = await api.post('/chat', { message: userMsg, code: code });
      
      if (res.data && res.data.choices && res.data.choices.length > 0) {
        setMessages(prev => [...prev, { role: 'AI', text: res.data.choices[0].message.content }]);
      } else if (res.data && res.data.error) {
        // РАСПАКОВЫВАЕМ ОБЪЕКТ ОШИБКИ
        const errorData = res.data.error;
        const errorText = typeof errorData === 'object' ? (errorData.message || JSON.stringify(errorData)) : errorData;
        setMessages(prev => [...prev, { role: 'AI', text: `⚠️ Ошибка API: ${errorText}` }]);
      } else {
        setMessages(prev => [...prev, { role: 'AI', text: `⚠️ Неизвестный ответ: ${JSON.stringify(res.data)}` }]);
      }

    } catch (err) {
      if (err.response?.status === 401) {
        handleLogout();
        toast.error("Сессия истекла");
      } else {
        setMessages(prev => [...prev, { role: 'AI', text: "Error: " + err.message }]);
      }
    }
  };

  const handleCodeChange = (newVal) => {
    setCode(newVal);
    if (mode === 'recording') {
      const elapsed = Date.now() - startTimeRef.current;
      timelineRef.current.push({ time: elapsed, type: 'code', value: newVal });
    }
  };

  const startRecording = async () => {
    timelineRef.current = [{ time: 0, value: code }];
    audioChunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      mediaRecorderRef.current.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioUrl(URL.createObjectURL(blob));
        await saveToDB(blob);
      };
      startTimeRef.current = Date.now();
      mediaRecorderRef.current.start();
      setMode('recording');
      toast.success("Запись начата");
    } catch (err) { toast.error("Нет доступа к микрофону!"); }
  };

  const saveToDB = async (audioBlob) => {
    const params = new URLSearchParams(window.location.search);
    const courseId = params.get('courseId');

    const formData = new FormData();
    formData.append("title", "Урок от " + new Date().toLocaleTimeString());
    formData.append("initial_code", timelineRef.current[0]?.value || code);
    formData.append("timeline", JSON.stringify(timelineRef.current));
    formData.append("audio", audioBlob);
    if (courseId) formData.append("course_id", courseId);

    try {
      const res = await api.post('/lessons', formData, {
        headers: { 'Content-Type': 'multipart/form-data' } // Axios сам добавит boundary
      });
      toast.success("Урок успешно сохранен!");
      if (courseId) {
        navigate(`/course/${courseId}`);
      } else {
        fetchLessons();
      }
    } catch (e) { 
      toast.error("Ошибка сохранения урока"); 
    }
  };

  const loadLesson = (lesson) => {
    let parsed = [];
    try {
      if (typeof lesson.Timeline === 'string') {
        // Умная расшифровка Base64, которая не ломает русский язык
        const decodedString = decodeURIComponent(escape(window.atob(lesson.Timeline)));
        parsed = JSON.parse(decodedString);
      } else {
        parsed = lesson.Timeline;
      }
    } catch(e) { 
      parsed = lesson.Timeline || []; 
    }
    
    timelineRef.current = parsed;
    setCode(lesson.InitialCode);

    // ЗДЕСЬ ИСПРАВЛЕНИЕ: Мы берем готовую ссылку на Supabase Storage
    // которую нам вернула база данных, без добавления api.defaults.baseURL
    setAudioUrl(lesson.AudioURL);
    
    setCurrentTime(0);
    setMode('idle');
  };

  const syncCodeToTime = useCallback((timeMs) => {
    const pastEvents = timelineRef.current.filter(e => e.time <= timeMs);
    if (pastEvents.length > 0) {
      // Ищем последнее изменение кода
      const codeEvents = pastEvents.filter(e => !e.type || e.type === 'code');
      if (codeEvents.length > 0) setCode(codeEvents[codeEvents.length - 1].value);
      
      // Ищем последний вывод в консоль
      const outputEvents = pastEvents.filter(e => e.type === 'output');
      if (outputEvents.length > 0) setOutput(outputEvents[outputEvents.length - 1].value);
      else setOutput('');
    } else {
      setOutput('');
    }
  }, []);

  const deleteLesson = async (lessonId) => {
  if (!window.confirm("Удалить этот урок навсегда?")) return;
  
  try {
    await api.delete(`/lessons/${lessonId}`);
    toast.success("Урок удален");
    
    // Если удалили тот урок, на котором сидим — уходим на главную
    if (parseInt(id) === lessonId) {
      navigate('/');
    } else {
      fetchLessons(); // Обновляем список в боковой панели
    }
  } catch (err) {
    toast.error("Не удалось удалить урок");
  }
};

  const togglePlayback = () => {
    const audio = audioRef.current;
    if (mode === 'playing') {
      audio.pause(); 
      setMode('idle'); 
      cancelAnimationFrame(playAnimationRef.current);
    } else {
      if (!audioUrl) return;
      syncCodeToTime(audio.currentTime * 1000);

      audio.play().then(() => {
        setMode('playing');
        const updateLoop = () => {
          const ms = audio.currentTime * 1000;
          setCurrentTime(ms);
          syncCodeToTime(ms);
          if (!audio.ended) { 
            playAnimationRef.current = requestAnimationFrame(updateLoop); 
          } else { 
            setMode('idle'); 
          }
        };
        playAnimationRef.current = requestAnimationFrame(updateLoop);
      }).catch(err => {
        toast.error("Ошибка воспроизведения аудио");
        setMode('idle');
      });
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#1e1e1e] text-white font-sans">
      
      {/* МОДАЛКА АВТОРИЗАЦИИ */}
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

      {/* ШАПКА */}
      <header className="flex justify-between px-5 py-3 bg-[#252526] border-b border-[#333] items-center">
        <div className="flex items-center gap-4">
          <button onClick={() => {
    const cId = new URLSearchParams(window.location.search).get('courseId');
    navigate(cId ? `/course/${cId}` : '/');
  }} className="text-gray-400 hover:text-white transition-colors">
            <ArrowLeft size={24} />
          </button>
          <div className="text-lg font-bold">Scrimba<span className="text-[#00add8]">Go</span></div>
        </div>
        <div className="flex gap-2 items-center">
          <button onClick={runCode} className="bg-green-500 hover:bg-green-600 text-white px-4 py-1.5 rounded flex items-center gap-2 font-medium transition-colors"><Play size={14}/> Run</button>
          
          {user?.role === 'teacher' && (
            mode === 'recording' ? (
              <button onClick={() => mediaRecorderRef.current.stop()} className="bg-amber-500 text-black px-4 py-1.5 rounded flex items-center gap-2 font-bold animate-pulse">Stop Rec</button>
            ) : (
              <button onClick={startRecording} className="bg-red-500 hover:bg-red-600 text-white px-4 py-1.5 rounded flex items-center gap-2 font-medium transition-colors"><Mic size={14}/> Record</button>
            )
          )}

          {audioUrl && (
            <button onClick={togglePlayback} className={`px-4 py-1.5 rounded flex items-center gap-2 font-medium transition-colors ${mode === 'playing' ? 'bg-gray-600 hover:bg-gray-700' : 'bg-[#00add8] hover:bg-[#008db1] text-white'}`}>
              {mode === 'playing' ? <Pause size={14}/> : <Play size={14}/>} {mode === 'playing' ? "Pause" : "Play Lesson"}
            </button>
          )}

          <div className="w-px h-6 bg-[#444] mx-2"></div>
          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-[13px] text-gray-400 flex items-center gap-1"><User size={14}/> {user.role}</span>
              <button onClick={handleLogout} className="text-gray-400 hover:text-white transition-colors"><LogOut size={16}/></button>
            </div>
          ) : (
            <button onClick={() => setAuthMode('login')} className="border border-gray-500 hover:border-gray-400 text-white px-4 py-1.5 rounded font-medium transition-colors">Log In</button>
          )}
        </div>
      </header>

      {/* ТАЙМЛАЙН */}
      {audioUrl && (
        <div className="flex items-center px-5 py-2 bg-[#2d2d2d] border-b border-[#3c3c3c]">
          <input type="range" min="0" max={duration || 0} value={currentTime} 
            onChange={(e) => {
              const ms = parseFloat(e.target.value);
              audioRef.current.currentTime = ms / 1000;
              setCurrentTime(ms);
              syncCodeToTime(ms);
            }} 
            className="flex-1 cursor-pointer accent-[#00add8]" 
          />
        </div>
      )}

      {/* ОСТАЛЬНАЯ ЧАСТЬ ЭКРАНА */}
      <main className="flex-1 flex relative overflow-hidden">
        {/* БОКОВАЯ ПАНЕЛЬ */}
        {id !== 'new' && (
          <aside className="w-[220px] bg-[#252526] border-r border-[#333] p-4 overflow-y-auto shrink-0 hidden md:block">
            <div className="text-[11px] text-gray-500 mb-3 flex items-center gap-1 font-bold tracking-wider"><BookOpen size={14}/> УРОКИ КУРСА</div>
            {lessons.map(l => (
              <div 
                key={l.ID} 
                onClick={() => {
                  const params = new URLSearchParams(window.location.search);
                  const cId = params.get('courseId');
                  navigate(`/lesson/${l.ID}${cId ? `?courseId=${cId}` : ''}`);
                }} 
                className={`p-3 rounded-md mb-2 cursor-pointer border text-[13px] transition-colors relative group ${(id !== 'new' && parseInt(id) === l.ID) ? 'border-[#00add8] bg-[#2a2a2a]' : 'border-[#444] bg-[#333] hover:bg-[#3a3a3a]'}`}
              >
                <div className="font-medium">{l.Title}</div>
                <div className="text-[10px] text-gray-400 mt-1">{new Date(l.CreatedAt).toLocaleDateString()}</div>
              </div>
            ))}
          </aside>
        )}

        {/* РЕДАКТОР КОДА */}
        <div className={`flex-1 flex flex-col min-w-0 ${chatMode === 'full' ? 'hidden' : 'flex'}`}>
          <Editor 
            height="100%" 
            theme="vs-dark" 
            defaultLanguage="go" 
            value={code} 
            onChange={handleCodeChange}
            options={{ readOnly: mode === 'playing', minimap: { enabled: false }, fontSize: 15, wordWrap: "on" }} 
          />
          {/* КОНСОЛЬ */}
          <div className="h-[30%] bg-[#0f0f0f] p-3 overflow-y-auto border-t border-[#333] relative group">
            <div className="text-[11px] text-gray-500 mb-2 flex items-center gap-1 font-bold"><Terminal size={12}/> КОНСОЛЬ</div>
            <pre className="text-[#4ade80] text-[13px] m-0 font-mono whitespace-pre-wrap">{output || "> Ready."}</pre>
            <button onClick={() => setOutput('')} className="absolute top-3 right-3 text-gray-600 hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14}/></button>
          </div>
        </div>

        {/* ЧАТ С ИИ */}
        <div className={`bg-[#252526] border-l border-[#333] transition-all duration-300 overflow-hidden z-10 absolute md:relative right-0 top-0 h-full shadow-[-5px_0_15px_rgba(0,0,0,0.5)] md:shadow-none ${chatMode === 'hidden' ? 'w-0 border-none' : chatMode === 'full' ? 'w-full' : 'w-[85%] md:w-[380px]'}`}>
          <div className="w-full h-full flex flex-col min-w-[300px]">
            <div className="flex justify-between items-center p-3 bg-[#1e1e1e] border-b border-[#333]">
               <div className="flex items-center gap-2 text-[13px] font-bold"><MessageSquare size={16} className="text-[#00add8]"/> ИИ Ментор</div>
               <div className="flex gap-1">
                 <button onClick={() => setChatMode(chatMode === 'full' ? 'side' : 'full')} className="text-gray-500 hover:text-white p-1"><Maximize2 size={16}/></button>
                 <button onClick={() => setChatMode('hidden')} className="text-gray-500 hover:text-white p-1"><X size={16}/></button>
               </div>
            </div>

            <div className="flex-1 p-5 overflow-y-auto flex flex-col gap-4">
              {messages.length === 0 && <div className="text-gray-500 text-center mt-20 text-sm">Спроси ментора о коде...</div>}
              {messages.map((m, i) => (
                <div key={i} className={`p-3 rounded-xl max-w-[90%] shadow-md ${m.role === 'You' ? 'bg-[#00add8] rounded-tr-none self-end' : 'bg-[#2d2d2d] border border-[#3c3c3c] rounded-tl-none self-start'}`}>
                  <div className="text-[10px] font-bold text-gray-300 mb-1 uppercase tracking-wider opacity-70">{m.role}</div>
                  <div className="text-sm leading-relaxed text-gray-100 prose prose-invert prose-p:my-1 prose-pre:bg-[#181818] prose-pre:border prose-pre:border-[#333] prose-pre:p-3 prose-pre:rounded-lg">
                    <ReactMarkdown 
  remarkPlugins={[remarkGfm]}
  components={{
    code({node, inline, className, children, ...props}) {
      const match = /language-(\w+)/.exec(className || '');
      return !inline && match ? (
        <SyntaxHighlighter
          {...props}
          children={String(children).replace(/\n$/, '')}
          style={vscDarkPlus}
          language={match[1]}
          PreTag="div"
          customStyle={{ margin: 0, borderRadius: '8px', fontSize: '13px' }}
        />
      ) : (
        <code {...props} className="bg-[#2a2a2a] text-[#569cd6] px-1.5 py-0.5 rounded text-[13px] font-mono">
          {children}
        </code>
      )
    }
  }}
>
  {m.text}
</ReactMarkdown>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 flex gap-2 bg-[#1e1e1e] border-t border-[#333]">
              <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChat()} placeholder="Задать вопрос..." className="flex-1 bg-[#333] border border-[#444] text-white p-3 rounded-lg outline-none text-sm focus:border-[#00add8] transition-colors" />
              <button onClick={sendChat} className="bg-[#00add8] hover:bg-[#008db1] text-white px-4 rounded-lg flex items-center justify-center transition-colors"><SendHorizonal size={18}/></button>
            </div>
          </div>
        </div>

        {/* ПЛАВАЮЩАЯ КНОПКА ЧАТА */}
        {chatMode === 'hidden' && (
          <button onClick={() => setChatMode('side')} className="absolute bottom-6 right-6 w-12 h-12 rounded-full bg-[#00add8] hover:bg-[#008db1] text-white z-10 flex items-center justify-center shadow-lg shadow-[#00add8]/30 transition-transform active:scale-95">
            <MessageSquare size={22}/>
          </button>
        )}
      </main>
    </div>
  );
}

export default LessonPage;