import React from "react";

type TimePickerProps = {
    value: string;
    onChange: (value: string) => void;
    className?: string;
};

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

export function TimePicker({ value, onChange, className }: TimePickerProps) {
    const isEmpty = !value || value.trim() === "";
    const [hourPart, minutePart] = (value || "").split(":");
    const hour = isEmpty || !HOURS.includes(hourPart || "") ? "--" : hourPart!;
    const minute = isEmpty || !MINUTES.includes(minutePart || "") ? "--" : minutePart!;

    const handleHourChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const h = e.target.value;
        if (h === "--") {
            // 時間が"--"に戻された場合は、全体を空にする
            onChange("");
        } else if (minute === "--") {
            // 時間は選択されたが、分が"--"の場合は、分を"00"にして返す
            onChange(`${h}:00`);
        } else {
            onChange(`${h}:${minute}`);
        }
    };

    const handleMinuteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const m = e.target.value;
        if (m === "--") {
            // 分が"--"に戻された場合は、全体を空にする
            onChange("");
        } else if (hour === "--") {
            // 分は選択されたが、時間が"--"の場合は、時間を"00"にして返す
            onChange(`00:${m}`);
        } else {
            onChange(`${hour}:${m}`);
        }
    };

    return (
        <div className={`flex items-center gap-1 ${className || ""}`}>
            <select
                className="h-9 rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-1 text-xs sm:text-sm"
                value={hour}
                onChange={handleHourChange}
            >
                <option value="--">--</option>
                {HOURS.map((h) => (
                    <option key={h} value={h}>
                        {h}
                    </option>
                ))}
            </select>
            <span className="text-xs sm:text-sm">:</span>
            <select
                className="h-9 rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-1 text-xs sm:text-sm"
                value={minute}
                onChange={handleMinuteChange}
            >
                <option value="--">--</option>
                {MINUTES.map((m) => (
                    <option key={m} value={m}>
                        {m}
                    </option>
                ))}
            </select>
        </div>
    );
}


