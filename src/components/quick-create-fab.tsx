'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Plus,
  Mic,
  MicOff,
  Send,
  Loader2,
  CheckCircle,
  XCircle,
  MessageSquare,
  Trash2,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

interface ToolResult {
  success: boolean;
  action: string;
  message?: string;
  error?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolResults?: ToolResult[];
}

interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
}

export function QuickCreateFAB() {
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load conversations
  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/conversations');
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  }, []);

  // Load conversation messages
  const loadConversation = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/conversations/${id}`);
      if (res.ok) {
        const data = await res.json();
        setConversationId(id);
        setMessages(data.messages.map((msg: Message) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          toolResults: msg.toolResults,
        })));
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  }, []);

  // Delete conversation
  const deleteConversation = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (conversationId === id) {
          startNewConversation();
        }
        loadConversations();
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  }, [conversationId, loadConversations]);

  // Start new conversation
  const startNewConversation = useCallback(() => {
    setConversationId(null);
    setMessages([]);
    setInput('');
    setStreamingContent('');
  }, []);

  // Send message with streaming
  const sendMessage = useCallback(async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;

    // Add user message optimistically
    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: messageText,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setStreamingContent('');

    // Create abort controller
    abortControllerRef.current = new AbortController();

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          message: messageText,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to send message');
      }

      // Get conversation ID from headers
      const newConvId = res.headers.get('X-Conversation-Id');
      if (newConvId && !conversationId) {
        setConversationId(newConvId);
      }

      // Read the stream
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullContent += chunk;
        setStreamingContent(fullContent);
      }

      // Add assistant message
      const assistantMessage: Message = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: fullContent,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setStreamingContent('');

      // Refresh conversations list
      loadConversations();
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        console.log('Request aborted');
      } else {
        console.error('Failed to send message:', error);
        // Show error in UI
        const errorMessage: Message = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `Error: ${(error as Error).message}`,
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [conversationId, isLoading, loadConversations]);

  // Speech recognition setup
  useEffect(() => {
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      setSpeechSupported(true);
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event) => {
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          }
        }

        if (finalTranscript) {
          setInput((prev) => prev + finalTranscript);
        }
      };

      recognitionRef.current.onerror = () => {
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // Load conversations when dialog opens
  useEffect(() => {
    if (open) {
      loadConversations();
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }, [open, loadConversations]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  const toggleListening = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      if (isListening && recognitionRef.current) {
        recognitionRef.current.stop();
        setIsListening(false);
      }
      // Abort any ongoing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <>
      {/* Floating Action Button */}
      <Button
        onClick={() => setOpen(true)}
        size="icon-lg"
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow z-40"
        aria-label="AI Assistant"
      >
        <MessageSquare className="h-6 w-6" />
      </Button>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] flex! flex-col! overflow-hidden p-0">
          <DialogHeader className="px-4 py-3 border-b">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg">AI Assistant</DialogTitle>
              <div className="flex items-center gap-2">
                {/* Conversation selector */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8">
                      <ChevronDown className="h-4 w-4 mr-1" />
                      History
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuItem onClick={startNewConversation}>
                      <Plus className="h-4 w-4 mr-2" />
                      New conversation
                    </DropdownMenuItem>
                    {conversations.length > 0 && (
                      <>
                        <DropdownMenuSeparator />
                        {conversations.slice(0, 10).map((conv) => (
                          <DropdownMenuItem
                            key={conv.id}
                            className="flex items-center justify-between group"
                          >
                            <span
                              className="truncate flex-1 cursor-pointer"
                              onClick={() => loadConversation(conv.id)}
                            >
                              {conv.title}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteConversation(conv.id);
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </DropdownMenuItem>
                        ))}
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* New conversation button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={startNewConversation}
                  title="New conversation"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* Messages area */}
          <ScrollArea className="flex-1 min-h-0 px-4" ref={scrollRef}>
            <div className="py-4 space-y-4">
              {messages.length === 0 && !streamingContent && (
                <div className="text-center text-muted-foreground py-8">
                  <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Start a conversation</p>
                  <p className="text-xs mt-1">Try &quot;Create a note about...&quot; or &quot;Remind me to...&quot;</p>
                </div>
              )}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-2 ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>

                    {/* Tool results */}
                    {message.role === 'assistant' && message.toolResults && message.toolResults.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {message.toolResults.map((tr, idx) => (
                          <div
                            key={idx}
                            className={`flex items-center gap-2 text-xs px-2 py-1 rounded ${
                              tr.success
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            }`}
                          >
                            {tr.success ? (
                              <CheckCircle className="h-3 w-3" />
                            ) : (
                              <XCircle className="h-3 w-3" />
                            )}
                            <span className="font-medium">{tr.action}</span>
                            {tr.message && <span className="truncate">{tr.message}</span>}
                            {tr.error && <span className="truncate">{tr.error}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Streaming content */}
              {streamingContent && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-lg px-3 py-2 bg-muted">
                    <p className="text-sm whitespace-pre-wrap">{streamingContent}</p>
                  </div>
                </div>
              )}

              {/* Loading indicator */}
              {isLoading && !streamingContent && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg px-3 py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input area */}
          <div className="border-t px-4 py-3">
            {isListening && (
              <div className="flex items-center gap-2 text-sm text-red-500 mb-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
                Listening...
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type a message..."
                  rows={1}
                  disabled={isLoading}
                  className="min-h-[40px] max-h-[120px] resize-none pr-10"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                />
                {speechSupported && (
                  <button
                    type="button"
                    onClick={toggleListening}
                    className={`absolute bottom-2 right-2 p-1.5 rounded-full transition-colors ${
                      isListening
                        ? 'bg-destructive text-destructive-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                  </button>
                )}
              </div>
              <Button type="submit" size="icon" disabled={!input.trim() || isLoading}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
