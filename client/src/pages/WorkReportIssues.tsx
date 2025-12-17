import { useState } from "react";
import { useLocation, Link } from "wouter";
import { trpc } from "../lib/trpc";
import { useAuth } from "../hooks/useAuth";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { TimePicker } from "../components/TimePicker";
import { ArrowLeft, Clock, AlertCircle, Plus, Edit2, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { toast } from "sonner";
import { happyHuesColors, happyHuesStyles } from "../styles/happyHues";

export default function WorkReportIssues() {
    const { user } = useAuth();
    const [location] = useLocation();

    // URLパラメータを取得（window.location.searchを使用）
    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
    const userIdParam = searchParams.get("userId");
    const workDateParam = searchParams.get("workDate");
    const issueTypeParam = searchParams.get("type");

    const userId = userIdParam ? parseInt(userIdParam) : null;
    const workDate = workDateParam || "";
    const issueType = issueTypeParam || "";

    const utils = trpc.useUtils();

    // 状態変数の定義を先に
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState<any>(null);
    const [selectedVehicleId, setSelectedVehicleId] = useState("");
    const [selectedProcessId, setSelectedProcessId] = useState("");
    const [editStartTime, setEditStartTime] = useState("");
    const [editEndTime, setEditEndTime] = useState("");
    const [editWorkDescription, setEditWorkDescription] = useState("");

    const canEdit = user?.role === "admin" || user?.role === "sub_admin";

    // デバッグログを削除（無限ループを防ぐため）

    const { data: detail, isLoading, error, refetch } = trpc.analytics.getWorkReportDetail.useQuery(
        {
            userId: userId!,
            workDate,
        },
        {
            enabled: !!userId && !!workDate,
        }
    );

    const { data: vehicles } = trpc.vehicles.list.useQuery({});
    const { data: processes } = trpc.processes.list.useQuery();

    const formatDuration = (minutes: number | null | undefined) => {
        // NaN、null、undefinedの場合は0分を返す
        if (minutes === null || minutes === undefined || isNaN(minutes)) {
            return "0分";
        }
        const absMinutes = Math.abs(minutes);
        const hours = Math.floor(absMinutes / 60);
        const mins = absMinutes % 60;
        return hours > 0 ? `${hours}時間${mins}分` : `${mins}分`;
    };

    const formatTime = (time: string | null | undefined) => {
        if (!time) return "--:--";
        return time;
    };

    // Mutations
    const createWorkRecordMutation = trpc.workRecords.create.useMutation({
        onMutate: async () => {
            console.log("[WorkReportIssues] createWorkRecordMutation.mutate started");
        },
        onSuccess: (createdRecord) => {
            console.log("[WorkReportIssues] 作業記録追加成功:", createdRecord);
            toast.success("作業記録を追加しました");
            setIsAddDialogOpen(false);
            setSelectedVehicleId("");
            setSelectedProcessId("");
            setEditStartTime("");
            setEditEndTime("");
            setEditWorkDescription("");

            // データを再取得（invalidateのみで自動的に再取得される）
            utils.analytics.getWorkReportDetail.invalidate({
                userId: userId!,
                workDate,
            });
            // 作業記録管理不備も再計算する（サンプルページのため無効化）
            // utils.analytics.getWorkRecordIssues.invalidate();
        },
        onError: (error: any) => {
            const errorMessage = error?.message || error?.data?.message || error?.shape?.message || "作業記録の追加に失敗しました";
            const errorCode = error?.data?.code || error?.shape?.code || "UNKNOWN";
            console.error("[WorkReportIssues] 作業記録追加エラー:", {
                message: errorMessage,
                code: errorCode,
                error: error,
                data: error?.data,
                shape: error?.shape,
            });
            toast.error(`${errorMessage} (コード: ${errorCode})`);
        },
    });

    const updateWorkRecordMutation = trpc.workRecords.update.useMutation({
        onSuccess: () => {
            toast.success("作業記録を更新しました");
            setIsEditDialogOpen(false);
            setEditingRecord(null);
            // データを再取得（invalidateのみで自動的に再取得される）
            utils.analytics.getWorkReportDetail.invalidate({
                userId: userId!,
                workDate,
            });
            // 作業記録管理不備も再計算する（サンプルページのため無効化）
            // utils.analytics.getWorkRecordIssues.invalidate();
        },
        onError: (error) => {
            toast.error(error.message || "作業記録の更新に失敗しました");
            console.error("[WorkReportIssues] 作業記録更新エラー:", error);
        },
    });

    const deleteWorkRecordMutation = trpc.workRecords.delete.useMutation({
        onSuccess: () => {
            toast.success("作業記録を削除しました");
            // データを再取得（invalidateのみで自動的に再取得される）
            utils.analytics.getWorkReportDetail.invalidate({
                userId: userId!,
                workDate,
            });
            // 作業記録管理不備も再計算する（サンプルページのため無効化）
            // utils.analytics.getWorkRecordIssues.invalidate();
        },
        onError: (error) => {
            toast.error(error.message || "作業記録の削除に失敗しました");
            console.error("[WorkReportIssues] 作業記録削除エラー:", error);
        },
    });

    const updateAttendanceMutation = trpc.attendance.updateAttendance.useMutation({
        onSuccess: () => {
            toast.success("出勤記録を更新しました");
            // データを再取得（invalidateのみで自動的に再取得される）
            utils.analytics.getWorkReportDetail.invalidate({
                userId: userId!,
                workDate,
            });
            // 作業記録管理不備も再計算する（サンプルページのため無効化）
            // utils.analytics.getWorkRecordIssues.invalidate();
        },
        onError: (error) => {
            toast.error(error.message || "出勤記録の更新に失敗しました");
            console.error("[WorkReportIssues] 出勤記録更新エラー:", error);
        },
    });

    const clearWorkRecordIssueMutation = trpc.analytics.clearWorkRecordIssue.useMutation({
        onSuccess: () => {
            toast.success("作業記録管理不備をクリアしました");
            // 作業記録管理不備を再計算する
            utils.analytics.getWorkRecordIssues.invalidate();
            // ダッシュボードに戻る
            window.location.href = "/";
        },
        onError: (error) => {
            toast.error(error.message || "不備のクリアに失敗しました");
            console.error("[WorkReportIssues] 不備クリアエラー:", error);
        },
    });

    // Handlers
    // JSTで時刻を取得する関数
    const getJSTTimeString = (date: Date | string): string => {
        const d = typeof date === "string" ? new Date(date) : date;
        // JST（Asia/Tokyo）で時刻を取得
        const formatter = new Intl.DateTimeFormat('ja-JP', {
            timeZone: 'Asia/Tokyo',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        });
        return formatter.format(d);
    };

    const handleEditRecord = (record: any) => {
        setEditingRecord(record);
        setSelectedVehicleId(record.vehicleId.toString());
        setSelectedProcessId(record.processId.toString());
        // サーバーから返されるstartTimeStrとendTimeStrを優先的に使用（JST変換済み）
        const startTimeStr = record.startTimeStr || (record.startTime ? getJSTTimeString(record.startTime) : "");
        const endTimeStr = record.endTimeStr || (record.endTime ? getJSTTimeString(record.endTime) : "");
        setEditStartTime(startTimeStr);
        setEditEndTime(endTimeStr);
        setEditWorkDescription(record.workDescription || "");
        setIsEditDialogOpen(true);
    };

    const handleDeleteRecord = (recordId: number) => {
        if (!window.confirm("この作業記録を削除しますか？")) return;
        deleteWorkRecordMutation.mutate({ id: recordId });
    };

    const handleSaveEdit = () => {
        if (!editingRecord || !selectedVehicleId || !selectedProcessId || !editStartTime) {
            toast.error("車両、工程、開始時刻を入力してください");
            return;
        }

        const startDateTime = `${workDate}T${editStartTime}:00+09:00`;
        const endDateTime = editEndTime ? `${workDate}T${editEndTime}:00+09:00` : undefined;

        updateWorkRecordMutation.mutate({
            id: editingRecord.id,
            vehicleId: parseInt(selectedVehicleId),
            processId: parseInt(selectedProcessId),
            startTime: startDateTime,
            endTime: endDateTime,
            workDescription: editWorkDescription || undefined,
        });
    };

    const handleAddWork = () => {
        console.log("[WorkReportIssues] ========== handleAddWork 開始 ==========");
        console.log("[WorkReportIssues] handleAddWork called", {
            selectedVehicleId,
            selectedProcessId,
            editStartTime,
            editEndTime,
            workDate,
            userId,
            workDescription: editWorkDescription,
        });

        if (!selectedVehicleId || !selectedProcessId || !editStartTime) {
            const errorMsg = "車両、工程、開始時刻を入力してください";
            console.error("[WorkReportIssues] Validation failed:", {
                selectedVehicleId: !!selectedVehicleId,
                selectedProcessId: !!selectedProcessId,
                editStartTime: !!editStartTime,
                errorMsg,
            });
            toast.error(errorMsg);
            return;
        }

        if (!userId) {
            console.error("[WorkReportIssues] userId is missing");
            toast.error("ユーザー情報が取得できません");
            return;
        }

        const startDateTime = `${workDate}T${editStartTime}:00+09:00`;
        const endDateTime = editEndTime ? `${workDate}T${editEndTime}:00+09:00` : undefined;

        const mutationData = {
            userId: userId,
            vehicleId: parseInt(selectedVehicleId),
            processId: parseInt(selectedProcessId),
            startTime: startDateTime,
            endTime: endDateTime,
            workDescription: editWorkDescription || undefined,
        };

        console.log("[WorkReportIssues] Creating work record with data:", mutationData);
        console.log("[WorkReportIssues] createWorkRecordMutation state:", {
            isPending: createWorkRecordMutation.isPending,
            isError: createWorkRecordMutation.isError,
            isSuccess: createWorkRecordMutation.isSuccess,
        });

        try {
            console.log("[WorkReportIssues] mutation.mutate() を呼び出します", {
                mutationData,
                isPending: createWorkRecordMutation.isPending,
            });
            createWorkRecordMutation.mutate(mutationData, {
                onError: (error) => {
                    console.error("[WorkReportIssues] mutation.mutate() のonErrorコールバック:", error);
                },
            });
            console.log("[WorkReportIssues] mutation.mutate() 呼び出し完了");
        } catch (error) {
            console.error("[WorkReportIssues] mutation.mutate() で同期エラー:", error);
            toast.error("作業記録の追加に失敗しました: " + (error instanceof Error ? error.message : String(error)));
        }
        console.log("[WorkReportIssues] ========== handleAddWork 終了 ==========");
    };

    const handleOpenAddDialog = () => {
        console.log("[WorkReportIssues] ========== handleOpenAddDialog 開始 ==========");
        console.log("[WorkReportIssues] handleOpenAddDialog called", {
            canEdit,
            userRole: user?.role,
            vehiclesCount: vehicles?.length || 0,
            processesCount: processes?.length || 0,
        });

        if (!canEdit) {
            console.error("[WorkReportIssues] canEdit is false, cannot open dialog");
            toast.error("編集権限がありません");
            return;
        }

        setSelectedVehicleId("");
        setSelectedProcessId("");
        setEditStartTime("");
        setEditEndTime("");
        setEditWorkDescription("");
        setIsAddDialogOpen(true);
        console.log("[WorkReportIssues] 追加ダイアログを開きました");
        console.log("[WorkReportIssues] ========== handleOpenAddDialog 終了 ==========");
    };

    if (!userId || !workDate) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Link href="/">
                        <Button variant="outline" size="sm">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            戻る
                        </Button>
                    </Link>
                    <h1 className="text-2xl font-bold">作業報告の詳細</h1>
                </div>
                <Card>
                    <CardContent className="p-6">
                        <p className="text-[hsl(var(--muted-foreground))]">
                            パラメータが正しくありません。
                        </p>
                        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-2">
                            userId: {userIdParam || "未指定"}, workDate: {workDateParam || "未指定"}
                        </p>
                        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-2">
                            URL: {typeof window !== 'undefined' ? window.location.href : 'N/A'}
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Link href="/">
                        <Button variant="outline" size="sm">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            戻る
                        </Button>
                    </Link>
                    <h1 className="text-2xl font-bold">作業報告の詳細</h1>
                </div>
                <Card>
                    <CardContent className="p-6">
                        <p className="text-[hsl(var(--muted-foreground))]">読み込み中...</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (error || !detail) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Link href="/">
                        <Button variant="outline" size="sm">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            戻る
                        </Button>
                    </Link>
                    <h1 className="text-2xl font-bold">作業報告の詳細</h1>
                </div>
                <Card>
                    <CardContent className="p-6">
                        <p className="text-red-600">エラーが発生しました: {error?.message || "データが見つかりません"}</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const dateObj = new Date(detail.workDate);
    const dateStr = format(dateObj, "yyyy年MM月dd日(E)", { locale: ja });

    return (
        <div 
            className="min-h-screen p-4 sm:p-6 space-y-6"
        >
            <div className="flex items-center gap-4">
                <Link href="/">
                    <Button variant="outline" size="sm">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        戻る
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold">作業報告の詳細</h1>
                    <p className="text-[hsl(var(--muted-foreground))] mt-1 text-sm">
                        {detail.userName}さん - {dateStr}
                    </p>
                </div>
            </div>

            {/* 警告表示 */}
            {issueType === "excessive" && Math.abs(detail.summary.differenceMinutes) > 60 && (
                <Card className="border-red-300 bg-red-50">
                    <CardContent className="p-4 sm:p-6">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <p className="font-semibold text-red-900 text-sm sm:text-base">
                                    作業報告が出勤時間を超えています
                                </p>
                                <p className="text-xs sm:text-sm text-red-800 mt-1">
                                    作業時間が{formatDuration(detail.summary.differenceMinutes)}超過しています
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {issueType === "low" && detail.summary.workMinutes < detail.summary.attendanceMinutes && Math.abs(detail.summary.differenceMinutes) > 60 && (
                <Card className="border-yellow-300 bg-yellow-50">
                    <CardContent className="p-4 sm:p-6">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <p className="font-semibold text-yellow-900 text-sm sm:text-base">
                                    作業報告が不足しています
                                </p>
                                <p className="text-xs sm:text-sm text-yellow-800 mt-1">
                                    期待される作業時間より{formatDuration(detail.summary.attendanceMinutes - detail.summary.workMinutes)}不足しています
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* 作業記録管理不備の場合に「ふみかチェック」ボタンを表示 */}
            {issueType === "issue" && canEdit && (
                <Card className="border-purple-300 bg-purple-50">
                    <CardContent className="p-4 sm:p-6">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex-1">
                                <p className="font-semibold text-purple-900 text-sm sm:text-base">
                                    作業記録管理に不備があります
                                </p>
                                <p className="text-xs sm:text-sm text-purple-800 mt-1">
                                    確認後、「ふみかチェック」ボタンを押して不備をクリアしてください
                                </p>
                            </div>
                            <Button
                                onClick={() => {
                                    if (window.confirm("作業記録管理不備をクリアしますか？")) {
                                        clearWorkRecordIssueMutation.mutate({
                                            userId: userId!,
                                            workDate: workDate,
                                        });
                                    }
                                }}
                                disabled={clearWorkRecordIssueMutation.isPending}
                                className="bg-purple-600 hover:bg-purple-700 text-white"
                            >
                                {clearWorkRecordIssueMutation.isPending ? "処理中..." : "ふみかチェック"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* 出勤情報 */}
            {detail.attendance ? (
                <Card>
                    <CardHeader className="p-4 sm:p-6">
                        <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
                            <Clock className="h-5 w-5" />
                            出勤情報
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-6 space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm text-[hsl(var(--muted-foreground))]">出勤時刻</p>
                                <p className="text-lg font-semibold">{formatTime(detail.attendance.clockInTime)}</p>
                            </div>
                            <div>
                                <p className="text-sm text-[hsl(var(--muted-foreground))]">退勤時刻</p>
                                <p className="text-lg font-semibold">{formatTime(detail.attendance.clockOutTime)}</p>
                            </div>
                        </div>
                        <div className="pt-3 border-t border-[hsl(var(--border))]">
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">出勤時間</p>
                            <p className="text-2xl font-bold text-blue-600">
                                {formatDuration(detail.summary.attendanceMinutes)}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardHeader className="p-4 sm:p-6">
                        <CardTitle className="text-lg sm:text-xl">出勤情報</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-6">
                        <p className="text-[hsl(var(--muted-foreground))]">出勤記録が見つかりません</p>
                    </CardContent>
                </Card>
            )}

            {/* 作業記録 */}
            <Card>
                <CardHeader className="p-4 sm:p-6">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg sm:text-xl">作業記録</CardTitle>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                console.log("[WorkReportIssues] 追加ボタン（ヘッダー）がクリックされました", {
                                    canEdit,
                                    userRole: user?.role,
                                    isAddDialogOpen,
                                });
                                if (!canEdit) {
                                    console.warn("[WorkReportIssues] canEdit is false, but button was clicked");
                                    toast.error("編集権限がありません");
                                    return;
                                }
                                handleOpenAddDialog();
                            }}
                            disabled={!canEdit}
                            style={{ pointerEvents: canEdit ? 'auto' : 'none', opacity: canEdit ? 1 : 0.5 }}
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            追加
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                    {detail.workRecords && detail.workRecords.length > 0 ? (
                        <div className="space-y-3">
                            {(() => {
                                // 重複を除去（idでユニークにする）
                                const uniqueRecords = Array.from(
                                    new Map(detail.workRecords.map((r: any) => [r.id, r])).values()
                                );
                                return uniqueRecords.map((record: any) => {
                                    // サーバーから返されるstartTimeStrとendTimeStrを直接使用（JST変換済み）
                                    // これにより、タイムゾーンの問題を回避
                                    const startTimeStr = record.startTimeStr || (record.startTime ? getJSTTimeString(record.startTime) : "--:--");
                                    const endTimeStr = record.endTimeStr || (record.endTime ? getJSTTimeString(record.endTime) : null);

                                    return (
                                        <div
                                            key={record.id}
                                            className="p-3 sm:p-4 border border-[hsl(var(--border))] rounded-lg bg-gray-50"
                                        >
                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                <div
                                                    className={`flex-1 min-w-0 ${canEdit ? "cursor-pointer hover:opacity-80" : ""}`}
                                                    onClick={() => canEdit && handleEditRecord(record)}
                                                >
                                                    <p className="font-semibold text-sm sm:text-base">
                                                        {record.vehicleNumber}
                                                        {record.customerName && (
                                                            <span className="text-xs text-[hsl(var(--muted-foreground))] ml-2">
                                                                ({record.customerName})
                                                            </span>
                                                        )}
                                                    </p>
                                                    <p className="text-xs sm:text-sm text-[hsl(var(--muted-foreground))] mt-1">
                                                        {record.processName}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    <div className="text-right">
                                                        <p className="font-semibold text-sm sm:text-base">
                                                            {formatDuration(record.durationMinutes)}
                                                        </p>
                                                    </div>
                                                    {canEdit && (
                                                        <div className="flex gap-1">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="h-8 w-8 p-0"
                                                                onClick={() => handleEditRecord(record)}
                                                            >
                                                                <Edit2 className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                                                onClick={() => handleDeleteRecord(record.id)}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-xs text-[hsl(var(--muted-foreground))]">
                                                {startTimeStr}
                                                {endTimeStr ? ` - ${endTimeStr}` : " (作業中)"}
                                            </div>
                                            {record.workDescription && (
                                                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                                                    {record.workDescription}
                                                </p>
                                            )}
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                    ) : (
                        <p className="text-[hsl(var(--muted-foreground))] text-center py-4">
                            作業記録がありません
                        </p>
                    )}

                    {/* 作業時間の合計 */}
                    <div className="mt-6 pt-6 border-t border-[hsl(var(--border))]">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold">作業時間の合計</p>
                            <p className="text-2xl font-bold text-green-600">
                                {formatDuration(detail.summary.workMinutes)}
                            </p>
                        </div>
                    </div>

                    {/* 休憩時間の計算詳細 */}
                    {detail.breakTimeDetails && detail.breakTimeDetails.intervals.length > 0 && (
                        <div className="mt-6 pt-6 border-t border-[hsl(var(--border))]">
                            <p className="text-sm font-semibold mb-3">休憩時間の計算詳細</p>
                            <div className="space-y-3">
                                <div className="text-xs text-[hsl(var(--muted-foreground))] mb-2">
                                    <p className="font-medium mb-1">設定されている休憩時間:</p>
                                    {detail.breakTimeDetails.breakTimes.map((bt: any, idx: number) => (
                                        <p key={idx} className="ml-2">・{bt.start} - {bt.end}</p>
                                    ))}
                                </div>
                                {detail.breakTimeDetails.intervals.map((interval: any) => (
                                    <div key={interval.index} className="p-3 bg-gray-50 rounded-lg text-xs">
                                        <p className="font-medium mb-1">
                                            作業区間[{interval.index}]: {interval.startTime} - {interval.endTime}
                                        </p>
                                        <div className="ml-2 space-y-1">
                                            <p>基本時間: {formatDuration(interval.baseMinutes)}</p>
                                            {interval.breakDetails.length > 0 ? (
                                                <>
                                                    <p>休憩時間の重複:</p>
                                                    {interval.breakDetails.map((bd: any, idx: number) => (
                                                        <p key={idx} className="ml-2">
                                                            ・{bd.breakTime}: {formatDuration(bd.overlap)}
                                                        </p>
                                                    ))}
                                                    <p className="font-medium">
                                                        休憩時間合計: {formatDuration(interval.breakTotal)}
                                                    </p>
                                                </>
                                            ) : (
                                                <p>休憩時間の重複: なし</p>
                                            )}
                                            <p className="font-semibold text-green-600">
                                                実作業時間: {formatDuration(interval.duration)}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* 比較サマリー */}
            <Card>
                <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="text-lg sm:text-xl">比較サマリー</CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-blue-50 rounded-lg">
                            <p className="text-xs text-[hsl(var(--muted-foreground))] mb-1">出勤時間</p>
                            <p className="text-xl font-bold text-blue-600">
                                {formatDuration(detail.summary.attendanceMinutes)}
                            </p>
                        </div>
                        <div className="p-4 bg-green-50 rounded-lg">
                            <p className="text-xs text-[hsl(var(--muted-foreground))] mb-1">作業時間</p>
                            <p className="text-xl font-bold text-green-600">
                                {formatDuration(detail.summary.workMinutes)}
                            </p>
                        </div>
                    </div>
                    <div className="pt-4 border-t border-[hsl(var(--border))]">
                        <p className="text-sm text-[hsl(var(--muted-foreground))] mb-1">差</p>
                        <p
                            className={`text-2xl font-bold ${detail.summary.differenceMinutes > 60
                                ? "text-red-600"
                                : detail.summary.differenceMinutes > 0
                                    ? "text-orange-600"
                                    : detail.summary.differenceMinutes < 0
                                        ? "text-yellow-600"
                                        : "text-gray-600"
                                }`}
                        >
                            {detail.summary.differenceMinutes > 0 ? "+" : ""}
                            {formatDuration(detail.summary.differenceMinutes)}
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* 編集ダイアログ */}
            {isEditDialogOpen && editingRecord && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
                    <Card className="w-full max-w-md min-w-0 my-auto">
                        <CardHeader className="p-3 sm:p-4 md:p-6">
                            <CardTitle className="text-base sm:text-lg md:text-xl">作業記録を編集</CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4">
                            <div className="min-w-0">
                                <label className="text-sm font-medium block mb-1">車両</label>
                                <select
                                    className="flex h-10 w-full min-w-0 rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-2 sm:px-3 py-2 text-sm"
                                    value={selectedVehicleId}
                                    onChange={(e) => setSelectedVehicleId(e.target.value)}
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
                                    className="flex h-10 w-full min-w-0 rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-2 sm:px-3 py-2 text-sm"
                                    value={selectedProcessId}
                                    onChange={(e) => setSelectedProcessId(e.target.value)}
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
                                    value={editStartTime}
                                    onChange={(value) => setEditStartTime(value)}
                                    className="w-full"
                                />
                            </div>
                            <div className="min-w-0">
                                <label className="text-sm font-medium block mb-1">終了時刻</label>
                                <TimePicker
                                    value={editEndTime}
                                    onChange={(value) => setEditEndTime(value)}
                                    className="w-full"
                                />
                            </div>
                            <div className="min-w-0">
                                <label className="text-sm font-medium block mb-1">作業内容（任意）</label>
                                <Input
                                    type="text"
                                    value={editWorkDescription}
                                    onChange={(e) => setEditWorkDescription(e.target.value)}
                                    placeholder="作業内容を入力"
                                    className="w-full min-w-0"
                                />
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2 pt-2">
                                <Button
                                    className="flex-1 w-full sm:w-auto"
                                    onClick={handleSaveEdit}
                                    disabled={updateWorkRecordMutation.isPending}
                                >
                                    保存
                                </Button>
                                <Button
                                    variant="outline"
                                    className="flex-1 w-full sm:w-auto"
                                    onClick={() => {
                                        setIsEditDialogOpen(false);
                                        setEditingRecord(null);
                                    }}
                                >
                                    キャンセル
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* 追加ダイアログ */}
            {isAddDialogOpen && (
                <div
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            console.log("[WorkReportIssues] ダイアログ背景をクリック - 閉じます");
                            setIsAddDialogOpen(false);
                        }
                    }}
                >
                    <Card className="w-full max-w-md min-w-0 my-auto" onClick={(e) => e.stopPropagation()}>
                        <CardHeader className="p-3 sm:p-4 md:p-6">
                            <CardTitle className="text-base sm:text-lg md:text-xl">作業記録を追加</CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4">
                            <div className="min-w-0">
                                <label className="text-sm font-medium block mb-1">車両</label>
                                <select
                                    className="flex h-10 w-full min-w-0 rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-2 sm:px-3 py-2 text-sm"
                                    value={selectedVehicleId}
                                    onChange={(e) => setSelectedVehicleId(e.target.value)}
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
                                    className="flex h-10 w-full min-w-0 rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-2 sm:px-3 py-2 text-sm"
                                    value={selectedProcessId}
                                    onChange={(e) => setSelectedProcessId(e.target.value)}
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
                                    value={editStartTime}
                                    onChange={(value) => setEditStartTime(value)}
                                    className="w-full"
                                />
                            </div>
                            <div className="min-w-0">
                                <label className="text-sm font-medium block mb-1">終了時刻</label>
                                <TimePicker
                                    value={editEndTime}
                                    onChange={(value) => setEditEndTime(value)}
                                    className="w-full"
                                />
                            </div>
                            <div className="min-w-0">
                                <label className="text-sm font-medium block mb-1">作業内容（任意）</label>
                                <Input
                                    type="text"
                                    value={editWorkDescription}
                                    onChange={(e) => setEditWorkDescription(e.target.value)}
                                    placeholder="作業内容を入力"
                                    className="w-full min-w-0"
                                />
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2 pt-2">
                                <Button
                                    type="button"
                                    className="flex-1 w-full sm:w-auto"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        console.log("[WorkReportIssues] 追加ボタンがクリックされました");
                                        handleAddWork();
                                    }}
                                    disabled={createWorkRecordMutation.isPending}
                                >
                                    {createWorkRecordMutation.isPending ? "追加中..." : "追加"}
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="flex-1 w-full sm:w-auto"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setIsAddDialogOpen(false);
                                    }}
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

