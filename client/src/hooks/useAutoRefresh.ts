import { useEffect } from "react";

export function useAutoRefresh(callback: () => void, interval: number) {
    useEffect(() => {
        const timer = setInterval(callback, interval);
        return () => clearInterval(timer);
    }, [callback, interval]);
}

