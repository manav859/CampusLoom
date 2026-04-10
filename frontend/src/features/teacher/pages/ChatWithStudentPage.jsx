import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, UserCircle, MessageSquare } from 'lucide-react';

export default function ChatWithStudentPage() {
  const [messages, setMessages] = useState([
    { id: 1, sender: 'teacher', text: 'Hello David, your assignment submission was incomplete.', time: '11:00 AM' },
    { id: 2, sender: 'student', text: 'I am so sorry sir, my internet dropped while uploading.', time: '11:05 AM' },
    { id: 3, sender: 'teacher', text: 'I have reopened the portal. Please submit it by 5 PM today.', time: '11:10 AM' },
  ]);
  const [inputValue, setInputValue] = useState('');

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    setMessages([...messages, { id: Date.now(), sender: 'teacher', text: inputValue, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    setInputValue('');
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] w-full max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b">
        <MessageSquare className="size-6 text-primary" />
        <div className="space-y-0.5">
           <h1 className="text-2xl font-bold tracking-tight">Chat with Students</h1>
           <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">Phase 2 Preview</p>
        </div>
      </div>

      <div className="flex-1 bg-card rounded-2xl shadow-sm border overflow-hidden flex flex-col">
        <CardHeader className="border-b bg-muted/20 py-4 shrink-0 px-4">
          <CardTitle className="text-lg flex items-center gap-3">
            <UserCircle className="size-10 text-muted-foreground bg-muted rounded-full p-1 border" />
            <div>
              <p className="text-sm font-bold">David Smith</p>
              <p className="text-xs text-muted-foreground font-medium mt-0.5 tracking-wider">Class 10-A • Student</p>
            </div>
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/10">
          <div className="text-center text-xs text-muted-foreground my-4 font-medium uppercase tracking-widest">
            Today
          </div>
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col max-w-[75%] ${msg.sender === 'teacher' ? 'ml-auto items-end' : 'mr-auto items-start'}`}
            >
              <div
                className={`px-4 py-2 text-sm rounded-2xl ${
                  msg.sender === 'teacher'
                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                    : 'bg-card border shadow-sm rounded-bl-sm text-foreground'
                }`}
              >
                {msg.text}
              </div>
              <span className="text-[10px] text-muted-foreground mt-1 px-1 tracking-wider font-semibold">
                {msg.time}
              </span>
            </div>
          ))}
          <div className="text-center text-xs text-muted-foreground mt-4 pb-2 border-t pt-4 opacity-70">
             Student messaging systems currently under development for Phase 3.
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
            <Send className="size-4 ml-0.5" />
          </Button>
        </form>
      </div>
    </div>
  );
}
