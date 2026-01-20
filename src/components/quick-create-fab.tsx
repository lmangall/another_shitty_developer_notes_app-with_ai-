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

interface ToolResult {
  success: boolean;
  action: string;
  message?: string;
  error?: string;
}

interface ToolInvocation {
  toolCallId: string;
  toolName: string;
  state: 'running' | 'completed' | 'error';
  result?: ToolResult;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolInvocations?: ToolInvocation[];
}

interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
}

// Helper to format tool names for display
function formatToolName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

export function QuickCreateFAB() {
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [activeToolCalls, setActiveToolCalls] = useState<Map<string, ToolInvocation>>(new Map());
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
        setMessages(data.messages.map((msg: Message & { toolResults?: ToolResult[] }) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          toolInvocations: msg.toolResults?.map((tr, idx) => ({
            toolCallId: `${msg.id}-tool-${idx}`,
            toolName: tr.action,
            state: 'completed' as const,
            result: tr,
          })),
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
    setActiveToolCalls(new Map());
  }, []);

  // Parse SSE stream line - supports both AI SDK Data Stream Protocol formats
  type StreamEvent =
    | { type: 'text-delta'; delta: string }
    | { type: 'tool-call'; toolCallId: string; toolName: string; args: Record<string, unknown> }
    | { type: 'tool-result'; toolCallId: string; result: unknown }
    | { type: 'finish'; finishReason: string }
    | { type: 'error'; error: string }
    | null;

  const parseStreamLine = (line: string): StreamEvent => {
    // Handle SSE format: remove "data: " prefix if present
    let content = line;
    if (line.startsWith('data: ')) {
      content = line.substring(6);
    }
    if (!content || content === '[DONE]') return null;

    // Try Data Stream Protocol format first: "TYPE_CODE:VALUE"
    // Type codes: 0=text, 9=tool-call, a=tool-result, e=finish, 3=error
    const match = content.match(/^([0-9a-f]):([\s\S]*)$/);
    if (match) {
      const [, typeCode, valueStr] = match;
      try {
        switch (typeCode) {
          case '0': {
            // Text delta - value is a JSON-encoded string
            const text = JSON.parse(valueStr);
            return { type: 'text-delta', delta: String(text) };
          }
          case '9': {
            // Tool call starting
            const data = JSON.parse(valueStr);
            return {
              type: 'tool-call',
              toolCallId: data.toolCallId,
              toolName: data.toolName,
              args: data.args || {},
            };
          }
          case 'a': {
            // Tool result (hex 10)
            const data = JSON.parse(valueStr);
            return {
              type: 'tool-result',
              toolCallId: data.toolCallId,
              result: data.result,
            };
          }
          case 'e': {
            // Finish
            const data = JSON.parse(valueStr);
            return { type: 'finish', finishReason: data.finishReason || 'stop' };
          }
          case '3': {
            // Error
            const error = JSON.parse(valueStr);
            return { type: 'error', error: String(error) };
          }
        }
      } catch {
        // Fall through to try JSON format
      }
    }

    // Try JSON format: {"type":"...", ...}
    try {
      const data = JSON.parse(content);
      if (data && typeof data.type === 'string') {
        switch (data.type) {
          case 'text-delta':
            return { type: 'text-delta', delta: String(data.textDelta || data.delta || '') };
          case 'tool-call':
            return {
              type: 'tool-call',
              toolCallId: data.toolCallId,
              toolName: data.toolName,
              args: data.args || {},
            };
          case 'tool-result':
            return {
              type: 'tool-result',
              toolCallId: data.toolCallId,
              result: data.result,
            };
          case 'finish':
            return { type: 'finish', finishReason: data.finishReason || 'stop' };
          case 'error':
            return { type: 'error', error: String(data.error || data.message || '') };
        }
      }
    } catch {
      // Not valid JSON
    }

    return null;
  };

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
    setActiveToolCalls(new Map());

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
      let buffer = '';
      let fullContent = '';
      const toolCalls = new Map<string, ToolInvocation>();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;

          // Debug: log raw line to see actual format
          console.log('[Stream line]:', JSON.stringify(line));

          const event = parseStreamLine(line);
          console.log('[Parsed event]:', event);
          if (!event) continue;

          switch (event.type) {
            case 'text-delta':
              fullContent += event.delta;
              setStreamingContent(fullContent);
              break;

            case 'tool-call':
              // Tool starting - show spinner
              if (event.toolCallId && event.toolName) {
                const invocation: ToolInvocation = {
                  toolCallId: event.toolCallId,
                  toolName: event.toolName,
                  state: 'running',
                };
                toolCalls.set(event.toolCallId, invocation);
                setActiveToolCalls(new Map(toolCalls));
              }
              break;

            case 'tool-result':
              // Tool completed - show result
              if (event.toolCallId) {
                const existing = toolCalls.get(event.toolCallId);
                if (existing) {
                  const output = event.result as ToolResult | undefined;
                  existing.state = output?.success !== false ? 'completed' : 'error';
                  existing.result = output;
                  toolCalls.set(event.toolCallId, existing);
                  setActiveToolCalls(new Map(toolCalls));
                }
              }
              break;
          }
        }
      }

      // Add assistant message with tool invocations
      const assistantMessage: Message = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: fullContent,
        toolInvocations: toolCalls.size > 0 ? Array.from(toolCalls.values()) : undefined,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setStreamingContent('');
      setActiveToolCalls(new Map());

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
  }, [messages, streamingContent, activeToolCalls]);

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

  // Render tool invocation
  const renderToolInvocation = (tool: ToolInvocation) => {
    const displayName = formatToolName(tool.toolName);

    if (tool.state === 'running') {
      return (
        <div
          key={tool.toolCallId}
          className="flex items-center gap-2 text-xs px-2 py-1.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 my-1"
        >
          <Loader2 className="h-3 w-3 animate-spin" />
          <Wrench className="h-3 w-3" />
          <span className="font-medium">{displayName}</span>
          <span className="text-blue-600 dark:text-blue-300">Running...</span>
        </div>
      );
    }

    const success = tool.result?.success !== false;

    return (
      <div
        key={tool.toolCallId}
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
        <span className="font-medium">{tool.result?.action || displayName}</span>
        {tool.result?.message && <span className="truncate">{tool.result.message}</span>}
        {tool.result?.error && <span className="truncate">{tool.result.error}</span>}
      </div>
    );
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
              <div className="flex items-center gap-2 mr-6">
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
                    {message.role === 'user' ? (
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    ) : (
                      <>
                        <div className="prose prose-sm max-w-none dark:prose-invert">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                        </div>
                        {/* Tool invocations */}
                        {message.toolInvocations && message.toolInvocations.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {message.toolInvocations.map(renderToolInvocation)}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}

              {/* Streaming content with active tool calls */}
              {(streamingContent || activeToolCalls.size > 0) && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-lg px-3 py-2 bg-muted">
                    {/* Show active tool calls */}
                    {activeToolCalls.size > 0 && (
                      <div className="space-y-1 mb-2">
                        {Array.from(activeToolCalls.values()).map(renderToolInvocation)}
                      </div>
                    )}
                    {/* Show streaming text */}
                    {streamingContent && (
                      <div className="prose prose-sm max-w-none dark:prose-invert">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingContent}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Loading indicator */}
              {isLoading && !streamingContent && activeToolCalls.size === 0 && (
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
