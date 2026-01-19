import React, { useEffect, useState, useRef } from 'react';
import { db, firebase } from '../../../lib/firebase';
import { Trip, TodoItem } from '../../../types';
import { useAuth } from '../../../context/AuthContext';
import { Card } from '../../../components/ui/Layout';
import { Plus, CheckCircle2, Lock } from 'lucide-react';
import { TodoItemCard } from './TodoItemCard';

interface PrivateTodoListProps {
    trip: Trip;
}

export const PrivateTodoList: React.FC<PrivateTodoListProps> = ({ trip }) => {
    const { user } = useAuth();
    const [todos, setTodos] = useState<TodoItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [newTodo, setNewTodo] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (!user) return;
        setLoading(true);
        
        // Private path: trips/{tripId}/members/{uid}/private_todos
        const unsubscribe = db.collection(`trips/${trip.id}/members/${user.uid}/private_todos`)
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
    }, [trip.id, user]);

    const handleAddTodo = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTodo.trim() || !user) return;

        setIsAdding(true);
        try {
            await db.collection(`trips/${trip.id}/members/${user.uid}/private_todos`).add({
                text: newTodo.trim(),
                isCompleted: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                createdBy: user.uid,
                // No logs for private todos
            });
            setNewTodo('');
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }
        } catch (err) {
            console.error(err);
            alert('Failed to add private task');
        } finally {
            setIsAdding(false);
        }
    };

    const handleToggle = async (id: string, currentStatus: boolean) => {
        if (!user) return;
        try {
            await db.collection(`trips/${trip.id}/members/${user.uid}/private_todos`).doc(id).update({
                isCompleted: !currentStatus
            });
        } catch (err) {
            console.error("Failed to toggle", err);
        }
    };

    const handleDelete = async (id: string) => {
        if (!user) return;
        try {
            await db.collection(`trips/${trip.id}/members/${user.uid}/private_todos`).doc(id).delete();
        } catch (err) {
            console.error("Failed to delete", err);
        }
    };

    const handleEdit = async (id: string, newText: string) => {
        if (!user) return;
        try {
            await db.collection(`trips/${trip.id}/members/${user.uid}/private_todos`).doc(id).update({
                text: newText
            });
        } catch (err) {
            console.error("Failed to update", err);
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
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-left-4">
            <Card className="bg-ink text-white border-none shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-sm text-yellow-300">
                        <Lock size={20} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black font-rounded">My Private Notes</h2>
                        <p className="text-gray-400 text-xs font-medium">Only visible to you.</p>
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
                        placeholder="Add a private note... (Enter for new line)" 
                        className="w-full pl-4 pr-12 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-gray-500 focus:outline-none focus:bg-white/20 transition-colors backdrop-blur-sm resize-none overflow-hidden min-h-[46px]"
                        style={{ height: 'auto' }}
                    />
                    <button 
                        type="submit" 
                        disabled={!newTodo.trim() || isAdding}
                        className="absolute right-2 bottom-2 w-8 h-8 bg-white text-ink rounded-lg flex items-center justify-center font-bold disabled:opacity-50 active:scale-95 transition-transform"
                    >
                        <Plus size={18} />
                    </button>
                </form>
            </Card>

            <div className="flex flex-col gap-2">
                {loading && <div className="text-center py-10 text-gray-400">Loading your notes...</div>}
                
                {!loading && todos.length === 0 && (
                    <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-3xl bg-white/50 flex flex-col items-center">
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3 text-gray-300">
                            <CheckCircle2 size={24} />
                        </div>
                        <h3 className="font-bold text-gray-400">Nothing here yet</h3>
                        <p className="text-xs text-gray-300">Keep your personal reminders here.</p>
                    </div>
                )}

                {activeTodos.map(todo => (
                    <TodoItemCard 
                        key={todo.id} 
                        todo={todo} 
                        onToggle={handleToggle} 
                        onDelete={handleDelete} 
                        onEdit={handleEdit}
                        showCreator={false}
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
                                showCreator={false}
                            />
                        ))}
                    </>
                )}
            </div>
        </div>
    );
};