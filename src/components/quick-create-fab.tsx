'use client';

import { useState, useRef, useEffect } from 'react';
import { Plus, Mic, MicOff, Send, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface ToolResult {
  success: boolean;
  action: string;
  message?: string;
  error?: string;
  data?: Record<string, unknown>;
}

interface AIProcessResponse {
  message?: string;
  toolResults?: ToolResult[];
  error?: string;
}

// Normalized result for UI display
interface DisplayResult {
  intent: string;
  success: boolean;
  message: string;
}

export function QuickCreateFAB() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<DisplayResult | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isSubmittingRef = useRef(false); // Sync ref to prevent double submissions

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

  // Focus textarea when dialog opens
  useEffect(() => {
    if (open && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }, [open]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSubmittingRef.current) return;

    isSubmittingRef.current = true; // Set immediately (sync)
    setProcessing(true);
    setResult(null);
    const currentInput = input;

    try {
      const res = await fetch('/api/ai/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: currentInput }),
      });

      // Handle HTTP errors before parsing JSON
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        let errorMessage = 'Failed to process input';
        if (res.status === 401) errorMessage = 'Please sign in to continue';
        else if (res.status === 429) errorMessage = 'Too many requests. Please wait a moment.';
        else if (errorData.error) errorMessage = errorData.error;

        setResult({
          intent: 'error',
          success: false,
          message: errorMessage,
        });
        return;
      }

      const data: AIProcessResponse = await res.json();

      // Derive success from toolResults
      const firstResult = data.toolResults?.[0];
      const success = firstResult?.success ?? false;
      const intent = firstResult?.action ?? 'response';
      const displayMessage = firstResult?.message ?? data.message ?? 'Done';

      setResult({
        intent,
        success,
        message: firstResult?.error ?? displayMessage,
      });

      if (success) {
        setInput('');
        // Close dialog after a brief delay on success
        setTimeout(() => {
          setOpen(false);
          setResult(null);
        }, 1500);
      }
    } catch {
      setResult({
        intent: 'error',
        success: false,
        message: 'Network error. Please try again.',
      });
    } finally {
      isSubmittingRef.current = false; // Reset ref
      setProcessing(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      // Reset state when closing
      setInput('');
      setResult(null);
      if (isListening && recognitionRef.current) {
        recognitionRef.current.stop();
        setIsListening(false);
      }
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <Button
        onClick={() => setOpen(true)}
        size="icon-lg"
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow z-40"
        aria-label="Quick create"
      >
        <Plus className="h-6 w-6" />
      </Button>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Quick Create</DialogTitle>
            <DialogDescription>
              Type or speak to create notes and reminders
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder='Try "Create a note about..." or "Remind me to..."'
                rows={3}
                disabled={processing}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    handleSubmit(e);
                  }
                }}
              />
              {speechSupported && (
                <button
                  type="button"
                  onClick={toggleListening}
                  className={`absolute bottom-3 right-3 p-2 rounded-full transition-colors ${
                    isListening
                      ? 'bg-destructive text-destructive-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
              )}
            </div>

            {isListening && (
              <div className="flex items-center gap-2 text-sm text-red-500">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
                Listening...
              </div>
            )}

            {result && (
              <div className="flex items-start gap-3 p-3 rounded-md bg-muted">
                {result.success ? (
                  <CheckCircle className="text-green-500 flex-shrink-0" size={20} />
                ) : (
                  <XCircle className="text-red-500 flex-shrink-0" size={20} />
                )}
                <div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      result.success
                        ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                        : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                    }`}
                  >
                    {result.intent}
                  </span>
                  <p className="text-sm text-foreground mt-1">
                    {result.message}
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!input.trim() || processing}>
                {processing ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Processing
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    Send
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
