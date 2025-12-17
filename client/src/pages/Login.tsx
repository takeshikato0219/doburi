import React, { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "../lib/trpc";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { toast } from "sonner";
import { happyHuesColors, happyHuesStyles } from "../styles/happyHues";
import { Shield, User } from "lucide-react";

export default function Login() {
    const [isLoading, setIsLoading] = useState(false);

    const loginAsMutation = trpc.auth.loginAs.useMutation({
        onSuccess: (data) => {
            console.log("LoginAs success:", data);
            toast.success("ログインしました");
            // 少し待ってからリロード（Cookieが設定されるのを待つ）
            setTimeout(() => {
                window.location.href = "/"; // ページリロードで認証状態を更新
            }, 100);
        },
        onError: (error) => {
            console.error("LoginAs error:", error);
            toast.error(error.message || "ログインに失敗しました");
            setIsLoading(false);
        },
    });

    const handleLoginAs = async (role: "admin" | "field_worker") => {
        setIsLoading(true);
        loginAsMutation.mutate({ role });
    };

    return (
        <div 
            className="min-h-screen flex items-center justify-center p-4"
            style={{ 
            }}
        >
            <div className="w-full max-w-md">
                {/* donburiロゴ */}
                <div className="flex justify-center mb-8">
                    <h1 
                        className="text-4xl font-bold"
                        style={{ color: happyHuesColors.headline, letterSpacing: '-0.02em' }}
                    >
                        donburi
                    </h1>
                </div>
                
                <div 
                    className="w-full rounded-[2rem] p-8 backdrop-blur-sm"
                    style={happyHuesStyles.card}
                >
                    <div className="text-center pb-6">
                        <h2 
                            className="text-3xl font-bold mb-2"
                            style={{ color: happyHuesColors.headline, letterSpacing: '-0.02em' }}
                        >
                            ログイン
                        </h2>
                        <p style={{ color: happyHuesColors.paragraph, opacity: 0.8 }}>
                            時間管理システム
                        </p>
                    </div>
                    <div className="space-y-4">
                        <button 
                            onClick={() => handleLoginAs("admin")}
                            className="w-full py-4 rounded-[1.5rem] font-bold text-lg transition-all hover:scale-[1.02] flex items-center justify-center gap-3"
                            style={happyHuesStyles.button}
                            disabled={isLoading}
                            onMouseEnter={(e) => {
                                if (!isLoading) {
                                    e.currentTarget.style.transform = 'scale(1.02)';
                                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(255, 216, 3, 0.5)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'scale(1)';
                                e.currentTarget.style.boxShadow = '0 6px 20px rgba(255, 216, 3, 0.4)';
                            }}
                        >
                            <Shield className="h-5 w-5" />
                            {isLoading ? "ログイン中..." : "管理者としてログイン"}
                        </button>
                        
                        <button 
                            onClick={() => handleLoginAs("field_worker")}
                            className="w-full py-4 rounded-[1.5rem] font-bold text-lg transition-all hover:scale-[1.02] flex items-center justify-center gap-3"
                            style={happyHuesStyles.button}
                            disabled={isLoading}
                            onMouseEnter={(e) => {
                                if (!isLoading) {
                                    e.currentTarget.style.transform = 'scale(1.02)';
                                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(255, 216, 3, 0.5)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'scale(1)';
                                e.currentTarget.style.boxShadow = '0 6px 20px rgba(255, 216, 3, 0.4)';
                            }}
                        >
                            <User className="h-5 w-5" />
                            {isLoading ? "ログイン中..." : "一般としてログイン"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

