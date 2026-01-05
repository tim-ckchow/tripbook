import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Settings, FileText, HelpCircle, Shield, LogOut, ClipboardList, User } from 'lucide-react';
import { PatchNotesModal } from '../../features/misc/PatchNotesModal';
import { DummyPage } from '../../features/misc/DummyPage';

export const UserMenu: React.FC = () => {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [activePage, setActivePage] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleLogout = async () => {
    setIsOpen(false);
    await logout();
  };

  const menuItems = [
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'patch_notes', label: 'Patch Notes', icon: ClipboardList },
    { id: 'help', label: 'Help & Feedback', icon: HelpCircle },
  ];

  const legalItems = [
    { id: 'terms', label: 'Terms and Conditions', icon: FileText },
    { id: 'privacy', label: 'Personal Data Collection Statement', icon: Shield },
  ];

  return (
    <div className="relative z-50" ref={menuRef}>
      {/* Trigger Icon */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-9 h-9 rounded-full bg-brand/10 border-2 border-white text-brand flex items-center justify-center hover:bg-brand/20 transition-colors shadow-sm active:scale-95"
      >
        <User size={20} strokeWidth={2.5} />
      </button>

      {/* Dropdown Popup */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-3 w-72 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 animate-in fade-in slide-in-from-top-2 origin-top-right">
            {/* User Header */}
            <div className="px-5 py-4 border-b border-gray-100">
                <div className="font-bold text-ink text-lg leading-tight font-rounded">
                    {user?.displayName || 'User'}
                </div>
                <div className="text-xs text-gray-400 font-medium truncate mt-0.5">
                    {user?.email}
                </div>
            </div>

            {/* Main Items */}
            <div className="py-2">
                {menuItems.map(item => (
                    <button
                        key={item.id}
                        onClick={() => {
                            setActivePage(item.id);
                            setIsOpen(false);
                        }}
                        className="w-full text-left px-5 py-3 hover:bg-gray-50 flex items-center gap-3 transition-colors group"
                    >
                        <item.icon size={18} className="text-gray-400 group-hover:text-brand transition-colors" />
                        <span className="text-sm font-bold text-gray-600 group-hover:text-ink">{item.label}</span>
                    </button>
                ))}
            </div>

            <div className="h-px bg-gray-100 mx-5 my-1"></div>

            {/* Legal Items */}
            <div className="py-2">
                {legalItems.map(item => (
                    <button
                        key={item.id}
                        onClick={() => {
                            setActivePage(item.id);
                            setIsOpen(false);
                        }}
                        className="w-full text-left px-5 py-3 hover:bg-gray-50 flex items-center gap-3 transition-colors group"
                    >
                        <item.icon size={18} className="text-gray-400 group-hover:text-brand transition-colors" />
                        <span className="text-sm font-bold text-gray-600 group-hover:text-ink">{item.label}</span>
                    </button>
                ))}
            </div>

            <div className="h-px bg-gray-100 mx-5 my-1"></div>

            {/* Logout */}
            <div className="py-2">
                <button
                    onClick={handleLogout}
                    className="w-full text-left px-5 py-3 hover:bg-red-50 flex items-center gap-3 transition-colors group"
                >
                    <LogOut size={18} className="text-red-400 group-hover:text-red-500" />
                    <span className="text-sm font-bold text-red-500">Logout</span>
                </button>
            </div>
        </div>
      )}

      {/* Modals */}
      {activePage === 'patch_notes' && (
          <PatchNotesModal onClose={() => setActivePage(null)} />
      )}
      
      {activePage === 'settings' && <DummyPage title="Settings" onClose={() => setActivePage(null)} />}
      {activePage === 'help' && <DummyPage title="Help & Feedback" onClose={() => setActivePage(null)} />}
      {activePage === 'terms' && <DummyPage title="Terms and Conditions" onClose={() => setActivePage(null)} />}
      {activePage === 'privacy' && <DummyPage title="Personal Data Collection Statement" onClose={() => setActivePage(null)} />}

    </div>
  );
};