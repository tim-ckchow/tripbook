import React, { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Layout';
import { Rocket } from 'lucide-react';

interface CountdownWidgetProps {
    startDate: string;
}

export const CountdownWidget: React.FC<CountdownWidgetProps> = ({ startDate }) => {
    const [timeLeft, setTimeLeft] = useState<{ days: number, hours: number } | null>(null);
    const [status, setStatus] = useState<'future' | 'current' | 'past'>('future');

    useEffect(() => {
        const calculateTime = () => {
            const start = new Date(startDate);
            start.setHours(0,0,0,0);
            const now = new Date();
            const diff = start.getTime() - now.getTime();
            
            if (diff < -86400000) { // Past 1 day
                 setStatus('past');
                 setTimeLeft(null);
            } else if (diff <= 0) {
                 setStatus('current');
                 setTimeLeft(null);
            } else {
                setStatus('future');
                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                setTimeLeft({ days, hours });
            }
        };

        calculateTime();
        const timer = setInterval(calculateTime, 1000 * 60);
        return () => clearInterval(timer);
    }, [startDate]);

    if (status === 'past') return null;

    if (status === 'current') {
        return (
            <Card className="bg-gradient-to-br from-brand to-emerald-600 text-white overflow-hidden relative border-none shadow-lg mb-0">
                 <div className="absolute top-0 right-0 p-4 opacity-20">
                     <Rocket size={100} className="-rotate-45" />
                 </div>
                 <div className="relative z-10 flex flex-col items-center py-6">
                     <div className="text-xs font-bold uppercase tracking-[0.3em] text-white/70 mb-2">Trip Status</div>
                     <h2 className="text-3xl font-black font-rounded tracking-tight text-white mb-1">Trip is Live!</h2>
                     <p className="text-sm text-emerald-100 font-medium">Have a safe journey</p>
                 </div>
            </Card>
        );
    }

    if (!timeLeft) return null;

    return (
        <Card className="bg-ink text-white overflow-hidden relative border-none shadow-lg mb-0">
             <div className="absolute top-0 right-0 p-4 opacity-10">
                 <Rocket size={100} className="-rotate-45" />
             </div>
             <div className="relative z-10 flex flex-col items-center py-6">
                 <div className="text-xs font-bold uppercase tracking-[0.3em] text-gray-400 mb-2">Ready for Takeoff</div>
                 <div className="flex items-baseline gap-2">
                     <span className="text-7xl font-black font-rounded tracking-tighter">{timeLeft.days}</span>
                     <span className="text-2xl font-bold text-gray-400">days</span>
                 </div>
                 {timeLeft.days < 10 && (
                     <div className="text-sm font-mono text-gray-500 mt-2 bg-white/10 px-3 py-1 rounded-full">{timeLeft.hours} hours to go</div>
                 )}
             </div>
        </Card>
    );
};