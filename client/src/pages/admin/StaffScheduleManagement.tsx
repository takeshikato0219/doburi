import React, { useState, useMemo } from "react";
import { useAuth } from "../../hooks/useAuth";
import { trpc } from "../../lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Edit, Save, X, User, Globe, ChevronLeft, ChevronRight, Palette, Printer } from "lucide-react";
import { toast } from "sonner";
import { format, parse } from "date-fns";
import { ja } from "date-fns/locale";
import { happyHuesColors, happyHuesStyles } from "../../styles/happyHues";

type ScheduleStatus = "work" | "rest" | "request" | "exhibition" | "other" | "morning" | "afternoon" | "business_trip" | "exhibition_duty" | "paid_leave" | "delivery" | "payment_date";

// デフォルトの色設定（データベースから取得できない場合のフォールバック）
const DEFAULT_STATUS_COLORS: Record<ScheduleStatus, string> = {
    work: "bg-blue-100", // 水色 = 出勤
    rest: "bg-pink-200", // ピンク = 休み
    request: "bg-pink-300", // ピンク = 希望休
    exhibition: "bg-green-100", // 薄緑 = 展示会
    other: "bg-green-50", // 薄緑 = その他業務
    morning: "bg-yellow-100", // 黄色 = 午前出
    afternoon: "bg-orange-100", // オレンジ = 午後出
    business_trip: "bg-purple-100", // 紫 = 出張
    exhibition_duty: "bg-cyan-100", // シアン = 展示場当番
    paid_leave: "bg-red-100", // 赤 = 有給
    delivery: "bg-indigo-100", // インディゴ = 納車
    payment_date: "bg-amber-100", // アンバー = 支払日
};

// 利用可能な色のオプション
const AVAILABLE_COLORS = [
    { value: "bg-blue-100", label: "青（薄）", preview: "bg-blue-100" },
    { value: "bg-blue-200", label: "青（中）", preview: "bg-blue-200" },
    { value: "bg-blue-300", label: "青（濃）", preview: "bg-blue-300" },
    { value: "bg-pink-100", label: "ピンク（薄）", preview: "bg-pink-100" },
    { value: "bg-pink-200", label: "ピンク（中）", preview: "bg-pink-200" },
    { value: "bg-pink-300", label: "ピンク（濃）", preview: "bg-pink-300" },
    { value: "bg-green-100", label: "緑（薄）", preview: "bg-green-100" },
    { value: "bg-green-200", label: "緑（中）", preview: "bg-green-200" },
    { value: "bg-green-300", label: "緑（濃）", preview: "bg-green-300" },
    { value: "bg-yellow-100", label: "黄色（薄）", preview: "bg-yellow-100" },
    { value: "bg-yellow-200", label: "黄色（中）", preview: "bg-yellow-200" },
    { value: "bg-orange-100", label: "オレンジ（薄）", preview: "bg-orange-100" },
    { value: "bg-orange-200", label: "オレンジ（中）", preview: "bg-orange-200" },
    { value: "bg-purple-100", label: "紫（薄）", preview: "bg-purple-100" },
    { value: "bg-purple-200", label: "紫（中）", preview: "bg-purple-200" },
    { value: "bg-cyan-100", label: "シアン（薄）", preview: "bg-cyan-100" },
    { value: "bg-cyan-200", label: "シアン（中）", preview: "bg-cyan-200" },
    { value: "bg-red-100", label: "赤（薄）", preview: "bg-red-100" },
    { value: "bg-red-200", label: "赤（中）", preview: "bg-red-200" },
    { value: "bg-indigo-100", label: "インディゴ（薄）", preview: "bg-indigo-100" },
    { value: "bg-indigo-200", label: "インディゴ（中）", preview: "bg-indigo-200" },
    { value: "bg-amber-100", label: "アンバー（薄）", preview: "bg-amber-100" },
    { value: "bg-amber-200", label: "アンバー（中）", preview: "bg-amber-200" },
    { value: "bg-gray-100", label: "グレー（薄）", preview: "bg-gray-100" },
    { value: "bg-gray-200", label: "グレー（中）", preview: "bg-gray-200" },
    { value: "bg-slate-100", label: "スレート（薄）", preview: "bg-slate-100" },
    { value: "bg-slate-200", label: "スレート（中）", preview: "bg-slate-200" },
];

const STATUS_LABELS: Record<ScheduleStatus, string> = {
    work: "出勤",
    rest: "休",
    request: "希望",
    exhibition: "展",
    other: "その他",
    morning: "午前出",
    afternoon: "午後出",
    business_trip: "出張",
    exhibition_duty: "展示場当番",
    paid_leave: "有給",
    delivery: "納車",
    payment_date: "支払日",
};

