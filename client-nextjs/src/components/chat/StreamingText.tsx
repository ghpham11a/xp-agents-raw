"use client";

interface StreamingTextProps {
  text: string;
  isStreaming: boolean;
}

export default function StreamingText({ text, isStreaming }: StreamingTextProps) {
  return (
    <span>
      {text}
      {isStreaming && (
        <span className="inline-block w-1.5 h-4 ml-0.5 bg-od-blue animate-pulse" />
      )}
    </span>
  );
}
