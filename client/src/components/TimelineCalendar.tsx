
interface WorkRecord {
    id: number;
    startTime: string; // ISO 8601形式
    endTime: string | null; // ISO 8601形式、nullは作業中
    vehicleNumber: string;
    processName: string;
    durationMinutes: number | null;
}

interface TimelineCalendarProps {
    workRecords: WorkRecord[];
    date: Date;
}

export default function TimelineCalendar({ workRecords }: TimelineCalendarProps) {

    const formatDuration = (minutes: number | null) => {
        if (!minutes) return "0分";
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return hours > 0 ? `${hours}時間${mins}分` : `${mins}分`;
    };

    const formatTime = (time: Date) => {
        // JST（Asia/Tokyo）で時刻を表示
        const formatter = new Intl.DateTimeFormat('ja-JP', {
            timeZone: 'Asia/Tokyo',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        });
        return formatter.format(time);
    };

    return (
        <div className="w-full">
            {workRecords.length === 0 ? (
                <p className="text-center text-sm text-[hsl(var(--muted-foreground))] py-4">
                    作業記録がありません
                </p>
            ) : (
                <div className="space-y-3">
                    {workRecords.map((record) => {
                        const startDate = new Date(record.startTime);
                        const endDate = record.endTime ? new Date(record.endTime) : new Date();

                        return (
                            <div
                                key={record.id}
                                className={`p-3 rounded-lg border ${record.endTime ? "bg-blue-50 border-blue-200" : "bg-green-50 border-green-200 animate-pulse"
                                    }`}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-sm truncate">
                                            {record.vehicleNumber}
                                        </p>
                                        <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">
                                            {record.processName}
                                        </p>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <p className="text-xs font-medium">
                                            {formatTime(startDate)}
                                            {record.endTime ? ` - ${formatTime(endDate)}` : " (作業中)"}
                                        </p>
                                        <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                            {formatDuration(record.durationMinutes)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

