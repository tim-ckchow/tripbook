import React, { useState, useRef, useEffect } from 'react';
import { Square, CheckSquare, Trash2, User, AlertTriangle, Edit2, X, Check } from 'lucide-react';
import { TodoItem } from '../../../types';
import { useAuth } from '../../../context/AuthContext';

interface TodoItemCardProps {
    todo: TodoItem;
    onToggle: (id: string, current: boolean) => void;
    onDelete: (id: string) => Promise<void>;
    onEdit: (id: string, newText: string) => Promise<void>;
    showCreator?: boolean;
    isTripOwner?: boolean;
}

export const TodoItemCard: React.FC<TodoItemCardProps> = ({ todo, onToggle, onDelete, onEdit, showCreator, isTripOwner }) => {
    const { user } = useAuth();
    const [isConfirming, setIsConfirming] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    
    // Edit State
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(todo.text);
    const [isSaving, setIsSaving] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    
    // Permission Logic:
    // 1. Private list (!showCreator) -> Always allow delete/edit.
    // 2. Team list -> Allow delete if created by me OR Trip Owner.
    // 3. Team list -> Allow edit if created by me.
    const canDelete = !showCreator || todo.createdBy === user?.uid || isTripOwner;
    const canEdit = !showCreator || todo.createdBy === user?.uid;

    useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
            textareaRef.current.focus();
            // Move cursor to end
            const len = textareaRef.current.value.length;
            textareaRef.current.setSelectionRange(len, len);
        }
    }, [isEditing]);

    const handleDelete = async () => {
        setIsDeleting(true);
        await onDelete(todo.id);
        setIsDeleting(false);
    };

    const handleSaveEdit = async () => {
        if (!editText.trim()) return;
        setIsSaving(true);
        await onEdit(todo.id, editText.trim());
        setIsSaving(false);
        setIsEditing(false);
    };

    if (isEditing) {
        return (
            <div className="bg-white p-3 rounded-2xl shadow-sm border border-brand/50 flex flex-col gap-2 animate-in fade-in duration-200">
                <textarea
                    ref={textareaRef}
                    value={editText}
                    onChange={(e) => {
                        setEditText(e.target.value);
                        e.target.style.height = 'auto';
                        e.target.style.height = e.target.scrollHeight + 'px';
                    }}
                    className="w-full bg-transparent resize-none focus:outline-none text-ink font-medium leading-relaxed"
                    rows={1}
                />
                <div className="flex justify-end gap-2">
                    <button 
                        onClick={() => { setIsEditing(false); setEditText(todo.text); }}
                        disabled={isSaving}
                        className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X size={16} />
                    </button>
                    <button 
                        onClick={handleSaveEdit}
                        disabled={isSaving}
                        className="p-1.5 bg-brand text-white rounded-lg hover:bg-brand/90 transition-colors shadow-sm"
                    >
                        <Check size={16} />
                    </button>
                </div>
            </div>
        );
    }

    if (isConfirming) {
        return (
            <div className="bg-red-50 p-3 rounded-2xl border border-red-100 flex items-center justify-between animate-in fade-in duration-200">
                <div className="flex items-center gap-2 text-red-500 pl-2">
                    <AlertTriangle size={16} />
                    <span className="text-xs font-bold uppercase tracking-wide">Delete?</span>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setIsConfirming(false)}
                        disabled={isDeleting}
                        className="px-3 py-1.5 bg-white text-gray-500 text-xs font-bold rounded-xl border border-gray-200 hover:bg-gray-50 active:scale-95 transition-all"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="px-3 py-1.5 bg-red-500 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1 active:scale-95 transition-all"
                    >
                        {isDeleting ? '...' : <><Trash2 size={12} /> Yes</>}
                    </button>
                </div>
            </div>
        );
    }

    if (todo.isCompleted) {
        return (
            <div className="bg-gray-50 p-4 rounded-2xl border border-transparent flex items-start gap-3 opacity-70 transition-all group">
                <button 
                    onClick={() => onToggle(todo.id, todo.isCompleted)}
                    className="mt-0.5 text-gray-400 hover:text-brand transition-colors active:scale-90 flex-shrink-0"
                >
                    <CheckSquare size={24} />
                </button>
                <div className="flex-1 min-w-0">
                    <span className="text-gray-500 line-through pt-0.5 decoration-gray-300 block leading-relaxed break-words whitespace-pre-wrap">{todo.text}</span>
                    {showCreator && todo.creatorName && (
                        <div className="flex items-center gap-1 mt-1">
                             <User size={10} className="text-gray-300" />
                             <span className="text-[10px] text-gray-400 font-bold">{todo.creatorName}</span>
                        </div>
                    )}
                </div>
                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    {canEdit && (
                        <button 
                            onClick={() => setIsEditing(true)}
                            className="text-gray-300 hover:text-brand transition-colors p-2 active:scale-95 flex-shrink-0"
                        >
                            <Edit2 size={16} />
                        </button>
                    )}
                    {canDelete && (
                        <button 
                            onClick={() => setIsConfirming(true)}
                            className="text-gray-300 hover:text-red-400 transition-colors p-2 active:scale-95 flex-shrink-0"
                        >
                            <Trash2 size={16} />
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex items-start gap-3 animate-in slide-in-from-bottom-2 group">
            <button 
                onClick={() => onToggle(todo.id, todo.isCompleted)}
                className="mt-0.5 text-gray-300 hover:text-brand transition-colors active:scale-90 flex-shrink-0"
            >
                <Square size={24} />
            </button>
            <div className="flex-1 min-w-0">
                <span className="text-ink font-medium leading-relaxed pt-0.5 block break-words whitespace-pre-wrap">{todo.text}</span>
                {showCreator && todo.creatorName && (
                     <div className="flex items-center gap-1 mt-1 bg-gray-50 w-fit px-1.5 py-0.5 rounded">
                          <User size={10} className="text-gray-400" />
                          <span className="text-[10px] text-gray-500 font-bold">{todo.creatorName}</span>
                     </div>
                )}
            </div>
            <div className="flex items-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                {canEdit && (
                    <button 
                        onClick={() => setIsEditing(true)}
                        className="text-gray-300 hover:text-brand transition-colors p-2 active:scale-95 flex-shrink-0"
                    >
                        <Edit2 size={16} />
                    </button>
                )}
                {canDelete && (
                    <button 
                        onClick={() => setIsConfirming(true)}
                        className="text-gray-300 hover:text-red-400 transition-colors p-2 active:scale-95 flex-shrink-0"
                    >
                        <Trash2 size={16} />
                    </button>
                )}
            </div>
        </div>
    );
};