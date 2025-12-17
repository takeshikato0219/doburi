import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../hooks/useAuth";
import { trpc } from "../../lib/trpc";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { format, addDays, subDays } from "date-fns";
import StaffAttendanceList from "./StaffAttendanceList";
import { useAutoRefresh } from "../../hooks/useAutoRefresh";
import { useDateChangeDetector } from "../../hooks/useDateChangeDetector";
import { usePageVisibility } from "../../hooks/usePageVisibility";
import { happyHuesColors, happyHuesStyles } from "../../styles/happyHues";

export default function AttendanceManagement() {
    const { user } = useAuth();
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());

    const autoCloseMutation = trpc.attendance.autoCloseTodayAt2359.useMutation({
        onSuccess: (result: { count: number }) => {
            if (result.count > 0) {
                console.log(`[出退勤管理] ${result.count}件の未退勤記録を23:59に自動退勤処理しました`);
            }
        },
        onError: (error) => {
            console.error("[出退勤管理] 自動退勤処理エラー:", error);
        },
    });

    const utils = trpc.useUtils();

    // データ更新用のコールバック
    const refreshData = useCallback(() => {
        console.log("[出退勤管理] データを更新します");
        utils.attendance.getAllStaffToday.invalidate();
        utils.attendance.getAllStaffByDate.invalidate();
    }, [utils]);

    // 日付が変わったらデータを更新
    useDateChangeDetector(() => {
        console.log("[出退勤管理] 日付が変わりました。データを更新します。");
        refreshData();
    });

    // 選択日が変更された時にもデータを更新
    useEffect(() => {
        refreshData();
    }, [selectedDate, refreshData]);

    // 1分ごとにデータを自動リフレッシュ
    useAutoRefresh(refreshData, 60 * 1000);

    // ページがアクティブになった時にデータを更新
    usePageVisibility(refreshData);

    // ページ読み込み時と定期的に自動退勤処理を実行
    useEffect(() => {
        // 初回実行
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();

        // 23:59以降の場合のみ自動退勤処理を実行
        if (hours === 23 && minutes >= 59) {
            autoCloseMutation.mutate(undefined, {
                onSuccess: () => {
                    utils.attendance.getAllStaffToday.invalidate();
                    utils.attendance.getAllStaffByDate.invalidate();
                },
            });
        }

        // 23:59になったら自動退勤処理を実行するタイマーを設定
        const scheduleAutoClose = () => {
            const now = new Date();
            const next2359 = new Date(now);
            next2359.setHours(23, 59, 0, 0);
            if (next2359 <= now) {
                next2359.setDate(next2359.getDate() + 1);
            }
            const msUntil2359 = next2359.getTime() - now.getTime();

            setTimeout(() => {
                autoCloseMutation.mutate(undefined, {
                    onSuccess: () => {
                        utils.attendance.getAllStaffToday.invalidate();
                        utils.attendance.getAllStaffByDate.invalidate();
                    },
                });
                // 次の日の23:59もスケジュール
                scheduleAutoClose();
            }, msUntil2359);
        };

        scheduleAutoClose();

        // 5分ごとにチェック（23:59以降の場合）
        const interval = setInterval(() => {
            const now = new Date();
            const hours = now.getHours();
            const minutes = now.getMinutes();
            if (hours === 23 && minutes >= 59) {
                autoCloseMutation.mutate(undefined, {
                    onSuccess: () => {
                        utils.attendance.getAllStaffToday.invalidate();
                        utils.attendance.getAllStaffByDate.invalidate();
                    },
                });
            }
        }, 5 * 60 * 1000); // 5分ごと

        return () => clearInterval(interval);
    }, []);

    // 管理者のみアクセス可能
    if (user?.role !== "admin") {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <p className="text-lg font-semibold">アクセス権限がありません</p>
                    <p className="text-[hsl(var(--muted-foreground))] mt-2">
                        このページは管理者のみがアクセスできます
                    </p>
                </div>
            </div>
        );
    }

    const formatDate = (date: Date) => format(date, "yyyy-MM-dd");

    const handlePrevDay = () => {
        setSelectedDate(subDays(selectedDate, 1));
    };

    const handleNextDay = () => {
        setSelectedDate(addDays(selectedDate, 1));
    };

    const handleToday = () => {
        setSelectedDate(new Date());
    };

    return (
        <div 
            className="min-h-screen p-4 sm:p-6 space-y-6"
            style={{ 
            }}
        >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 
                        className="text-2xl sm:text-3xl font-bold"
                        style={{ color: happyHuesColors.headline, letterSpacing: '-0.02em' }}
                    >
                        出退勤管理
                    </h1>
                    <p 
                        className="mt-2 text-sm sm:text-base"
                        style={{ color: happyHuesColors.paragraph, opacity: 0.8 }}
                    >
                        全スタッフの出退勤状況を管理します
                    </p>
                </div>
                <Button
                    size="lg"
                    onClick={handleToday}
                    className="bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 font-semibold w-full sm:w-auto"
                >
                    今日
                </Button>
            </div>

            {/* 日付選択 */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                        <Button variant="outline" size="sm" onClick={handlePrevDay} className="w-full sm:w-auto">
                            <ChevronLeft className="h-4 w-4" />
                            前日
                        </Button>
                        <div className="flex items-center gap-2 flex-1 sm:flex-initial justify-center">
                            <Calendar className="h-4 w-4 hidden sm:block" />
                            <Input
                                type="date"
                                value={formatDate(selectedDate)}
                                onChange={(e) => setSelectedDate(new Date(e.target.value))}
                                className="flex-1 sm:w-auto"
                            />
                            <Button
                                size="sm"
                                onClick={handleToday}
                                className="hidden sm:inline-flex bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 font-semibold px-6"
                            >
                                今日
                            </Button>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleNextDay} className="w-full sm:w-auto">
                            次の日
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* スタッフ一覧 */}
            <Card>
                <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="text-lg sm:text-xl">
                        {format(selectedDate, "yyyy年MM月dd日")}の出退勤状況
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-2 sm:p-6">
                    <StaffAttendanceList selectedDate={selectedDate} />
                </CardContent>
            </Card>
        </div>
    );
}