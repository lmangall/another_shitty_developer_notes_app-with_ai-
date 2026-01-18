'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Send, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface ActionResult {
  intent: string;
  result: {
    success: boolean;
    action: string;
    message?: string;
    error?: string;
    data?: Record<string, unknown>;
  };
}

export default function InputPage() {
  const [input, setInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<ActionResult[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    // Check if Web Speech API is supported
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      setSpeechSupported(true);
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        if (finalTranscript) {
          setInput((prev) => prev + finalTranscript);
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
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
    if (!input.trim() || processing) return;

    setProcessing(true);
    const currentInput = input;
    setInput('');

    try {
      const res = await fetch('/api/ai/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: currentInput }),
      });

      const result: ActionResult = await res.json();
      setResults((prev) => [result, ...prev]);
    } catch (error) {
      console.error('Processing error:', error);
      setResults((prev) => [
        {
          intent: 'unknown',
          result: {
            success: false,
            action: 'process',
            error: 'Failed to process input',
          },
        },
        ...prev,
      ]);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-foreground mb-8">Quick Input</h1>

      <Card className="mb-8">
        <CardHeader>
          <p className="text-sm text-muted-foreground">
            Type or speak your request. Examples:
          </p>
          <ul className="text-sm text-muted-foreground list-disc list-inside mt-2 space-y-1">
            <li>&quot;Create a note about project ideas&quot;</li>
            <li>&quot;Remind me to call mom tomorrow at 5pm&quot;</li>
            <li>&quot;Update my grocery list note&quot;</li>
            <li>&quot;Cancel my dentist reminder&quot;</li>
          </ul>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="What would you like to do?"
                rows={4}
                disabled={processing}
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
                  {isListening ? <MicOff size={20} /> : <Mic size={20} />}
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

            <div className="flex justify-end">
              <Button type="submit" disabled={!input.trim() || processing}>
                {processing ? (
                  <>
                    <Loader2 size={18} className="mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Send size={18} className="mr-2" />
                    Send
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Results</h2>
          {results.map((result, index) => (
            <Card key={index}>
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  {result.result.success ? (
                    <CheckCircle className="text-green-500 flex-shrink-0" size={20} />
                  ) : (
                    <XCircle className="text-red-500 flex-shrink-0" size={20} />
                  )}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          result.result.success
                            ? 'bg-green-50 text-green-700'
                            : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {result.intent}
                      </span>
                    </div>
                    <p className="text-foreground">
                      {result.result.message || result.result.error}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
