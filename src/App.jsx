import React, { useState, useRef, useEffect } from 'react';
import { Bot, AlertCircle, Sparkles, Plus, MessageSquare, Trash2, Sun, Moon, Menu, X } from 'lucide-react';

function App() {
  // Theme
  const [theme, setTheme] = useState(() => localStorage.getItem('chatTheme') || 'dark');

  // Chat history: array of { id, title, messages }
  const [chatHistory, setChatHistory] = useState(() => {
    const saved = localStorage.getItem('chatHistory');
    return saved ? JSON.parse(saved) : [{ id: Date.now(), title: 'New Chat', messages: [] }];
  });
  const [activeChatId, setActiveChatId] = useState(() => {
    const saved = localStorage.getItem('chatHistory');
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.length > 0 ? parsed[0].id : Date.now();
    }
    return Date.now();
  });

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  const FIXED_MODEL = 'Qwen/Qwen2.5-1.5B-Instruct:featherless-ai';
  const hfKey = import.meta.env.VITE_HF_TOKEN || '';

  const messagesEndRef = useRef(null);

  // Get active chat
  const activeChat = chatHistory.find(c => c.id === activeChatId) || chatHistory[0];
  const messages = activeChat?.messages || [];

  // Persist
  useEffect(() => {
    localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
  }, [chatHistory]);

  useEffect(() => {
    localStorage.setItem('chatTheme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // API
  async function query(data) {
    const response = await fetch(
      "https://router.huggingface.co/v1/chat/completions",
      {
        headers: {
          Authorization: `Bearer ${hfKey}`,
          "Content-Type": "application/json",
        },
        method: "POST",
        body: JSON.stringify(data),
      }
    );
    return await response.json();
  }

  async function generateImage(prompt) {
    const response = await fetch(
      "https://router.huggingface.co/hf-inference/models/stabilityai/stable-diffusion-xl-base-1.0",
      {
        headers: {
          Authorization: `Bearer ${hfKey}`,
          "Content-Type": "application/json",
        },
        method: "POST",
        body: JSON.stringify({ inputs: prompt }),
      }
    );
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Image generation failed (Status: ${response.status})`);
    }
    return await response.blob();
  }

  const getTime = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const updateMessages = (chatId, newMessages) => {
    setChatHistory(prev => prev.map(c =>
      c.id === chatId
        ? { ...c, messages: newMessages, title: c.title === 'New Chat' && newMessages.length > 0
            ? newMessages.find(m => m.role === 'user')?.content.slice(0, 30) || c.title
            : c.title }
        : c
    ));
  };

  const handleSendText = async (e) => {
    e?.preventDefault();
    if (!input.trim()) return;
    if (!hfKey) {
      alert('API Key missing. Please ensure VITE_HF_TOKEN is set in your .env file.');
      return;
    }

    const userMessage = { role: 'user', content: input, type: 'text', time: getTime() };
    const newMessages = [...messages, userMessage];

    updateMessages(activeChatId, newMessages);
    setInput('');
    setIsTyping(true);

    try {
      const apiMessages = newMessages
        .filter(m => m.type === 'text')
        .map(m => ({ role: m.role === 'bot' ? 'assistant' : 'user', content: m.content }));

      const result = await query({ model: FIXED_MODEL, messages: apiMessages, max_tokens: 500 });
      if (result.error) throw new Error(result.error.message || 'API Error');

      const botReply = result.choices[0].message.content;
      updateMessages(activeChatId, [...newMessages, { role: 'bot', content: botReply, type: 'text', time: getTime() }]);
    } catch (error) {
      console.error('Text Generation Error:', error);
      updateMessages(activeChatId, [...newMessages, { role: 'bot', content: error.message, type: 'error', time: getTime() }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!input.trim()) return;
    if (!hfKey) {
      alert('API Token missing. Please ensure VITE_HF_TOKEN is set in your .env file.');
      return;
    }

    const userMessage = { role: 'user', content: `🖼️ ${input}`, type: 'text', time: getTime() };
    const newMessages = [...messages, userMessage];
    updateMessages(activeChatId, newMessages);

    const prompt = input;
    setInput('');
    setIsTyping(true);

    try {
      const blob = await generateImage(prompt);
      const imageUrl = URL.createObjectURL(blob);
      updateMessages(activeChatId, [...newMessages, { role: 'bot', content: imageUrl, type: 'image', time: getTime() }]);
    } catch (error) {
      console.error('Image Generation Error:', error);
      updateMessages(activeChatId, [...newMessages, {
        role: 'bot',
        content: `${error.message}. The model may be loading — please retry in a moment.`,
        type: 'error', time: getTime()
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  const createNewChat = () => {
    const newChat = { id: Date.now(), title: 'New Chat', messages: [] };
    setChatHistory(prev => [newChat, ...prev]);
    setActiveChatId(newChat.id);
  };

  const deleteChat = (chatId, e) => {
    e.stopPropagation();
    const filtered = chatHistory.filter(c => c.id !== chatId);
    if (filtered.length === 0) {
      const newChat = { id: Date.now(), title: 'New Chat', messages: [] };
      setChatHistory([newChat]);
      setActiveChatId(newChat.id);
    } else {
      setChatHistory(filtered);
      if (activeChatId === chatId) setActiveChatId(filtered[0].id);
    }
  };

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  return (
    <div className={`app-container ${theme}`} data-theme={theme}>
      {/* Sidebar */}
      <div className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <h2>Chats</h2>
          <div className="sidebar-actions">
            <button className="icon-btn" onClick={toggleTheme} title="Toggle theme">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button className="icon-btn" onClick={createNewChat} title="New chat">
              <Plus size={18} />
            </button>
            <button className="icon-btn sidebar-close" onClick={() => setSidebarOpen(false)} title="Close sidebar">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="chat-list">
          {chatHistory.map(chat => (
            <div
              key={chat.id}
              className={`chat-item ${chat.id === activeChatId ? 'active' : ''}`}
              onClick={() => setActiveChatId(chat.id)}
            >
              <MessageSquare size={16} />
              <span className="chat-item-title">{chat.title}</span>
              <span className="chat-item-count">{chat.messages.filter(m => m.role === 'user').length}</span>
              <button className="delete-btn" onClick={(e) => deleteChat(chat.id, e)} title="Delete chat">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat */}
      <div className="chat-area">
        {/* Header */}
        <div className="chat-header">
          <div className="header-left">
            {!sidebarOpen && (
              <button className="icon-btn" onClick={() => setSidebarOpen(true)} title="Open sidebar">
                <Menu size={20} />
              </button>
            )}
            <div className="header-avatar">
              <Sparkles size={20} />
            </div>
            <div className="header-info">
              <h1>AI CHATBOT</h1>
              <span className="status-indicator">
                <span className="status-dot"></span>
                {isTyping ? 'Typing...' : 'Online'}
              </span>
            </div>
          </div>
          <button className="icon-btn theme-toggle-header" onClick={toggleTheme} title="Toggle theme">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>

        {/* Messages */}
        <div className="messages-container">
          {messages.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <Sparkles size={40} />
              </div>
              <h3>Start a conversation</h3>
              <p>Ask me anything or generate images from text prompts</p>
              <div className="quick-actions">
                <button onClick={() => setInput('Tell me a fun fact')}>💡 Fun fact</button>
                <button onClick={() => setInput('Write a short poem')}>✍️ Write a poem</button>
                <button onClick={() => setInput('A sunset over mountains')}>🎨 Generate art</button>
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div key={idx} className={`message-row ${msg.role}`}>
                {msg.role === 'bot' && (
                  <div className="avatar bot-avatar">
                    <Bot size={18} />
                  </div>
                )}
                <div className="message-wrapper">
                  <div className={`message ${msg.role} ${msg.type === 'error' ? 'error' : ''}`}>
                    {msg.type === 'image' ? (
                      <img src={msg.content} alt="AI Generated" />
                    ) : msg.type === 'error' ? (
                      <div className="error-content">
                        <AlertCircle size={16} />
                        <span>{msg.content}</span>
                      </div>
                    ) : (
                      <p>{msg.content}</p>
                    )}
                  </div>
                  <span className="message-time">{msg.time}</span>
                </div>
                {msg.role === 'user' && (
                  <div className="avatar user-avatar">U</div>
                )}
              </div>
            ))
          )}

          {isTyping && (
            <div className="message-row bot">
              <div className="avatar bot-avatar">
                <Bot size={18} />
              </div>
              <div className="message-wrapper">
                <div className="message bot typing-bubble">
                  <div className="typing-indicator">
                    <span></span><span></span><span></span>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="input-area">
          <div className="input-container">
            <input
              type="text"
              className="chat-input"
              placeholder="Type a message to chat, or describe an image and click Generate Image..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isTyping}
            />
            <button
              className="action-btn image-btn"
              onClick={handleGenerateImage}
              disabled={isTyping || !input.trim()}
              title="Generate Image"
            >
              Generate Image
            </button>
            <button
              className="action-btn send-btn"
              onClick={handleSendText}
              disabled={isTyping || !input.trim()}
              title="Send"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
