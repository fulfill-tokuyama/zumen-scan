"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Send, Loader2 } from "lucide-react"

type Message = {
  role: "user" | "assistant"
  content: string
}

type QuestionChatProps = {
  imageBase64: string
  mimeType: string
}

const HINTS = [
  "この壁の厚みは？",
  "材料の合計本数は？",
  "この部屋の畳数は？",
]

export function QuestionChat({ imageBase64, mimeType }: QuestionChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const sendQuestion = async (question: string) => {
    if (!question.trim() || isLoading) return

    const userMessage: Message = { role: "user", content: question.trim() }
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    try {
      const res = await fetch("/api/analyze", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, mimeType, question: question.trim() }),
      })
      const data = await res.json()
      if (data.answer) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.answer },
        ])
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "回答を取得できませんでした。" },
        ])
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "エラーが発生しました。" },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendQuestion(input)
    }
  }

  return (
    <div className="mt-6 rounded-lg border border-slate-700 bg-slate-800/50 p-4">
      <h3 className="mb-3 text-sm font-medium text-slate-300">
        💬 図面について質問する
      </h3>

      {/* Hints */}
      {messages.length === 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {HINTS.map((hint) => (
            <button
              key={hint}
              onClick={() => sendQuestion(hint)}
              className="rounded-full bg-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-600 transition-colors"
            >
              {hint}
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      {messages.length > 0 && (
        <div className="mb-3 max-h-64 space-y-3 overflow-y-auto">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === "user"
                    ? "bg-amber-600 text-white"
                    : "bg-slate-700 text-slate-200"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="rounded-lg bg-slate-700 px-3 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="図面について質問..."
          className="flex-1 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
          disabled={isLoading}
        />
        <Button
          onClick={() => sendQuestion(input)}
          disabled={!input.trim() || isLoading}
          size="sm"
          className="bg-amber-600 hover:bg-amber-700"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
