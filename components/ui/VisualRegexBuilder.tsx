'use client'

import { useState, useEffect } from 'react'
import { Plus, X, Type, Hash, AlignLeft, Fingerprint, ListFilter } from 'lucide-react'

export type BlockType = 'text' | 'letters' | 'numbers' | 'alphanumeric' | 'choices'

export interface RegexBlock {
  id: string
  type: BlockType
  value?: string
  length?: number
  choices?: string[] // For 'choices' type
  label?: string // Optional label for dynamic forms (e.g. "Year", "College Code")
  lockedValue?: string // Used by college admin to lock a university block
  lockedChoices?: string[] // Used by college admin to select a subset of choices
}

interface VisualRegexBuilderProps {
  initialBlocks?: RegexBlock[]
  onChange: (regex: string, hint: string, blocks: RegexBlock[]) => void
}

export default function VisualRegexBuilder({ initialBlocks, onChange }: VisualRegexBuilderProps) {
  const [blocks, setBlocks] = useState<RegexBlock[]>(initialBlocks || [])

  useEffect(() => {
    // Generate Regex and Hint whenever blocks change
    if (blocks.length === 0) {
      onChange('', '', [])
      return
    }

    let regexStr = '^'
    let hintStr = ''

    for (const block of blocks) {
      if (block.lockedChoices && block.lockedChoices.length > 0) {
        // Treat locked subset of choices as the new choices
        const escapedChoices = block.lockedChoices.map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        regexStr += `(${escapedChoices.join('|')})`
        hintStr += `[${block.lockedChoices.join('/')}]`
      } else if (block.lockedValue) {
        // Treat locked dynamic blocks as exact text
        const escaped = block.lockedValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        regexStr += escaped
        hintStr += block.lockedValue
      } else if (block.type === 'text' && block.value) {
        // Escape special regex characters in the fixed text
        const escaped = block.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        regexStr += escaped
        hintStr += block.value
      } else if (block.type === 'choices' && block.choices && block.choices.length > 0) {
        // e.g. (S|H|A|V)
        const escapedChoices = block.choices.map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        regexStr += `(${escapedChoices.join('|')})`
        hintStr += `[${block.choices.join('/')}]`
      } else if (block.type === 'letters' && block.length) {
        regexStr += `[A-Za-z]{${block.length}}`
        hintStr += 'A'.repeat(block.length)
      } else if (block.type === 'numbers' && block.length) {
        regexStr += `[0-9]{${block.length}}`
        hintStr += '#'.repeat(block.length)
      } else if (block.type === 'alphanumeric' && block.length) {
        regexStr += `[A-Za-z0-9]{${block.length}}`
        hintStr += 'X'.repeat(block.length)
      }
    }

    regexStr += '$'
    onChange(regexStr, hintStr, blocks)
  }, [blocks])

  const addBlock = (type: BlockType) => {
    setBlocks(prev => [
      ...prev,
      { 
        id: Math.random().toString(36).substr(2, 9), 
        type, 
        value: type === 'text' ? '' : undefined, 
        length: type !== 'text' && type !== 'choices' ? 1 : undefined,
        choices: type === 'choices' ? [] : undefined,
        label: type !== 'text' ? '' : undefined
      }
    ])
  }

  const removeBlock = (id: string) => {
    setBlocks(prev => prev.filter(b => b.id !== id))
  }

  const updateBlock = (id: string, updates: Partial<RegexBlock>) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b))
  }

  const handleChoicesChange = (id: string, val: string) => {
    // split by comma and trim
    const choices = val.split(',').map(s => s.trim()).filter(Boolean)
    updateBlock(id, { choices })
  }

  const renderIcon = (type: BlockType) => {
    switch(type) {
      case 'text': return <Type className="w-4 h-4" />
      case 'letters': return <AlignLeft className="w-4 h-4" />
      case 'numbers': return <Hash className="w-4 h-4" />
      case 'alphanumeric': return <Fingerprint className="w-4 h-4" />
      case 'choices': return <ListFilter className="w-4 h-4" />
    }
  }

  return (
    <div className="p-4 rounded-xl border border-white/[0.06] bg-black/20">
      <div className="flex flex-col gap-4 mb-4">
        {blocks.map((block, index) => (
          <div key={block.id} className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 group">
            <div className="flex flex-col gap-1 items-center justify-center w-12 text-cyber-green bg-cyber-green/10 rounded-lg py-2">
              {renderIcon(block.type)}
              <span className="text-[9px] uppercase font-bold text-cyber-green/70">{block.type}</span>
            </div>
            
            {block.type !== 'text' && (
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-white/50 uppercase font-semibold">Field Label</span>
                <input
                  type="text"
                  placeholder="e.g. Year"
                  value={block.label || ''}
                  onChange={e => updateBlock(block.id, { label: e.target.value })}
                  className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-cyber-green w-32"
                />
              </div>
            )}

            {block.type === 'text' ? (
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-white/50 uppercase font-semibold">Exact Text</span>
                <input
                  type="text"
                  placeholder="e.g. -"
                  value={block.value || ''}
                  onChange={e => updateBlock(block.id, { value: e.target.value })}
                  className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-cyber-green w-24 text-center font-mono"
                />
              </div>
            ) : block.type === 'choices' ? (
              <div className="flex flex-col gap-1 flex-1">
                <span className="text-[10px] text-white/50 uppercase font-semibold">Choices (Comma separated)</span>
                <input
                  type="text"
                  placeholder="e.g. S, H, A, V"
                  value={(block.choices || []).join(', ')}
                  onChange={e => handleChoicesChange(block.id, e.target.value)}
                  className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-cyber-green w-full font-mono"
                />
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-white/50 uppercase font-semibold">Length</span>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={block.length || 1}
                  onChange={e => updateBlock(block.id, { length: parseInt(e.target.value) || 1 })}
                  className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-cyber-green w-20 text-center"
                />
              </div>
            )}
            
            <div className="flex-1 flex justify-end">
              <button
                onClick={() => removeBlock(block.id)}
                className="p-2 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 pt-4 border-t border-white/10">
        <button onClick={() => addBlock('text')} type="button" className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/10 transition-colors">
          <Plus className="w-3 h-3" /> Exact Separator
        </button>
        <button onClick={() => addBlock('choices')} type="button" className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-amber-400">
          <Plus className="w-3 h-3" /> Dropdown Choices
        </button>
        <button onClick={() => addBlock('numbers')} type="button" className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/10 transition-colors">
          <Plus className="w-3 h-3" /> Numbers
        </button>
        <button onClick={() => addBlock('letters')} type="button" className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/10 transition-colors">
          <Plus className="w-3 h-3" /> Letters
        </button>
        <button onClick={() => addBlock('alphanumeric')} type="button" className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/10 transition-colors">
          <Plus className="w-3 h-3" /> Any (Alphanumeric)
        </button>
      </div>

      {blocks.length === 0 && (
        <p className="text-sm text-white/30 mt-4 text-center py-4 bg-white/[0.02] rounded-xl border border-white/[0.05] border-dashed">
          Click the buttons above to start building a smart roll number format.
        </p>
      )}
    </div>
  )
}
