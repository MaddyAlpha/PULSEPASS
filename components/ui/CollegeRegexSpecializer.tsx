'use client'

import { useState, useEffect } from 'react'
import { Type, AlignLeft, Hash, Fingerprint, ListFilter, Lock } from 'lucide-react'
import { RegexBlock, BlockType } from './VisualRegexBuilder'

interface CollegeRegexSpecializerProps {
  universityBlocks: RegexBlock[]
  initialCollegeBlocks?: RegexBlock[]
  onChange: (regex: string, hint: string, blocks: RegexBlock[]) => void
}

export default function CollegeRegexSpecializer({ universityBlocks, initialCollegeBlocks, onChange }: CollegeRegexSpecializerProps) {
  const [blocks, setBlocks] = useState<RegexBlock[]>(() => {
    // Attempt to recover locked values by matching block IDs
    if (initialCollegeBlocks && initialCollegeBlocks.length > 0) {
      return universityBlocks.map((uBlock) => {
        const existingColBlock = initialCollegeBlocks.find(cb => cb.id === uBlock.id)
        if (existingColBlock) {
          return {
            ...uBlock,
            lockedValue: existingColBlock.lockedValue,
            lockedChoices: existingColBlock.lockedChoices
          }
        }
        return { ...uBlock }
      })
    }
    return [...universityBlocks]
  })

  useEffect(() => {
    if (blocks.length === 0) {
      onChange('', '', [])
      return
    }

    let regexStr = '^'
    let hintStr = ''

    for (const block of blocks) {
      if (block.lockedChoices && block.lockedChoices.length > 0) {
        const escapedChoices = block.lockedChoices.map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        regexStr += `(${escapedChoices.join('|')})`
        hintStr += `[${block.lockedChoices.join('/')}]`
      } else if (block.lockedValue) {
        const escaped = block.lockedValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        regexStr += escaped
        hintStr += block.lockedValue
      } else if (block.type === 'text' && block.value) {
        const escaped = block.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        regexStr += escaped
        hintStr += block.value
      } else if (block.type === 'choices' && block.choices && block.choices.length > 0) {
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

  const updateLockedValue = (index: number, val: string) => {
    setBlocks(prev => {
      const newBlocks = [...prev]
      const block = newBlocks[index]
      
      // Validate length if letters/numbers/alphanumeric
      if (block.length && val.length > block.length) return prev

      // Allow only letters for 'letters', numbers for 'numbers'
      if (block.type === 'letters' && /[^a-zA-Z]/.test(val)) return prev
      if (block.type === 'numbers' && /[^0-9]/.test(val)) return prev
      if (block.type === 'alphanumeric' && /[^a-zA-Z0-9]/.test(val)) return prev

      // Force uppercase
      newBlocks[index] = { ...block, lockedValue: val.toUpperCase() }
      return newBlocks
    })
  }

  const toggleChoice = (index: number, choice: string) => {
    setBlocks(prev => {
      const newBlocks = [...prev]
      const block = newBlocks[index]
      const currentChoices = block.lockedChoices || []
      
      let newChoices;
      if (currentChoices.includes(choice)) {
        newChoices = currentChoices.filter(c => c !== choice)
      } else {
        newChoices = [...currentChoices, choice]
      }
      
      newBlocks[index] = { ...block, lockedChoices: newChoices }
      return newBlocks
    })
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
          <div key={block.id} className="flex flex-wrap items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 relative overflow-hidden group">
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${block.type === 'text' ? 'bg-white/20' : 'bg-cyber-green/50'}`} />
            
            <div className="flex flex-col gap-1 items-center justify-center w-12 text-cyber-green bg-cyber-green/10 rounded-lg py-2 shrink-0">
              {renderIcon(block.type)}
              <span className="text-[9px] uppercase font-bold text-cyber-green/70">{block.type}</span>
            </div>
            
            <div className="flex-1 min-w-[200px]">
              {block.type === 'text' ? (
                <div>
                  <span className="text-xs text-white/50 uppercase font-semibold block mb-1">Fixed Separator</span>
                  <p className="font-mono text-xl font-bold text-white">{block.value}</p>
                </div>
              ) : (
                <div className="flex items-end gap-4">
                  <div className="flex-1">
                    <span className="text-xs text-cyber-green uppercase font-bold block mb-1 flex items-center gap-1">
                      {block.label || `Dynamic ${block.type}`}
                      <Lock className="w-3 h-3 ml-1 opacity-50" />
                    </span>
                    <p className="text-xs text-white/40 mb-2">
                      {block.type === 'choices' ? `Allowed values: ${block.choices?.join(', ')}` : `Length: ${block.length}`}
                    </p>
                    <div className="relative">
                      {block.type === 'choices' ? (
                        <div className="flex flex-wrap gap-2 mt-1">
                          {block.choices?.map(c => {
                            const isSelected = block.lockedChoices?.includes(c)
                            return (
                              <button
                                key={c}
                                type="button"
                                onClick={() => toggleChoice(index, c)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-mono font-bold transition-all border ${
                                  isSelected 
                                    ? 'bg-cyber-green/20 text-cyber-green border-cyber-green/50' 
                                    : 'bg-black/60 text-white/40 border-white/10 hover:border-white/30 hover:bg-white/5'
                                }`}
                              >
                                {c}
                              </button>
                            )
                          })}
                          {(!block.lockedChoices || block.lockedChoices.length === 0) && (
                            <span className="text-[10px] text-white/30 italic mt-2 ml-1 w-full">
                              (Select specific options to restrict, otherwise any option is allowed)
                            </span>
                          )}
                        </div>
                      ) : (
                        <input
                          type="text"
                          placeholder="Optional: Lock to specific value"
                          value={block.lockedValue || ''}
                          onChange={(e) => updateLockedValue(index, e.target.value)}
                          className="bg-black/60 border border-cyber-green/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyber-green w-full font-mono text-amber-400 font-bold uppercase placeholder:text-white/20 placeholder:font-sans placeholder:font-normal"
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
