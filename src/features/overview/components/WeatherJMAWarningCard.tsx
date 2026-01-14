import React from 'react';
import { Card } from '../../../components/ui/Layout';
import { JMAWarning } from '../WeatherShared';
import { AlertTriangle, AlertOctagon, Info, Snowflake, CloudRain, Wind, Mountain, CloudLightning, ExternalLink, Megaphone } from 'lucide-react';

interface WeatherJMAWarningCardProps {
    warning: JMAWarning;
    regionName: string;
    onClick: () => void;
}

export const WeatherJMAWarningCard: React.FC<WeatherJMAWarningCardProps> = ({ warning, regionName, onClick }) => {
    
    // Determine Style - Industrial Warning Sign Aesthetic
    let bgClass = 'bg-[#FFEA00]'; // Intense Yellow
    let borderClass = 'border-black';
    let textClass = 'text-black';
    let iconColor = 'text-black';
    let Icon = AlertTriangle;
    let label = 'ADVISORY';

    if (warning.level === 'emergency') {
        bgClass = 'bg-[#6200EA]'; // Deep Purple
        borderClass = 'border-black';
        textClass = 'text-white';
        iconColor = 'text-yellow-300';
        Icon = AlertOctagon;
        label = 'EMERGENCY';
    } else if (warning.level === 'warning') {
        bgClass = 'bg-[#D50000]'; // Warning Red
        borderClass = 'border-black';
        textClass = 'text-white';
        iconColor = 'text-white';
        Icon = AlertOctagon;
        label = 'WARNING';
    }

    // Contextual Icon Override based on title keywords
    const lowerTitle = warning.title.toLowerCase();
    if (lowerTitle.includes('avalanche')) Icon = Mountain;
    else if (lowerTitle.includes('lightning')) Icon = CloudLightning;
    else if (lowerTitle.includes('snow') || lowerTitle.includes('blizzard')) Icon = Snowflake;
    else if (lowerTitle.includes('rain') || lowerTitle.includes('flood')) Icon = CloudRain;
    else if (lowerTitle.includes('wind') || lowerTitle.includes('storm') || lowerTitle.includes('gale')) Icon = Wind;

    return (
        <Card 
            onClick={onClick}
            // !rounded-none to remove border radius
            // border-2 for thickness
            className={`min-w-[200px] snap-center !p-5 !rounded-none !shadow-none border-2 relative overflow-hidden flex flex-col justify-between cursor-pointer hover:brightness-110 active:scale-[0.98] transition-all group ${bgClass} ${borderClass}`}
        >
             {/* Hazard Pattern Overlay */}
             <div className="absolute inset-0 pointer-events-none opacity-10 bg-[linear-gradient(135deg,#000_25%,transparent_25%,transparent_50%,#000_50%,#000_75%,transparent_75%,transparent)] bg-[length:20px_20px]"></div>

             <div className="flex justify-between items-start mb-4 relative z-10">
                 <div className="flex flex-col items-start gap-1">
                    <div className={`text-[10px] font-black uppercase tracking-widest ${textClass} bg-black/10 px-2 py-0.5`}>
                        {regionName}
                    </div>
                    <div className={`text-[10px] font-mono font-bold uppercase tracking-wider ${textClass} flex items-center gap-1`}>
                        <Megaphone size={10} /> {label}
                    </div>
                 </div>
                 <div className="flex gap-2 items-start">
                    <ExternalLink size={14} className={`${textClass} opacity-0 group-hover:opacity-100 transition-opacity`} />
                    <div className="border-2 border-current p-1 bg-black/5 backdrop-blur-sm">
                        <Icon size={24} className={iconColor} strokeWidth={2.5} />
                    </div>
                 </div>
             </div>

             <div className="relative z-10">
                 <h4 className={`text-xl font-black font-sans uppercase leading-none tracking-tight ${textClass} drop-shadow-sm`}>
                     {warning.title}
                 </h4>
                 <div className={`text-[9px] mt-2 font-mono uppercase opacity-70 ${textClass} flex items-center gap-1`}>
                     JMA Official Feed
                 </div>
             </div>
        </Card>
    );
};
