import { useMemo, useState, useEffect } from "react";
import { trpc } from "../lib/trpc";
import { useAuth } from "../hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight, CalendarDays, Edit, Plus, Trash2, CheckCircle2, FileText, MessageCircle, Send, AlertTriangle } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { VehicleChat } from "../components/VehicleChat";
import { happyHuesColors, happyHuesStyles } from "../styles/happyHues";

const OPTION_PRESETS = [
    "家庭用クーラー",
    "ワンクール",
    "クールスター",
    "インバーター1500",
    "リチウムイオン200",
    "リチウムイオン300",
    "リチウムイオン400",
    "FFヒーター",
    "ベンチレーター",
    "ソーラー",
    "ルーフクーラー",
];

export default function DeliverySchedules() {
    const { user } = useAuth();
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [isCalendarMode, setIsCalendarMode] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editing, setEditing] = useState<any | null>(null);
    const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
    const [otherOption, setOtherOption] = useState("");
    const [specFile, setSpecFile] = useState<File | null>(null);
    const [chatMessage, setChatMessage] = useState("");
    const [replyingTo, setReplyingTo] = useState<number | null>(null);

    const { data, refetch, isLoading, error, isError } = trpc.deliverySchedules.list.useQuery({ year, month });

    useEffect(() => {
        console.log("[DeliverySchedules] 🔄 Component mounted/updated");
        console.log("[DeliverySchedules] 🔄 Year:", year, "Month:", month);
        console.log("[DeliverySchedules] 🔄 isLoading:", isLoading);
        console.log("[DeliverySchedules] 🔄 isError:", isError);
        if (data) {
            console.log("[DeliverySchedules] ✅ Data received:", data);
            console.log("[DeliverySchedules] ✅ Data length:", data?.length || 0);
            if (data && data.length > 0) {
                console.log("[DeliverySchedules] ✅ First record:", data[0]);
            }
        }
        if (error) {
            console.error("[DeliverySchedules] ❌ Error:", error);
            console.error("[DeliverySchedules] ❌ Error message:", error.message);
        }
    }, [year, month, isLoading, isError, data, error]);
    const { data: chats, refetch: refetchChats } = trpc.deliverySchedules.getChats.useQuery({
        deliveryScheduleId: undefined, // 全体チャット
    });

    const createMutation = trpc.deliverySchedules.create.useMutation({
        onSuccess: () => {
            toast.success("納車スケジュールを追加しました");
            setIsEditDialogOpen(false);
            setEditing(null);
            refetch();
        },
        onError: (e) => toast.error(e.message || "追加に失敗しました"),
    });

    const updateMutation = trpc.deliverySchedules.update.useMutation({
        onSuccess: () => {
            toast.success("納車スケジュールを更新しました");
            setIsEditDialogOpen(false);
            setEditing(null);
            refetch();
        },
        onError: (e) => toast.error(e.message || "更新に失敗しました"),
    });

    const deleteMutation = trpc.deliverySchedules.delete.useMutation({
        onSuccess: () => {
            toast.success("納車スケジュールを削除しました");
            refetch();
        },
        onError: (e) => toast.error(e.message || "削除に失敗しました"),
    });

    const confirmPickupMutation = trpc.deliverySchedules.confirmPickup.useMutation({
        onSuccess: () => {
            toast.success("ワングラム様に引き取りに行く日を更新しました");
            refetch();
        },
        onError: (e) => toast.error(e.message || "更新に失敗しました"),
    });

    const confirmIncomingMutation = trpc.deliverySchedules.confirmIncoming.useMutation({
        onSuccess: () => {
            toast.success("ワングラム完成予定日を更新しました");
            refetch();
        },
        onError: (e) => toast.error(e.message || "更新に失敗しました"),
    });

    const uploadSpecSheetMutation = trpc.deliverySchedules.uploadSpecSheet.useMutation({
        onSuccess: () => {
            toast.success("仕様書をアップしました");
            setSpecFile(null);
            refetch();
        },
        onError: (e) => toast.error(e.message || "仕様書のアップに失敗しました"),
    });

    const createChatMutation = trpc.deliverySchedules.createChat.useMutation({
        onSuccess: () => {
            setChatMessage("");
            setReplyingTo(null);
            refetchChats();
        },
        onError: (e) => toast.error(e.message || "コメントの投稿に失敗しました"),
    });

    const deleteChatMutation = trpc.deliverySchedules.deleteChat.useMutation({
        onSuccess: () => {
            toast.success("コメントを削除しました");
            refetchChats();
        },
        onError: (e) => toast.error(e.message || "コメントの削除に失敗しました"),
    });

    const canEdit = user && (user.role === "admin" || user.role === "sub_admin");
    const isExternal = user?.role === "external";
    // ワングラムアカウントでもチャット機能は使える
    const canUseChat = user && (canEdit || isExternal);

    const handlePrevMonth = () => {
        if (month === 1) {
            setYear((y) => y - 1);
            setMonth(12);
        } else {
            setMonth((m) => m - 1);
        }
    };

    const handleNextMonth = () => {
        if (month === 12) {
            setYear((y) => y + 1);
            setMonth(1);
        } else {
            setMonth((m) => m + 1);
        }
    };

    const handleCurrentMonth = () => {
        const now = new Date();
        setYear(now.getFullYear());
        setMonth(now.getMonth() + 1);
    };

    const isCurrentMonth = useMemo(() => {
        const now = new Date();
        return year === now.getFullYear() && month === now.getMonth() + 1;
    }, [year, month]);

    // 納車遅れリスト（ワングラム入庫予定を過ぎているかつ未完成の車両）
    const delayedItems = useMemo(() => {
        if (!data) return [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return data.filter((item: any) => {
            if (item.status === "completed") return false;
            if (!item.dueDate) return false;
            const due = new Date(item.dueDate);
            due.setHours(0, 0, 0, 0);
            return due < today;
        }).sort((a: any, b: any) => {
            const aDue = a.dueDate ? new Date(a.dueDate).getTime() : 0;
            const bDue = b.dueDate ? new Date(b.dueDate).getTime() : 0;
            return aDue - bDue;
        });
    }, [data]);


    // 納車予定日で月別にグループ化（一覧ビューモード用）
    const groupedByDay = useMemo(() => {
        const map = new Map<string, any[]>();
        (data || []).forEach((item: any) => {
            // 制作分（productionMonth）を基準にグループ化
            // 制作分から月を抽出（例：「11月ワングラム制作分」→ 11）
            let productionMonthNum: number | null = null;
            if (item.productionMonth) {
                const match = item.productionMonth.match(/^(\d+)月/);
                if (match) {
                    productionMonthNum = parseInt(match[1], 10);
                }
            }

            // 表示されている年月より後の制作分は表示しない（今月制作が前月に表示されないようにする）
            // 制作分は現在の年を基準にしていると仮定（年越しの場合は要調整）
            if (productionMonthNum !== null) {
                // 制作分の月が表示月より後の場合はスキップ
                // ただし、年をまたぐ場合（例：12月制作分を1月に表示）は考慮しない
                if (productionMonthNum > month) {
                    return; // このアイテムをスキップ
                }
            }

            // 制作分がある場合は制作分でグループ化、ない場合は納車予定日でグループ化
            if (item.productionMonth) {
                const key = item.productionMonth;
                const list = map.get(key) || [];
                list.push(item);
                map.set(key, list);
            } else {
                // 制作分がない場合は納車予定日でグループ化
                const d = item.deliveryPlannedDate ? new Date(item.deliveryPlannedDate) : null;
                const key = d ? format(d, "yyyy-MM-dd") : "未設定";
                const list = map.get(key) || [];
                list.push(item);
                map.set(key, list);
            }
        });
        return Array.from(map.entries()).sort(([a], [b]) => {
            // 制作分の場合は月の順序でソート（例：「11月ワングラム制作分」→ 11）
            const getMonthFromKey = (key: string): number => {
                if (key.includes("月ワングラム制作分")) {
                    const match = key.match(/^(\d+)月/);
                    if (match) {
                        return parseInt(match[1], 10);
                    }
                }
                // 日付形式の場合（yyyy-MM-dd）
                if (key.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    return new Date(key).getMonth() + 1;
                }
                return 999; // 「未設定」などは最後に
            };
            const monthA = getMonthFromKey(a);
            const monthB = getMonthFromKey(b);
            if (monthA !== monthB) {
                return monthA - monthB;
            }
            return a === "未設定" ? 1 : b === "未設定" ? -1 : a.localeCompare(b);
        });
    }, [data, month]);

    // 納期遅れリスト（希望納期が過去のもの）
    const overdueItems = useMemo(() => {
        if (!data) return [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return data.filter((item: any) => {
            if (item.status === "completed") return false;
            if (!item.desiredIncomingPlannedDate) return false;
            const desired = new Date(item.desiredIncomingPlannedDate);
            desired.setHours(0, 0, 0, 0);
            return desired < today;
        }).sort((a: any, b: any) => {
            const aDesired = a.desiredIncomingPlannedDate ? new Date(a.desiredIncomingPlannedDate).getTime() : 0;
            const bDesired = b.desiredIncomingPlannedDate ? new Date(b.desiredIncomingPlannedDate).getTime() : 0;
            return aDesired - bDesired;
        });
    }, [data]);

    // 制作月遅延リスト（制作月が過ぎていて、引き取り待ちより前のステータスの車）
    const delayedProductionItems = useMemo(() => {
        if (!data) return [];
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1; // 1-12

        return data.filter((item: any) => {
            // 完成済みは除外
            if (item.status === "completed") return false;

            // 引き取り待ちより前のステータスのみ（katomo_stock, wg_storage, wg_production）
            const beforePickupStatuses = ["katomo_stock", "wg_storage", "wg_production"];
            if (!beforePickupStatuses.includes(item.status)) return false;

            // 制作月を抽出
            if (!item.productionMonth) return false;
            const match = item.productionMonth.match(/^(\d+)月/);
            if (!match) return false;

            const productionMonthNum = parseInt(match[1], 10); // 1-12

            // 制作月が現在の年月より前の場合、遅延とみなす
            // 年をまたぐ場合は考慮（例：12月制作分を1月に確認）
            let isDelayed = false;
            if (productionMonthNum < currentMonth) {
                // 同じ年の前の月
                isDelayed = true;
            } else if (productionMonthNum === 12 && currentMonth === 1) {
                // 年越しの場合（前年12月 → 今年1月）
                isDelayed = true;
            }

            return isDelayed;
        }).sort((a: any, b: any) => {
            // 制作月の順序でソート（古い順）
            const aMatch = a.productionMonth.match(/^(\d+)月/);
            const bMatch = b.productionMonth.match(/^(\d+)月/);
            const aMonth = aMatch ? parseInt(aMatch[1], 10) : 999;
            const bMonth = bMatch ? parseInt(bMatch[1], 10) : 999;
            if (aMonth !== bMonth) return aMonth - bMonth;

            // 同じ制作月なら、ステータスの順序でソート
            const statusOrder = ["katomo_stock", "wg_storage", "wg_production"];
            const aStatusIndex = statusOrder.indexOf(a.status);
            const bStatusIndex = statusOrder.indexOf(b.status);
            return aStatusIndex - bStatusIndex;
        });
    }, [data]);

    const activeItems = (data || []).filter((item: any) => item.status !== "completed");
    const completedItems = (data || []).filter((item: any) => item.status === "completed");
    const revisionRequestedItems = completedItems.filter((item: any) => item.completionStatus === "revision_requested");
    const otherCompletedItems = completedItems.filter((item: any) => item.completionStatus !== "revision_requested");

    const statusLabel = (status?: string | null) => {
        switch (status) {
            case "katomo_stock":
                return "katomo在庫中";
            case "wg_storage":
                return "ワングラム保管中";
            case "wg_production":
                return "ワングラム製作中";
            case "wg_wait_pickup":
                return "ワングラム完成引き取り待ち";
            case "katomo_picked_up":
                return "katomo引き取り済み";
            case "katomo_checked":
                return "katomoチェック済み";
            case "completed":
                return "完成";
            default:
                return "未設定";
        }
    };

    const statusOrder: string[] = [
        "katomo_stock",
        "wg_storage",
        "wg_production",
        "wg_wait_pickup",
        "katomo_picked_up",
        "katomo_checked",
        "completed",
    ];

    const statusButtons = [
        { key: "katomo_stock", label: "katomo在庫中" },
        { key: "wg_storage", label: "ワングラム保管中" },
        { key: "wg_production", label: "ワングラム製作中" },
        { key: "wg_wait_pickup", label: "ワングラム完成引き取り待ち" },
        { key: "katomo_picked_up", label: "katomo引き取り済み" },
        { key: "katomo_checked", label: "katomoチェック済み" },
    ] as const;

    const openNewDialog = () => {
        if (!canEdit) return;
        setEditing({
            vehicleName: "",
            vehicleType: "",
            customerName: "",
            optionName: "",
            optionCategory: "",
            prefecture: "",
            baseCarReady: "",
            furnitureReady: "",
            inCharge: "",
            dueDate: "",
            desiredIncomingPlannedDate: "",
            incomingPlannedDate: "",
            shippingPlannedDate: "",
            deliveryPlannedDate: "",
            comment: "",
            claimComment: "",
            oemComment: "",
            productionMonth: "",
            status: "katomo_stock",
        });
        setSelectedOptions([]);
        setOtherOption("");
        setSpecFile(null);
        setIsEditDialogOpen(true);
    };

    const handleSave = () => {
        if (!editing) return;
        if (!editing.vehicleName) {
            toast.error("車両の名前を入力してください");
            return;
        }

        const allOptions = [...selectedOptions];
        if (otherOption.trim()) {
            allOptions.push(otherOption.trim());
        }

        // 日付をYYYY-MM-DD形式の文字列に正規化
        const normalizeDate = (value: string | Date | null | undefined): string | undefined => {
            if (!value) return undefined;
            if (value === "") return undefined;
            if (value instanceof Date) {
                return format(value, "yyyy-MM-dd");
            }
            if (typeof value === "string") {
                // 既にYYYY-MM-DD形式の場合はそのまま返す
                if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
                    return value;
                }
                // Date文字列の場合はパースしてフォーマット
                const d = new Date(value);
                if (!isNaN(d.getTime())) {
                    return format(d, "yyyy-MM-dd");
                }
            }
            return undefined;
        };

        const payload: any = {
            vehicleName: editing.vehicleName,
            vehicleType: editing.vehicleType || undefined,
            customerName: editing.customerName || undefined,
            optionName: allOptions.length > 0 ? allOptions.join(" / ") : undefined,
            optionCategory: undefined,
            prefecture: editing.prefecture || undefined,
            baseCarReady: editing.baseCarReady || undefined,
            furnitureReady: editing.furnitureReady || undefined,
            inCharge: editing.inCharge || undefined,
            productionMonth: editing.productionMonth || undefined,
            dueDate: normalizeDate(editing.dueDate),
            desiredIncomingPlannedDate: normalizeDate(editing.desiredIncomingPlannedDate),
            // incomingPlannedDate と shippingPlannedDate は編集ダイアログからは編集不可（カード表示の直接入力のみ）
            // これらのフィールドは編集ダイアログから削除されているため、payloadには含めない
            deliveryPlannedDate: normalizeDate(editing.deliveryPlannedDate),
            comment: editing.comment || undefined,
            claimComment: editing.claimComment || undefined,
            photosJson: undefined,
            oemComment: editing.oemComment || undefined,
        };

        const afterMutation = (id: number | null) => {
            if (specFile && id) {
                const reader = new FileReader();
                reader.onload = () => {
                    const base64 = reader.result as string;
                    const fileType = specFile.type;
                    if (
                        fileType === "image/jpeg" ||
                        fileType === "image/jpg" ||
                        fileType === "application/pdf"
                    ) {
                        uploadSpecSheetMutation.mutate({
                            id,
                            fileData: base64,
                            fileName: specFile.name,
                            fileType: fileType as "image/jpeg" | "image/jpg" | "application/pdf",
                        });
                    } else {
                        toast.error("PDFまたはJPGファイルを選択してください");
                    }
                };
                reader.readAsDataURL(specFile);
            }
        };

        if (editing.id) {
            updateMutation.mutate(
                { id: editing.id, ...payload },
                {
                    onSuccess: () => {
                        toast.success("納車スケジュールを更新しました");
                        setIsEditDialogOpen(false);
                        setEditing(null);
                        afterMutation(editing.id);
                        refetch();
                    },
                } as any
            );
        } else {
            createMutation.mutate(payload as any, {
                onSuccess: () => {
                    toast.success("納車スケジュールを追加しました");
                    setIsEditDialogOpen(false);
                    setEditing(null);
                    setSpecFile(null);
                    refetch();
                },
            } as any);
        }
    };

    return (
        <div 
            className="min-h-screen p-4 sm:p-6 space-y-4 sm:space-y-6"
            style={{ 
            }}
        >
            <div className="flex flex-col gap-4">
                <div>
                    <h1 
                        className="text-2xl sm:text-3xl font-bold"
                        style={{ color: happyHuesColors.headline, letterSpacing: '-0.02em' }}
                    >
                        ワングラム製造スケジュール
                    </h1>
                    <p 
                        className="mt-1 sm:mt-2 text-sm sm:text-base"
                        style={{ color: happyHuesColors.paragraph, opacity: 0.8 }}
                    >
                        ワングラムデザインさんと共有する製造・納車スケジュールです（スマホ表示対応）。
                        オプション・注意事項・仕様書もまとめて管理できます。
                    </p>
                </div>

                {/* 日付ナビゲーション */}
                <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
                    <CardContent className="p-4">
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                {/* 左側: 年月表示と今月ボタン */}
                                <div className="flex items-center gap-1">
                                    <div className="flex flex-col items-start">
                                        <span className={`text-lg sm:text-xl font-bold ${isCurrentMonth ? "text-blue-600" : "text-gray-800"}`}>
                                            {year}年{month}月
                                        </span>
                                        {isCurrentMonth && (
                                            <span className="text-xs text-blue-500 font-medium">（今月）</span>
                                        )}
                                    </div>
                                    <Button
                                        variant={isCurrentMonth ? "default" : "secondary"}
                                        size="sm"
                                        onClick={handleCurrentMonth}
                                        className="h-10 px-4 font-semibold shadow-sm hover:shadow-md transition-shadow ml-1"
                                    >
                                        今月
                                    </Button>
                                </div>

                                {/* 右側: 矢印ボタン */}
                                <div className="flex items-center gap-3">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={handlePrevMonth}
                                        className="h-10 w-10 shadow-sm hover:shadow-md transition-shadow"
                                    >
                                        <ChevronLeft className="h-5 w-5" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={handleNextMonth}
                                        className="h-10 w-10 shadow-sm hover:shadow-md transition-shadow"
                                    >
                                        <ChevronRight className="h-5 w-5" />
                                    </Button>
                                </div>
                            </div>

                            {/* 遅延情報 */}
                            {delayedProductionItems.length > 0 && (
                                <div className="flex items-center justify-between gap-3 pt-2 border-t border-blue-300">
                                    <div className="flex items-center gap-2">
                                        <AlertTriangle className="h-5 w-5 text-orange-600" />
                                        <span className="text-sm sm:text-base font-semibold text-orange-700">
                                            {delayedProductionItems.length}台遅延中
                                        </span>
                                    </div>
                                    <Link href="/delivery-schedules/delayed">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-9 px-4 text-sm font-semibold border-orange-300 text-orange-700 hover:bg-orange-50"
                                        >
                                            遅延一覧
                                        </Button>
                                    </Link>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* 追加ボタン（タブの上） */}
            {canEdit && (
                <div className="flex justify-end mb-2">
                    <Button
                        size="sm"
                        onClick={openNewDialog}
                        className="h-10 px-4 font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        追加
                    </Button>
                </div>
            )}

            <Card>
                <CardHeader className="p-3 sm:p-4">
                    <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                        {isCalendarMode ? (
                            <>
                                <CalendarDays className="h-4 w-4" />
                                一覧ビューモード
                            </>
                        ) : (
                            <>今月のワングラム製造スケジュール</>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-3 sm:p-4 space-y-3 sm:space-y-4">
                    {isLoading ? (
                        <p className="text-sm text-[hsl(var(--muted-foreground))]">読み込み中...</p>
                    ) : isError ? (
                        <div className="space-y-2">
                            <p className="text-sm text-red-600 font-semibold">エラーが発生しました</p>
                            <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                {error?.message || "データの取得に失敗しました"}
                            </p>
                            <Button onClick={() => refetch()} size="sm" variant="outline">
                                再試行
                            </Button>
                        </div>
                    ) : !data || data.length === 0 ? (
                        <div className="space-y-2">
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                この月のスケジュールはありません
                            </p>
                            <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                データ取得: {data === undefined ? "未取得" : `空配列 (${data.length}件)`}
                            </p>
                        </div>
                    ) : isCalendarMode ? (
                        <div className="space-y-3">
                            {groupedByDay.map(([day, items]) => {
                                // 制作分の場合は制作分名を表示、それ以外は日付を表示
                                const isProductionMonth = day.includes("月ワングラム制作分");
                                const displayHeader = isProductionMonth ? day : (day === "未設定" ? "日付未設定" : format(new Date(day), "M月d日"));

                                return (
                                    <div key={day} className="border border-[hsl(var(--border))] rounded-lg">
                                        <div className="px-2 sm:px-3 py-1.5 sm:py-2 bg-[hsl(var(--muted))] text-xs sm:text-sm font-semibold flex items-center justify-between">
                                            <span>{displayHeader}</span>
                                            <span className="text-[10px] sm:text-xs text-[hsl(var(--muted-foreground))]">
                                                {items.length}件
                                            </span>
                                        </div>
                                        <div className="divide-y divide-[hsl(var(--border))]">
                                            {items.map((item: any) => {
                                                // 納期（希望納期）の計算
                                                const desiredDate = item.desiredIncomingPlannedDate ? new Date(item.desiredIncomingPlannedDate) : null;
                                                const today = new Date();
                                                today.setHours(0, 0, 0, 0);
                                                let daysDiff = 0;
                                                let isOverdue = false;
                                                let daysText = "";
                                                if (desiredDate) {
                                                    desiredDate.setHours(0, 0, 0, 0);
                                                    daysDiff = Math.floor((desiredDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                                                    isOverdue = daysDiff < 0;
                                                    daysText = isOverdue ? `${Math.abs(daysDiff)}日遅れ` : `後${daysDiff}日`;
                                                }

                                                return (
                                                    <div key={item.id} className="p-2 sm:p-3 space-y-2">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <div className="min-w-0 flex-1">
                                                                <p className="font-semibold text-sm sm:text-base break-words">
                                                                    {item.vehicleName}
                                                                    {item.customerName && ` / ${item.customerName}様`}
                                                                    {item.productionMonth && ` / ${item.productionMonth}`}
                                                                </p>
                                                                <p className="text-[11px] sm:text-xs text-[hsl(var(--muted-foreground))] break-words">
                                                                    {item.vehicleType || "車種未設定"}
                                                                </p>
                                                            </div>
                                                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                                                <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-800 text-[10px] sm:text-xs font-semibold">
                                                                    {statusLabel(item.status)}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* 納期（希望納期） */}
                                                        {desiredDate && (
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[11px] sm:text-xs font-semibold">納期:</span>
                                                                <span className={`px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold ${isOverdue ? "bg-red-600 text-white" : "bg-blue-600 text-white"}`}>
                                                                    {format(desiredDate, "M月d日")} {daysText}
                                                                </span>
                                                            </div>
                                                        )}

                                                        {/* ワングラム完成予定日 */}
                                                        {item.incomingPlannedDate && (
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[11px] sm:text-xs font-semibold">ワングラム完成予定日:</span>
                                                                <span className="text-[11px] sm:text-xs">
                                                                    {format(new Date(item.incomingPlannedDate), "M月d日")}
                                                                </span>
                                                            </div>
                                                        )}

                                                        {/* ワングラム様に引き取りに行く日 */}
                                                        {item.shippingPlannedDate && (
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[11px] sm:text-xs font-semibold">ワングラム様に引き取りに行く日:</span>
                                                                <span className="text-[11px] sm:text-xs">
                                                                    {format(new Date(item.shippingPlannedDate), "M月d日")}
                                                                </span>
                                                            </div>
                                                        )}

                                                        {/* ベース車と家具 */}
                                                        {(item.baseCarReady || item.furnitureReady) && (
                                                            <div className="flex items-center gap-3">
                                                                {item.baseCarReady && (
                                                                    <div className="flex items-center gap-1">
                                                                        <span className="text-[11px] sm:text-xs font-semibold">ベース車:</span>
                                                                        <span className="text-[11px] sm:text-xs">
                                                                            {item.baseCarReady === "yes" ? "◯" : "×"}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                {item.furnitureReady && (
                                                                    <div className="flex items-center gap-1">
                                                                        <span className="text-[11px] sm:text-xs font-semibold">家具:</span>
                                                                        <span className="text-[11px] sm:text-xs">
                                                                            {item.furnitureReady === "yes" ? "◯" : "×"}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* donburiお客さん納期 - ワングラム側では非表示 */}
                                                        {!isExternal && item.deliveryPlannedDate && (
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[11px] sm:text-xs font-semibold">donburiお客さん納期:</span>
                                                                <span className="text-[11px] sm:text-xs">
                                                                    {format(new Date(item.deliveryPlannedDate), "M月d日")}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* 上段: 未完成の車両 */}
                            <div className="space-y-2">
                                <h2 className="text-sm sm:text-base font-semibold">進行中の車両</h2>
                                {activeItems.length === 0 ? (
                                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                        進行中の車両はありません
                                    </p>
                                ) : (
                                    <div className="flex flex-col gap-2">
                                        {activeItems
                                            .slice()
                                            .sort(
                                                (a: any, b: any) =>
                                                    statusOrder.indexOf(a.status || "katomo_stock") -
                                                    statusOrder.indexOf(b.status || "katomo_stock")
                                            )
                                            .map((item: any) => {
                                                // 状態ごとの背景色を決定
                                                let bgColor = "";
                                                let borderColor = "border-[hsl(var(--border))]";

                                                if (item.status === "wg_wait_pickup") {
                                                    bgColor = "bg-lime-50";
                                                    borderColor = "border-lime-300 border-2";
                                                } else if (item.status === "katomo_stock") {
                                                    bgColor = "bg-blue-50";
                                                } else if (item.status === "wg_storage") {
                                                    bgColor = "bg-cyan-50";
                                                } else if (item.status === "wg_production") {
                                                    bgColor = "bg-amber-50";
                                                }

                                                return (
                                                    <div
                                                        key={item.id}
                                                        className={`border rounded-lg p-3 sm:p-4 md:p-5 flex flex-col gap-3 ${bgColor} ${borderColor}`}
                                                    >
                                                        {/* 上部: 車両名と主要情報 */}
                                                        <div className="flex items-start justify-between gap-3 border-b pb-2">
                                                            <div className="min-w-0 flex-1">
                                                                <p className="font-bold text-xl sm:text-2xl md:text-3xl break-words">
                                                                    {item.vehicleName}
                                                                    {item.customerName && ` / ${item.customerName}様`}
                                                                    {item.productionMonth && ` / ${item.productionMonth}`}
                                                                </p>
                                                                <p className="text-xs sm:text-sm text-[hsl(var(--muted-foreground))] break-words mt-0.5">
                                                                    {item.vehicleType || "車種未設定"}
                                                                </p>
                                                            </div>
                                                            <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                                                {item.desiredIncomingPlannedDate && (() => {
                                                                    const desiredDate = new Date(item.desiredIncomingPlannedDate);
                                                                    const today = new Date();
                                                                    today.setHours(0, 0, 0, 0);
                                                                    desiredDate.setHours(0, 0, 0, 0);
                                                                    const daysDiff = Math.floor((desiredDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                                                                    const isOverdue = daysDiff < 0;
                                                                    const daysText = isOverdue ? `${Math.abs(daysDiff)}日遅れ` : `後${daysDiff}日`;

                                                                    if (isOverdue) {
                                                                        return (
                                                                            <span className="px-3 py-1.5 rounded-full bg-red-600 text-white text-base sm:text-lg font-bold">
                                                                                {format(desiredDate, "M月d日")} 希望納期 {daysText}
                                                                            </span>
                                                                        );
                                                                    } else {
                                                                        return (
                                                                            <span className="px-3 py-1.5 rounded-full bg-blue-600 text-white text-base sm:text-lg font-bold">
                                                                                {format(desiredDate, "M月d日")} 希望納期 {daysText}
                                                                            </span>
                                                                        );
                                                                    }
                                                                })()}
                                                                <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-800 text-xs sm:text-sm font-semibold">
                                                                    {statusLabel(item.status)}
                                                                </span>
                                                            </div>
                                                        </div>


                                                        {/* その他の情報 */}
                                                        {(item.optionName || item.inCharge) && (
                                                            <div className="flex flex-wrap items-center gap-1.5 text-xs sm:text-sm">
                                                                {item.optionName && (() => {
                                                                    // オプションを「/」で分割して、一つひとつ表示
                                                                    const options = typeof item.optionName === "string"
                                                                        ? item.optionName.split("/").map((opt: string) => opt.trim()).filter((opt: string) => opt)
                                                                        : [];
                                                                    return options.map((opt: string, index: number) => (
                                                                        <span key={index} className="px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                                                                            {opt}
                                                                        </span>
                                                                    ));
                                                                })()}
                                                                {item.inCharge && (
                                                                    <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                                                                        担当: {item.inCharge}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* メモ（進行中の車両のみ） */}
                                                        {item.comment && item.status !== "completed" && (
                                                            <div className="border-t pt-2 text-xs sm:text-sm">
                                                                <p className="text-[hsl(var(--muted-foreground))]">
                                                                    <span className="font-semibold">メモ:</span> {item.comment}
                                                                </p>
                                                            </div>
                                                        )}

                                                        {/* 仕様書リンク */}
                                                        {item.specSheetUrl && (
                                                            <div className="border-t pt-2">
                                                                <a
                                                                    href={item.specSheetUrl}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="inline-flex items-center gap-1 text-xs sm:text-sm text-blue-600 hover:text-blue-800 underline"
                                                                >
                                                                    <FileText className="h-3 w-3" />
                                                                    製造注意仕様書を表示
                                                                </a>
                                                            </div>
                                                        )}


                                                        {/* 希望ワングラム完成予定日（katomo入力） - ワングラム側はロック */}
                                                        {(isExternal || canEdit) && (
                                                            <div className="border-t pt-2">
                                                                <label className="text-xs sm:text-sm font-semibold block mb-1">
                                                                    希望ワングラム完成予定日（katomo入力）{isExternal && <span className="text-gray-500 font-normal">(katomo側で設定)</span>}:
                                                                </label>
                                                                <Input
                                                                    type="date"
                                                                    value={
                                                                        item.desiredIncomingPlannedDate
                                                                            ? format(new Date(item.desiredIncomingPlannedDate), "yyyy-MM-dd")
                                                                            : ""
                                                                    }
                                                                    onChange={(e) => {
                                                                        if (!isExternal) {
                                                                            const value = e.target.value;
                                                                            updateMutation.mutate({
                                                                                id: item.id,
                                                                                desiredIncomingPlannedDate: value === "" ? undefined : value,
                                                                            });
                                                                        }
                                                                    }}
                                                                    readOnly={isExternal}
                                                                    className="text-sm sm:text-base px-2 py-1 border rounded flex-1"
                                                                />
                                                            </div>
                                                        )}

                                                        {/* ワングラム完成予定日（ワングラム入力）- ワングラム側でも編集可能 */}
                                                        {(isExternal || canEdit) && (
                                                            <div className="border-t pt-2">
                                                                <label className="text-xs sm:text-sm font-semibold block mb-1">
                                                                    ワングラム完成予定日（ワングラム入力）:
                                                                </label>
                                                                <div className="flex items-center gap-2">
                                                                    <Input
                                                                        type="date"
                                                                        value={
                                                                            item.incomingPlannedDate
                                                                                ? format(new Date(item.incomingPlannedDate), "yyyy-MM-dd")
                                                                                : ""
                                                                        }
                                                                        onChange={(e) => {
                                                                            const value = e.target.value;
                                                                            // カレンダーの消去ボタン対応: 空文字列をそのまま送信（サーバー側でnullに変換される）
                                                                            updateMutation.mutate({
                                                                                id: item.id,
                                                                                incomingPlannedDate: value,
                                                                            });
                                                                        }}
                                                                        className="text-sm sm:text-base px-2 py-1 border rounded flex-1"
                                                                    />
                                                                    {/* 確定ボタンは管理者・準管理者のみ */}
                                                                    {canEdit && item.incomingPlannedDate && (
                                                                        <div className="flex items-center gap-1">
                                                                            <button
                                                                                type="button"
                                                                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs sm:text-sm border ${item.incomingPlannedDateConfirmed !== "true"
                                                                                    ? "bg-red-50 text-red-700 border-red-200"
                                                                                    : "bg-white text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))]"
                                                                                    }`}
                                                                                onClick={() => {
                                                                                    // 未決定にしたら日付もクリア
                                                                                    updateMutation.mutate({
                                                                                        id: item.id,
                                                                                        incomingPlannedDate: undefined,
                                                                                    });
                                                                                    confirmIncomingMutation.mutate({
                                                                                        id: item.id,
                                                                                        confirmed: false,
                                                                                    });
                                                                                }}
                                                                            >
                                                                                未決定
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs sm:text-sm border ${item.incomingPlannedDateConfirmed === "true"
                                                                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                                                    : "bg-white text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))]"
                                                                                    }`}
                                                                                onClick={() =>
                                                                                    confirmIncomingMutation.mutate({
                                                                                        id: item.id,
                                                                                        confirmed: true,
                                                                                    })
                                                                                }
                                                                            >
                                                                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                                                                確定
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                        {!canEdit && item.incomingPlannedDate && (
                                                            <div className="border-t pt-2 text-xs sm:text-sm">
                                                                <span className="text-[hsl(var(--muted-foreground))]">ワングラム完成予定日（ワングラム入力）: </span>
                                                                <span className="font-semibold">{format(new Date(item.incomingPlannedDate), "M月d日")}</span>
                                                                {item.incomingPlannedDateConfirmed === "true" && (
                                                                    <span className="ml-1 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px]">確定済み</span>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* ワングラム様に引き取りに行く日（katomo入力）- ワングラム側はロック */}
                                                        {(isExternal || canEdit) && (
                                                            <div className="border-t pt-2">
                                                                <label className="text-xs sm:text-sm font-semibold block mb-1">
                                                                    ワングラム様に引き取りに行く日（katomo入力）{isExternal && <span className="text-gray-500 font-normal">(katomo側で設定)</span>}:
                                                                </label>
                                                                <div className="flex items-center gap-2">
                                                                    <Input
                                                                        type="date"
                                                                        value={
                                                                            item.shippingPlannedDate
                                                                                ? format(new Date(item.shippingPlannedDate), "yyyy-MM-dd")
                                                                                : ""
                                                                        }
                                                                        onChange={(e) => {
                                                                            if (!isExternal) {
                                                                                const value = e.target.value;
                                                                                // カレンダーの消去ボタン対応: 空文字列をそのまま送信（サーバー側でnullに変換される）
                                                                                updateMutation.mutate({
                                                                                    id: item.id,
                                                                                    shippingPlannedDate: value,
                                                                                });
                                                                            }
                                                                        }}
                                                                        readOnly={isExternal}
                                                                        className="text-sm sm:text-base px-2 py-1 border rounded flex-1"
                                                                    />
                                                                    {item.shippingPlannedDate && (
                                                                        <div className="flex items-center gap-1">
                                                                            <button
                                                                                type="button"
                                                                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs sm:text-sm border ${item.pickupConfirmed !== "true"
                                                                                    ? "bg-red-50 text-red-700 border-red-200"
                                                                                    : "bg-white text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))]"
                                                                                    }`}
                                                                                onClick={() => {
                                                                                    // 未決定にしたら日付もクリア
                                                                                    updateMutation.mutate({
                                                                                        id: item.id,
                                                                                        shippingPlannedDate: undefined,
                                                                                    });
                                                                                    confirmPickupMutation.mutate({
                                                                                        id: item.id,
                                                                                        confirmed: false,
                                                                                    });
                                                                                }}
                                                                            >
                                                                                未決定
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs sm:text-sm border ${item.pickupConfirmed === "true"
                                                                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                                                    : "bg-white text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))]"
                                                                                    }`}
                                                                                onClick={() =>
                                                                                    confirmPickupMutation.mutate({
                                                                                        id: item.id,
                                                                                        confirmed: true,
                                                                                    })
                                                                                }
                                                                            >
                                                                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                                                                確定
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                        {/* ワングラム側以外では表示のみ */}
                                                        {!isExternal && !canEdit && item.shippingPlannedDate && (
                                                            <div className="border-t pt-2 text-xs sm:text-sm">
                                                                <span className="text-[hsl(var(--muted-foreground))]">ワングラム様に引き取りに行く日: </span>
                                                                <span className="font-semibold">{format(new Date(item.shippingPlannedDate), "M月d日")}</span>
                                                                {item.pickupConfirmed === "true" && (
                                                                    <span className="ml-1 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px]">確定済み</span>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* donburiお客さん納期 - ワングラム側では非表示 */}
                                                        {!isExternal && item.deliveryPlannedDate && (
                                                            <div className="border-t pt-2 text-xs sm:text-sm">
                                                                <span className="text-[hsl(var(--muted-foreground))]">donburiお客さん納期: </span>
                                                                <span className="font-semibold">{format(new Date(item.deliveryPlannedDate), "M月d日")}</span>
                                                            </div>
                                                        )}

                                                        {/* コメント機能 - ワングラムアカウントでも使用可能 */}
                                                        <VehicleChat vehicleId={item.id} canEdit={!!canUseChat} />

                                                        {/* ボタン類（準管理者以上のみ） */}
                                                        {canEdit && (
                                                            <div className="border-t pt-3 space-y-2">
                                                                {/* 状態変更ボタン */}
                                                                <div>
                                                                    <p className="text-xs text-[hsl(var(--muted-foreground))] mb-1">状態を変更:</p>
                                                                    <div className="flex flex-wrap gap-1">
                                                                        {statusButtons.map((s) => (
                                                                            <Button
                                                                                key={s.key}
                                                                                size="sm"
                                                                                variant={
                                                                                    item.status === s.key ? "default" : "outline"
                                                                                }
                                                                                className="h-7 px-2 text-xs"
                                                                                onClick={() =>
                                                                                    updateMutation.mutate({
                                                                                        id: item.id,
                                                                                        status: s.key as any,
                                                                                    })
                                                                                }
                                                                            >
                                                                                {s.label}
                                                                            </Button>
                                                                        ))}
                                                                        <Button
                                                                            size="sm"
                                                                            variant={
                                                                                item.status === "completed" ? "default" : "outline"
                                                                            }
                                                                            className="h-7 px-2 text-xs"
                                                                            onClick={() =>
                                                                                updateMutation.mutate({
                                                                                    id: item.id,
                                                                                    status: "completed" as any,
                                                                                })
                                                                            }
                                                                        >
                                                                            完成
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                                {/* 編集・削除ボタン */}
                                                                <div className="flex gap-2">
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        className="h-7 px-3 text-xs flex-1"
                                                                        onClick={() => {
                                                                            setEditing({
                                                                                ...item,
                                                                                dueDate: item.dueDate
                                                                                    ? format(new Date(item.dueDate), "yyyy-MM-dd")
                                                                                    : "",
                                                                                incomingPlannedDate: item.incomingPlannedDate
                                                                                    ? format(new Date(item.incomingPlannedDate), "yyyy-MM-dd")
                                                                                    : "",
                                                                                desiredIncomingPlannedDate: item.desiredIncomingPlannedDate
                                                                                    ? format(new Date(item.desiredIncomingPlannedDate), "yyyy-MM-dd")
                                                                                    : "",
                                                                                shippingPlannedDate: item.shippingPlannedDate
                                                                                    ? format(new Date(item.shippingPlannedDate), "yyyy-MM-dd")
                                                                                    : "",
                                                                                deliveryPlannedDate: item.deliveryPlannedDate
                                                                                    ? format(new Date(item.deliveryPlannedDate), "yyyy-MM-dd")
                                                                                    : "",
                                                                            });
                                                                            const existingOptions =
                                                                                item.optionName && typeof item.optionName === "string"
                                                                                    ? String(item.optionName)
                                                                                        .split("/")
                                                                                        .map((s: string) => s.trim())
                                                                                    : [];
                                                                            const preset = existingOptions.filter((opt: string) =>
                                                                                OPTION_PRESETS.includes(opt)
                                                                            );
                                                                            const others = existingOptions.filter(
                                                                                (opt: string) => !OPTION_PRESETS.includes(opt)
                                                                            );
                                                                            setSelectedOptions(preset);
                                                                            setOtherOption(others.join(" / "));
                                                                            setSpecFile(null);
                                                                            setIsEditDialogOpen(true);
                                                                        }}
                                                                    >
                                                                        <Edit className="h-3 w-3 mr-1" />
                                                                        編集
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="destructive"
                                                                        className="h-7 px-3 text-xs"
                                                                        onClick={() => {
                                                                            if (
                                                                                window.confirm(
                                                                                    "この納車スケジュールを削除しますか？"
                                                                                )
                                                                            ) {
                                                                                deleteMutation.mutate({ id: item.id });
                                                                            }
                                                                        }}
                                                                    >
                                                                        <Trash2 className="h-3 w-3" />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* 修正依頼の車両（優先表示） */}
                    {revisionRequestedItems.length > 0 && (
                        <div className="space-y-2">
                            <h2 className="text-base sm:text-lg font-bold mt-4 text-red-600">⚠️ 修正依頼の車両</h2>
                            <div className="flex flex-col gap-2">
                                {revisionRequestedItems.map((item: any) => (
                                    <div
                                        key={item.id}
                                        className="border-2 border-red-300 rounded-lg p-2 sm:p-3 md:p-4 flex flex-col gap-1.5 bg-red-50"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-col gap-1">
                                                    <p className="font-bold text-xl sm:text-2xl md:text-3xl break-words">
                                                        {item.vehicleName}
                                                    </p>
                                                    {/* ワングラム側はロック、それ以外は表示のみ */}
                                                    {isExternal ? (
                                                        <div className="border-t pt-2 mt-2">
                                                            <label className="text-xs sm:text-sm font-semibold block mb-1">
                                                                希望ワングラム完成予定日（katomo入力） <span className="text-gray-500 font-normal">(katomo側で設定)</span>:
                                                            </label>
                                                            <Input
                                                                type="date"
                                                                value={
                                                                    item.desiredIncomingPlannedDate
                                                                        ? format(new Date(item.desiredIncomingPlannedDate), "yyyy-MM-dd")
                                                                        : ""
                                                                }
                                                                readOnly={true}
                                                                className="text-sm sm:text-base px-2 py-1 border rounded flex-1"
                                                            />
                                                        </div>
                                                    ) : (
                                                        item.desiredIncomingPlannedDate && (
                                                            <p className="text-base sm:text-lg md:text-xl font-bold text-blue-600 break-words">
                                                                {format(new Date(item.desiredIncomingPlannedDate), "yyyy年M月d日")} 希望ワングラム完成予定日（katomo入力）
                                                            </p>
                                                        )
                                                    )}
                                                </div>
                                                <p className="text-[11px] sm:text-xs text-[hsl(var(--muted-foreground))] break-words">
                                                    {item.vehicleType || "車種未設定"} ／{" "}
                                                    {item.customerName || "お客様名未設定"}
                                                </p>
                                            </div>
                                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                                <span className="px-2 py-0.5 rounded-full bg-red-200 text-red-800 text-[10px] sm:text-xs font-bold">
                                                    状態: 修正依頼
                                                </span>
                                            </div>
                                        </div>
                                        {/* 完成後の状態ボタン */}
                                        {canEdit && (
                                            <div className="flex flex-wrap gap-1 mt-1 pt-2 border-t border-red-200">
                                                <span className="text-[10px] sm:text-xs text-[hsl(var(--muted-foreground))] w-full mb-1">
                                                    完成後の状態:
                                                </span>
                                                <Button
                                                    size="sm"
                                                    variant={item.completionStatus === "ok" ? "default" : "outline"}
                                                    className="h-7 px-3 text-xs"
                                                    onClick={() =>
                                                        updateMutation.mutate({
                                                            id: item.id,
                                                            completionStatus: "ok" as any,
                                                        })
                                                    }
                                                >
                                                    OK
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant={item.completionStatus === "checked" ? "default" : "outline"}
                                                    className="h-7 px-3 text-xs"
                                                    onClick={() =>
                                                        updateMutation.mutate({
                                                            id: item.id,
                                                            completionStatus: "checked" as any,
                                                        })
                                                    }
                                                >
                                                    チェック
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant={item.completionStatus === "revision_requested" ? "default" : "outline"}
                                                    className="h-7 px-3 text-xs bg-red-600 text-white hover:bg-red-700"
                                                    onClick={() =>
                                                        updateMutation.mutate({
                                                            id: item.id,
                                                            completionStatus: "revision_requested" as any,
                                                        })
                                                    }
                                                >
                                                    修正依頼
                                                </Button>
                                            </div>
                                        )}
                                        {/* 状態変更ボタン（準管理者以上のみ） */}
                                        {canEdit && (
                                            <div className="flex flex-wrap gap-1 mt-1 pt-2 border-t border-red-200">
                                                <span className="text-[10px] sm:text-xs text-[hsl(var(--muted-foreground))] w-full mb-1">
                                                    状態を変更:
                                                </span>
                                                {statusButtons.map((s) => (
                                                    <Button
                                                        key={s.key}
                                                        size="sm"
                                                        variant={
                                                            item.status === s.key ? "default" : "outline"
                                                        }
                                                        className="h-6 px-2 text-[10px]"
                                                        onClick={() =>
                                                            updateMutation.mutate({
                                                                id: item.id,
                                                                status: s.key as any,
                                                            })
                                                        }
                                                    >
                                                        {s.label}
                                                    </Button>
                                                ))}
                                                <Button
                                                    size="sm"
                                                    variant={
                                                        item.status === "completed" ? "default" : "outline"
                                                    }
                                                    className="h-6 px-2 text-[10px]"
                                                    onClick={() =>
                                                        updateMutation.mutate({
                                                            id: item.id,
                                                            status: "completed" as any,
                                                        })
                                                    }
                                                >
                                                    完成
                                                </Button>
                                            </div>
                                        )}
                                        {(item.comment || item.claimComment) && (
                                            <div className="mt-2 text-sm sm:text-base text-[hsl(var(--muted-foreground))] space-y-1">
                                                {item.comment && <p className="font-semibold">メモ: {item.comment}</p>}
                                                {item.claimComment && <p className="font-semibold text-red-600">クレーム・傷: {item.claimComment}</p>}
                                            </div>
                                        )}
                                        {/* ワングラム完成予定日（ワングラム入力）- ワングラム側でも編集可能 */}
                                        {(isExternal || canEdit) && (
                                            <div className="border-t pt-2 mt-2">
                                                <label className="text-xs sm:text-sm font-semibold block mb-1">
                                                    ワングラム完成予定日（ワングラム入力）:
                                                </label>
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        type="date"
                                                        value={
                                                            item.incomingPlannedDate
                                                                ? format(new Date(item.incomingPlannedDate), "yyyy-MM-dd")
                                                                : ""
                                                        }
                                                        onChange={(e) => {
                                                            const value = e.target.value;
                                                            updateMutation.mutate({
                                                                id: item.id,
                                                                incomingPlannedDate: value,
                                                            });
                                                        }}
                                                        className="text-sm sm:text-base px-2 py-1 border rounded flex-1"
                                                    />
                                                    {/* 確定ボタンは管理者・準管理者のみ */}
                                                    {canEdit && item.incomingPlannedDate && (
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                type="button"
                                                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs sm:text-sm border ${item.incomingPlannedDateConfirmed !== "true"
                                                                    ? "bg-red-50 text-red-700 border-red-200"
                                                                    : "bg-white text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))]"
                                                                    }`}
                                                                onClick={() => {
                                                                    // 未決定にしたら日付もクリア
                                                                    updateMutation.mutate({
                                                                        id: item.id,
                                                                        incomingPlannedDate: undefined,
                                                                    });
                                                                    confirmIncomingMutation.mutate({
                                                                        id: item.id,
                                                                        confirmed: false,
                                                                    });
                                                                }}
                                                            >
                                                                未決定
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs sm:text-sm border ${item.incomingPlannedDateConfirmed === "true"
                                                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                                    : "bg-white text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))]"
                                                                    }`}
                                                                onClick={() =>
                                                                    confirmIncomingMutation.mutate({
                                                                        id: item.id,
                                                                        confirmed: true,
                                                                    })
                                                                }
                                                            >
                                                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                                                確定
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        {!canEdit && item.incomingPlannedDate && (
                                            <div className="border-t pt-2 mt-2 text-xs sm:text-sm">
                                                <span className="text-[hsl(var(--muted-foreground))]">ワングラム完成予定日（ワングラム入力）: </span>
                                                <span className="font-semibold">{format(new Date(item.incomingPlannedDate), "M月d日")}</span>
                                                {item.incomingPlannedDateConfirmed === "true" && (
                                                    <span className="ml-1 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px]">確定済み</span>
                                                )}
                                            </div>
                                        )}
                                        {/* ワングラム様に引き取りに行く日（katomo入力）- ワングラム側はロック */}
                                        {(isExternal || canEdit) && (
                                            <div className="border-t pt-2">
                                                <label className="text-xs sm:text-sm font-semibold block mb-1">
                                                    ワングラム様に引き取りに行く日（katomo入力）{isExternal && <span className="text-gray-500 font-normal">(katomo側で設定)</span>}:
                                                </label>
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        type="date"
                                                        value={
                                                            item.shippingPlannedDate
                                                                ? format(new Date(item.shippingPlannedDate), "yyyy-MM-dd")
                                                                : ""
                                                        }
                                                        onChange={(e) => {
                                                            if (!isExternal) {
                                                                updateMutation.mutate({
                                                                    id: item.id,
                                                                    shippingPlannedDate: e.target.value || undefined,
                                                                });
                                                            }
                                                        }}
                                                        readOnly={isExternal}
                                                        className="text-sm sm:text-base px-2 py-1 border rounded flex-1"
                                                    />
                                                    {/* 確定ボタンは管理者・準管理者のみ */}
                                                    {canEdit && item.shippingPlannedDate && (
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                type="button"
                                                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs sm:text-sm border ${item.pickupConfirmed !== "true"
                                                                    ? "bg-red-50 text-red-700 border-red-200"
                                                                    : "bg-white text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))]"
                                                                    }`}
                                                                onClick={() => {
                                                                    // 未決定にしたら日付もクリア
                                                                    updateMutation.mutate({
                                                                        id: item.id,
                                                                        shippingPlannedDate: undefined,
                                                                    });
                                                                    confirmPickupMutation.mutate({
                                                                        id: item.id,
                                                                        confirmed: false,
                                                                    });
                                                                }}
                                                            >
                                                                未決定
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs sm:text-sm border ${item.pickupConfirmed === "true"
                                                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                                    : "bg-white text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))]"
                                                                    }`}
                                                                onClick={() =>
                                                                    confirmPickupMutation.mutate({
                                                                        id: item.id,
                                                                        confirmed: true,
                                                                    })
                                                                }
                                                            >
                                                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                                                確定
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        {/* ワングラム側以外では表示のみ */}
                                        {!isExternal && !canEdit && item.shippingPlannedDate && (
                                            <div className="border-t pt-2 text-xs sm:text-sm">
                                                <span className="text-[hsl(var(--muted-foreground))]">ワングラム様に引き取りに行く日: </span>
                                                <span className="font-semibold">{format(new Date(item.shippingPlannedDate), "M月d日")}</span>
                                                {item.pickupConfirmed === "true" && (
                                                    <span className="ml-1 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px]">確定済み</span>
                                                )}
                                            </div>
                                        )}

                                        {/* donburiお客さん納期 - ワングラム側では非表示 */}
                                        {!isExternal && item.deliveryPlannedDate && (
                                            <div className="border-t pt-2 text-xs sm:text-sm">
                                                <span className="text-[hsl(var(--muted-foreground))]">donburiお客さん納期: </span>
                                                <span className="font-semibold">{format(new Date(item.deliveryPlannedDate), "M月d日")}</span>
                                            </div>
                                        )}

                                        {/* コメント機能 - ワングラムアカウントでも使用可能 */}
                                        <VehicleChat vehicleId={item.id} canEdit={!!canUseChat} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 下段: 完成した車両 */}
                    {otherCompletedItems.length > 0 && (
                        <div className="space-y-2">
                            <h2 className="text-sm sm:text-base font-semibold mt-4">完成した車両</h2>
                            <div className="flex flex-col gap-2">
                                {otherCompletedItems.map((item: any) => (
                                    <div
                                        key={item.id}
                                        className="border border-[hsl(var(--border))] rounded-lg p-2 sm:p-3 md:p-4 flex flex-col gap-1.5 bg-green-50"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-col gap-1">
                                                    <p className="font-bold text-xl sm:text-2xl md:text-3xl break-words">
                                                        {item.vehicleName}
                                                    </p>
                                                    {/* ワングラム側はロック、それ以外は表示のみ */}
                                                    {isExternal ? (
                                                        <div className="border-t pt-2 mt-2">
                                                            <label className="text-xs sm:text-sm font-semibold block mb-1">
                                                                希望ワングラム完成予定日（katomo入力） <span className="text-gray-500 font-normal">(katomo側で設定)</span>:
                                                            </label>
                                                            <Input
                                                                type="date"
                                                                value={
                                                                    item.desiredIncomingPlannedDate
                                                                        ? format(new Date(item.desiredIncomingPlannedDate), "yyyy-MM-dd")
                                                                        : ""
                                                                }
                                                                readOnly={true}
                                                                className="text-sm sm:text-base px-2 py-1 border rounded flex-1"
                                                            />
                                                        </div>
                                                    ) : (
                                                        item.desiredIncomingPlannedDate && (
                                                            <p className="text-base sm:text-lg md:text-xl font-bold text-blue-600 break-words">
                                                                {format(new Date(item.desiredIncomingPlannedDate), "yyyy年M月d日")} 希望ワングラム完成予定日（katomo入力）
                                                            </p>
                                                        )
                                                    )}
                                                </div>
                                                <p className="text-[11px] sm:text-xs text-[hsl(var(--muted-foreground))] break-words">
                                                    {item.vehicleType || "車種未設定"} ／{" "}
                                                    {item.customerName || "お客様名未設定"}
                                                </p>
                                            </div>
                                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] sm:text-xs">
                                                    状態: 完成
                                                </span>
                                            </div>
                                        </div>
                                        {/* 完成後の状態ボタン */}
                                        {canEdit && (
                                            <div className="flex flex-wrap gap-1 mt-1 pt-2 border-t border-green-200">
                                                <span className="text-[10px] sm:text-xs text-[hsl(var(--muted-foreground))] w-full mb-1">
                                                    完成後の状態:
                                                </span>
                                                <Button
                                                    size="sm"
                                                    variant={item.completionStatus === "ok" ? "default" : "outline"}
                                                    className="h-7 px-3 text-xs"
                                                    onClick={() =>
                                                        updateMutation.mutate({
                                                            id: item.id,
                                                            completionStatus: "ok" as any,
                                                        })
                                                    }
                                                >
                                                    OK
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant={item.completionStatus === "checked" ? "default" : "outline"}
                                                    className="h-7 px-3 text-xs"
                                                    onClick={() =>
                                                        updateMutation.mutate({
                                                            id: item.id,
                                                            completionStatus: "checked" as any,
                                                        })
                                                    }
                                                >
                                                    チェック
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant={item.completionStatus === "revision_requested" ? "default" : "outline"}
                                                    className="h-7 px-3 text-xs bg-red-600 text-white hover:bg-red-700"
                                                    onClick={() =>
                                                        updateMutation.mutate({
                                                            id: item.id,
                                                            completionStatus: "revision_requested" as any,
                                                        })
                                                    }
                                                >
                                                    修正依頼
                                                </Button>
                                            </div>
                                        )}
                                        {/* 状態変更ボタン（準管理者以上のみ） */}
                                        {canEdit && (
                                            <div className="flex flex-wrap gap-1 mt-1 pt-2 border-t border-green-200">
                                                <span className="text-[10px] sm:text-xs text-[hsl(var(--muted-foreground))] w-full mb-1">
                                                    状態を変更:
                                                </span>
                                                {statusButtons.map((s) => (
                                                    <Button
                                                        key={s.key}
                                                        size="sm"
                                                        variant={
                                                            item.status === s.key ? "default" : "outline"
                                                        }
                                                        className="h-6 px-2 text-[10px]"
                                                        onClick={() =>
                                                            updateMutation.mutate({
                                                                id: item.id,
                                                                status: s.key as any,
                                                            })
                                                        }
                                                    >
                                                        {s.label}
                                                    </Button>
                                                ))}
                                                <Button
                                                    size="sm"
                                                    variant={
                                                        item.status === "completed" ? "default" : "outline"
                                                    }
                                                    className="h-6 px-2 text-[10px]"
                                                    onClick={() =>
                                                        updateMutation.mutate({
                                                            id: item.id,
                                                            status: "completed" as any,
                                                        })
                                                    }
                                                >
                                                    完成
                                                </Button>
                                            </div>
                                        )}
                                        {(item.comment || item.claimComment) && (
                                            <div className="mt-2 text-sm sm:text-base text-[hsl(var(--muted-foreground))] space-y-1">
                                                {item.comment && <p className="font-semibold">メモ: {item.comment}</p>}
                                                {item.claimComment && <p className="font-semibold text-red-600">クレーム・傷: {item.claimComment}</p>}
                                            </div>
                                        )}
                                        {/* ワングラム完成予定日（ワングラム入力）- ワングラム側でも編集可能 */}
                                        {(isExternal || canEdit) && (
                                            <div className="border-t pt-2 mt-2">
                                                <label className="text-xs sm:text-sm font-semibold block mb-1">
                                                    ワングラム完成予定日（ワングラム入力）:
                                                </label>
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        type="date"
                                                        value={
                                                            item.incomingPlannedDate
                                                                ? format(new Date(item.incomingPlannedDate), "yyyy-MM-dd")
                                                                : ""
                                                        }
                                                        onChange={(e) => {
                                                            const value = e.target.value;
                                                            updateMutation.mutate({
                                                                id: item.id,
                                                                incomingPlannedDate: value,
                                                            });
                                                        }}
                                                        className="text-sm sm:text-base px-2 py-1 border rounded flex-1"
                                                    />
                                                    {/* 確定ボタンは管理者・準管理者のみ */}
                                                    {canEdit && item.incomingPlannedDate && (
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                type="button"
                                                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs sm:text-sm border ${item.incomingPlannedDateConfirmed !== "true"
                                                                    ? "bg-red-50 text-red-700 border-red-200"
                                                                    : "bg-white text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))]"
                                                                    }`}
                                                                onClick={() => {
                                                                    // 未決定にしたら日付もクリア
                                                                    updateMutation.mutate({
                                                                        id: item.id,
                                                                        incomingPlannedDate: undefined,
                                                                    });
                                                                    confirmIncomingMutation.mutate({
                                                                        id: item.id,
                                                                        confirmed: false,
                                                                    });
                                                                }}
                                                            >
                                                                未決定
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs sm:text-sm border ${item.incomingPlannedDateConfirmed === "true"
                                                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                                    : "bg-white text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))]"
                                                                    }`}
                                                                onClick={() =>
                                                                    confirmIncomingMutation.mutate({
                                                                        id: item.id,
                                                                        confirmed: true,
                                                                    })
                                                                }
                                                            >
                                                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                                                確定
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        {!canEdit && item.incomingPlannedDate && (
                                            <div className="border-t pt-2 mt-2 text-xs sm:text-sm">
                                                <span className="text-[hsl(var(--muted-foreground))]">ワングラム完成予定日（ワングラム入力）: </span>
                                                <span className="font-semibold">{format(new Date(item.incomingPlannedDate), "M月d日")}</span>
                                                {item.incomingPlannedDateConfirmed === "true" && (
                                                    <span className="ml-1 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px]">確定済み</span>
                                                )}
                                            </div>
                                        )}
                                        {/* ワングラム様に引き取りに行く日（katomo入力）- ワングラム側はロック */}
                                        {(isExternal || canEdit) && (
                                            <div className="border-t pt-2">
                                                <label className="text-xs sm:text-sm font-semibold block mb-1">
                                                    ワングラム様に引き取りに行く日（katomo入力）{isExternal && <span className="text-gray-500 font-normal">(katomo側で設定)</span>}:
                                                </label>
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        type="date"
                                                        value={
                                                            item.shippingPlannedDate
                                                                ? format(new Date(item.shippingPlannedDate), "yyyy-MM-dd")
                                                                : ""
                                                        }
                                                        onChange={(e) => {
                                                            if (!isExternal) {
                                                                updateMutation.mutate({
                                                                    id: item.id,
                                                                    shippingPlannedDate: e.target.value || undefined,
                                                                });
                                                            }
                                                        }}
                                                        readOnly={isExternal}
                                                        className="text-sm sm:text-base px-2 py-1 border rounded flex-1"
                                                    />
                                                    {/* 確定ボタンは管理者・準管理者のみ */}
                                                    {canEdit && item.shippingPlannedDate && (
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                type="button"
                                                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs sm:text-sm border ${item.pickupConfirmed !== "true"
                                                                    ? "bg-red-50 text-red-700 border-red-200"
                                                                    : "bg-white text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))]"
                                                                    }`}
                                                                onClick={() => {
                                                                    // 未決定にしたら日付もクリア
                                                                    updateMutation.mutate({
                                                                        id: item.id,
                                                                        shippingPlannedDate: undefined,
                                                                    });
                                                                    confirmPickupMutation.mutate({
                                                                        id: item.id,
                                                                        confirmed: false,
                                                                    });
                                                                }}
                                                            >
                                                                未決定
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs sm:text-sm border ${item.pickupConfirmed === "true"
                                                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                                    : "bg-white text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))]"
                                                                    }`}
                                                                onClick={() =>
                                                                    confirmPickupMutation.mutate({
                                                                        id: item.id,
                                                                        confirmed: true,
                                                                    })
                                                                }
                                                            >
                                                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                                                確定
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        {/* ワングラム側以外では表示のみ */}
                                        {!isExternal && !canEdit && item.shippingPlannedDate && (
                                            <div className="border-t pt-2 text-xs sm:text-sm">
                                                <span className="text-[hsl(var(--muted-foreground))]">ワングラム様に引き取りに行く日: </span>
                                                <span className="font-semibold">{format(new Date(item.shippingPlannedDate), "M月d日")}</span>
                                                {item.pickupConfirmed === "true" && (
                                                    <span className="ml-1 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px]">確定済み</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* 一覧ビューモードボタン（タブの下） */}
            <div className="flex justify-center mt-2">
                <Button
                    variant={isCalendarMode ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => setIsCalendarMode((v) => !v)}
                    className="h-10 px-4 font-semibold shadow-sm hover:shadow-md transition-shadow"
                >
                    <CalendarDays className="h-4 w-4 mr-2" />
                    {isCalendarMode ? "カード表示" : "一覧ビューモード"}
                </Button>
            </div>

            {/* 納車遅れリスト */}
            {delayedItems.length > 0 && (
                <Card>
                    <CardHeader className="p-3 sm:p-4">
                        <CardTitle className="text-base sm:text-lg text-red-600">
                            納車遅れリスト
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 sm:p-4">
                        <div className="flex flex-col gap-2">
                            {delayedItems.map((item: any) => {
                                const dueDate = item.dueDate ? new Date(item.dueDate) : null;
                                const today = new Date();
                                const delayDays = dueDate
                                    ? Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
                                    : 0;
                                return (
                                    <div
                                        key={item.id}
                                        className="border border-red-300 rounded-lg p-2 sm:p-3 bg-red-50 flex items-start justify-between gap-2"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <p className="font-semibold text-sm sm:text-base break-words">
                                                {item.vehicleName}
                                            </p>
                                            <p className="text-[11px] sm:text-xs text-[hsl(var(--muted-foreground))] break-words">
                                                {item.vehicleType || "車種未設定"} ／ {item.customerName || "お客様名未設定"}
                                            </p>
                                            {dueDate && (
                                                <p className="text-[11px] sm:text-xs text-red-600 mt-1">
                                                    ワングラム入庫予定: {format(dueDate, "yyyy年M月d日")} （{delayDays}日遅れ）
                                                </p>
                                            )}
                                        </div>
                                        <span className="px-2 py-1 rounded-full bg-red-100 text-red-800 text-[10px] sm:text-xs font-semibold">
                                            {statusLabel(item.status)}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* チャット機能 */}
            <Card>
                <CardHeader className="p-3 sm:p-4">
                    <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                        <MessageCircle className="h-4 w-4" />
                        話し合い・チャット
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-3 sm:p-4">
                    <div className="space-y-3">
                        {/* 返信先コメント表示 */}
                        {replyingTo && chats && (() => {
                            const parentChat = chats.find((c: any) => c.id === replyingTo);
                            return parentChat ? (
                                <div className="bg-[hsl(var(--muted))] p-2 rounded-lg mb-2 flex items-start justify-between">
                                    <div className="flex-1">
                                        <p className="text-xs text-[hsl(var(--muted-foreground))] mb-1">
                                            {parentChat.userName || `ユーザーID: ${parentChat.userId}`}に返信:
                                        </p>
                                        <p className="text-sm line-clamp-2">{parentChat.message}</p>
                                    </div>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-6 w-6 flex-shrink-0"
                                        onClick={() => setReplyingTo(null)}
                                    >
                                        <span className="text-xs">×</span>
                                    </Button>
                                </div>
                            ) : null;
                        })()}

                        {/* チャット投稿フォーム */}
                        <div className="flex gap-2">
                            <textarea
                                value={chatMessage}
                                onChange={(e) => setChatMessage(e.target.value)}
                                placeholder={replyingTo ? "返信を入力..." : "コメントを入力..."}
                                className="flex-1 min-h-[80px] p-2 border border-[hsl(var(--border))] rounded-lg text-sm resize-none"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                                        e.preventDefault();
                                        if (chatMessage.trim()) {
                                            createChatMutation.mutate({
                                                message: chatMessage.trim(),
                                                parentId: replyingTo || undefined,
                                            });
                                        }
                                    }
                                }}
                            />
                            <Button
                                onClick={() => {
                                    if (chatMessage.trim()) {
                                        createChatMutation.mutate({
                                            message: chatMessage.trim(),
                                            parentId: replyingTo || undefined,
                                        });
                                    }
                                }}
                                disabled={!chatMessage.trim() || createChatMutation.isPending}
                                className="self-end"
                            >
                                <Send className="h-4 w-4" />
                            </Button>
                        </div>
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">
                            Ctrl+Enter（Mac: Cmd+Enter）で送信
                        </p>

                        {/* チャット履歴 */}
                        <div className="space-y-2 max-h-[400px] overflow-y-auto border border-[hsl(var(--border))] rounded-lg p-3">
                            {chats && chats.length > 0 ? (
                                chats.map((chat: any) => (
                                    <div
                                        key={chat.id}
                                        className={`flex items-start gap-2 p-2 hover:bg-[hsl(var(--muted))]/50 rounded ${chat.parentId ? "ml-6 border-l-2 border-[hsl(var(--border))] pl-4" : ""}`}
                                    >
                                        <div className="flex-1 min-w-0">
                                            {/* 返信先コメント表示 */}
                                            {chat.parentId && chat.parentUserName && (
                                                <div className="mb-1 p-2 bg-[hsl(var(--muted))] rounded text-xs">
                                                    <span className="text-[hsl(var(--muted-foreground))]">
                                                        {chat.parentUserName}への返信:
                                                    </span>
                                                    <p className="text-[hsl(var(--muted-foreground))] line-clamp-2 mt-1">
                                                        {chat.parentMessage}
                                                    </p>
                                                </div>
                                            )}

                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-semibold text-sm">
                                                    {chat.userName || `ユーザーID: ${chat.userId}`}
                                                </span>
                                                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                                                    {format(new Date(chat.createdAt), "yyyy/MM/dd HH:mm")}
                                                </span>
                                            </div>
                                            <p className="text-sm whitespace-pre-wrap break-words">{chat.message}</p>
                                        </div>
                                        <div className="flex gap-1 flex-shrink-0">
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-7 w-7"
                                                onClick={() => setReplyingTo(chat.id)}
                                                title="返信"
                                            >
                                                <MessageCircle className="h-3 w-3" />
                                            </Button>
                                            {canEdit && (
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-7 w-7"
                                                    onClick={() => {
                                                        if (window.confirm("このコメントを削除しますか？")) {
                                                            deleteChatMutation.mutate({ id: chat.id });
                                                        }
                                                    }}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-4">
                                    コメントはまだありません
                                </p>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* 追加・編集ダイアログ */}
            {isEditDialogOpen && editing && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
                    <Card className="w-full max-w-md min-w-0 my-auto">
                        <CardHeader className="p-3 sm:p-4">
                            <CardTitle className="text-base sm:text-lg">
                                {editing.id ? "納車スケジュールを編集" : "納車スケジュールを追加"}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 sm:p-4 space-y-3 text-sm">
                            <div>
                                <label className="text-xs font-medium block mb-1">車両の名前 *</label>
                                <Input
                                    value={editing.vehicleName}
                                    onChange={(e) => setEditing({ ...editing, vehicleName: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium block mb-1">車両の種類</label>
                                <Input
                                    value={editing.vehicleType}
                                    onChange={(e) => setEditing({ ...editing, vehicleType: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium block mb-1">お客様名</label>
                                <Input
                                    value={editing.customerName}
                                    onChange={(e) => setEditing({ ...editing, customerName: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium block mb-1">オプション</label>
                                <div className="flex flex-wrap gap-1.5 mb-1">
                                    {OPTION_PRESETS.map((opt) => {
                                        const checked = selectedOptions.includes(opt);
                                        return (
                                            <button
                                                key={opt}
                                                type="button"
                                                className={`px-2 py-0.5 rounded-full text-[10px] sm:text-xs border ${checked
                                                    ? "bg-blue-600 text-white border-blue-600"
                                                    : "bg-white text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))]"
                                                    }`}
                                                onClick={() => {
                                                    setSelectedOptions((prev) =>
                                                        checked
                                                            ? prev.filter((v) => v !== opt)
                                                            : [...prev, opt]
                                                    );
                                                }}
                                            >
                                                {opt}
                                            </button>
                                        );
                                    })}
                                </div>
                                <Input
                                    placeholder="その他オプション（自由入力）"
                                    value={otherOption}
                                    onChange={(e) => setOtherOption(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium block mb-1">納車県</label>
                                <Input
                                    value={editing.prefecture}
                                    onChange={(e) => setEditing({ ...editing, prefecture: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-xs font-medium block mb-1">ベース車</label>
                                    <select
                                        className="flex h-9 w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-2 text-xs"
                                        value={editing.baseCarReady || ""}
                                        onChange={(e) =>
                                            setEditing({ ...editing, baseCarReady: e.target.value || "" })
                                        }
                                    >
                                        <option value="">未設定</option>
                                        <option value="yes">◯</option>
                                        <option value="no">✕</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-medium block mb-1">家具</label>
                                    <select
                                        className="flex h-9 w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-2 text-xs"
                                        value={editing.furnitureReady || ""}
                                        onChange={(e) =>
                                            setEditing({ ...editing, furnitureReady: e.target.value || "" })
                                        }
                                    >
                                        <option value="">未設定</option>
                                        <option value="yes">◯</option>
                                        <option value="no">✕</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-medium block mb-1">担当</label>
                                <Input
                                    value={editing.inCharge}
                                    onChange={(e) => setEditing({ ...editing, inCharge: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium block mb-1">ワングラム制作分（月選択）</label>
                                <select
                                    className="flex h-9 w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-2 text-xs"
                                    value={editing.productionMonth ? (() => {
                                        // 「○月ワングラム制作分」から月の数字を抽出（例: "11月ワングラム制作分" → "11"）
                                        const match = editing.productionMonth.match(/^(\d+)月/);
                                        return match ? match[1] : "";
                                    })() : ""}
                                    onChange={(e) => {
                                        const month = e.target.value;
                                        if (month) {
                                            setEditing({ ...editing, productionMonth: `${month}月ワングラム制作分` });
                                        } else {
                                            setEditing({ ...editing, productionMonth: "" });
                                        }
                                    }}
                                >
                                    <option value="">未選択</option>
                                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                                        <option key={m} value={m}>
                                            {m}月
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-medium block mb-1">ワングラム入庫予定</label>
                                <Input
                                    type="date"
                                    value={editing.dueDate}
                                    onChange={(e) => setEditing({ ...editing, dueDate: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium block mb-1">希望ワングラム完成予定日（katomo入力）</label>
                                <Input
                                    type="date"
                                    value={editing.desiredIncomingPlannedDate}
                                    onChange={(e) =>
                                        setEditing({ ...editing, desiredIncomingPlannedDate: e.target.value })
                                    }
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium block mb-1">donburiお客さん納期</label>
                                <Input
                                    type="date"
                                    value={editing.deliveryPlannedDate}
                                    onChange={(e) =>
                                        setEditing({ ...editing, deliveryPlannedDate: e.target.value })
                                    }
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium block mb-1">注意事項・メモ</label>
                                <Input
                                    value={editing.comment}
                                    onChange={(e) => setEditing({ ...editing, comment: e.target.value })}
                                />
                            </div>
                            {/* クレーム・傷は完成した車両のみ編集可能 */}
                            {editing.status === "completed" && (
                                <div>
                                    <label className="text-xs font-medium block mb-1">クレーム・傷など</label>
                                    <Input
                                        value={editing.claimComment}
                                        onChange={(e) => setEditing({ ...editing, claimComment: e.target.value })}
                                    />
                                </div>
                            )}
                            <div>
                                <label className="text-xs font-medium block mb-1">ワングラム側メモ（任意）</label>
                                <Input
                                    value={editing.oemComment}
                                    onChange={(e) => setEditing({ ...editing, oemComment: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium block mb-1">
                                    製造注意仕様書（PDF / JPG）
                                </label>
                                <Input
                                    type="file"
                                    accept=".pdf,.jpg,.jpeg"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0] || null;
                                        setSpecFile(file);
                                    }}
                                />
                                {editing.specSheetUrl && (
                                    <a
                                        href={editing.specSheetUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="mt-1 inline-flex items-center gap-1 text-[10px] sm:text-xs text-blue-600 hover:text-blue-800 underline"
                                    >
                                        <FileText className="h-3 w-3" />
                                        既存の仕様書を表示
                                    </a>
                                )}
                            </div>
                            <div className="flex gap-2 pt-2">
                                <Button
                                    className="flex-1"
                                    onClick={handleSave}
                                    disabled={createMutation.isPending || updateMutation.isPending}
                                >
                                    保存
                                </Button>
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => {
                                        setIsEditDialogOpen(false);
                                        setEditing(null);
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


