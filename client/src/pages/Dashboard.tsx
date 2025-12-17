import React, { useState, useCallback } from "react";
import { useAuth } from "../hooks/useAuth";
import { trpc } from "../lib/trpc";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { TimePicker } from "../components/TimePicker";
import TimelineCalendar from "../components/TimelineCalendar";
import { Plus, AlertCircle, Home, Clock, Hammer } from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { format, isSameDay, subDays } from "date-fns";
import { useDateChangeDetector } from "../hooks/useDateChangeDetector";
import { useAutoRefresh } from "../hooks/useAutoRefresh";
import { usePageVisibility } from "../hooks/usePageVisibility";
import { happyHuesColors, happyHuesStyles } from "../styles/happyHues";

export default function Dashboard() {
    const { user } = useAuth();
    const [, setLocation] = useLocation();

    // ワングラムアカウント（externalロール）の場合は納車スケジュールページへリダイレクト
    React.useEffect(() => {
        if (user?.role === "external") {
            setLocation("/delivery-schedules");
        }
    }, [user, setLocation]);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [selectedVehicleId, setSelectedVehicleId] = useState("");
    const [selectedProcessId, setSelectedProcessId] = useState("");
    const [workDate, setWorkDate] = useState(() => {
        const today = new Date();
        return format(today, "yyyy-MM-dd");
    });
    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");

    const utils = trpc.useUtils();
    const { data: activeWork } = trpc.workRecords.getActive.useQuery();
    const { data: todayRecords, refetch: refetchTodayRecords } =
        trpc.workRecords.getTodayRecords.useQuery();
    const { data: vehicles } = trpc.vehicles.list.useQuery({});
    const { data: processes } = trpc.processes.list.useQuery();
    const todayStrForAttendance = format(new Date(), "yyyy-MM-dd");
    const { data: todayAttendance } = trpc.attendance.getTodayStatus.useQuery({
        workDate: todayStrForAttendance,
    });
    // サンプルページのため、データベース接続エラーを避けるため無効化
    // const { data: myCheckRequests } = trpc.checks.getMyCheckRequests.useQuery();
    const myCheckRequests: any[] = [];
    
    const { data: unreadBroadcasts, refetch: refetchBroadcasts } = trpc.salesBroadcasts.getUnread.useQuery(undefined, {
        retry: false,
        refetchOnWindowFocus: false,
    });
    const { data: bulletinMessages, refetch: refetchBulletin } = trpc.bulletin.list.useQuery(undefined, {
        retry: false,
        refetchOnWindowFocus: false,
    });
    const { data: vehicleTypes } = trpc.vehicleTypes.list.useQuery(undefined, {
        retry: false,
        refetchOnWindowFocus: false,
    });
    // 一時的に完全にコメントアウトして問題を切り分け
    // const { data: recentLowWorkUsers } = trpc.analytics.getRecentLowWorkUsers.useQuery();
    // const { data: excessiveWorkUsers } = trpc.analytics.getExcessiveWorkUsers.useQuery();
    const recentLowWorkUsers: any[] = [];
    const excessiveWorkUsers: any[] = [];
    // この警告は過剰に表示されるため、クエリも無効化しています
    // const { data: missingAttendanceUsers } = trpc.analytics.getMissingAttendanceUsers.useQuery();
    // 作業記録管理不備の取得を完全に無効化（サンプルページのため）
    // const { data: workRecordIssues, error: workRecordIssuesError, isLoading: workRecordIssuesLoading } = trpc.analytics.getWorkRecordIssues.useQuery(undefined, {
    //     retry: false,
    //     refetchOnWindowFocus: false,
    // });
    const workRecordIssues: any[] = [];
    const workRecordIssuesError = null;
    const workRecordIssuesLoading = false;
    
    // 案件ごとの作業時間を取得
    const { data: vehicleProductionTimes } = trpc.analytics.getVehicleProductionTimes.useQuery();
    
    // 昨日の総合作業時間を取得
    const { data: totalWorkTimeYesterday } = trpc.analytics.getTotalWorkTimeTodayYesterday.useQuery();
    
    // 時間をフォーマットする関数
    const formatMinutes = (minutes: number) => {
        if (!minutes || minutes === 0) return "0分";
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (hours > 0) {
            return `${hours}時間${mins}分`;
        }
        return `${mins}分`;
    };
    // 今日の作業記録を入れていない人の警告は不要のため、クエリを無効化
    // const { data: usersWithoutWorkRecords } = trpc.analytics.getUsersWithoutWorkRecords.useQuery();
    const usersWithoutWorkRecords: any[] = [];

    // サンプルページのため、データベース接続エラーを避けるため無効化
    // const { data: myNotifications, refetch: refetchNotifications } = trpc.notifications.getMyUnread.useQuery();
    const myNotifications: any[] = [];
    const refetchNotifications = () => {};
    const [selectedVehicleTypeFilter, setSelectedVehicleTypeFilter] = useState<number | "all">("all");

    // 未完了のチェック依頼を取得
    const pendingCheckRequests = myCheckRequests?.filter((req) => req.status === "pending") || [];

    const markBroadcastAsReadMutation = trpc.salesBroadcasts.markAsRead.useMutation({
        onSuccess: () => {
            refetchBroadcasts();
        },
    });

    const markNotificationAsReadMutation = trpc.notifications.markAsRead.useMutation({
        onSuccess: () => {
            refetchNotifications();
        },
    });

    const deleteBulletinMutation = trpc.bulletin.delete.useMutation({
        onSuccess: () => {
            toast.success("掲示板の投稿を削除しました");
            refetchBulletin();
        },
        onError: (error) => {
            toast.error(error.message || "掲示板の削除に失敗しました");
        },
    });

    const createBulletinMutation = trpc.bulletin.create.useMutation({
        onSuccess: () => {
            toast.success("掲示板に投稿しました");
            refetchBulletin();
            setBulletinInput("");
            setBulletinExpireDays("5");
        },
        onError: (error) => {
            toast.error(error.message || "掲示板への投稿に失敗しました");
        },
    });

    // データ更新用のコールバック
    const [bulletinInput, setBulletinInput] = useState("");
    const [bulletinExpireDays, setBulletinExpireDays] = useState<"1" | "3" | "5">("5");

    const refreshData = useCallback(() => {
        console.log("[マイダッシュボード] データを更新します");
        utils.workRecords.getActive.invalidate();
        utils.workRecords.getTodayRecords.invalidate();
        utils.vehicles.list.invalidate();
        utils.bulletin.list.invalidate();
        // utils.analytics.getExcessiveWorkUsers.invalidate();
        // utils.analytics.getRecentLowWorkUsers.invalidate();
        // utils.analytics.getMissingAttendanceUsers.invalidate(); // この警告は非表示のため無効化
        utils.analytics.getWorkRecordIssues.invalidate();
    }, [utils]);

    // 日付が変わったらデータを更新
    useDateChangeDetector(() => {
        console.log("[マイダッシュボード] 日付が変わりました。データを更新します。");
        refreshData();
    });

    // 1分ごとにデータを自動リフレッシュ
    useAutoRefresh(refreshData, 60 * 1000);

    // ページがアクティブになった時にデータを更新
    usePageVisibility(refreshData);

    const createWorkRecordMutation = trpc.workRecords.create.useMutation({
        onSuccess: () => {
            toast.success("作業記録を追加しました");
            setIsAddDialogOpen(false);
            refetchTodayRecords();
            setSelectedVehicleId("");
            setSelectedProcessId("");
            setStartTime("");
            setEndTime("");
        },
        onError: (error) => {
            toast.error(error.message || "作業記録の追加に失敗しました");
        },
    });

    // 出勤打刻は管理者専用のため、一般ユーザーは使用不可

    const handleAddWork = () => {
        if (!selectedVehicleId || !selectedProcessId || !workDate || !startTime) {
            toast.error("車両、工程、日付、開始時刻を入力してください");
            return;
        }

        const startDateTime = `${workDate}T${startTime}:00+09:00`;
        const endDateTime = endTime ? `${workDate}T${endTime}:00+09:00` : undefined;

        createWorkRecordMutation.mutate({
            userId: user!.id,
            vehicleId: parseInt(selectedVehicleId),
            processId: parseInt(selectedProcessId),
            startTime: startDateTime,
            endTime: endDateTime,
        });
    };

    const formatDuration = (minutes: number | null) => {
        if (!minutes) return "0分";
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return hours > 0 ? `${hours}時間${mins}分` : `${mins}分`;
    };

    const formatTime = (date: Date | string) => {
        const d = typeof date === "string" ? new Date(date) : date;
        // JST（Asia/Tokyo）で時刻を表示
        const formatter = new Intl.DateTimeFormat('ja-JP', {
            timeZone: 'Asia/Tokyo',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        });
        return formatter.format(d);
    };

    const formatAttendanceTime = (time: string | null | undefined) => {
        if (!time) return "--:--";
        return time;
    };

    // 今日と昨日の作業記録を分ける（JSTで比較）
    const getJSTDateString = (date: Date | string): string => {
        const d = typeof date === "string" ? new Date(date) : date;
        const formatter = new Intl.DateTimeFormat('ja-JP', {
            timeZone: 'Asia/Tokyo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        });
        const parts = formatter.formatToParts(d);
        const y = parts.find(p => p.type === 'year')?.value || '0';
        const m = parts.find(p => p.type === 'month')?.value || '01';
        const dStr = parts.find(p => p.type === 'day')?.value || '01';
        return `${y}-${m}-${dStr}`;
    };
    
    const now = new Date();
    const todayJST = getJSTDateString(now);
    const yesterdayJST = getJSTDateString(subDays(now, 1));
    
    const todayRecordsFiltered = todayRecords?.filter((record) => {
        const recordDate = typeof record.startTime === "string" ? new Date(record.startTime) : record.startTime;
        return getJSTDateString(recordDate) === todayJST;
    }) || [];
    const yesterdayRecords = todayRecords?.filter((record) => {
        const recordDate = typeof record.startTime === "string" ? new Date(record.startTime) : record.startTime;
        return getJSTDateString(recordDate) === yesterdayJST;
    }) || [];

    // 「作業追加」ダイアログを開くとき、
    // 1件目: 開始時刻デフォルト 8:35
    // 2件目以降: 直前の作業の終了時刻を開始時刻に自動セット
    const handleOpenAddDialog = () => {
        const now = new Date();
        const todayStr = format(now, "yyyy-MM-dd");

        // デフォルトは今日の 8:35 にする
        let nextDate = todayStr;
        let nextStart = "08:35";

        if (todayRecordsFiltered.length > 0) {
            // 終了時間が入っているレコードの中から一番新しいものを探す
            const lastWithEnd = [...todayRecordsFiltered]
                .filter((r) => r.endTime)
                .sort((a, b) => {
                    const aEnd = a.endTime ? new Date(a.endTime as any) : new Date(a.startTime as any);
                    const bEnd = b.endTime ? new Date(b.endTime as any) : new Date(b.startTime as any);
                    return aEnd.getTime() - bEnd.getTime();
                })
                .pop();

            if (lastWithEnd && lastWithEnd.endTime) {
                const end = typeof lastWithEnd.endTime === "string"
                    ? new Date(lastWithEnd.endTime)
                    : lastWithEnd.endTime;
                nextDate = format(end, "yyyy-MM-dd");
                nextStart = format(end, "HH:mm");
            }
        }

        setWorkDate(nextDate);
        setStartTime(nextStart);
        setEndTime("");
        setIsAddDialogOpen(true);
    };

    return (
        <div 
            className="min-h-screen p-4 sm:p-6 space-y-6"
        >
            <div>
                <h1 
                    className="text-2xl sm:text-3xl font-bold"
                    style={{ color: happyHuesColors.headline, letterSpacing: '-0.02em' }}
                >
                    マイダッシュボード
                </h1>
                <p 
                    className="mt-2 text-sm sm:text-base"
                    style={{ color: happyHuesColors.paragraph, opacity: 0.8 }}
                >
                    こんにちは、{user?.name || user?.username}さん
                </p>
            </div>

            {/* 納車スケジュールなどのシステム通知（自分宛） */}
            {myNotifications && myNotifications.length > 0 && (
                <Card className="card-md border-l-4 border-l-[hsl(var(--google-blue-500))] bg-[hsl(var(--google-blue-50))]">
                    <CardContent className="p-4 sm:p-6 space-y-2">
                        <p className="font-medium text-[hsl(var(--google-blue-900))] text-sm sm:text-base">
                            お知らせが{myNotifications.length}件あります
                        </p>
                        <div className="space-y-1.5">
                            {myNotifications.slice(0, 3).map((n) => (
                                <div
                                    key={n.id}
                                    className="flex items-start justify-between gap-2 text-xs sm:text-sm"
                                >
                                    <div className="min-w-0">
                                        <p className="font-semibold break-words">{n.title}</p>
                                        <p className="text-[hsl(var(--muted-foreground))] break-words">
                                            {n.message}
                                        </p>
                                        <p className="mt-0.5 text-[10px] text-[hsl(var(--muted-foreground))]">
                                            {format(new Date(n.createdAt), "MM/dd HH:mm")}
                                        </p>
                                    </div>
                                    <Button
                                        variant="outline"
                                        className="flex-shrink-0 h-6 px-2 text-[10px]"
                                        onClick={() => markNotificationAsReadMutation.mutate({ id: n.id })}
                                    >
                                        確認
                                    </Button>
                                </div>
                            ))}
                            {myNotifications.length > 3 && (
                                <p className="text-[10px] sm:text-xs text-blue-900">
                                    他{myNotifications.length - 3}件のお知らせがあります
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* 作業報告が出勤時間を超えている可能性がある現場スタッフの注意喚起 */}
            {excessiveWorkUsers && excessiveWorkUsers.length > 0 && (
                <Card className="card-md border-l-4 border-l-[hsl(var(--google-red-500))] bg-[hsl(var(--google-red-50))]">
                    <CardContent className="p-4 sm:p-6 space-y-1">
                        <p className="font-medium text-[hsl(var(--google-red-900))] text-sm sm:text-base">
                            作業報告が間違えている可能性があります（過去3日）
                        </p>
                        <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm text-red-900">
                            {excessiveWorkUsers.flatMap((u) =>
                                u.dates.map((d: string) => (
                                    <li key={`${u.userId}-${d}`}>
                                        <Link
                                            href={`/work-report-issues?userId=${u.userId}&workDate=${d}&type=excessive`}
                                            className="hover:underline cursor-pointer hover:text-red-950 transition-colors block py-1 px-2 -mx-2 rounded hover:bg-red-100"
                                        >
                                            <span className="font-semibold">{u.userName}</span>
                                            <span>
                                                さんが
                                                {format(new Date(d), "MM/dd")}
                                                日の作業報告が、出勤時間を超えています
                                            </span>
                                            <span className="text-[10px] ml-2 text-red-700">（クリックして修正）</span>
                                        </Link>
                                    </li>
                                ))
                            )}
                        </ul>
                    </CardContent>
                </Card>
            )}

            {/* 過去3営業日以内で出勤記録が入力されていない現場スタッフの注意喚起 */}
            {/* この警告は過剰に表示されるため、非表示にしています */}
            {/* {missingAttendanceUsers && missingAttendanceUsers.length > 0 && (
                <Card className="border-orange-300 bg-orange-50">
                    <CardContent className="p-4 sm:p-6 space-y-1">
                        <p className="font-semibold text-orange-900 text-sm sm:text-base">
                            出勤記録が入力されていません（過去3日）
                        </p>
                        <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm text-orange-900">
                            {missingAttendanceUsers.flatMap((u) =>
                                u.dates.map((d: string) => (
                                    <li key={`${u.userId}-${d}`}>
                                        <Link
                                            href={`/admin/attendance?date=${d}`}
                                            className="hover:underline cursor-pointer hover:text-orange-950 transition-colors block py-1 px-2 -mx-2 rounded hover:bg-orange-100"
                                        >
                                            <span className="font-semibold">{u.userName}</span>
                                            <span>
                                                さんが
                                                {format(new Date(d), "MM/dd")}
                                                日の出勤記録を入れていません
                                            </span>
                                            <span className="text-[10px] ml-2 text-orange-700">（クリックして修正）</span>
                                        </Link>
                                    </li>
                                ))
                            )}
                        </ul>
                    </CardContent>
                </Card>
            )} */}

            {/* 昨日の総合作業時間 */}
            {totalWorkTimeYesterday && totalWorkTimeYesterday.yesterday && (
                <Card className="card-md border-l-4 border-l-[hsl(var(--google-blue-500))] bg-[hsl(var(--google-blue-50))]">
                    <CardHeader>
                        <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
                            <Clock className="w-5 h-5" />
                            昨日の総合作業時間
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {totalWorkTimeYesterday.yesterday.length > 0 ? (
                                <>
                                    <div className="text-2xl sm:text-3xl font-bold text-[hsl(var(--google-blue-900))]">
                                        {formatMinutes(
                                            totalWorkTimeYesterday.yesterday.reduce(
                                                (sum, item) => sum + item.totalMinutes,
                                                0
                                            )
                                        )}
                                    </div>
                                    <div className="mt-4 space-y-1">
                                        <p className="text-sm font-medium text-[hsl(var(--google-blue-900))]">大分類別:</p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {totalWorkTimeYesterday.yesterday.map((item, idx) => (
                                                <div
                                                    key={idx}
                                                    className="flex justify-between items-center p-2 bg-white rounded border"
                                                >
                                                    <span className="text-sm text-[hsl(var(--google-blue-900))]">
                                                        {item.majorCategory}
                                                    </span>
                                                    <span className="text-sm font-semibold text-[hsl(var(--google-blue-700))]">
                                                        {formatMinutes(item.totalMinutes)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <p className="text-sm text-[hsl(var(--muted-foreground))]">昨日の作業記録はありません</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* 案件ごとの作業時間 */}
            {vehicleProductionTimes && vehicleProductionTimes.length > 0 && (
                <Card className="card-md border-l-4 border-l-[hsl(var(--google-green-500))] bg-[hsl(var(--google-green-50))]">
                    <CardHeader>
                        <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
                            <Home className="w-5 h-5" />
                            案件ごとの作業時間
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {vehicleProductionTimes
                                .filter((v: any) => v.totalMinutes > 0)
                                .sort((a: any, b: any) => b.totalMinutes - a.totalMinutes)
                                .slice(0, 10)
                                .map((vehicle: any) => (
                                    <div
                                        key={vehicle.vehicleId}
                                        className="p-3 bg-white rounded-lg border border-[hsl(var(--google-green-200))] hover:shadow-md transition-shadow"
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex-1">
                                                <p className="font-semibold text-base sm:text-lg text-[hsl(var(--google-green-900))]">
                                                    {vehicle.vehicleNumber}
                                                </p>
                                                {vehicle.customerName && (
                                                    <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                                                        {vehicle.customerName}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xl sm:text-2xl font-bold text-[hsl(var(--google-green-700))]">
                                                    {formatMinutes(vehicle.totalMinutes)}
                                                </p>
                                            </div>
                                        </div>
                                        {vehicle.processes && vehicle.processes.length > 0 && (
                                            <div className="mt-2 pt-2 border-t border-[hsl(var(--google-green-200))]">
                                                <p className="text-xs font-medium text-[hsl(var(--google-green-800))] mb-1">
                                                    工程別:
                                                </p>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                                                    {vehicle.processes
                                                        .filter((p: any) => p.totalMinutes > 0)
                                                        .sort((a: any, b: any) => b.totalMinutes - a.totalMinutes)
                                                        .slice(0, 6)
                                                        .map((process: any, idx: number) => (
                                                            <div
                                                                key={idx}
                                                                className="text-xs p-1 bg-[hsl(var(--google-green-100))] rounded"
                                                            >
                                                                <span className="text-[hsl(var(--google-green-900))]">
                                                                    {process.processName}:
                                                                </span>
                                                                <span className="ml-1 font-semibold text-[hsl(var(--google-green-700))]">
                                                                    {formatMinutes(process.totalMinutes)}
                                                                </span>
                                                            </div>
                                                        ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* 作業記録管理を入れていない人（今日出勤しているが作業記録がない） */}
            {/* ユーザー要求により、今日の作業記録を入れていない人の警告は削除 */}
            {/* {usersWithoutWorkRecords && usersWithoutWorkRecords.length > 0 && (
                <Card className="border-orange-300 bg-orange-50">
                    <CardContent className="p-4 sm:p-6 space-y-1">
                        <p className="font-semibold text-orange-900 text-sm sm:text-base">
                            作業記録管理を入れていない人（今日）
                        </p>
                        <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm text-orange-900">
                            {usersWithoutWorkRecords.map((u) => (
                                <li key={u.userId}>
                                    <Link
                                        href="/work-records"
                                        className="hover:underline cursor-pointer hover:text-orange-950 transition-colors block py-1 px-2 -mx-2 rounded hover:bg-orange-100"
                                    >
                                        <span className="font-semibold">{u.userName}</span>
                                        <span>
                                            さんが今日出勤していますが、作業記録を入力していません
                                        </span>
                                        {u.clockInTime && (
                                            <span className="text-[10px] ml-2 text-orange-700">
                                                （出勤時刻: {u.clockInTime}）
                                            </span>
                                        )}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>
            )} */}

            {/* 前日で出勤時間と作業記録時間の差が±1時間をはみ出している現場スタッフの注意喚起 */}
            {recentLowWorkUsers && recentLowWorkUsers.length > 0 && (
                <Card className="card-md border-l-4 border-l-[hsl(var(--google-yellow-500))] bg-[hsl(var(--google-yellow-50))]">
                    <CardContent className="p-4 sm:p-6 space-y-1">
                        <p className="font-medium text-[hsl(var(--google-yellow-900))] text-sm sm:text-base">
                            作業報告が不足している可能性があります（前日）
                        </p>
                        <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm text-yellow-900">
                            {recentLowWorkUsers.flatMap((u) =>
                                u.dates.map((d: string) => (
                                    <li key={`${u.userId}-${d}`}>
                                        <Link
                                            href={`/work-report-issues?userId=${u.userId}&workDate=${d}&type=low`}
                                            className="hover:underline cursor-pointer hover:text-yellow-950 transition-colors block py-1 px-2 -mx-2 rounded hover:bg-yellow-100"
                                        >
                                            <span className="font-semibold">{u.userName}</span>
                                            <span>
                                                さんが
                                                {format(new Date(d), "MM/dd")}
                                                日の作業報告を入れていません
                                            </span>
                                            <span className="text-[10px] ml-2 text-yellow-700">（クリックして修正）</span>
                                        </Link>
                                    </li>
                                ))
                            )}
                        </ul>
                    </CardContent>
                </Card>
            )}

            {/* 管理者向け：各案件の作業時間一覧（大工が家を作っている想定） */}
            {user?.role === "admin" && vehicles && vehicles.length > 0 && (
                <Card className="card-md">
                    <CardHeader className="p-4 sm:p-6">
                        <div className="flex items-center gap-2">
                            <Hammer className="h-5 w-5 text-[hsl(var(--google-blue-600))]" />
                            <CardTitle className="text-lg sm:text-xl">各案件の作業時間</CardTitle>
                        </div>
                        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                            大工が家を作っている想定で、各案件に何分かかっているかを表示します
                        </p>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {vehicles
                                .filter((v) => {
                                    // 「家-」で始まる新しいサンプルデータのみを表示
                                    const isNewSample = v.vehicleNumber?.startsWith("家-");
                                    // 進行中または保留中で、作業時間がある案件のみ
                                    const hasWork = (v.status === "in_progress" || v.status === "pending") && (v.totalWorkMinutes || 0) > 0;
                                    return isNewSample && hasWork;
                                })
                                .sort((a, b) => (b.totalWorkMinutes || 0) - (a.totalWorkMinutes || 0))
                                .map((vehicle) => {
                                    const hours = Math.floor((vehicle.totalWorkMinutes || 0) / 60);
                                    const minutes = (vehicle.totalWorkMinutes || 0) % 60;
                                    const totalHours = hours + minutes / 60;
                                    
                                    // 顧客名を優先表示、なければ案件番号
                                    const displayName = vehicle.customerName || vehicle.vehicleNumber || `案件 #${vehicle.id}`;
                                    
                                    return (
                                        <div
                                            key={vehicle.id}
                                            className="p-4 border border-[hsl(var(--border))] rounded-lg bg-white hover:shadow-md transition-shadow"
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className="flex-shrink-0">
                                                    <Home className="h-6 w-6 text-[hsl(var(--google-blue-600))]" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-semibold text-base mb-1 truncate">
                                                        {displayName}
                                                    </h3>
                                                    {vehicle.vehicleNumber && vehicle.vehicleNumber !== displayName && (
                                                        <p className="text-xs text-[hsl(var(--muted-foreground))] mb-2 truncate">
                                                            {vehicle.vehicleNumber}
                                                        </p>
                                                    )}
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <Clock className="h-4 w-4 text-[hsl(var(--google-blue-500))]" />
                                                        <div>
                                                            <p className="text-lg font-bold text-[hsl(var(--google-blue-700))]">
                                                                {hours > 0 ? `${hours}時間${minutes > 0 ? `${minutes}分` : ''}` : `${minutes}分`}
                                                            </p>
                                                            <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                                                {totalHours > 0 ? `（${totalHours.toFixed(1)}時間）` : ''}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    {vehicle.targetTotalMinutes && vehicle.targetTotalMinutes > 0 && (
                                                        <div className="mt-2 pt-2 border-t border-[hsl(var(--border))]">
                                                            <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                                                目標時間: {Math.floor(vehicle.targetTotalMinutes / 60)}時間{vehicle.targetTotalMinutes % 60}分
                                                            </p>
                                                            <div className="mt-1 w-full bg-[hsl(var(--muted))] rounded-full h-2">
                                                                <div
                                                                    className="bg-[hsl(var(--google-blue-500))] h-2 rounded-full transition-all"
                                                                    style={{
                                                                        width: `${Math.min((vehicle.totalWorkMinutes || 0) / vehicle.targetTotalMinutes * 100, 100)}%`
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                        {vehicles.filter((v) => {
                            const isNewSample = v.vehicleNumber?.startsWith("家-");
                            const hasWork = (v.status === "in_progress" || v.status === "pending") && (v.totalWorkMinutes || 0) > 0;
                            return isNewSample && hasWork;
                        }).length === 0 && (
                            <p className="text-center text-sm text-[hsl(var(--muted-foreground))] py-8">
                                進行中の案件がありません
                            </p>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* 全員向け掲示板（最新3件だけ表示） */}
            <Card>
                <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="text-lg sm:text-xl">全員向け掲示板</CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 space-y-3">
                    <div className="flex flex-col sm:flex-row gap-2">
                        <Input
                            value={bulletinInput}
                            onChange={(e) => setBulletinInput(e.target.value)}
                            placeholder="全員に共有したい一言メッセージを入力（3行程度）"
                            className="flex-1"
                        />
                        <div className="flex items-center gap-2">
                            <select
                                className="h-10 text-xs sm:text-sm rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-2 sm:px-3"
                                value={bulletinExpireDays}
                                onChange={(e) => setBulletinExpireDays(e.target.value as "1" | "3" | "5")}
                            >
                                <option value="1">1日</option>
                                <option value="3">3日</option>
                                <option value="5">5日</option>
                            </select>
                            <Button
                                onClick={() => {
                                    if (!bulletinInput.trim()) {
                                        toast.error("メッセージを入力してください");
                                        return;
                                    }
                                    createBulletinMutation.mutate({
                                        message: bulletinInput.trim(),
                                        expireDays: parseInt(bulletinExpireDays, 10),
                                    });
                                }}
                                disabled={createBulletinMutation.isPending}
                                className="w-full sm:w-auto"
                            >
                                投稿
                            </Button>
                        </div>
                    </div>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                        {bulletinMessages && bulletinMessages.length > 0 ? (
                            bulletinMessages
                                .slice(0, 3)
                                .map((msg) => (
                                    <div key={msg.id} className="p-2 bg-[hsl(var(--muted))] rounded text-sm">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-medium text-xs sm:text-sm">
                                                {msg.user?.name || msg.user?.username || "不明"} さん
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                                                    {format(new Date(msg.createdAt), "MM/dd HH:mm")}
                                                </span>
                                                {typeof (msg as any).expireDays === "number" && (
                                                    <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                                                        {(msg as any).expireDays}日表示
                                                    </span>
                                                )}
                                                {(msg.userId === user?.id || user?.role === "admin") && (
                                                    <Button
                                                        variant="outline"
                                                        className="h-6 px-2 text-[10px]"
                                                        onClick={() => {
                                                            if (!window.confirm("この掲示板の投稿を削除しますか？")) return;
                                                            deleteBulletinMutation.mutate({ id: msg.id });
                                                        }}
                                                    >
                                                        削除
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                        <p className="mt-1 text-xs sm:text-sm whitespace-pre-wrap break-words">
                                            {msg.message}
                                        </p>
                                    </div>
                                ))
                        ) : (
                            <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                まだ掲示板のメッセージはありません
                            </p>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* 営業からの拡散通知 */}
            {unreadBroadcasts && unreadBroadcasts.length > 0 && (
                <Card className="card-md border-l-4 border-l-[hsl(var(--google-blue-500))] bg-[hsl(var(--google-blue-50))]">
                    <CardContent className="p-4">
                        <div className="space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="h-5 w-5 text-[hsl(var(--google-blue-600))] flex-shrink-0 mt-0.5" />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-[hsl(var(--google-blue-900))] text-sm sm:text-base">
                                            営業からの拡散が{unreadBroadcasts.length}件あります
                                        </p>
                                    </div>
                                </div>
                                {vehicleTypes && vehicleTypes.length > 0 && (
                                    <div className="flex items-center gap-2">
                                        <label className="text-xs sm:text-sm text-blue-900 font-medium">車種で絞り込み:</label>
                                        <select
                                            className="flex h-8 sm:h-10 text-xs sm:text-sm rounded-md border border-blue-300 bg-white px-2 sm:px-3 py-1 sm:py-2"
                                            value={selectedVehicleTypeFilter}
                                            onChange={(e) =>
                                                setSelectedVehicleTypeFilter(
                                                    e.target.value === "all" ? "all" : parseInt(e.target.value)
                                                )
                                            }
                                        >
                                            <option value="all">全て</option>
                                            {vehicleTypes.map((vt) => (
                                                <option key={vt.id} value={vt.id}>
                                                    {vt.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>
                            <div className="space-y-2">
                                {unreadBroadcasts
                                    .filter((broadcast) => {
                                        if (selectedVehicleTypeFilter === "all") return true;
                                        return (
                                            broadcast.vehicle?.vehicleTypeId === selectedVehicleTypeFilter
                                        );
                                    })
                                    .map((broadcast) => (
                                        <div
                                            key={broadcast.id}
                                            className="p-3 bg-white rounded-lg border border-blue-200"
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <p className="font-semibold text-sm sm:text-base text-blue-900">
                                                            {broadcast.vehicle?.vehicleNumber || "車両ID: " + broadcast.vehicleId}
                                                        </p>
                                                        {broadcast.vehicle?.customerName && (
                                                            <p className="text-xs sm:text-sm text-blue-700">
                                                                ({broadcast.vehicle.customerName})
                                                            </p>
                                                        )}
                                                        {broadcast.vehicle?.vehicleType && (
                                                            <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">
                                                                {broadcast.vehicle.vehicleType.name}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-blue-700 mt-1">
                                                        {broadcast.createdByUser?.name || broadcast.createdByUser?.username || "不明"}さんから
                                                    </p>
                                                    <p className="text-sm text-blue-800 mt-2 whitespace-pre-wrap">
                                                        {broadcast.message}
                                                    </p>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => {
                                                        markBroadcastAsReadMutation.mutate({ broadcastId: broadcast.id });
                                                    }}
                                                    className="flex-shrink-0"
                                                >
                                                    確認
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* チェック依頼通知（誰から・どの項目か分かるように表示） */}
            {pendingCheckRequests.length > 0 && (
                <Card className="card-md border-l-4 border-l-[hsl(var(--google-yellow-500))] bg-[hsl(var(--google-yellow-50))]">
                    <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="h-5 w-5 text-[hsl(var(--google-yellow-600))] flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-[hsl(var(--google-yellow-900))] text-sm sm:text-base">
                                    チェック依頼が{pendingCheckRequests.length}件あります
                                </p>
                                <div className="mt-2 space-y-1">
                                    {pendingCheckRequests.slice(0, 3).map((request) => (
                                        <Link
                                            key={request.id}
                                            href="/vehicle-checks"
                                            className="block text-xs sm:text-sm text-orange-800 hover:text-orange-900"
                                        >
                                            <span className="font-semibold">
                                                {request.vehicle?.vehicleNumber || "車両ID: " + request.vehicleId}
                                            </span>
                                            <span className="ml-1">
                                                （
                                                {request.requestedByUser?.name ||
                                                    request.requestedByUser?.username ||
                                                    "不明"}
                                                さんから依頼）
                                            </span>
                                            {request.checkItem?.name && (
                                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 text-[10px] sm:text-xs">
                                                    項目: {request.checkItem.name}
                                                </span>
                                            )}
                                        </Link>
                                    ))}
                                    {pendingCheckRequests.length > 3 && (
                                        <p className="text-xs text-orange-700">
                                            他{pendingCheckRequests.length - 3}件の依頼があります
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* 出退勤カード */}
            <Card>
                <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="text-lg sm:text-xl">出退勤</CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                    {todayAttendance ? (
                        <div className="space-y-4">
                            <div>
                                <p className="text-sm text-[hsl(var(--muted-foreground))]">出勤時刻</p>
                                <p className="text-lg font-semibold">
                                    {formatAttendanceTime(todayAttendance.clockInTime)}
                                </p>
                            </div>
                            {todayAttendance.clockOutTime ? (
                                <div>
                                    <p className="text-sm text-[hsl(var(--muted-foreground))]">退勤時刻</p>
                                    <p className="text-lg font-semibold">
                                        {formatAttendanceTime(todayAttendance.clockOutTime)}
                                    </p>
                                    <p className="text-sm text-[hsl(var(--muted-foreground))] mt-2">
                                        勤務時間: {formatDuration(todayAttendance.workMinutes)}
                                    </p>
                                </div>
                            ) : (
                                <p className="text-sm text-orange-500">作業中</p>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-4">
                            <p className="text-[hsl(var(--muted-foreground))] mb-4">まだ出勤していません</p>
                            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2">
                                出勤は管理者が「出退勤管理」ページで行います
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* 現在の作業 */}
            {activeWork && activeWork.length > 0 && (
                <Card>
                    <CardHeader className="p-4 sm:p-6">
                        <CardTitle className="text-lg sm:text-xl">現在の作業</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-6">
                        {activeWork.map((work) => (
                            <div key={work.id} className="space-y-2">
                                <p className="font-semibold">{work.vehicleNumber}</p>
                                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                    {work.processName} - {formatTime(work.startTime)}から作業中
                                </p>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* タイムラインカレンダー */}
            {todayRecordsFiltered && todayRecordsFiltered.length > 0 && (
                <Card>
                    <CardHeader className="p-4 sm:p-6">
                        <CardTitle className="text-lg sm:text-xl">今日の作業タイムライン</CardTitle>
                    </CardHeader>
                    <CardContent className="p-2 sm:p-6">
                        <TimelineCalendar
                            workRecords={todayRecordsFiltered.map((r) => ({
                                id: r.id,
                                startTime: typeof r.startTime === "string" ? r.startTime : r.startTime.toISOString(),
                                endTime: r.endTime
                                    ? typeof r.endTime === "string"
                                        ? r.endTime
                                        : r.endTime.toISOString()
                                    : null,
                                vehicleNumber: r.vehicleNumber || "不明",
                                processName: r.processName || "不明",
                                durationMinutes: r.durationMinutes,
                            }))}
                            date={new Date()}
                        />
                    </CardContent>
                </Card>
            )}

            {/* 昨日の作業履歴 */}
            {yesterdayRecords && yesterdayRecords.length > 0 && (
                <Card>
                    <CardHeader className="p-4 sm:p-6">
                        <CardTitle className="text-lg sm:text-xl">昨日の作業履歴</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-6">
                        <div className="space-y-2 sm:space-y-3">
                            {yesterdayRecords.map((record) => (
                                <div
                                    key={record.id}
                                    className="flex items-center justify-between p-2 sm:p-3 border border-[hsl(var(--border))] rounded-lg bg-gray-50"
                                >
                                    <div>
                                        <p className="font-semibold">{record.vehicleNumber}</p>
                                        <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                            {record.processName}
                                        </p>
                                        <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                            {formatTime(record.startTime)}
                                            {record.endTime ? ` - ${formatTime(record.endTime)}` : " (作業中)"}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-semibold">
                                            {formatDuration(record.durationMinutes)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* 今日の作業履歴 */}
            <Card>
                <CardHeader className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <CardTitle className="text-lg sm:text-xl">今日の作業履歴</CardTitle>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={handleOpenAddDialog}
                            className="w-full sm:w-auto"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            作業追加
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                    {todayRecordsFiltered && todayRecordsFiltered.length > 0 ? (
                        <div className="space-y-2 sm:space-y-3">
                            {todayRecordsFiltered.map((record) => (
                                <div
                                    key={record.id}
                                    className="flex items-center justify-between p-2 sm:p-3 border border-[hsl(var(--border))] rounded-lg"
                                >
                                    <div>
                                        <p className="font-semibold">{record.vehicleNumber}</p>
                                        <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                            {record.processName}
                                        </p>
                                        <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                            {formatTime(record.startTime)}
                                            {record.endTime ? ` - ${formatTime(record.endTime)}` : " (作業中)"}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-semibold">
                                            {formatDuration(record.durationMinutes)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-[hsl(var(--muted-foreground))] text-center py-4">
                            今日の作業記録はありません
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* 作業追加ダイアログ */}
            {isAddDialogOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
                    <Card className="w-full max-w-md min-w-0 my-auto">
                        <CardHeader className="p-3 sm:p-4 md:p-6">
                            <CardTitle className="text-base sm:text-lg md:text-xl">作業記録を追加</CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4">
                            <div className="min-w-0">
                                <label className="text-sm font-medium block mb-1">日付</label>
                                <Input
                                    type="date"
                                    value={workDate}
                                    onChange={(e) => setWorkDate(e.target.value)}
                                    className="w-full min-w-0"
                                />
                            </div>
                            <div className="min-w-0">
                                <label className="text-sm font-medium block mb-1">車両</label>
                                <select
                                    key={`vehicle-${selectedVehicleId}`}
                                    className="flex h-10 w-full min-w-0 rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-2 sm:px-3 py-2 text-sm"
                                    value={selectedVehicleId}
                                    onChange={(e) => {
                                        e.preventDefault();
                                        setSelectedVehicleId(e.target.value);
                                    }}
                                >
                                    <option value="">選択してください</option>
                                    {vehicles?.map((v) => (
                                        <option key={v.id} value={v.id}>
                                            {v.vehicleNumber}{v.customerName ? ` - ${v.customerName}` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="min-w-0">
                                <label className="text-sm font-medium block mb-1">工程</label>
                                <select
                                    key={`process-${selectedProcessId}`}
                                    className="flex h-10 w-full min-w-0 rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-2 sm:px-3 py-2 text-sm"
                                    value={selectedProcessId}
                                    onChange={(e) => {
                                        e.preventDefault();
                                        setSelectedProcessId(e.target.value);
                                    }}
                                >
                                    <option value="">選択してください</option>
                                    {processes?.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="min-w-0">
                                <label className="text-sm font-medium block mb-1">開始時刻</label>
                                <TimePicker
                                    value={startTime}
                                    onChange={(value) => setStartTime(value)}
                                    className="w-full"
                                />
                            </div>
                            <div className="min-w-0">
                                <label className="text-sm font-medium block mb-1">終了時刻</label>
                                <TimePicker
                                    value={endTime}
                                    onChange={(value) => setEndTime(value)}
                                    className="w-full"
                                />
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2 pt-2">
                                <Button
                                    className="flex-1 w-full sm:w-auto"
                                    onClick={handleAddWork}
                                    disabled={createWorkRecordMutation.isPending}
                                >
                                    追加
                                </Button>
                                <Button
                                    variant="outline"
                                    className="flex-1 w-full sm:w-auto"
                                    onClick={() => setIsAddDialogOpen(false)}
                                >
                                    キャンセル
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}

