/**
 * QuestionCarouselPart - 问题轮播
 * 对齐 VS Code chatQuestionCarouselPart.ts (简化版)
 */
import { useState } from 'react';
import { ChevronLeft, ChevronRight, HelpCircle } from 'lucide-react';

export interface CarouselQuestion {
  label: string;
  value: string;
}

export interface QuestionCarouselPartData {
  id: string;
  type: 'question_carousel';
  questions: CarouselQuestion[];
  currentIndex?: number;
  onSelect?: (value: string) => void;
}

interface Props extends QuestionCarouselPartData {}

export function QuestionCarouselPart({ questions, currentIndex = 0, onSelect }: Props) {
  const [index, setIndex] = useState(currentIndex);
  if (!questions.length) return null;

  const current = questions[index];
  const hasPrev = index > 0;
  const hasNext = index < questions.length - 1;

  const goPrev = () => setIndex((i) => Math.max(0, i - 1));
  const goNext = () => setIndex((i) => Math.min(questions.length - 1, i + 1));

  return (
    <div className="vscode-chat-question-carousel">
      <div className="vscode-chat-question-carousel-header">
        <HelpCircle size={13} />
        <span className="vscode-chat-question-carousel-title">Quick Questions</span>
        <span className="vscode-chat-question-carousel-count">{index + 1} / {questions.length}</span>
      </div>
      <div className="vscode-chat-question-carousel-body">
        <button
          className="vscode-chat-question-carousel-nav prev"
          onClick={goPrev}
          disabled={!hasPrev}
        >
          <ChevronLeft size={14} />
        </button>
        <button
          className="vscode-chat-question-carousel-content"
          onClick={() => onSelect?.(current.value)}
        >
          {current.label}
        </button>
        <button
          className="vscode-chat-question-carousel-nav next"
          onClick={goNext}
          disabled={!hasNext}
        >
          <ChevronRight size={14} />
        </button>
      </div>
      <div className="vscode-chat-question-carousel-dots">
        {questions.map((_, i) => (
          <span
            key={i}
            className={`vscode-chat-question-carousel-dot ${i === index ? 'active' : ''}`}
            onClick={() => setIndex(i)}
          />
        ))}
      </div>
    </div>
  );
}