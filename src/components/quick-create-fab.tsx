'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useChat } from '@ai-sdk/react';
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
  Wrench,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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

interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
}

interface LoadedMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolResults?: Array<{
    success: boolean;
    action: string;
    message?: string;
    error?: string;
  }>;
}

// Helper to format tool names for display
function formatToolName(name: string): string {
  return name
    .replace(/^tool-/, '')
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

export function QuickCreateFAB() {
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Use the AI SDK's useChat hook
  const {
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
  } = useChat({
    api: '/api/ai/chat',
    onFinish: () => {
      // Refresh conversations list after message completes
      loadConversations();
    },
  });

  const isLoading = status === 'streaming' || status === 'submitted';

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
        // Convert loaded messages to the format expected by useChat
        const loadedMessages = data.messages.map((msg: LoadedMessage) => ({
          id: msg.id,
          role: msg.role,
          parts: [
            { type: 'text' as const, text: msg.content },
          ],
        }));
        setMessages(loadedMessages);
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  }, [setMessages]);

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
  }, [setMessages]);

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
  }, [messages]);

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
      // Stop any ongoing request
      if (isLoading) {
        stop();
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const messageText = input;
    setInput('');

    // Send message with body containing conversationId and timezone
    const response = await sendMessage(
      { role: 'user', content: messageText },
      {
        body: {
          conversationId,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      }
    );

    // Capture conversation ID from response headers if available
    if (response && 'headers' in response) {
      const newConvId = (response as Response).headers.get('X-Conversation-Id');
      if (newConvId && !conversationId) {
        setConversationId(newConvId);
      }
    }
  };

  // Type guard for tool parts
  const isToolPart = (part: { type: string }): part is {
    type: string;
    toolCallId: string;
    toolName?: string;
    state: string;
    input?: unknown;
    output?: unknown;
    errorText?: string;
  } => {
    return part.type.startsWith('tool-') || part.type === 'dynamic-tool';
  };

  // Render a message part (text or tool invocation)
  const renderMessagePart = (part: { type: string; text?: string; [key: string]: unknown }, index: number) => {
    if (part.type === 'text') {
      if (!part.text) return null;
      return (
        <div key={index} className="prose prose-sm max-w-none dark:prose-invert">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{part.text}</ReactMarkdown>
        </div>
      );
    }

    // Handle tool invocation parts (type starts with 'tool-')
    if (isToolPart(part)) {
      const toolName = part.toolName || part.type.replace(/^tool-/, '');
      const displayName = formatToolName(toolName);
      const state = part.state;

      // Tool is being called (streaming input or input ready)
      if (state === 'input-streaming' || state === 'input-available') {
        return (
          <div
            key={index}
            className="flex items-center gap-2 text-xs px-2 py-1.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 my-1"
          >
            <Loader2 className="h-3 w-3 animate-spin" />
            <Wrench className="h-3 w-3" />
            <span className="font-medium">{displayName}</span>
            <span className="text-blue-600 dark:text-blue-300">Running...</span>
          </div>
        );
      }

      // Tool completed successfully
      if (state === 'output-available') {
        const result = part.output as {
          success?: boolean;
          action?: string;
          message?: string;
          error?: string;
        } | undefined;

        const success = result?.success ?? true;

        return (
          <div
            key={index}
            className={`flex items-center gap-2 text-xs px-2 py-1 rounded my-1 ${
              success
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            }`}
          >
            {success ? (
              <CheckCircle className="h-3 w-3" />
            ) : (
              <XCircle className="h-3 w-3" />
            )}
            <span className="font-medium">{result?.action || displayName}</span>
            {result?.message && <span className="truncate">{result.message}</span>}
            {result?.error && <span className="truncate">{result.error}</span>}
          </div>
        );
      }

      // Tool failed
      if (state === 'output-error') {
        return (
          <div
            key={index}
            className="flex items-center gap-2 text-xs px-2 py-1 rounded my-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
          >
            <XCircle className="h-3 w-3" />
            <span className="font-medium">{displayName}</span>
            <span className="truncate">{part.errorText || 'Failed'}</span>
          </div>
        );
      }
    }

    return null;
  };

  // Get text content from message parts for user messages
  const getMessageText = (message: { parts: Array<{ type: string; text?: string }> }): string => {
    const textPart = message.parts.find(p => p.type === 'text');
    return textPart?.text || '';
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

              </div>
            </div>
          </DialogHeader>

          {/* Messages area */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4" ref={scrollRef}>
            <div className="py-4 space-y-4">
              {messages.length === 0 && (
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
                    {message.role === 'user' ? (
                      <p className="text-sm whitespace-pre-wrap">{getMessageText(message)}</p>
                    ) : (
                      // Render message parts (text + tool invocations)
                      message.parts.map((part, idx) => renderMessagePart(part as { type: string; text?: string }, idx))
                    )}
                  </div>
                </div>
              ))}

              {/* Loading indicator when waiting for first response */}
              {isLoading && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg px-3 py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}
            </div>
          </div>

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
