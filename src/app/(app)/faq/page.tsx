'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FAQItem {
  question: string;
  answer: string;
}

const faqItems: FAQItem[] = [
  {
    question: 'How do I create a new note?',
    answer:
      'Use the Quick Input at the top of the Notes page or click "New Note". You can type naturally - the AI will automatically extract the title and format your content with markdown.',
  },
  {
    question: 'How do reminders work?',
    answer:
      'Create reminders through the Quick Input or Reminders page. Set a date/time and choose to be notified via email, push notification, or both. Reminders are automatically sent when the time arrives.',
  },
  {
    question: 'What is the Quick Input?',
    answer:
      'The Quick Input bar uses AI to understand your natural language. Type something like "Remind me to call John tomorrow at 2pm" or "Note: Meeting notes from today\'s standup" and it will automatically create the right type of content.',
  },
  {
    question: 'How do I enable push notifications?',
    answer:
      'Go to the Dashboard and look for the Push Notifications section. Click "Enable Push Notifications" and allow notifications when prompted by your browser.',
  },
  {
    question: 'How do I get push notifications on iPhone?',
    answer:
      'On iPhone, you need to add the app to your Home Screen first. Open the app in Safari, tap the Share button, then select "Add to Home Screen". After that, open the app from your Home Screen and enable push notifications from the Dashboard. This is required because iOS only supports push notifications for installed web apps (PWAs).',
  },
  {
    question: 'Can I organize notes with tags?',
    answer:
      'Yes! Tags are automatically suggested by the AI when you create notes. You can also manually add or remove tags from any note. Tags help you filter and find related content quickly.',
  },
  {
    question: 'How do I connect Google Calendar?',
    answer:
      'Navigate to the Integrations page and click "Connect" next to Google Calendar. Complete the OAuth flow in the popup window. Once connected, you can create calendar events using natural language.',
  },
  {
    question: 'What happens to deleted notes?',
    answer:
      'Deleted notes are moved to the Trash where they stay for 30 days before permanent deletion. You can restore notes from the Trash at any time during this period.',
  },
  {
    question: 'Can I create notes via email?',
    answer:
      'Yes! You can email content to your dedicated inbox address. The AI processes incoming emails and creates notes or reminders based on the content and subject line.',
  },
  {
    question: 'How do I change my notification preferences?',
    answer:
      'When creating a reminder, select your preferred notification method: email, push, or both. You can also manage push notification settings from the Dashboard.',
  },
];

function FAQAccordionItem({ item, isOpen, onToggle }: { item: FAQItem; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full py-4 text-left hover:text-primary transition-colors"
      >
        <span className="font-medium pr-4">{item.question}</span>
        <ChevronDown
          className={cn(
            'h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </button>
      <div
        className={cn(
          'overflow-hidden transition-all duration-200',
          isOpen ? 'max-h-96 pb-4' : 'max-h-0'
        )}
      >
        <p className="text-muted-foreground text-sm leading-relaxed">{item.answer}</p>
      </div>
    </div>
  );
}

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Frequently Asked Questions</h1>
        <p className="text-muted-foreground mt-1">
          Find answers to common questions about using the Notes App
        </p>
      </div>

      <div className="bg-card rounded-lg border border-border p-6">
        {faqItems.map((item, index) => (
          <FAQAccordionItem
            key={index}
            item={item}
            isOpen={openIndex === index}
            onToggle={() => setOpenIndex(openIndex === index ? null : index)}
          />
        ))}
      </div>

      <div className="mt-8 text-center text-sm text-muted-foreground">
        <p>
          Still have questions?{' '}
          <a
            href="https://wa.me/48537606403"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Contact Leo
          </a>
        </p>
      </div>
    </div>
  );
}
