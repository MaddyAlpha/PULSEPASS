'use client'

import { useState, useEffect, useRef } from 'react'
import type { RegexBlock } from './VisualRegexBuilder'

interface DynamicRollNumberInputProps {
  blocks: RegexBlock[]
  value: string
  onChange: (val: string) => void
}

export default function DynamicRollNumberInput({ blocks, value, onChange }: DynamicRollNumberInputProps) {
  // State to hold the value of each block
  const [blockValues, setBlockValues] = useState<Record<string, string>>({})
  const inputRefs = useRef<(HTMLInputElement | HTMLSelectElement | null)[]>([])

  // On mount or block change, parse the initial value or set defaults
  useEffect(() => {
    if (!blocks || blocks.length === 0) return

    const newVals: Record<string, string> = {}
    
    // If we have an incoming concatenated value, we try to split it, but it's complex 
    // because length isn't always fixed (choices can vary).
    // For simplicity, we just initialize choices with their first option if empty,
    // and text with their fixed value.
    blocks.forEach((block) => {
      if (block.type === 'text') {
        newVals[block.id] = block.value || ''
      } else if (block.type === 'choices') {
        // Default to first choice if available
        newVals[block.id] = (block.choices && block.choices.length > 0) ? block.choices[0] : ''
      } else {
        newVals[block.id] = ''
      }
    })
    
    // If the parent passes an empty string (e.g. form reset), reset our state
    if (!value) {
      setBlockValues(newVals)
    }
  }, [blocks, value])

  // Re-calculate the final concatenated string whenever a part changes
  useEffect(() => {
    if (!blocks || blocks.length === 0) return
    const fullString = blocks.map(b => blockValues[b.id] || '').join('')
    onChange(fullString)
  }, [blockValues, blocks])

  const handleInputChange = (id: string, idx: number, val: string, maxLength?: number) => {
    // Only allow max length
    if (maxLength && val.length > maxLength) return

    setBlockValues(prev => ({ ...prev, [id]: val.toUpperCase() }))

    // Auto-focus next input if we hit max length
    if (maxLength && val.length === maxLength) {
      // Find the next focusable input
      for (let i = idx + 1; i < blocks.length; i++) {
        if (blocks[i].type !== 'text' && inputRefs.current[i]) {
          inputRefs.current[i]?.focus()
          break
        }
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>, idx: number) => {
    if (e.key === 'Backspace' && !(e.target as HTMLInputElement).value) {
      // Focus previous input on backspace if current is empty
      for (let i = idx - 1; i >= 0; i--) {
        if (blocks[i].type !== 'text' && inputRefs.current[i]) {
          inputRefs.current[i]?.focus()
          break
        }
      }
    }
  }

  if (!blocks || blocks.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {blocks.map((block, idx) => {
        if (block.type === 'text') {
          return (
            <span key={block.id} className="text-white/40 font-bold font-mono">
              {block.value}
            </span>
          )
        }

        if (block.type === 'choices') {
          return (
            <div key={block.id} className="flex flex-col gap-1">
              {block.label && <span className="text-[10px] text-white/50 uppercase font-semibold">{block.label}</span>}
              <select
                ref={el => { inputRefs.current[idx] = el }}
                value={blockValues[block.id] || ''}
                onChange={e => {
                  setBlockValues(prev => ({ ...prev, [block.id]: e.target.value }))
                  // Auto-focus next input
                  for (let i = idx + 1; i < blocks.length; i++) {
                    if (blocks[i].type !== 'text' && inputRefs.current[i]) {
                      inputRefs.current[i]?.focus()
                      break
                    }
                  }
                }}
                className="input-cyber py-2 px-3 text-sm appearance-none bg-obsidian-900 min-w-[80px]"
              >
                {block.choices?.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          )
        }

        // numbers, letters, alphanumeric
        const placeholder = block.type === 'numbers' ? '0'.repeat(block.length || 1) : 
                            block.type === 'letters' ? 'A'.repeat(block.length || 1) : 
                            'X'.repeat(block.length || 1)

        return (
          <div key={block.id} className="flex flex-col gap-1">
            {block.label && <span className="text-[10px] text-white/50 uppercase font-semibold">{block.label}</span>}
            <input
              ref={el => { inputRefs.current[idx] = el }}
              type="text"
              placeholder={placeholder}
              value={blockValues[block.id] || ''}
              onChange={e => {
                let val = e.target.value
                if (block.type === 'numbers') val = val.replace(/[^0-9]/g, '')
                if (block.type === 'letters') val = val.replace(/[^a-zA-Z]/g, '')
                if (block.type === 'alphanumeric') val = val.replace(/[^a-zA-Z0-9]/g, '')
                handleInputChange(block.id, idx, val, block.length)
              }}
              onKeyDown={e => handleKeyDown(e, idx)}
              style={{ width: `${Math.max(3, (block.length || 1) + 1)}ch` }}
              className="input-cyber py-2 px-3 text-sm text-center font-mono uppercase tracking-widest min-w-[50px]"
            />
          </div>
        )
      })}
    </div>
  )
}
