import { useEffect } from "react";

export function useDateChangeDetector(callback: () => void) {
    useEffect(() => {
        let lastDate = new Date().toDateString();

        const interval = setInterval(() => {
            const currentDate = new Date().toDateString();
            if (currentDate !== lastDate) {
                lastDate = currentDate;
                callback();
            }
        }, 60000); // 1分ごとにチェック

        return () => clearInterval(interval);
    }, [callback]);
}

