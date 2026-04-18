import React, { useState, useRef, useEffect, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { Play, Mic, SendHorizonal, MessageSquare, Pause, Terminal, Trash2, BookOpen, X, Maximize2, Minimize2, User, LogOut } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useParams, useNavigate } from 'react-router-dom';

const API_BASE = "http://localhost:8080";

function LessonPage() {
  const { id } = useParams(); // Достаем ID урока из адресной строки
  const navigate = useNavigate(); // Для кнопки "Назад"
  
  // --- АВТОРИЗАЦИЯ И РОЛИ ---
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [role, setRole] = useState(localStorage.getItem('role') || '');
  const [authMode, setAuthMode] = useState(null); // 'login', 'register' или null (скрыто)
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [regRole, setRegRole] = useState('student');
  const [authError, setAuthError] = useState('');

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

  // ИСПРАВЛЕНИЕ: Добавили id в зависимости, чтобы урок перезагружался при смене URL
  useEffect(() => {
    fetchLessons();
  }, [id]);

  // --- НОВЫЙ useEffect ДЛЯ ЗАГРУЗКИ АУДИО ---
  useEffect(() => {
    const audio = audioRef.current;
    if (audioUrl) {
      audio.src = audioUrl; // Присваиваем ссылку только один раз
      audio.load();         // Готовим плеер к воспроизведению
    }
  }, [audioUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    const setMeta = () => setDuration(audio.duration * 1000);
    audio.addEventListener('loadedmetadata', setMeta);
    return () => audio.removeEventListener('loadedmetadata', setMeta);
  }, [audioUrl]);

  // Глобальный слушатель пробела (Песочница)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Проверяем, что фокус не в инпуте и не в редакторе, иначе пробел не будет печататься
      if (e.code === 'Space' && 
          e.target.tagName !== 'INPUT' && 
          e.target.tagName !== 'TEXTAREA' &&
          !e.target.classList.contains('view-lines')) { 
        e.preventDefault(); // Чтобы страница не скроллилась вниз
        togglePlayback();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, audioUrl]); 

  // --- ЛОГИКА АВТОРИЗАЦИИ ---
  const handleAuth = async (isLogin) => {
    setAuthError('');
    const endpoint = isLogin ? '/login' : '/register';
    
    // Формируем тело запроса: при логине роль не отправляем, при регистрации - отправляем
    const bodyData = isLogin 
      ? { username, password } 
      : { username, password, role: regRole };

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      });
      
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Ошибка авторизации');
      
      if (isLogin) {
        setToken(data.token);
        setRole(data.role);
        localStorage.setItem('token', data.token);
        localStorage.setItem('role', data.role);
        setAuthMode(null);
      } else {
        // После успешной регистрации сразу логинимся
        handleAuth(true);
      }
      setUsername('');
      setPassword('');
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleLogout = () => {
    setToken('');
    setRole('');
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    setMessages([]); // Очищаем историю чата
  };

  // Хелпер для получения заголовков
  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  });

  // --- ЗАГРУЗКА И API ---
  const fetchLessons = async () => {
    try {
      // Ищем ID курса в адресной строке (?courseId=...)
      const params = new URLSearchParams(window.location.search);
      const courseId = params.get('courseId');

      // Если мы внутри курса, запрашиваем только его уроки. Иначе (вдруг) - все.
      const url = courseId 
        ? `${API_BASE}/courses/${courseId}/lessons` 
        : `${API_BASE}/lessons`;

      const res = await fetch(url);
      const data = await res.json();
      setLessons(data || []);

      if (id && id !== 'new' && data && data.length > 0) {
        const targetLesson = data.find(l => l.ID === parseInt(id));
        if (targetLesson) {
          loadLesson(targetLesson);
        }
      }
    } catch (err) { console.error("Ошибка загрузки", err); }
  };

  const runCode = async () => {
    if (!token) return setAuthMode('login'); // Требуем логин для запуска
    setOutput("Running...");
    try {
      const res = await fetch(`${API_BASE}/run`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      setOutput(data.output || data.error || "No output");
    } catch (err) { setOutput("Backend error. Check connection."); }
  };

  const sendChat = async () => {
    if (!token) return setAuthMode('login');
    if (!chatInput.trim()) return;
    
    const userMsg = chatInput;
    setMessages(prev => [...prev, { role: 'You', text: userMsg }]);
    setChatInput('');
    if (chatMode === 'hidden') setChatMode('side');

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ message: userMsg, code: code }),
      });
      if (res.status === 401) {
        handleLogout();
        throw new Error("Сессия истекла");
      }
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'AI', text: data.choices[0].message.content }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'AI', text: "Error: " + err.message }]);
    }
  };

  const handleCodeChange = (newVal) => {
    setCode(newVal);
    if (mode === 'recording') {
      const elapsed = Date.now() - startTimeRef.current;
      timelineRef.current.push({ time: elapsed, value: newVal });
    }
  };

  // --- ЗАПИСЬ (ТОЛЬКО ДЛЯ УЧИТЕЛЯ) ---
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
    } catch (err) { alert("Mic access denied!"); }
  };

  // ИСПРАВЛЕНИЕ: Добавили привязку к курсу при сохранении
  const saveToDB = async (audioBlob) => {
    const params = new URLSearchParams(window.location.search);
    const courseId = params.get('courseId');

    const formData = new FormData();
    formData.append("title", "Урок от " + new Date().toLocaleTimeString());
    formData.append("initial_code", timelineRef.current[0]?.value || code);
    formData.append("timeline", JSON.stringify(timelineRef.current));
    formData.append("audio", audioBlob);

    if (courseId) {
      formData.append("course_id", courseId);
    }

    try {
      const res = await fetch(`${API_BASE}/lessons`, { 
        method: 'POST', 
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData 
      });
      
      if (res.ok) {
        if (courseId) {
          navigate(`/course/${courseId}`); // Возвращаем в курс
        } else {
          fetchLessons();
        }
      }
    } catch (e) { console.error("Save error", e); }
  };

  // --- ВОСПРОИЗВЕДЕНИЕ ---
  const loadLesson = (lesson) => {
    let parsed = [];
    try {
      parsed = typeof lesson.Timeline === 'string' ? JSON.parse(atob(lesson.Timeline)) : lesson.Timeline;
    } catch(e) { parsed = lesson.Timeline; }
    
    timelineRef.current = parsed;
    setCode(lesson.InitialCode);
    setAudioUrl(`${API_BASE}${lesson.AudioURL}`);
    setCurrentTime(0);
    setMode('idle');
  };

  const syncCodeToTime = useCallback((timeMs) => {
    const pastEvents = timelineRef.current.filter(e => e.time <= timeMs);
    if (pastEvents.length > 0) {
      setCode(pastEvents[pastEvents.length - 1].value);
    }
  }, []);

  const togglePlayback = () => {
    const audio = audioRef.current;
    if (mode === 'playing') {
      audio.pause(); 
      setMode('idle'); 
      cancelAnimationFrame(playAnimationRef.current);
    } else {
      if (!audioUrl) return;

      // СИНХРОНИЗАЦИЯ: Откатываем код студента к оригинальному коду урока на ТЕКУЩЕЙ секунде
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
        console.error("Ошибка воспроизведения аудио:", err);
        setMode('idle');
      });
    }
  };

  let chatWidthStyle = '0px';
  if (chatMode === 'side') chatWidthStyle = '380px';
  if (chatMode === 'full') chatWidthStyle = '100%';

  return (
    <div style={styles.app}>
      
      {/* МОДАЛКА АВТОРИЗАЦИИ */}
      {authMode && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#00add8' }}>{authMode === 'login' ? 'Вход' : 'Регистрация'}</h2>
              <button onClick={() => setAuthMode(null)} style={styles.clearBtn}><X size={20}/></button>
            </div>
            {authError && <div style={{ color: '#ef4444', marginBottom: '15px', fontSize: '14px' }}>{authError}</div>}
            <input placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} style={styles.authInput} />
            <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} style={styles.authInput} />
            {authMode === 'register' && (
              <select 
                value={regRole} 
                onChange={e => setRegRole(e.target.value)} 
                style={{...styles.authInput, cursor: 'pointer', appearance: 'auto'}}
              >
                <option value="student">Я ученик (Student)</option>
                <option value="teacher">Я преподаватель (Teacher)</option>
              </select>
            )}
            <button onClick={() => handleAuth(authMode === 'login')} style={styles.authSubmitBtn}>
              {authMode === 'login' ? 'Войти' : 'Зарегистрироваться'}
            </button>
            <div style={{ marginTop: '15px', textAlign: 'center', fontSize: '13px', color: '#888' }}>
              {authMode === 'login' ? 'Нет аккаунта? ' : 'Уже есть аккаунт? '}
              <span onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} style={{ color: '#00add8', cursor: 'pointer' }}>
                {authMode === 'login' ? 'Создать' : 'Войти'}
              </span>
            </div>
          </div>
        </div>
      )}

      <header style={styles.header}>
      <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
          {/* Кнопка назад */}
          <button onClick={() => navigate('/')} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: '24px', paddingBottom: '3px' }}>
            ←
          </button>
          <div style={styles.logo}>Scrimba<span style={{color:'#00add8'}}>Go</span></div>
        </div>
        <div style={styles.controls}>
          <button onClick={runCode} style={styles.btnRun}><Play size={14}/> Run</button>
          
          {/* КНОПКА ЗАПИСИ ВИДНА ТОЛЬКО УЧИТЕЛЯМ */}
          {role === 'teacher' && (
            mode === 'recording' ? (
              <button onClick={() => mediaRecorderRef.current.stop()} style={styles.btnRecActive}>Stop Rec</button>
            ) : (
              <button onClick={startRecording} style={styles.btnRec}><Mic size={14}/> Record</button>
            )
          )}

          {audioUrl && (
            <button onClick={togglePlayback} style={mode === 'playing' ? styles.btnPause : styles.btnPlay}>
              {mode === 'playing' ? <Pause size={14}/> : <Play size={14}/>} {mode === 'playing' ? "Pause" : "Play Lesson"}
            </button>
          )}

          {/* БЛОК ПОЛЬЗОВАТЕЛЯ */}
          <div style={{ width: '1px', background: '#444', margin: '0 8px' }}></div>
          {token ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '13px', color: '#aaa', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <User size={14}/> {role}
              </span>
              <button onClick={handleLogout} style={styles.btnGhost}><LogOut size={16}/></button>
            </div>
          ) : (
            <button onClick={() => setAuthMode('login')} style={styles.btnLogin}>Log In</button>
          )}
        </div>
      </header>

      {audioUrl && (
        <div style={styles.timelineContainer}>
          <input type="range" min="0" max={duration || 0} value={currentTime} 
            onChange={(e) => {
              const ms = parseFloat(e.target.value);
              audioRef.current.currentTime = ms / 1000;
              setCurrentTime(ms);
              syncCodeToTime(ms);
            }} style={styles.slider} />
        </div>
      )}

      <main className="app-main" style={styles.main}>
        {/* Боковая панель скрывается, если это новый урок */}
        {id !== 'new' && (
          <aside className="library-aside" style={styles.library}>
            <div style={styles.libHead}><BookOpen size={14}/> LIBRARY</div>
            {lessons.map(l => (
              <div 
                key={l.ID} 
                // При клике меняем адресную строку, сохраняя привязку к курсу
                onClick={() => {
                  const params = new URLSearchParams(window.location.search);
                  const cId = params.get('courseId');
                  navigate(`/lesson/${l.ID}${cId ? `?courseId=${cId}` : ''}`);
                }} 
                style={{
                  ...styles.lessonCard, 
                  // Подсвечиваем урок, который открыт сейчас
                  border: parseInt(id) === l.ID ? '1px solid #00add8' : '1px solid #444',
                  background: parseInt(id) === l.ID ? '#2a2a2a' : '#333'
                }}
              >
                <div style={{fontWeight:'500'}}>{l.Title}</div>
                <div style={{fontSize:'10px', color:'#666'}}>{new Date(l.CreatedAt).toLocaleDateString()}</div>
              </div>
            ))}
          </aside>
        )}

        <div className="editor-area" style={{...styles.editorArea, display: chatMode === 'full' ? 'none' : 'flex'}}>
          <Editor 
            height="100%" 
            theme="vs-dark" 
            defaultLanguage="go" 
            value={code} 
            onChange={handleCodeChange}
            options={{ 
              readOnly: mode === 'playing', 
              minimap: { enabled: false }, 
              fontSize: 15,
              wordWrap: "on"
            }} 
          />
          <div style={styles.console}>
            <div style={styles.consoleHead}><Terminal size={12}/> CONSOLE</div>
            <pre style={styles.consoleText}>{output || "> Ready."}</pre>
            <button onClick={() => setOutput('')} style={styles.clearBtn}><Trash2 size={12}/></button>
          </div>
        </div>

        <div className={`chat-container chat-${chatMode}`} style={{...styles.chat, width: chatWidthStyle}}>
          <div style={styles.chatContent}>
            <div style={styles.chatHeader}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 'bold' }}>
                 <MessageSquare size={16} color="#00add8"/> AI Mentor
               </div>
               <div style={{ display: 'flex', gap: '5px' }}>
                 <button onClick={() => setChatMode(chatMode === 'full' ? 'side' : 'full')} style={styles.iconBtn}>
                   {chatMode === 'full' ? <Minimize2 size={16}/> : <Maximize2 size={16}/>}
                 </button>
                 <button onClick={() => setChatMode('hidden')} style={styles.iconBtn}>
                   <X size={16}/>
                 </button>
               </div>
            </div>

            <div style={styles.chatMsgs}>
              {messages.length === 0 && <div style={styles.emptyChat}>Ask your Go mentor...</div>}
              {messages.map((m, i) => (
                <div key={i} style={m.role === 'You' ? styles.msgYou : styles.msgAi}>
                  <div style={styles.roleLabel}>{m.role}</div>
                  <div className="markdown-body">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text}</ReactMarkdown>
                  </div>
                </div>
              ))}
            </div>
            <div style={styles.chatInputArea}>
              <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendChat()} placeholder="Ask Mentor..." style={styles.input} />
              <button onClick={sendChat} style={styles.btnSend}><SendHorizonal size={18}/></button>
            </div>
          </div>
        </div>

        {chatMode === 'hidden' && (
          <button onClick={() => setChatMode('side')} style={styles.floatBtn}>
            <MessageSquare size={22}/>
          </button>
        )}
      </main>

      <style>{`
        @keyframes blink { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } } 
        @media (max-width: 768px) {
          .app-main { flex-direction: column !important; }
          .library-aside { display: none !important; } 
          .chat-container { position: absolute; right: 0; top: 0; height: 100%; z-index: 100; box-shadow: -5px 0 15px rgba(0,0,0,0.5); }
          .chat-side { width: 85% !important; }
          .chat-full { width: 100% !important; }
        }
        .markdown-body { font-size: 14px; line-height: 1.6; color: #e1e1e1; word-wrap: break-word; }
        .markdown-body p { margin-bottom: 12px; }
        .markdown-body p:last-child { margin-bottom: 0; }
        .markdown-body pre { background: #181818; padding: 12px; border-radius: 8px; border: 1px solid #333; overflow-x: auto; margin: 12px 0; }
        .markdown-body code { font-family: 'Consolas', monospace; background: #2a2a2a; padding: 2px 6px; border-radius: 4px; color: #569cd6; font-size: 13px; }
        .markdown-body pre code { background: transparent; padding: 0; color: #dcdcaa; }
        .markdown-body strong { color: #fff; font-weight: 600; }
      `}</style>
    </div>
  );
}

