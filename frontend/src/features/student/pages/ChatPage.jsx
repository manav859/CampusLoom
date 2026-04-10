import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, UserCircle, MessageSquare } from 'lucide-react';

export default function ChatPage() {
  const [messages, setMessages] = useState([
    { id: 1, sender: 'teacher', text: 'Hello! I have uploaded the new assignment. Let me know if you have any questions.', time: '10:00 AM' },
    { id: 2, sender: 'student', text: 'Thank you, sir. When is the deadline?', time: '10:05 AM' },
    { id: 3, sender: 'teacher', text: 'It is due next Friday by 5 PM.', time: '10:10 AM' },
  ]);
  const [inputValue, setInputValue] = useState('');

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    setMessages([...messages, { id: Date.now(), sender: 'student', text: inputValue, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    setInputValue('');
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] w-full max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b">
        <MessageSquare className="size-6 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">Chat with Teachers</h1>
      </div>

      <div className="flex-1 bg-card rounded-2xl shadow-sm border overflow-hidden flex flex-col">
        <CardHeader className="border-b bg-muted/20 py-4 shrink-0">
          <CardTitle className="text-lg flex items-center gap-2">
            <UserCircle className="size-8 text-muted-foreground" />
            <div>
              <p className="text-sm font-semibold">Mr. Robert</p>
              <p className="text-xs text-muted-foreground mt-0.5">Mathematics</p>
            </div>
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/10">
          <div className="text-center text-xs text-muted-foreground my-4">
            Today
          </div>
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col max-w-[75%] ${msg.sender === 'student' ? 'ml-auto items-end' : 'mr-auto items-start'}`}
            >
              <div
                className={`px-4 py-2 rounded-2xl ${
                  msg.sender === 'student'
                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                    : 'bg-card border rounded-bl-sm text-foreground'
                }`}
              >
                {msg.text}
              </div>
              <span className="text-[10px] text-muted-foreground mt-1 px-1">
                {msg.time}
              </span>
            </div>
          ))}
          <div className="text-center text-sm text-muted-foreground mt-4 pb-2 border-t pt-2 opacity-50">
             Real-time integration pending Phase 2
          </div>
        </CardContent>

        <form onSubmit={handleSend} className="p-4 bg-card border-t shrink-0 flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 rounded-full bg-muted/50 focus-visible:ring-1"
          />
          <Button type="submit" size="icon" className="rounded-full shadow-md shrink-0">
            <Send className="size-4 ml-1" />
          </Button>
        </form>
      </div>
    </div>
  );
}
