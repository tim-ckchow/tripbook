import React, { useState } from 'react';
import { Square, CheckSquare, Trash2, User, AlertTriangle } from 'lucide-react';
import { TodoItem } from '../../../types';
import { useAuth } from '../../../context/AuthContext';

interface TodoItemCardProps {
    todo: TodoItem;
    onToggle: (id: string, current: boolean) => void;
    onDelete: (id: string) => Promise<void>;
    showCreator?: boolean;
    isTripOwner?: boolean;
}

export const TodoItemCard: React.FC<TodoItemCardProps> = ({ todo, onToggle, onDelete, showCreator, isTripOwner }) => {
    const { user } = useAuth();
    const [isConfirming, setIsConfirming] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    
    // Permission Logic:
    // 1. Private list (!showCreator) -> Always allow delete.
    // 2. Team list -> Allow if I created it OR I am the Trip Owner.
    const canDelete = !showCreator || todo.createdBy === user?.uid || isTripOwner;

    const handleDelete = async () => {
        setIsDeleting(true);
        await onDelete(todo.id);
        // Component will unmount after delete, so no need to set isDeleting(false) usually,
        // but safe to do so if it fails.
        setIsDeleting(false);
    };

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
            <div className="bg-gray-50 p-4 rounded-2xl border border-transparent flex items-start gap-3 opacity-70 transition-all">
                <button 
                    onClick={() => onToggle(todo.id, todo.isCompleted)}
                    className="mt-0.5 text-gray-400 hover:text-brand transition-colors active:scale-90"
                >
                    <CheckSquare size={24} />
                </button>
                <div className="flex-1 min-w-0">
                    <span className="text-gray-500 line-through pt-0.5 decoration-gray-300 block leading-relaxed break-words">{todo.text}</span>
                    {showCreator && todo.creatorName && (
                        <div className="flex items-center gap-1 mt-1">
                             <User size={10} className="text-gray-300" />
                             <span className="text-[10px] text-gray-400 font-bold">{todo.creatorName}</span>
                        </div>
                    )}
                </div>
                {canDelete && (
                    <button 
                        onClick={() => setIsConfirming(true)}
                        className="text-gray-300 hover:text-red-400 transition-colors px-2 active:scale-95"
                    >
                        <Trash2 size={16} />
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex items-start gap-3 animate-in slide-in-from-bottom-2">
            <button 
                onClick={() => onToggle(todo.id, todo.isCompleted)}
                className="mt-0.5 text-gray-300 hover:text-brand transition-colors active:scale-90"
            >
                <Square size={24} />
            </button>
            <div className="flex-1 min-w-0">
                <span className="text-ink font-medium leading-relaxed pt-0.5 block break-words">{todo.text}</span>
                {showCreator && todo.creatorName && (
                     <div className="flex items-center gap-1 mt-1 bg-gray-50 w-fit px-1.5 py-0.5 rounded">
                          <User size={10} className="text-gray-400" />
                          <span className="text-[10px] text-gray-500 font-bold">{todo.creatorName}</span>
                     </div>
                )}
            </div>
            {canDelete && (
                <button 
                    onClick={() => setIsConfirming(true)}
                    className="text-gray-300 hover:text-red-400 transition-colors px-2 active:scale-95"
                >
                    <Trash2 size={16} />
                </button>
            )}
        </div>
    );
};