export default function StaffScheduleManagement() {
    const { user } = useAuth();

    if (user?.role !== "admin") {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <p className="text-lg font-semibold">アクセス権限がありません</p>
                    <p className="text-[hsl(var(--muted-foreground))] mt-2">このページは管理者のみがアクセスできます</p>
                </div>
            </div>
        );
    }

    const [baseDate, setBaseDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
    const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
    const [isBulkEditMode, setIsBulkEditMode] = useState(false);
    const [bulkStatus, setBulkStatus] = useState<ScheduleStatus>("work");
    const [bulkComment, setBulkComment] = useState("");
    const [isEditOrderMode, setIsEditOrderMode] = useState(false);
    const [isEditNameMode, setIsEditNameMode] = useState(false);
    const [editingNameUserId, setEditingNameUserId] = useState<number | null>(null);
    const [editingName, setEditingName] = useState("");
    // 色設定管理
    const [isColorEditMode, setIsColorEditMode] = useState(false);
    const [editingColorStatus, setEditingColorStatus] = useState<ScheduleStatus | null>(null);
    const [baseMenuUserId, setBaseMenuUserId] = useState<number | null>(null);
    const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
    // 編集モード用のローカル変更管理
    const [isEditMode, setIsEditMode] = useState(false);
    const [localChanges, setLocalChanges] = useState<Map<string, { status: ScheduleStatus; comment: string | null }>>(new Map());
    // フィルタは一旦「全員表示」のみ（スタッフは独立管理のため）

    // 月移動用の関数
    const moveMonth = (months: number) => {
        const currentDate = parse(baseDate, "yyyy-MM-dd", new Date());
        const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + months, currentDate.getDate());
        setBaseDate(format(newDate, "yyyy-MM-dd"));
    };

    const { data: scheduleData, refetch, isLoading, error } = trpc.staffSchedule.getSchedule.useQuery({ baseDate });
    const { data: editLogs } = trpc.staffSchedule.getEditLogs.useQuery();
    const updateAdjustmentMutation = trpc.staffSchedule.updateAdjustment.useMutation({
        onSuccess: () => {
            refetch();
        },
        onError: (error) => {
            toast.error(error.message || "調整休の更新に失敗しました");
        },
    });

    const resetScheduleMutation = trpc.staffSchedule.resetScheduleToDefault.useMutation({
        onSuccess: () => {
            toast.success("スケジュールを初期状態に戻しました");
            setIsResetDialogOpen(false);
            refetch();
        },
        onError: (error) => {
            toast.error(error.message || "スケジュールの初期化に失敗しました");
        },
    });
    const publishMutation = trpc.staffSchedule.publishSchedule.useMutation({
        onSuccess: () => {
            toast.success("スケジュールを公開しました");
            refetch();
        },
        onError: (error) => {
            toast.error(error.message || "公開に失敗しました");
        },
    });
    const unpublishMutation = trpc.staffSchedule.unpublishSchedule.useMutation({
        onSuccess: () => {
            toast.success("スケジュールを非公開にしました");
            refetch();
        },
        onError: (error) => {
            toast.error(error.message || "非公開に失敗しました");
        },
    });

    const updateDisplayOrderMutation = trpc.staffSchedule.updateDisplayOrder.useMutation({
        onSuccess: () => {
            toast.success("表示順序を更新しました");
            refetch();
        },
        onError: (error) => {
            toast.error(error.message || "表示順序の更新に失敗しました");
        },
    });

    const updateDisplayNameMutation = trpc.staffSchedule.updateDisplayName.useMutation({
        onSuccess: () => {
            toast.success("表示名を更新しました");
            refetch();
        },
        onError: (error) => {
            toast.error(error.message || "表示名の更新に失敗しました");
        },
    });

    // 色設定の取得と更新
    const { data: statusColors, refetch: refetchColors } = trpc.staffSchedule.getStatusColors.useQuery();
    const updateStatusColorMutation = trpc.staffSchedule.updateStatusColor.useMutation({
        onSuccess: () => {
            toast.success("色を更新しました");
            refetchColors();
        },
        onError: (error) => {
            toast.error(error.message || "色の更新に失敗しました");
        },
    });

    // 実際に使用する色設定（データベースから取得、なければデフォルト）
    const STATUS_COLORS = useMemo(() => {
        if (!statusColors) return DEFAULT_STATUS_COLORS;
        return { ...DEFAULT_STATUS_COLORS, ...statusColors } as Record<ScheduleStatus, string>;
    }, [statusColors]);

    const updateMutation = trpc.staffSchedule.updateSchedule.useMutation({
        onSuccess: () => {
            // 成功時は静かに更新（toastは表示しない）
            refetch();
            setSelectedCells(new Set());
        },
        onError: (error) => {
            toast.error(error.message || "スケジュールの更新に失敗しました");
            // エラー時は再取得して元に戻す
            refetch();
        },
    });

    const bulkUpdateMutation = trpc.staffSchedule.bulkUpdateSchedule.useMutation({
        onSuccess: () => {
            toast.success("スケジュールを一括更新しました");
            refetch();
            setSelectedCells(new Set());
            setIsBulkEditMode(false);
        },
        onError: (error) => {
            toast.error(error.message || "スケジュールの一括更新に失敗しました");
        },
    });

    const handleStatusChange = (userId: number, date: string, status: ScheduleStatus, comment?: string | null) => {
        if (isEditMode) {
            // 編集モードの場合はローカルに保存（高速化のため、元のデータではなく現在の値を優先）
            const cellKey = `${userId}_${date}`;
            setLocalChanges((prev) => {
                const newChanges = new Map(prev);
                // 既存の変更があれば、そのコメントを使用、なければ元のデータから取得
                const existingChange = prev.get(cellKey);
                const originalEntry = scheduleData?.scheduleData
                    .find((d) => d.date === date)
                    ?.userEntries.find((e) => e.userId === userId);

                newChanges.set(cellKey, {
                    status,
                    comment: comment !== undefined
                        ? comment
                        : (existingChange?.comment !== undefined
                            ? existingChange.comment
                            : (originalEntry?.comment || null)),
                });
                return newChanges;
            });
        } else {
            // 通常モードの場合は即座にサーバーに送信
            const entry = filteredScheduleData
                .find((d) => d.date === date)
                ?.userEntries.find((e) => e.userId === userId);
            // commentが明示的に指定されている場合はそれを使用、指定されていない場合は既存のcommentを使用
            // 空文字列の場合はnullに変換
            let commentValue: string | null | undefined;
            if (comment !== undefined) {
                commentValue = comment && comment.trim() !== "" ? comment.trim() : null;
            } else {
                // commentが指定されていない場合は、既存のcommentを維持（空文字列の場合はnullに変換）
                const existingComment = entry?.comment;
                commentValue = existingComment && existingComment.trim() !== "" ? existingComment.trim() : null;
            }
            updateMutation.mutate({
                userId,
                date,
                status,
                comment: commentValue ?? null,
            });
        }
    };

    const handleCellClick = (userId: number, date: string) => {
        if (!isBulkEditMode) {
            // 一括編集モードでない場合は、セルクリックは無視（Selectで処理）
            return;
        } else {
            // 一括編集モード：セルを選択/解除
            const cellKey = `${userId}_${date}`;
            const newSelected = new Set(selectedCells);
            if (newSelected.has(cellKey)) {
                newSelected.delete(cellKey);
            } else {
                newSelected.add(cellKey);
            }
            setSelectedCells(newSelected);
        }
    };

    const handleBulkSave = () => {
        if (selectedCells.size === 0) {
            toast.error("セルを選択してください");
            return;
        }

        const updates = Array.from(selectedCells).map((cellKey) => {
            const [userIdStr, date] = cellKey.split("_");
            return {
                userId: parseInt(userIdStr),
                date,
                status: bulkStatus,
                comment: bulkComment || null,
            };
        });

        bulkUpdateMutation.mutate({ updates });
    };

    const handleDateStatusChange = (date: string, status: ScheduleStatus) => {
        // その日の全スタッフのステータスを一括変更
        if (!scheduleData) return;

        const updates = filteredUsers.map((user) => ({
            userId: user.id,
            date,
            status,
            comment: null,
        }));

        bulkUpdateMutation.mutate({ updates });
    };

    const handleCellDoubleClick = (userId: number, date: string) => {
        // ダブルクリックでコメント編集ダイアログを開く
        // 編集モードの場合はローカル変更を考慮、通常モードの場合は現在のデータを参照
        const entry = filteredScheduleData
            .find((d) => d.date === date)
            ?.userEntries.find((e) => e.userId === userId);
        if (entry) {
            const currentStatus = entry.status as ScheduleStatus;
            let promptText = "コメントを入力してください:";
            if (currentStatus === "business_trip") {
                promptText = "出張先の県名を入力してください:";
            } else if (currentStatus === "payment_date") {
                promptText = "支払日に関するコメントを入力してください:";
            } else {
                promptText = "コメントを入力してください（支払日、買い付け、外出など）:";
            }
            const comment = prompt(promptText, entry.comment || "");
            if (comment !== null) {
                // 空文字列も有効な値として扱う（出張先の県名など）
                handleStatusChange(userId, date, currentStatus, comment);
            }
        }
    };

    // フィルタリングされたユーザーリスト（現状は全員）
    const filteredUsers = useMemo(
        () => (scheduleData ? scheduleData.users : []),
        [scheduleData]
    );

    // フィルタリングされたスケジュールデータ（useMemoで再計算を最小限に）
    // 編集モードの場合はローカル変更を反映
    const filteredScheduleData = useMemo(
        () => {
            if (!scheduleData) return [];

            const userIdSet = new Set(filteredUsers.map(u => u.id));

            return scheduleData.scheduleData.map((day) => ({
                ...day,
                userEntries: day.userEntries
                    .filter((entry) => userIdSet.has(entry.userId))
                    .map((entry) => {
                        const cellKey = `${entry.userId}_${day.date}`;
                        const localChange = localChanges.get(cellKey);
                        if (localChange) {
                            return {
                                ...entry,
                                status: localChange.status,
                                comment: localChange.comment,
                            };
                        }
                        return entry;
                    }),
            }));
        },
        [scheduleData, filteredUsers, localChanges]
    );

    // フィルタリングされた集計データ（useMemoで再計算を最小限に）
    const filteredSummary = useMemo(
        () =>
            scheduleData
                ? scheduleData.summary.filter((s) =>
                    filteredUsers.some((u) => u.id === s.userId)
                )
                : [],
        [scheduleData, filteredUsers]
    );

    // 右端・右から2番目のスタッフを「ベース用テンプレ」として扱う
    const templateUserRight =
        filteredUsers.length >= 1 ? filteredUsers[filteredUsers.length - 1] : null;
    const templateUserRight2 =
        filteredUsers.length >= 2 ? filteredUsers[filteredUsers.length - 2] : null;

    // 指定したスタッフの予定を、テンプレートスタッフの予定で上書きする
    const applyBaseFromTemplate = (targetUserId: number, templateUserId: number) => {
        if (!scheduleData) return;
        if (targetUserId === templateUserId) {
            toast.error("同じスタッフにはベースを適用できません");
            return;
        }

        const updates: {
            userId: number;
            date: string;
            status: ScheduleStatus;
            comment: string | null;
        }[] = [];

        filteredScheduleData.forEach((day) => {
            const templateEntry = day.userEntries.find((e) => e.userId === templateUserId);
            if (!templateEntry) return;
            updates.push({
                userId: targetUserId,
                date: day.date,
                status: templateEntry.status as ScheduleStatus,
                comment: templateEntry.comment || null,
            });
        });

        if (updates.length === 0) {
            toast.error("ベースにする出勤予定がありません");
            return;
        }

        const templateName =
            filteredUsers.find((u) => u.id === templateUserId)?.name || `スタッフ${templateUserId}`;
        const targetName =
            filteredUsers.find((u) => u.id === targetUserId)?.name || `スタッフ${targetUserId}`;

        if (
            !window.confirm(
                `${templateName} の出勤予定をベースにして、${targetName} の20日分の予定を上書きしますか？`
            )
        ) {
            return;
        }

        bulkUpdateMutation.mutate({ updates });
    };

    const handleAdjustmentClick = (userId: number, currentValue: number | undefined | null) => {
        if (!scheduleData) return;
        const input = window.prompt(
            "調整休の日数を入力してください（マイナスも可、例: -1, 0, 2）",
            currentValue != null ? String(currentValue) : "0"
        );
        if (input === null) return;

        const trimmed = input.trim();
        if (trimmed === "") {
            toast.error("数値を入力してください");
            return;
        }

        const value = Number(trimmed);
        if (!Number.isFinite(value) || !Number.isInteger(value)) {
            toast.error("整数で入力してください（例: -1, 0, 2）");
            return;
        }

        updateAdjustmentMutation.mutate({
            userId,
            periodStart: scheduleData.period.start,
            periodEnd: scheduleData.period.end,
            adjustment: value,
        });
    };

    if (isLoading) {
        return <div className="text-center py-8">読み込み中...</div>;
    }

    if (error) {
        return (
            <div className="text-center py-8">
                <p className="text-red-500">エラーが発生しました: {error.message}</p>
                <p className="text-sm text-[hsl(var(--muted-foreground))] mt-2">
                    データベースのテーブルが作成されていない可能性があります。マイグレーションを実行してください。
                </p>
            </div>
        );
    }

    if (!scheduleData) {
        return <div className="text-center py-8">データがありません</div>;
    }

    return (
        <div 
            className="min-h-screen p-4 sm:p-6 space-y-6"
            style={{ 
            }}
        >
            <div className="flex items-center justify-between">
                <div>
                    <h1 
                        className="text-3xl font-bold"
                        style={{ color: happyHuesColors.headline, letterSpacing: '-0.02em' }}
                    >
                        スタッフ休み予定一覧（管理）
                    </h1>
                    <p 
                        className="mt-2"
                        style={{ color: happyHuesColors.paragraph, opacity: 0.8 }}
                    >
                        期間: {format(parse(scheduleData.period.start, "yyyy-MM-dd", new Date()), "yyyy年MM月dd日")} ～{" "}
                        {format(parse(scheduleData.period.end, "yyyy-MM-dd", new Date()), "yyyy年MM月dd日")}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => moveMonth(-1)} title="前の月">
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        前の月
                    </Button>
                    <Button variant="outline" onClick={() => moveMonth(1)} title="次の月">
                        次の月
                        <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                    <Button
                        variant={isEditMode ? "default" : "outline"}
                        onClick={() => {
                            if (isEditMode && localChanges.size > 0) {
                                if (confirm("編集中の変更が失われます。編集モードを終了しますか？")) {
                                    setIsEditMode(false);
                                    setLocalChanges(new Map());
                                }
                            } else {
                                setIsEditMode(!isEditMode);
                            }
                        }}
                    >
                        {isEditMode ? "編集モード終了" : "編集モード"}
                    </Button>
                    {isEditMode && localChanges.size > 0 && (
                        <>
                            <Button
                                onClick={() => {
                                    const updates = Array.from(localChanges.entries()).map(([cellKey, change]) => {
                                        const [userIdStr, date] = cellKey.split("_");
                                        return {
                                            userId: parseInt(userIdStr),
                                            date,
                                            status: change.status,
                                            comment: change.comment,
                                        };
                                    });
                                    bulkUpdateMutation.mutate({ updates }, {
                                        onSuccess: () => {
                                            setLocalChanges(new Map());
                                            setIsEditMode(false);
                                        },
                                    });
                                }}
                                disabled={bulkUpdateMutation.isPending}
                            >
                                <Save className="h-4 w-4 mr-2" />
                                保存（{localChanges.size}件）
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    if (confirm("編集中の変更を破棄しますか？")) {
                                        setLocalChanges(new Map());
                                        setIsEditMode(false);
                                    }
                                }}
                            >
                                <X className="h-4 w-4 mr-2" />
                                キャンセル
                            </Button>
                        </>
                    )}
                    <Button
                        variant={isBulkEditMode ? "default" : "outline"}
                        onClick={() => {
                            setIsBulkEditMode(!isBulkEditMode);
                            setSelectedCells(new Set());
                        }}
                    >
                        {isBulkEditMode ? "一括編集モード" : "通常モード"}
                    </Button>
                    <Button
                        variant={isEditOrderMode ? "default" : "outline"}
                        onClick={() => {
                            setIsEditOrderMode(!isEditOrderMode);
                        }}
                    >
                        <Edit className="h-4 w-4 mr-2" />
                        スタッフ順序変更
                    </Button>
                    <Button
                        variant={isEditNameMode ? "default" : "outline"}
                        onClick={() => {
                            setIsEditNameMode(!isEditNameMode);
                            setEditingNameUserId(null);
                            setEditingName("");
                        }}
                    >
                        <User className="h-4 w-4 mr-2" />
                        {isEditNameMode ? "名前編集モード" : "名前編集"}
                    </Button>
                    <Button
                        variant={isColorEditMode ? "default" : "outline"}
                        onClick={() => {
                            setIsColorEditMode(!isColorEditMode);
                            setEditingColorStatus(null);
                        }}
                    >
                        <Palette className="h-4 w-4 mr-2" />
                        {isColorEditMode ? "色設定モード終了" : "色設定"}
                    </Button>
                    <Button
                        variant="default"
                        onClick={() => {
                            if (!scheduleData) return;
                            publishMutation.mutate({
                                periodStart: scheduleData.period.start,
                                periodEnd: scheduleData.period.end,
                            });
                        }}
                        disabled={publishMutation.isPending}
                    >
                        <Globe className="h-4 w-4 mr-2" />
                        公開
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => {
                            if (!scheduleData) return;
                            if (
                                !window.confirm(
                                    "この期間のスタッフ休み予定を非公開にしますか？\n一般ユーザー側からは見えなくなります。"
                                )
                            ) {
                                return;
                            }
                            unpublishMutation.mutate({
                                periodStart: scheduleData.period.start,
                                periodEnd: scheduleData.period.end,
                            });
                        }}
                        disabled={unpublishMutation.isPending}
                    >
                        非公開
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => setIsResetDialogOpen(true)}
                    >
                        初期に戻す
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => {
                            window.print();
                        }}
                    >
                        <Printer className="h-4 w-4 mr-2" />
                        印刷
                    </Button>
                </div>
            </div>

            {/* 印刷用コンテナ */}
            <div className="print-container">
                {/* 一括編集パネル */}
                {isBulkEditMode && (
                    <Card className="no-print">
                        <CardHeader>
                            <CardTitle>一括編集</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="text-sm font-medium">選択されたセル: {selectedCells.size}個</label>
                            </div>
                            <div>
                                <label className="text-sm font-medium">状態</label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                                    value={bulkStatus}
                                    onChange={(e) => setBulkStatus(e.target.value as ScheduleStatus)}
                                >
                                    <option value="work">出勤</option>
                                    <option value="rest">休み</option>
                                    <option value="request">希望休</option>
                                    <option value="exhibition">展示会</option>
                                    <option value="other">その他業務</option>
                                    <option value="morning">午前出</option>
                                    <option value="afternoon">午後出</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-medium">コメント（任意）</label>
                                <Input
                                    value={bulkComment}
                                    onChange={(e) => setBulkComment(e.target.value)}
                                    placeholder="支払日、買い付け、外出など"
                                />
                            </div>
                            <div className="flex gap-2">
                                <Button onClick={handleBulkSave} disabled={bulkUpdateMutation.isPending}>
                                    <Save className="h-4 w-4 mr-2" />
                                    一括保存
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setSelectedCells(new Set());
                                        setIsBulkEditMode(false);
                                    }}
                                >
                                    <X className="h-4 w-4 mr-2" />
                                    キャンセル
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* 凡例 */}
                <Card className="no-print">
                    <CardContent className="pt-6">
                        <div className="flex flex-wrap gap-4 text-sm">
                            <div className="flex items-center gap-2">
                                <div className={`w-6 h-6 rounded ${STATUS_COLORS.work}`}></div>
                                <span>出勤</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className={`w-6 h-6 rounded ${STATUS_COLORS.rest}`}></div>
                                <span>休み</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className={`w-6 h-6 rounded ${STATUS_COLORS.request}`}></div>
                                <span>希望休</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className={`w-6 h-6 rounded ${STATUS_COLORS.exhibition}`}></div>
                                <span>展示会</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className={`w-6 h-6 rounded ${STATUS_COLORS.other}`}></div>
                                <span>その他業務</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className={`w-6 h-6 rounded ${STATUS_COLORS.morning}`}></div>
                                <span>午前出</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className={`w-6 h-6 rounded ${STATUS_COLORS.afternoon}`}></div>
                                <span>午後出</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className={`w-6 h-6 rounded ${STATUS_COLORS.business_trip}`}></div>
                                <span>出張</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className={`w-6 h-6 rounded ${STATUS_COLORS.exhibition_duty}`}></div>
                                <span>展示場当番</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className={`w-6 h-6 rounded ${STATUS_COLORS.paid_leave}`}></div>
                                <span>有給</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className={`w-6 h-6 rounded ${STATUS_COLORS.delivery}`}></div>
                                <span>納車</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className={`w-6 h-6 rounded ${STATUS_COLORS.payment_date}`}></div>
                                <span>支払日</span>
                            </div>
                        </div>
                        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2">
                            ※ セルをクリックで状態変更、ダブルクリックでコメント編集
                        </p>
                    </CardContent>
                </Card>

                {/* 色設定パネル */}
                {isColorEditMode && (
                    <Card className="no-print">
                        <CardHeader>
                            <CardTitle>ステータス色設定</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {(Object.keys(STATUS_LABELS) as ScheduleStatus[]).map((status) => (
                                    <div key={status} className="flex items-center gap-3 p-3 border rounded-lg">
                                        <div className={`w-10 h-10 rounded ${STATUS_COLORS[status]}`}></div>
                                        <div className="flex-1">
                                            <label className="text-sm font-medium">{STATUS_LABELS[status]}</label>
                                            <Select
                                                value={STATUS_COLORS[status]}
                                                onValueChange={(value) => {
                                                    updateStatusColorMutation.mutate({
                                                        status,
                                                        colorClass: value,
                                                    });
                                                }}
                                            >
                                                <SelectTrigger className="w-full mt-1">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {AVAILABLE_COLORS.map((color) => (
                                                        <SelectItem key={color.value} value={color.value}>
                                                            <div className="flex items-center gap-2">
                                                                <div className={`w-4 h-4 rounded ${color.preview}`}></div>
                                                                <span>{color.label}</span>
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-end">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setIsColorEditMode(false);
                                        setEditingColorStatus(null);
                                    }}
                                >
                                    閉じる
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* スケジュール表 */}
                <div className="overflow-x-auto w-full">
                    <table className="w-full border-collapse border border-[hsl(var(--border))] text-xs table-fixed" style={{ tableLayout: "fixed" }}>
                        <thead>
                            <tr>
                                <th className="border border-[hsl(var(--border))] p-1 bg-[hsl(var(--muted))] w-[50px]">
                                    日付
                                </th>
                                {filteredUsers.map((u, index) => (
                                    <th
                                        key={u.id}
                                        className="border border-[hsl(var(--border))] p-1 bg-[hsl(var(--muted))] w-[50px] relative text-left"
                                    >
                                        <div className="flex items-center justify-start gap-0.5">
                                            {isEditNameMode && editingNameUserId === u.id ? (
                                                <Input
                                                    value={editingName}
                                                    onChange={(e) => setEditingName(e.target.value)}
                                                    onBlur={() => {
                                                        if (editingName.trim()) {
                                                            updateDisplayNameMutation.mutate({
                                                                userId: u.id,
                                                                displayName: editingName.trim(),
                                                            });
                                                        }
                                                        setEditingNameUserId(null);
                                                        setEditingName("");
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter") {
                                                            if (editingName.trim()) {
                                                                updateDisplayNameMutation.mutate({
                                                                    userId: u.id,
                                                                    displayName: editingName.trim(),
                                                                });
                                                            }
                                                            setEditingNameUserId(null);
                                                            setEditingName("");
                                                        } else if (e.key === "Escape") {
                                                            setEditingNameUserId(null);
                                                            setEditingName("");
                                                        }
                                                    }}
                                                    className="h-6 text-[18px] p-1"
                                                    autoFocus
                                                />
                                            ) : (
                                                <div className="flex flex-col gap-0.5">
                                                    <span
                                                        className="text-[18px] truncate leading-tight cursor-pointer hover:underline"
                                                        onClick={() => {
                                                            if (isEditNameMode) {
                                                                // 名前編集モード中は従来通り名前編集
                                                                setEditingNameUserId(u.id);
                                                                setEditingName(u.name || "");
                                                            } else {
                                                                // 通常モード：ベース適用用のタブを開閉
                                                                setBaseMenuUserId((prev) => (prev === u.id ? null : u.id));
                                                            }
                                                        }}
                                                    >
                                                        {u.name || "不明"}
                                                    </span>
                                                    {/* ベース適用タブ（右端2列をベースにする） */}
                                                    {baseMenuUserId === u.id && !isEditNameMode && !isEditOrderMode && (
                                                        <div className="mt-0.5 flex flex-col gap-0.5 text-[10px]">
                                                            {templateUserRight2 && (
                                                                <Button
                                                                    type="button"
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="h-5 px-1 text-[10px]"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        applyBaseFromTemplate(u.id, templateUserRight2.id);
                                                                    }}
                                                                >
                                                                    右から2番目をベース（{templateUserRight2.name}）
                                                                </Button>
                                                            )}
                                                            {templateUserRight && (
                                                                <Button
                                                                    type="button"
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="h-5 px-1 text-[10px]"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        applyBaseFromTemplate(u.id, templateUserRight.id);
                                                                    }}
                                                                >
                                                                    一番右をベース（{templateUserRight.name}）
                                                                </Button>
                                                            )}
                                                            {(!templateUserRight || !templateUserRight2) && (
                                                                <div className="text-[9px] text-[hsl(var(--muted-foreground))]">
                                                                    右端2列をベース用に設定してください
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            {isEditOrderMode && (
                                                <div className="flex flex-col gap-0.5">
                                                    <button
                                                        className="text-[10px] px-0.5 py-0 bg-blue-500 text-white rounded hover:bg-blue-600"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (index > 0) {
                                                                const prevUser = filteredUsers[index - 1];
                                                                updateDisplayOrderMutation.mutate({
                                                                    userId: u.id,
                                                                    displayOrder: prevUser.displayOrder,
                                                                });
                                                                updateDisplayOrderMutation.mutate({
                                                                    userId: prevUser.id,
                                                                    displayOrder: u.displayOrder,
                                                                });
                                                            }
                                                        }}
                                                    >
                                                        ↑
                                                    </button>
                                                    <button
                                                        className="text-[10px] px-0.5 py-0 bg-blue-500 text-white rounded hover:bg-blue-600"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (index < filteredUsers.length - 1) {
                                                                const nextUser = filteredUsers[index + 1];
                                                                updateDisplayOrderMutation.mutate({
                                                                    userId: u.id,
                                                                    displayOrder: nextUser.displayOrder,
                                                                });
                                                                updateDisplayOrderMutation.mutate({
                                                                    userId: nextUser.id,
                                                                    displayOrder: u.displayOrder,
                                                                });
                                                            }
                                                        }}
                                                    >
                                                        ↓
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredScheduleData.map((day) => (
                                <tr key={day.date}>
                                    <td
                                        className={`border border-[hsl(var(--border))] p-0.5 ${day.isWeekend ? "bg-pink-100" : "bg-white"
                                            }`}
                                    >
                                        <div className="mb-0.5 leading-tight text-[16px] font-medium">{format(day.dateObj, "MM/dd", { locale: ja })}</div>
                                        <div className="text-[12px] text-[hsl(var(--muted-foreground))] mb-0.5 leading-tight">
                                            {format(day.dateObj, "E", { locale: ja })}
                                        </div>
                                        <Select
                                            onValueChange={(value) => {
                                                handleDateStatusChange(day.date, value as ScheduleStatus);
                                            }}
                                            disabled={bulkUpdateMutation.isPending}
                                        >
                                            <SelectTrigger className="h-5 text-[8px] p-0.5 border border-[hsl(var(--border))] bg-white hover:bg-[hsl(var(--muted))] focus:ring-0 shadow-none w-full">
                                                <SelectValue placeholder="変更">
                                                    <span className="text-[8px]">変更</span>
                                                </SelectValue>
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="work">出勤</SelectItem>
                                                <SelectItem value="rest">休</SelectItem>
                                                <SelectItem value="request">希望</SelectItem>
                                                <SelectItem value="exhibition">展</SelectItem>
                                                <SelectItem value="other">その他</SelectItem>
                                                <SelectItem value="morning">午前出</SelectItem>
                                                <SelectItem value="afternoon">午後出</SelectItem>
                                                <SelectItem value="business_trip">出張</SelectItem>
                                                <SelectItem value="exhibition_duty">展示場当番</SelectItem>
                                                <SelectItem value="paid_leave">有給</SelectItem>
                                                <SelectItem value="delivery">納車</SelectItem>
                                                <SelectItem value="payment_date">支払日</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </td>
                                    {day.userEntries.map((entry) => {
                                        const cellKey = `${entry.userId}_${day.date}`;
                                        const isSelected = selectedCells.has(cellKey);
                                        const hasLocalChange = localChanges.has(cellKey);
                                        return (
                                            <td
                                                key={entry.userId}
                                                className={`border border-[hsl(var(--border))] p-1 text-center relative w-[50px] ${STATUS_COLORS[entry.status as ScheduleStatus]
                                                    } ${isSelected ? "ring-2 ring-blue-500" : ""} ${hasLocalChange ? "ring-2 ring-green-500" : ""} ${isBulkEditMode ? "cursor-pointer" : ""}`}
                                                onClick={isBulkEditMode ? (e) => {
                                                    e.stopPropagation();
                                                    handleCellClick(entry.userId, day.date);
                                                } : undefined}
                                                onDoubleClick={(e) => {
                                                    e.stopPropagation();
                                                    e.preventDefault();
                                                    handleCellDoubleClick(entry.userId, day.date);
                                                }}
                                                title={hasLocalChange ? "変更あり（保存が必要）" : entry.status === "business_trip" ? "ダブルクリックで県名を編集" : undefined}
                                            >
                                                {entry.status === "business_trip" && entry.comment ? (
                                                    // 出張で県名がある場合は表示し、「出張」ラベルは非表示
                                                    <div
                                                        className="text-[14px] font-medium text-center cursor-pointer hover:opacity-80"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleCellDoubleClick(entry.userId, day.date);
                                                        }}
                                                        title="クリックで県名を編集"
                                                    >
                                                        {entry.comment}
                                                    </div>
                                                ) : (
                                                    <>
                                                        {!isBulkEditMode ? (
                                                            <div
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                <Select
                                                                    value={entry.status}
                                                                    onValueChange={(value) => {
                                                                        handleStatusChange(entry.userId, day.date, value as ScheduleStatus);
                                                                    }}
                                                                    disabled={updateMutation.isPending && !isEditMode}
                                                                >
                                                                    <SelectTrigger
                                                                        className="h-6 text-[14px] p-0.5 border-0 bg-transparent hover:bg-transparent focus:ring-0 shadow-none w-full"
                                                                    >
                                                                        <SelectValue>
                                                                            <span className="text-[14px] font-medium">
                                                                                {STATUS_LABELS[entry.status as ScheduleStatus]}
                                                                            </span>
                                                                        </SelectValue>
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="work">出勤</SelectItem>
                                                                        <SelectItem value="rest">休</SelectItem>
                                                                        <SelectItem value="request">希望</SelectItem>
                                                                        <SelectItem value="exhibition">展</SelectItem>
                                                                        <SelectItem value="other">その他</SelectItem>
                                                                        <SelectItem value="morning">午前出</SelectItem>
                                                                        <SelectItem value="afternoon">午後出</SelectItem>
                                                                        <SelectItem value="business_trip">出張</SelectItem>
                                                                        <SelectItem value="exhibition_duty">展示場当番</SelectItem>
                                                                        <SelectItem value="paid_leave">有給</SelectItem>
                                                                        <SelectItem value="delivery">納車</SelectItem>
                                                                        <SelectItem value="payment_date">支払日</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                        ) : (
                                                            <div className="text-[14px] font-medium">
                                                                {STATUS_LABELS[entry.status as ScheduleStatus]}
                                                            </div>
                                                        )}
                                                        {entry.comment && (
                                                            <div
                                                                className="text-[8px] text-[hsl(var(--muted-foreground))] mt-0.5 truncate cursor-pointer hover:underline"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleCellDoubleClick(entry.userId, day.date);
                                                                }}
                                                                title="クリックでコメント編集"
                                                            >
                                                                {entry.comment}
                                                            </div>
                                                        )}
                                                        {!entry.comment && (entry.status === "business_trip" || entry.status === "payment_date") && (
                                                            <div
                                                                className="text-[8px] text-gray-400 mt-0.5 truncate cursor-pointer hover:text-gray-600"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleCellDoubleClick(entry.userId, day.date);
                                                                }}
                                                                title="クリックでコメント追加"
                                                            >
                                                                {entry.status === "business_trip" ? "県名を入力" : "コメント追加"}
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                        {/* 集計行 */}
                        <tfoot>
                            <tr className="bg-yellow-50">
                                <td className="border border-[hsl(var(--border))] p-1 text-[16px] font-bold">
                                    休みの数
                                </td>
                                {filteredSummary.map((s) => (
                                    <td key={s.userId} className="border border-[hsl(var(--border))] p-1 text-[16px] text-center font-bold">
                                        {s.restDays || 0}
                                    </td>
                                ))}
                            </tr>
                            <tr className="bg-gray-50">
                                <td className="border border-[hsl(var(--border))] p-1 text-[16px] font-bold">
                                    調整休
                                </td>
                                {filteredSummary.map((s) => (
                                    <td
                                        key={s.userId}
                                        className="border border-[hsl(var(--border))] p-1 text-[16px] text-center font-bold cursor-pointer hover:bg-yellow-100"
                                        onClick={() => handleAdjustmentClick(s.userId, (s as any).adjustment)}
                                        title="クリックして調整休を編集"
                                    >
                                        {(s as any).adjustment ?? 0}
                                    </td>
                                ))}
                            </tr>
                            <tr className="bg-gray-50">
                                <td className="border border-[hsl(var(--border))] p-1 text-[16px] font-bold">
                                    合計
                                </td>
                                {filteredSummary.map((s) => (
                                    <td key={s.userId} className="border border-[hsl(var(--border))] p-1 text-[16px] text-center font-bold">
                                        {s.totalRest}
                                    </td>
                                ))}
                            </tr>
                            <tr className="bg-purple-50">
                                <td className="border border-[hsl(var(--border))] p-1 text-[16px] font-bold">
                                    出張
                                </td>
                                {filteredSummary.map((s) => (
                                    <td key={s.userId} className="border border-[hsl(var(--border))] p-1 text-[16px] text-center font-bold">
                                        {(s as any).businessTripDays || 0}
                                    </td>
                                ))}
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
            {/* 印刷用コンテナ終了 */}

            {/* 初期化確認ダイアログ */}
            {isResetDialogOpen && scheduleData && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
                    <Card className="w-full max-w-md">
                        <CardHeader>
                            <CardTitle className="text-lg">スケジュールを初期に戻しますか？</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                この期間（{format(parse(scheduleData.period.start, "yyyy-MM-dd", new Date()), "yyyy年MM月dd日")} ～{" "}
                                {format(parse(scheduleData.period.end, "yyyy-MM-dd", new Date()), "yyyy年MM月dd日")}）の
                                すべてのスタッフの予定を、
                                <span className="font-semibold">平日は出勤、土日は休み</span>
                                の初期状態に戻します。調整休もリセットされます。
                            </p>
                            <p className="text-sm text-red-600">
                                一度実行すると元には戻せません。本当に初期化してよろしいですか？
                            </p>
                            <div className="flex justify-end gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => setIsResetDialogOpen(false)}
                                    disabled={resetScheduleMutation.isPending}
                                >
                                    キャンセル
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={() => {
                                        resetScheduleMutation.mutate({
                                            periodStart: scheduleData.period.start,
                                            periodEnd: scheduleData.period.end,
                                        });
                                    }}
                                    disabled={resetScheduleMutation.isPending}
                                >
                                    初期化する
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* 編集履歴（印刷時は非表示） */}
            {editLogs && editLogs.length > 0 && (
                <Card className="no-print">
                    <CardHeader>
                        <CardTitle>編集履歴</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                            {editLogs.map((log) => (
                                <div key={log.id} className="text-sm border-b pb-2">
                                    <div>
                                        {format(new Date(log.createdAt), "yyyy-MM-dd HH:mm")} - {log.editorName}が
                                        {log.userName}の{log.fieldName}を変更
                                    </div>
                                    <div className="text-xs text-[hsl(var(--muted-foreground))]">
                                        {log.oldValue || "(なし)"} → {log.newValue || "(なし)"}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

