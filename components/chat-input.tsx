"use client"

import type React from "react"
import { useState, useRef, useEffect, useCallback, memo } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Send, Paperclip, ImageIcon, File, X } from "lucide-react"

interface ChatInputProps {
  onSend: (text: string, files: File[]) => void
  onTyping?: () => void
  loading: boolean
  uploading: boolean
  maxFiles?: number
}

export const ChatInput = memo(function ChatInput({
  onSend,
  onTyping,
  loading,
  uploading,
  maxFiles = 5,
}: ChatInputProps) {
  const [input, setInput] = useState("")
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isTypingSentRef = useRef(false)

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = "auto"
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`
    }
  }, [input])

  const handleTyping = useCallback(() => {
    if (!onTyping) return
    if (!isTypingSentRef.current) {
      isTypingSentRef.current = true
      onTyping()
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      isTypingSentRef.current = false
    }, 3000)
  }, [onTyping])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    handleTyping()
  }, [handleTyping])

  const handleSend = useCallback(() => {
    if (!input.trim() && selectedFiles.length === 0) return
    onSend(input, selectedFiles)
    setInput("")
    setSelectedFiles([])
    isTypingSentRef.current = false
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
  }, [input, selectedFiles, onSend])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files)
      setSelectedFiles(prev => [...prev, ...newFiles].slice(0, maxFiles))
    }
    e.target.value = ""
  }, [maxFiles])

  // Allow parent to set input text (for question form submissions)
  // We expose this via a global callback
  useEffect(() => {
    (window as any).__chatInputSetText = (text: string) => {
      setInput(text)
    }
    return () => {
      delete (window as any).__chatInputSetText
    }
  }, [])

  return (
    <div className="space-y-2">
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">{selectedFiles.length} fichier(s)</span>
            <button
              onClick={() => setSelectedFiles([])}
              className="text-xs text-red-500 hover:text-red-700"
            >
              Tout retirer
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedFiles.map((file, index) => (
              <div key={index} className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-full text-sm">
                {file.type.startsWith("image/") ? (
                  <ImageIcon className="h-4 w-4 text-gray-500" />
                ) : (
                  <File className="h-4 w-4 text-gray-500" />
                )}
                <span className="truncate max-w-[150px] text-gray-700">{file.name}</span>
                <button
                  onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== index))}
                  className="text-gray-400 hover:text-red-500"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="flex gap-2 items-end">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
          accept="image/*,.pdf,.doc,.docx,.txt,.xlsx,.xls,.csv,.zip,.rar,.dwg,.dxf,.ppt,.pptx,.rtf,.odt,.ods,.odp"
        />
        <div className="relative">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || uploading || selectedFiles.length >= maxFiles}
            className="h-10 w-10 text-gray-400 hover:text-gray-600"
          >
            <Paperclip className="h-5 w-5" />
          </Button>
          {selectedFiles.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
              {selectedFiles.length}
            </span>
          )}
        </div>
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Votre message..."
          disabled={loading || uploading}
          className="flex-1 min-h-[44px] max-h-[120px] resize-none text-[16px] md:text-sm rounded-xl border-gray-200 focus:border-orange-300 focus:ring-orange-200"
          rows={1}
        />
        <Button
          onClick={handleSend}
          disabled={loading || uploading || (!input.trim() && selectedFiles.length === 0)}
          className="h-10 w-10 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50"
          size="icon"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
})
