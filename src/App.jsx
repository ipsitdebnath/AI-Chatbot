import React, { useState, useRef, useEffect } from 'react';
import { Bot, AlertCircle, Sparkles } from 'lucide-react';

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  // Hardcoded Model for Text
  const FIXED_MODEL = 'Qwen/Qwen2.5-1.5B-Instruct:featherless-ai';
  const hfKey = import.meta.env.VITE_HF_TOKEN || '';

  // Part B & D: query function struct
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
    const result = await response.json();
    return result;
  }

  // Part E: generateImage function struct
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

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const getTime = () => {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
    
    setMessages(newMessages);
    setInput('');
    setIsTyping(true);

    try {
      const apiMessages = newMessages
        .filter(m => m.type === 'text')
        .map(m => ({
          role: m.role === 'bot' ? 'assistant' : 'user',
          content: m.content
        }));

      const result = await query({
        model: FIXED_MODEL,
        messages: apiMessages,
        max_tokens: 500
      });
      
      if (result.error) {
        throw new Error(result.error.message || 'API Error');
      }

      const botReply = result.choices[0].message.content;
      setMessages(prev => [...prev, { role: 'bot', content: botReply, type: 'text', time: getTime() }]);
    } catch (error) {
      console.error('Text Generation Error:', error);
      setMessages(prev => [...prev, { 
        role: 'bot', 
        content: `${error.message}`, 
        type: 'error',
        time: getTime()
      }]);
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
    setMessages(prev => [...prev, userMessage]);
    
    const prompt = input;
    setInput('');
    setIsTyping(true);

    try {
      const blob = await generateImage(prompt);
      const imageUrl = URL.createObjectURL(blob);
      
      setMessages(prev => [...prev, { role: 'bot', content: imageUrl, type: 'image', time: getTime() }]);
    } catch (error) {
      console.error('Image Generation Error:', error);
      setMessages(prev => [...prev, { 
        role: 'bot', 
        content: `${error.message}. The model may be loading — please retry in a moment.`, 
        type: 'error',
        time: getTime()
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

  return (
    <div className="app-container">
      <div className="chat-area">
        
        {/* Header */}
        <div className="chat-header">
          <div className="header-left">
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
              placeholder="Type a message..."
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
