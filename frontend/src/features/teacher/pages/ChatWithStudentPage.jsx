import { useState, useRef, useEffect } from 'react';
import { useTeacherChatHistory, useTeacherSendMessage } from '../hooks/useTeacherQueries';
import { useChatContacts } from '../../student/hooks/useStudentQueries'; // Re-use contact list hook
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';
import Loading from '@/components/common/Loading';
import ApiErrorState from '@/components/common/ApiErrorState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, UserCircle, MessageSquare, Search, ChevronLeft, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ChatWithStudentPage() {
  const { user: currentUser } = useAuthSession();
  const [selectedContact, setSelectedContact] = useState(null);
  const [inputValue, setInputValue] = useState('');
  const [contactSearch, setContactSearch] = useState('');
  const scrollRef = useRef(null);

  const { data: contacts, isLoading: contactsLoading, isError: contactsError } = useChatContacts();
  const { data: messages = [], isLoading: chatLoading } = useTeacherChatHistory(selectedContact?.id);
  const sendMutation = useTeacherSendMessage();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || !selectedContact) return;

    try {
      await sendMutation.mutateAsync({
        receiverId: selectedContact.id,
        message: inputValue,
      });
      setInputValue('');
    } catch (err) {
      // Error handled by mutation
    }
  };

  if (contactsLoading) return <Loading title="Loading Communications" />;
  if (contactsError) return <ApiErrorState title="Error" message="Failed to load student contacts" />;

  const filteredContacts = (contacts || []).filter(c => 
    c.name.toLowerCase().includes(contactSearch.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-140px)] w-full max-w-6xl mx-auto border rounded-3xl overflow-hidden bg-card/30 shadow-premium">
      {/* Sidebar: Student Contacts */}
      <aside className={cn(
        "w-full sm:w-80 border-r bg-muted/20 flex flex-col transition-all",
        selectedContact ? "hidden sm:flex" : "flex"
      )}>
        <div className="p-6 border-b space-y-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="size-5 text-primary" />
            <h2 className="font-bold tracking-tight">Student Chats</h2>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input 
                placeholder="Search students..." 
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                className="pl-9 h-10 rounded-xl bg-background"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredContacts.map((contact) => (
            <button
              key={contact.id}
              onClick={() => setSelectedContact(contact)}
              className={cn(
                "w-full flex items-center gap-3 p-4 hover:bg-muted/40 transition-colors border-b last:border-0",
                selectedContact?.id === contact.id && "bg-primary/10 hover:bg-primary/15"
              )}
            >
              <div className="relative">
                <UserCircle className="size-10 text-muted-foreground/50" />
                <div className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-background bg-emerald-500" />
              </div>
              <div className="text-left overflow-hidden">
                <p className="font-semibold truncate">{contact.name}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary/70 truncate">
                    Class {contact.class}
                </p>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className={cn(
        "flex-1 flex flex-col bg-card",
        !selectedContact ? "hidden sm:flex items-center justify-center" : "flex"
      )}>
        {selectedContact ? (
          <>
            <header className="p-4 border-b bg-muted/10 flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="icon" 
                className="sm:hidden" 
                onClick={() => setSelectedContact(null)}
              >
                <ChevronLeft className="size-5" />
              </Button>
              <UserCircle className="size-10 text-muted-foreground/50" />
              <div>
                <p className="font-bold">{selectedContact.name}</p>
                <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[9px] font-black uppercase tracking-widest px-1.5 h-4">Class {selectedContact.class}</Badge>
                    <span className="text-[10px] font-medium text-muted-foreground">Roll: {selectedContact.rollNumber}</span>
                </div>
              </div>
            </header>

            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-6 space-y-4 bg-[radial-gradient(ellipse_at_top,transparent,rgba(14,165,233,0.02))]"
            >
              {messages.length === 0 && !chatLoading && (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-3 opacity-40">
                    <MessageSquare className="size-12" />
                    <p className="text-sm">Start a conversation with {selectedContact.name}</p>
                </div>
              )}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex flex-col max-w-[80%]",
                    msg.senderId === currentUser.id ? "ml-auto items-end" : "mr-auto items-start"
                  )}
                >
                  <div
                    className={cn(
                      "px-4 py-2.5 rounded-2xl shadow-sm",
                      msg.senderId === currentUser.id
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : "bg-muted/50 border rounded-tl-sm text-foreground"
                    )}
                  >
                    <p className="text-sm leading-relaxed">{msg.message}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-1.5 px-1 font-medium">
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>

            <form onSubmit={handleSend} className="p-4 border-t flex gap-2">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={`Message ${selectedContact.name}...`}
                disabled={sendMutation.isPending}
                className="h-12 rounded-2xl bg-muted/30 border-none focus-visible:ring-1"
              />
              <Button 
                type="submit" 
                disabled={!inputValue.trim() || sendMutation.isPending} 
                className="size-12 rounded-2xl shadow-lg shrink-0"
              >
                {sendMutation.isPending ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5 ml-0.5" />}
              </Button>
            </form>
          </>
        ) : (
          <div className="text-center space-y-4 opacity-30 select-none">
            <div className="size-20 bg-muted rounded-full mx-auto flex items-center justify-center">
                <MessageSquare className="size-10" />
            </div>
            <div className="space-y-1">
                <p className="text-2xl font-black italic">Student Messaging</p>
                <p className="text-sm font-medium">Select a student from the sidebar to open the chat window.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
