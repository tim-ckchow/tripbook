import React, { useEffect, useState, useRef } from 'react';
import { db, firebase } from '../../../lib/firebase';
import { Trip, TodoItem } from '../../../types';
import { useAuth } from '../../../context/AuthContext';
import { Card } from '../../../components/ui/Layout';
import { Plus, CheckCircle2, ListTodo } from 'lucide-react';
import { TodoItemCard } from './TodoItemCard';

interface TeamTodoListProps {
    trip: Trip;
}

export const TeamTodoList: React.FC<TeamTodoListProps> = ({ trip }) => {
    const { user } = useAuth();
    const [todos, setTodos] = useState<TodoItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [newTodo, setNewTodo] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    
    const isOwner = user?.uid === trip.ownerUid;

    useEffect(() => {
        setLoading(true);
        const unsubscribe = db.collection(`trips/${trip.id}/todos`)
            .orderBy('createdAt', 'desc')
            .onSnapshot((snapshot) => {
                const data = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as TodoItem[];
                setTodos(data);
                setLoading(false);
            });
        return () => unsubscribe();
    }, [trip.id]);

    const logActivity = async (action: 'create' | 'update' | 'delete', title: string) => {
        try {
            await db.collection(`trips/${trip.id}/logs`).add({
                tripId: trip.id,
                timestamp: new Date().toISOString(),
                category: 'todo',
                action,
                title,
                details: 'Team Checklist',
                userUid: user?.uid || 'unknown',
                userName: user?.displayName || user?.email?.split('@')[0] || 'Member'
            });
        } catch (err) {
            console.error("Failed to log", err);
        }
    };

    const handleAddTodo = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTodo.trim()) return;

        setIsAdding(true);
        const text = newTodo.trim();
        try {
            await db.collection(`trips/${trip.id}/todos`).add({
                text: text,
                isCompleted: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                createdBy: user?.uid,
                creatorName: user?.displayName || user?.email?.split('@')[0]
            });
            logActivity('create', `Added task: ${text.length > 20 ? text.substring(0, 20) + '...' : text}`);
            setNewTodo('');
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }
        } catch (err: any) {
            console.error(err);
            alert(`Failed to add task: ${err.message}`);
        } finally {
            setIsAdding(false);
        }
    };

    const handleToggle = async (id: string, currentStatus: boolean) => {
        const item = todos.find(t => t.id === id);
        try {
            await db.collection(`trips/${trip.id}/todos`).doc(id).update({
                isCompleted: !currentStatus
            });
            if (item && !currentStatus) {
                // Only log completion
                logActivity('update', `Completed task: ${item.text.length > 20 ? item.text.substring(0, 20) + '...' : item.text}`);
            }
        } catch (err) {
            console.error("Failed to toggle", err);
        }
    };

    const handleDelete = async (id: string) => {
        const item = todos.find(t => t.id === id);
        try {
            await db.collection(`trips/${trip.id}/todos`).doc(id).delete();
            if (item) logActivity('delete', `Deleted task: ${item.text.length > 20 ? item.text.substring(0, 20) + '...' : item.text}`);
        } catch (err: any) {
            console.error("Failed to delete", err);
            if (err.code === 'permission-denied') {
                alert("Only the creator or trip owner can delete shared tasks.");
            } else {
                alert("Failed to delete task.");
            }
        }
    };

    const handleEdit = async (id: string, newText: string) => {
        try {
            await db.collection(`trips/${trip.id}/todos`).doc(id).update({
                text: newText
            });
        } catch (err: any) {
            console.error("Failed to update", err);
            alert("Failed to update task.");
        }
    };

    const activeTodos = todos.filter(t => !t.isCompleted);
    const completedTodos = todos.filter(t => t.isCompleted);

    const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
        e.currentTarget.style.height = 'auto';
        e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Submit on Ctrl+Enter or Cmd+Enter only
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleAddTodo(e);
        }
        // Plain enter adds new line (default behavior)
    };

    return (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-right-4">
            <Card className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white border-none shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                        <ListTodo size={20} className="text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black font-rounded">Team Checklist</h2>
                        <p className="text-indigo-100 text-xs font-medium">Shared tasks for everyone.</p>
                    </div>
                </div>

                <form onSubmit={handleAddTodo} className="relative">
                    <textarea 
                        ref={textareaRef}
                        rows={1}
                        value={newTodo}
                        onChange={e => setNewTodo(e.target.value)}
                        onInput={handleInput}
                        onKeyDown={handleKeyDown}
                        placeholder="Add a shared task... (Enter for new line)" 
                        className="w-full pl-4 pr-12 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/50 focus:outline-none focus:bg-white/20 transition-colors backdrop-blur-sm resize-none overflow-hidden min-h-[46px]"
                        style={{ height: 'auto' }}
                    />
                    <button 
                        type="submit" 
                        disabled={!newTodo.trim() || isAdding}
                        className="absolute right-2 bottom-2 w-8 h-8 bg-white text-indigo-600 rounded-lg flex items-center justify-center font-bold disabled:opacity-50 active:scale-95 transition-transform"
                    >
                        <Plus size={18} />
                    </button>
                </form>
            </Card>

            <div className="flex flex-col gap-2">
                {loading && <div className="text-center py-10 text-gray-400">Loading team list...</div>}
                
                {!loading && todos.length === 0 && (
                    <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-3xl bg-white/50 flex flex-col items-center">
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3 text-gray-300">
                            <CheckCircle2 size={24} />
                        </div>
                        <h3 className="font-bold text-gray-400">All caught up!</h3>
                        <p className="text-xs text-gray-300">Add shared items above.</p>
                    </div>
                )}

                {activeTodos.map(todo => (
                    <TodoItemCard 
                        key={todo.id} 
                        todo={todo} 
                        onToggle={handleToggle} 
                        onDelete={handleDelete} 
                        onEdit={handleEdit}
                        showCreator={true}
                        isTripOwner={isOwner}
                    />
                ))}

                {completedTodos.length > 0 && (
                    <>
                        <div className="flex items-center gap-2 mt-4 px-2">
                            <div className="h-px bg-gray-200 flex-1"></div>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Completed</span>
                            <div className="h-px bg-gray-200 flex-1"></div>
                        </div>
                        {completedTodos.map(todo => (
                            <TodoItemCard 
                                key={todo.id} 
                                todo={todo} 
                                onToggle={handleToggle} 
                                onDelete={handleDelete}
                                onEdit={handleEdit}
                                showCreator={true}
                                isTripOwner={isOwner}
                            />
                        ))}
                    </>
                )}
            </div>
        </div>
    );
};