const styles = {
  app: { height: '100vh', display: 'flex', flexDirection: 'column', background: '#1e1e1e', color: 'white', fontFamily: 'system-ui, -apple-system, sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', padding: '10px 20px', background: '#252526', borderBottom: '1px solid #333', alignItems: 'center' },
  logo: { fontSize: '18px', fontWeight: 'bold' },
  controls: { display: 'flex', gap: '8px' },
  timelineContainer: { display: 'flex', alignItems: 'center', padding: '8px 20px', background: '#2d2d2d', borderBottom: '1px solid #3c3c3c' },
  slider: { flex: 1, cursor: 'pointer', accentColor: '#00add8' },
  main: { flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' },
  library: { width: '220px', background: '#252526', borderRight: '1px solid #333', padding: '15px', overflowY: 'auto', flexShrink: 0 },
  libHead: { fontSize: '11px', color: '#888', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold', letterSpacing: '0.5px' },
  lessonCard: { padding: '10px', background: '#333', borderRadius: '6px', marginBottom: '8px', cursor: 'pointer', border: '1px solid #444', fontSize: '13px', transition: 'background 0.2s' },
  editorArea: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
  console: { height: '30%', background: '#0f0f0f', padding: '12px', overflowY: 'auto', borderTop: '1px solid #333', position: 'relative' },
  consoleHead: { fontSize: '11px', color: '#666', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold' },
  consoleText: { color: '#4ade80', fontSize: '13px', margin: 0, fontFamily: 'Consolas, monospace', whiteSpace: 'pre-wrap' },
  clearBtn: { position: 'absolute', top: '10px', right: '10px', background: 'transparent', border: 'none', color: '#555', cursor: 'pointer' },
  chat: { background: '#252526', borderLeft: '1px solid #333', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', overflow: 'hidden', zIndex: 10 },
  chatContent: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', minWidth: '300px' },
  chatHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 15px', background: '#1e1e1e', borderBottom: '1px solid #333' },
  iconBtn: { background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', borderRadius: '4px' },
  chatMsgs: { flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '15px' },
  emptyChat: { color: '#666', textAlign: 'center', marginTop: '50%', fontSize: '14px' },
  chatInputArea: { padding: '15px', display: 'flex', gap: '10px', background: '#1e1e1e', borderTop: '1px solid #333' },
  input: { flex: 1, background: '#333', border: '1px solid #444', color: 'white', padding: '12px', borderRadius: '6px', outline: 'none', fontSize: '14px' },
  btnSend: { background: '#00add8', border: 'none', color: 'white', padding: '10px 14px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  floatBtn: { position: 'absolute', bottom: '25px', right: '25px', width: '50px', height: '50px', borderRadius: '50%', background: '#00add8', border: 'none', color: 'white', cursor: 'pointer', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' },
  btnRun: { background: '#22c55e', border: 'none', color: 'white', padding: '6px 14px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '500' },
  btnRec: { background: '#ef4444', border: 'none', color: 'white', padding: '6px 14px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '500' },
  btnRecActive: { background: '#f59e0b', border: 'none', color: 'black', padding: '6px 14px', borderRadius: '4px', cursor: 'pointer', animation: 'blink 1.5s infinite', fontWeight: 'bold' },
  btnPlay: { background: '#00add8', border: 'none', color: 'white', padding: '6px 14px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '500' },
  btnPause: { background: '#444', border: 'none', color: 'white', padding: '6px 14px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '500' },
  btnLogin: { background: '#333', border: '1px solid #555', color: 'white', padding: '6px 14px', borderRadius: '4px', cursor: 'pointer', fontWeight: '500' },
  btnGhost: { background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer', display: 'flex', alignItems: 'center' },
  msgYou: { background: '#00add8', padding: '12px 15px', borderRadius: '12px 12px 0 12px', alignSelf: 'flex-end', maxWidth: '85%', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' },
  msgAi: { background: '#2d2d2d', padding: '12px 15px', borderRadius: '12px 12px 12px 0', alignSelf: 'flex-start', maxWidth: '90%', border: '1px solid #3c3c3c', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' },
  roleLabel: { fontSize: '10px', fontWeight: 'bold', color: '#aaa', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  
  // Стили для модального окна авторизации
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)' },
  modal: { background: '#252526', padding: '30px', borderRadius: '12px', width: '350px', border: '1px solid #3c3c3c', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column' },
  authInput: { background: '#1e1e1e', border: '1px solid #444', color: 'white', padding: '12px', borderRadius: '6px', marginBottom: '15px', outline: 'none', fontSize: '14px' },
  authSubmitBtn: { background: '#00add8', border: 'none', color: 'white', padding: '12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px', marginTop: '5px' }
};

export default LessonPage;