import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, trpcClient } from "./lib/trpc";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            retry: (failureCount, error: any) => {
                // 401エラー（認証エラー）の場合はリトライしない
                if (error?.data?.code === "UNAUTHORIZED" || error?.data?.httpStatus === 401) {
                    // ログインページにリダイレクト
                    if (window.location.pathname !== "/login") {
                        window.location.href = "/login";
                    }
                    return false;
                }
                return failureCount < 1;
            },
            onError: (error: any) => {
                // 401エラー（認証エラー）の場合はログインページにリダイレクト
                if (error?.data?.code === "UNAUTHORIZED" || error?.data?.httpStatus === 401) {
                    if (window.location.pathname !== "/login") {
                        window.location.href = "/login";
                    }
                }
            },
        },
        mutations: {
            retry: (failureCount, error: any) => {
                // 401エラー（認証エラー）の場合はリトライしない
                if (error?.data?.code === "UNAUTHORIZED" || error?.data?.httpStatus === 401) {
                    // ログインページにリダイレクト
                    if (window.location.pathname !== "/login") {
                        window.location.href = "/login";
                    }
                    return false;
                }
                return false; // 通常のミューテーションはリトライしない
            },
            onError: (error: any) => {
                // 401エラー（認証エラー）の場合はログインページにリダイレクト
                if (error?.data?.code === "UNAUTHORIZED" || error?.data?.httpStatus === 401) {
                    if (window.location.pathname !== "/login") {
                        window.location.href = "/login";
                    }
                }
            },
        },
    },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
            <QueryClientProvider client={queryClient}>
                <App />
            </QueryClientProvider>
        </trpc.Provider>
    </React.StrictMode>
);

