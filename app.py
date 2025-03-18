from fastapi import FastAPI, Request
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from llama_cpp import Llama
import os
import re
import uvicorn
import sys

# Initialize FastAPI app
app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"]
)

# Determine model path
if getattr(sys, 'frozen', False):
    BASE_DIR = sys._MEIPASS  # Running as compiled .exe
else:
    BASE_DIR = os.path.abspath(".")

MODEL_PATH = os.path.join(BASE_DIR, "models", "tinyllama-1.1b-chat-v1.0.Q4_0.gguf")

print("Loading model from:", MODEL_PATH)
llm = Llama(model_path=MODEL_PATH, n_ctx=2048)

# Request model
class RequestData(BaseModel):
    input: str

conversation_history = []
SYSTEM_PROMPT = """[Role]
You are PsychPal - a mental health companion. Respond with:
1. Emotional validation
2. One open question
3. Coping suggestion

[Rules]
- NEVER mention crisis resources unless user explicitly states:
  'suicide', 'kill myself', 'end my life'
- Keep responses conversational
- Maintain 3-5 sentence length

[Examples]
User: "I'm having dark thoughts"
Response: "Dark thoughts can feel overwhelming. Would you like to share what's been troubling you? We could try a grounding exercise."

User: "What's 2+2?"
Response: "Numbers can sometimes represent emotional burdens. What's weighing on your mind?"

[History]
{history}

User: {input}
PsychPal:"""

CRISIS_KEYWORDS = {
    'suicide', 'kill myself', 'end my life',
    'want to die', 'ending it all', 'death thoughts'
}

CRISIS_RESPONSE = """🚨 Immediate Support:
• 988 Suicide & Crisis Lifeline (US)
• Crisis Text Line: TEXT HOME to 741741
• International Help: https://findahelpline.com

You matter. Please reach out now."""

def contains_crisis(text):
    text_lower = text.lower()
    return any(keyword in text_lower for keyword in CRISIS_KEYWORDS)

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.post("/predict")
def predict(data: RequestData):
    global conversation_history
    user_input = data.input.strip()
    
    if contains_crisis(user_input):
        conversation_history = []  # Clear history to prevent crisis loop
        return {"response": CRISIS_RESPONSE}
    
    conversation_history.append(f"User: {user_input}")
    context = "\n".join(conversation_history[-3:])  # Keep last 3 exchanges
    
    response = llm(
        SYSTEM_PROMPT.format(history=context, input=user_input),
        max_tokens=250,
        temperature=0.5,
        top_p=0.85,
        stop=["\nUser:", "[Role]"],
        repeat_penalty=1.2
    )
    
    raw_response = response["choices"][0]["text"].strip()
    final_response = re.split(r'PsychPal:|Response:', raw_response)[-1].strip()
    
    if not final_response or len(final_response) < 4:
        final_response = "I want to understand better. Could you share more about that?"
    
    conversation_history.append(f"PsychPal: {final_response}")
    conversation_history = conversation_history[-6:]  # Keep last 3 exchanges
    
    return {"response": final_response}

@app.get("/shutdown")
def shutdown():
    os.kill(os.getpid(), signal.SIGTERM)  # ✅ Gracefully stop backend
    return {"status": "shutting down"}

if __name__ == "__main__":
    print("Running server...")
    uvicorn.run(app, host="0.0.0.0", port=9090)