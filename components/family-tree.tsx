"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, Settings, Plus, Link as LinkIcon, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FamilyMemberCard } from "./family-member-card"
import { cn } from "@/lib/utils"

export interface FamilyMember {
  id: string
  name: string
  firstName: string; 
  lastName: string; 
  gender: string;    
  suffix?: string;  
  relationship: string
  birthYear?: number
  description?: string;
  photo?: string
  parentId?: string | null
  isAlive?: boolean
  autobiography?: string
  email?: string; // New field for account linking
}

interface FamilyTreeProps {
  members: FamilyMember[]
  isShared?: boolean
  onMemberView?: (id: string) => void
  onAddMember?: (parentId?: string) => void
  onSettings?: () => void
  onJoin?: () => void
  onEdit?: (member: FamilyMember) => void
  onRemove?: (id: string) => void
}

export function FamilyTree({
  members,
  isShared = false,
  onMemberView,
  onEdit,
  onAddMember,
  onSettings,
  onJoin,
  onRemove,
}: FamilyTreeProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  // STEP 1: Normalize all parentId values (handle null, undefined, empty string, "null" string)
  const normalizeParentId = (parentId: any): string | null => {
    if (parentId === null || parentId === undefined || parentId === "" || parentId === "null") {
      return null
    }
    return String(parentId).trim()
  }

  // STEP 2: Normalize all members to ensure consistent parentId format
  const normalizedMembers = members.map(m => ({
    ...m,
    parentId: normalizeParentId(m.parentId)
  }))

  // STEP 3: Find ROOT members - those who are NOT children of anyone else
  // A member is a root if:
  // - Their parentId is null, OR
  // - Their parentId points to a member that doesn't exist
  const getRootMembers = (): FamilyMember[] => {
    const memberIds = new Set(normalizedMembers.map(m => m.id))
    
    // First: find all members who ARE children (have a parent that exists)
    const childrenIds = new Set<string>()
    normalizedMembers.forEach(member => {
      if (member.parentId && memberIds.has(member.parentId)) {
        childrenIds.add(member.id)
      }
    })

    // Second: roots are members who are NOT children
    return normalizedMembers.filter(member => !childrenIds.has(member.id))
  }

  // STEP 4: Get children of a specific parent
  const getChildren = (parentId: string): FamilyMember[] => {
    return normalizedMembers.filter(m => m.parentId === parentId)
  }

  // STEP 5: Calculate generation level (distance from root)
  const calculateGeneration = (memberId: string, visited = new Set<string>()): number => {
    // Prevent infinite loops
    if (visited.has(memberId)) return 0
    visited.add(memberId)

    const member = normalizedMembers.find(m => m.id === memberId)
    if (!member) return 0

    // If no parent, this is generation 0
    if (member.parentId === null) return 0

    // If parent doesn't exist, treat as generation 0
    const parentExists = normalizedMembers.some(m => m.id === member.parentId)
    if (!parentExists) return 0

    // Recursive: 1 + parent's generation
    return 1 + calculateGeneration(member.parentId, visited)
  }

  // STEP 6: Dynamic relationship label generator
  const getDynamicLabel = (generation: number): string => {
    switch (generation) {
      case 0:
        return 'YOU'
      case 1:
        return 'PARENT'
      case 2:
        return 'GRANDPARENT'
      default:
        // For generation 3+, add GREAT- prefix
        // Generation 3 = GREAT-GRANDPARENT
        // Generation 4 = GREAT-GREAT-GRANDPARENT
        const greatCount = generation - 2
        return 'GREAT-'.repeat(greatCount) + 'GRANDPARENT'
    }
  }

  // STEP 7: Render a single tree node with its children
  const renderTreeNode = (member: FamilyMember, generation: number = 0) => {
    const children = getChildren(member.id)
    const dynamicLabel = getDynamicLabel(generation)

    return (
      <div key={member.id} className="flex flex-col items-center">
        {/* Render the member card */}
        <FamilyMemberCard
          id={member.id}
          name={member.name}
          relationship={dynamicLabel}
          birthYear={member.birthYear}
          photo={member.photo}
          generation={generation}
          onView={() => onMemberView?.(member.id)}
          onEdit={() => onEdit?.(member)}
          onAddRelative={() => onAddMember?.(member.id)}
          onRemove={() => onRemove?.(member.id)}
        />

        {/* If this member has children, render them with connectors */}
        {children.length > 0 && (
          <div className="relative mt-8">
            {/* Vertical line from parent down */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1 h-8 -mt-8 bg-gradient-to-b from-primary to-primary/60 rounded-full shadow-[0_0_12px_rgba(74,158,255,0.4)]" />
            
            {/* Container for all children */}
            <div className="flex items-start gap-10 pt-4 flex-wrap justify-center">
              {/* Horizontal line connecting multiple children */}
              {children.length > 1 && (
                <div 
                  className="absolute top-0 h-1 bg-gradient-to-r from-primary/60 via-primary to-primary/60 rounded-full shadow-[0_0_8px_rgba(74,158,255,0.3)]"
                  style={{
                    left: "50%",
                    width: `calc(100% - 100px)`,
                    transform: "translateX(-50%)",
                  }}
                />
              )}
              
              {/* Render each child */}
              {children.map((child) => (
                <div key={child.id} className="relative">
                  {/* Vertical line from horizontal bar to child */}
                  {children.length > 1 && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1 h-4 -mt-4 bg-primary/60 rounded-full" />
                  )}
                  {/* For single child, just vertical line */}
                  {children.length === 1 && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1 h-4 -mt-4 bg-gradient-to-b from-primary to-primary/60 rounded-full" />
                  )}
                  {/* Recursively render child */}
                  {renderTreeNode(child, generation + 1)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  
  const filteredMembers = normalizedMembers.filter((member) =>
    member.name.toLowerCase().includes(searchQuery.toLowerCase())
  )
  // Empty state
  if (normalizedMembers.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="size-20 mx-auto mb-6 rounded-full bg-primary/5 flex items-center justify-center">
          <svg className="size-10 text-primary/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">No Family Members Yet</h3>
        <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
          Start building your family tree by adding family members.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Button onClick={() => onAddMember?.()} className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25 cursor-pointer">
            <Plus className="size-4 mr-2" />
            Start New Lineage
          </Button>
          <Button 
            variant="outline" 
            onClick={onJoin}
            className="cursor-pointer"
          >
            <LinkIcon className="size-4 mr-2" /> Join via Code
          </Button>
        </div>
      </div>
    )
  }

  // Get root members
  const roots = getRootMembers()

  return (
    <div className="space-y-6 px-8 pt-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800/50">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-foreground">Added Members</h3>
          {isShared && (
            <Badge className="bg-success/10 text-success border-success/30">
              Shared
            </Badge>
          )}
        </div>
      </div>


      <div className="w-full flex justify-start mb-11">
        <div className="w-full max-w-[320px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-9 py-2 bg-zinc-900/60 border border-zinc-800/80 rounded-lg text-sm text-zinc-200 placeholder-zinc-500 transition-all focus:outline-none focus:border-zinc-700 focus:bg-zinc-900 shadow-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-0.5 rounded-md hover:bg-zinc-800 transition-colors"
              title="Clear search"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Grid visualization instead of Tree */}
      <div 
         className={cn(
          "relative w-full transition-all duration-500 ease-in-out overflow-hidden",
        isExpanded ? "max-h-[1200px] pb-4" : "max-h-[240px]"
        )}
      >

        
        {/* Grid container spanning full width */}
        <div className="absolute inset-x-0 bottom-0 h-0 bg-gradient-to-t from-background to-transparent pointer-events-none" 
       style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
       
        <div className="w-full flex justify-center">
          <div className={cn(
            "p-1 pb-16 justify-center items-scenter",
            filteredMembers.length > 0 ? "flex flex-wrap gap-6 w-fit" : "w-full"
          )}>
            {filteredMembers.length > 0 ? (
              filteredMembers.map((member) => {
                const generation = calculateGeneration(member.id);
                const dynamicLabel = getDynamicLabel(generation);

                return (
                  <div key={member.id} className="w-[185px] flex-shrink-0">
                    <FamilyMemberCard
                      id={member.id}
                      name={member.name}
                      relationship={dynamicLabel}
                      birthYear={member.birthYear}
                      photo={member.photo}
                      generation={generation}
                      onView={() => onMemberView?.(member.id)}
                      onEdit={() => onEdit?.(member)}
                      onAddRelative={() => onAddMember?.(member.id)}
                      onRemove={() => onRemove?.(member.id)}
                    />
                  </div>
                );
              })
            ) : (
              <div className="w-full flex justify-center items-center py-20">
                <p className="text-sm text-zinc-500 py-12 text-center w-full min-w-[280px]">
                  No members match "{searchQuery}"
                </p>
              </div>
            )}

            

          </div>
        </div>

        {!isExpanded && (
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent pointer-events-none z-10" />
        )}
      </div>

      {/* Toggle button */}
      <Button
        variant="outline"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full border-primary/30 text-primary hover:bg-primary/5 mb-5 cursor-pointer"
      >
        {isExpanded ? (
          <>
            <ChevronUp className="size-4 mr-2" />
            Show Less
          </>
        ) : (
          <>
            <ChevronDown className="size-4 mr-2" />
            Show More
          </>
        )}
      </Button>
      
      {/* Fixed Add Member button — ADD HERE */}
      {!isShared && (
        <button
          onClick={() => onAddMember?.()}
          className="cursor-pointer fixed bottom-40 right-10 z-50 size-14 rounded-full bg-primary hover:bg-primary/90 flex items-center justify-center shadow-xl shadow-primary/30 transition-all hover:scale-105 active:scale-95 group"
        >
          <Plus className="size-6 text-white" />
          <span className="absolute right-16 bg-zinc-800 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg">
            Add Member
          </span>
        </button>
      )}

    </div>
  )
}
