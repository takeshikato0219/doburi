import { useAuth } from "../hooks/useAuth";
import { trpc } from "../lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import { format } from "date-fns";
import { happyHuesColors, happyHuesStyles } from "../styles/happyHues";

export default function MyAttendance() {
    const { user } = useAuth();
    const utils = trpc.useUtils();
    const todayStr = format(new Date(), "yyyy-MM-dd");

    // 管理アカウント（admin/sub_admin）のみアクセス可能
    const isAdmin = user?.role === "admin" || user?.role === "sub_admin";

    const { data: todayAttendance } = trpc.attendance.getTodayStatus.useQuery({
        workDate: todayStr,
    }, {
        enabled: isAdmin, // 管理アカウントのみクエリを実行
    });

    const clockInMutation = trpc.attendance.clockIn.useMutation({
        onSuccess: () => {
            toast.success("出勤を打刻しました");
            utils.attendance.getTodayStatus.invalidate({ workDate: todayStr });
        },
        onError: (error) => {
            toast.error(error.message || "出勤打刻に失敗しました");
        },
    });

    const clockOutMutation = trpc.attendance.clockOut.useMutation({
        onSuccess: () => {
            toast.success("退勤を打刻しました");
            utils.attendance.getTodayStatus.invalidate({ workDate: todayStr });
        },
        onError: (error) => {
            toast.error(error.message || "退勤打刻に失敗しました");
        },
    });

    const formatDuration = (minutes: number | null) => {
        if (!minutes) return "0分";
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return hours > 0 ? `${hours}時間${mins}分` : `${mins}分`;
    };

    const formatAttendanceTime = (time: string | null | undefined) => {
        if (!time) return "--:--";
        return time;
    };

    // 管理アカウント以外はアクセス不可
    if (!isAdmin) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold">出退勤記録</h1>
                    <p className="text-[hsl(var(--muted-foreground))] mt-2">
                        このページは管理アカウントのみアクセス可能です
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div 
            className="min-h-screen p-4 sm:p-6 space-y-6"
            style={{ 
            }}
        >
            <div>
                <h1 
                    className="text-3xl font-bold"
                    style={{ color: happyHuesColors.headline, letterSpacing: '-0.02em' }}
                >
                    出退勤記録
                </h1>
                <p 
                    className="mt-2"
                    style={{ color: happyHuesColors.paragraph, opacity: 0.8 }}
                >
                    {user?.name || user?.username}さんの出退勤状況
                </p>
            </div>

            <Card>
                <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="text-lg sm:text-xl">今日の出退勤</CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                    {todayAttendance ? (
                        <div className="space-y-6">
                            <div>
                                <p className="text-sm text-[hsl(var(--muted-foreground))]">出勤時刻</p>
                                <p className="text-2xl font-semibold mt-1">
                                    {formatAttendanceTime(todayAttendance.clockInTime)}
                                </p>
                            </div>
                            {todayAttendance.clockOutTime ? (
                                <div className="space-y-2">
                                    <div>
                                        <p className="text-sm text-[hsl(var(--muted-foreground))]">退勤時刻</p>
                                        <p className="text-2xl font-semibold mt-1">
                                            {formatAttendanceTime(todayAttendance.clockOutTime)}
                                        </p>
                                    </div>
                                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                        勤務時間: {formatDuration(todayAttendance.workMinutes)}
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <p className="text-sm text-orange-500">作業中</p>
                                    <Button
                                        className="w-full sm:w-auto"
                                        onClick={() => clockOutMutation.mutate()}
                                        disabled={clockOutMutation.isPending}
                                    >
                                        退勤する
                                    </Button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4 text-center">
                            <p className="text-[hsl(var(--muted-foreground))]">まだ出勤していません</p>
                            <div className="flex justify-center">
                                <Button
                                    className="w-full sm:w-auto"
                                    onClick={() =>
                                        clockInMutation.mutate({
                                            workDate: todayStr,
                                            deviceType: "pc",
                                        })
                                    }
                                    disabled={clockInMutation.isPending}
                                >
                                    出勤する
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

