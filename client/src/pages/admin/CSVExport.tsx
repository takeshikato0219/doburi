import React, { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { trpc } from "../../lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { happyHuesColors, happyHuesStyles } from "../../styles/happyHues";

export default function CSVExport() {
    const { user } = useAuth();

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

    const formatDateForInput = (date: Date) => {
        return format(date, "yyyy-MM-dd");
    };

    // 20日始まりの1ヶ月期間を計算する関数
    const getMonthPeriod20th = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const day = date.getDate();

        let startDate: Date;
        let endDate: Date;

        if (day >= 20) {
            // 20日以降の場合、今月20日から来月19日まで
            startDate = new Date(year, month, 20);
            endDate = new Date(year, month + 1, 19);
        } else {
            // 20日未満の場合、先月20日から今月19日まで
            startDate = new Date(year, month - 1, 20);
            endDate = new Date(year, month, 19);
        }

        return { start: startDate, end: endDate };
    };

    const [attendanceBaseDate, setAttendanceBaseDate] = useState(() => formatDateForInput(new Date()));

    const [workRecordStartDate, setWorkRecordStartDate] = useState(() => {
        const date = new Date();
        date.setDate(date.getDate() - 30);
        return formatDateForInput(date);
    });
    const [workRecordEndDate, setWorkRecordEndDate] = useState(() => formatDateForInput(new Date()));

    const exportAttendanceMutation = trpc.csv.exportAttendance.useMutation({
        onSuccess: (data) => {
            const bom = "\uFEFF";
            const csvContent = bom + data.csv;
            const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            const period = getMonthPeriod20th(new Date(attendanceBaseDate));
            link.download = `出退勤記録_${format(period.start, "yyyyMMdd")}_${format(period.end, "yyyyMMdd")}.csv`;
            link.href = url;
            link.click();
            URL.revokeObjectURL(url);
            toast.success("CSVファイルをダウンロードしました");
        },
        onError: (error) => {
            toast.error(error.message || "CSV出力に失敗しました");
        },
    });

    const exportWorkRecordsMutation = trpc.csv.exportWorkRecords.useMutation({
        onSuccess: (data) => {
            const bom = "\uFEFF";
            const csvContent = bom + data.csv;
            const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `作業記録_${workRecordStartDate}_${workRecordEndDate}.csv`;
            link.click();
            URL.revokeObjectURL(url);
            toast.success("CSVファイルをダウンロードしました");
        },
        onError: (error) => {
            toast.error(error.message || "CSV出力に失敗しました");
        },
    });

    const exportVehiclesMutation = trpc.csv.exportVehicles.useMutation({
        onSuccess: (data) => {
            const bom = "\uFEFF";
            const csvContent = bom + data.csv;
            const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `車両情報_${formatDateForInput(new Date())}.csv`;
            link.click();
            URL.revokeObjectURL(url);
            toast.success("CSVファイルをダウンロードしました");
        },
        onError: (error) => {
            toast.error(error.message || "CSV出力に失敗しました");
        },
    });

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
                    CSV出力
                </h1>
                <p 
                    className="mt-2"
                    style={{ color: happyHuesColors.paragraph, opacity: 0.8 }}
                >
                    各種データをCSV形式でエクスポートします
                </p>
            </div>

            {/* 出退勤記録 */}
            <Card>
                <CardHeader>
                    <CardTitle>出退勤記録（20日始まりの1ヶ月単位）</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <label className="text-sm font-medium">基準日</label>
                        <p className="text-xs text-[hsl(var(--muted-foreground))] mb-2">
                            基準日を含む20日始まりの1ヶ月期間（例：1/20-2/19）で出力されます
                        </p>
                        <Input
                            type="date"
                            value={attendanceBaseDate}
                            onChange={(e) => setAttendanceBaseDate(e.target.value)}
                            className="max-w-xs"
                        />
                        {attendanceBaseDate && (
                            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2">
                                出力期間: {format(getMonthPeriod20th(new Date(attendanceBaseDate)).start, "yyyy年MM月dd日")} ～ {format(getMonthPeriod20th(new Date(attendanceBaseDate)).end, "yyyy年MM月dd日")}
                            </p>
                        )}
                    </div>
                    <Button
                        onClick={() =>
                            exportAttendanceMutation.mutate({
                                date: attendanceBaseDate,
                            })
                        }
                        disabled={exportAttendanceMutation.isPending}
                    >
                        <Download className="h-4 w-4 mr-2" />
                        ダウンロード
                    </Button>
                </CardContent>
            </Card>

            {/* 作業記録 */}
            <Card>
                <CardHeader>
                    <CardTitle>作業記録</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium">開始日</label>
                            <Input
                                type="date"
                                value={workRecordStartDate}
                                onChange={(e) => setWorkRecordStartDate(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">終了日</label>
                            <Input
                                type="date"
                                value={workRecordEndDate}
                                onChange={(e) => setWorkRecordEndDate(e.target.value)}
                            />
                        </div>
                    </div>
                    <Button
                        onClick={() =>
                            exportWorkRecordsMutation.mutate({
                                startDate: workRecordStartDate,
                                endDate: workRecordEndDate,
                            })
                        }
                        disabled={exportWorkRecordsMutation.isPending}
                    >
                        <Download className="h-4 w-4 mr-2" />
                        ダウンロード
                    </Button>
                </CardContent>
            </Card>

            {/* 車両情報 */}
            <Card>
                <CardHeader>
                    <CardTitle>車両情報</CardTitle>
                </CardHeader>
                <CardContent>
                    <Button
                        onClick={() => exportVehiclesMutation.mutate()}
                        disabled={exportVehiclesMutation.isPending}
                    >
                        <Download className="h-4 w-4 mr-2" />
                        ダウンロード
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}