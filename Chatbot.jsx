import React, { useState, useEffect, useRef, useCallback} from "react";
import axios from "axios";
import "./Chatbot.css";

const BACKEND_URL = "http://localhost:9090";

function Chatbot() {
    const [messages, setMessages] = useState([
        {
            sender: "bot",
            text: "Hello friend! 🌟 I'm PsychPal, here to support your mental wellness. How can I help today?",
            id: Date.now(),
            timestamp: Date.now(),
        },
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [connectionError, setConnectionError] = useState(null);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, loading]);

    useEffect(() => {
        const checkConnection = async (retryCount = 3) => {
            for (let i = 0; i < retryCount; i++) {
                try {
                    const response = await axios.get(`${BACKEND_URL}/health`, { timeout: 5000 });
                    if (response.status === 200) {
                        setConnectionError(null);
                        return;
                    }
                } catch (err) {
                    if (i === retryCount - 1) {
                        setConnectionError(`⚠️ Cannot connect to backend: ${BACKEND_URL}`);
                        console.error("Connection error:", err);
                    }
                }
            }
        };
        checkConnection();
    }, []);

    const addMessage = useCallback((message) => {
        setMessages((prev) => [
            ...prev,
            { ...message, id: Date.now(), timestamp: Date.now() },
        ]);
    }, []);

    const sendMessage = useCallback(async () => {
        const trimmedText = input.trim();
        if (!trimmedText || loading) return;

        if (trimmedText.length > 500) {
            addMessage({ sender: "bot", text: "Please keep messages under 500 characters." });
            return;
        }

        addMessage({ sender: "user", text: trimmedText });
        setInput("");
        setLoading(true);

        try {
            const response = await axios.post(
                `${BACKEND_URL}/predict`,
                { input: trimmedText },
                { headers: { "Content-Type": "application/json" }, timeout: 15000 }
            );

            if (!response.data?.response) throw new Error("Empty response from server");

            addMessage({ sender: "bot", text: response.data.response });
        } catch (err) {
            handleApiError(err);
        } finally {
            setLoading(false);
        }
    }, [input, loading, addMessage]);

    const handleApiError = (error) => {
        let errorDetails = [
            "Check if backend is running", 
            `Backend URL: ${BACKEND_URL}`
        ];

        if (error.code === "ECONNABORTED") {
            errorDetails.unshift("Request timed out (15s)");
        } else if (error.message === "Network Error") {
            errorDetails.unshift("Server unavailable");
        } else if (error.response) {
            const statusMessages = {
                400: "Invalid request",
                500: "Server error - try again later",
                503: "Service unavailable",
            };
            errorDetails.unshift(statusMessages[error.response.status] || `Error ${error.response.status}`);
        }

        addMessage({
            sender: "bot",
            text: `⚠️ Connection issue.\n${errorDetails.map((d) => `• ${d}`).join("\n")}`,
        });
    };

    return (
        <div className="chatbot-container">
            <div className="chat-header">
                <h2>PsychPal</h2>
                <p>Your Mental Health Companion</p>

                <div className="header-actions">
                    {connectionError && (
                        <div className="connection-error">
                            {connectionError}
                            <div className="error-details">
                                <p>Trying to connect to: {BACKEND_URL}</p>
                            </div>
                        </div>
                    )}
                    <button className="login-button" onClick={() => console.log("Redirect to Login")}>
                        Login
                    </button>
                </div>
            </div>

            <div className="chat-messages">
                {messages.map((msg) => (
                    <div key={msg.id} className={`message ${msg.sender}`}>
                        <div className="message-header">
                            <span className="sender">{msg.sender === "user" ? "You" : "PsychPal"}</span>
                            <span className="timestamp">
                                {new Date(msg.timestamp).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                })}
                            </span>
                        </div>
                        <div className="bubble">{msg.text}</div>
                    </div>
                ))}
                {loading && (
                    <div className="message bot">
                        <div className="bubble typing-indicator">
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="chat-input">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type your message..."
                    onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                    disabled={loading || connectionError}
                    aria-label="Type your message"
                />
                <button onClick={sendMessage} disabled={loading || !input.trim() || connectionError}>
                    {loading ? <div className="spinner"></div> : "Send"}
                </button>
            </div>
        </div>
    );
}

export default Chatbot;
