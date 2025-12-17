import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { trpc } from "../lib/trpc";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Plus, Search, Edit, Check, Archive, FileText, Trash2, ClipboardCheck, AlertCircle, UserPlus } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { format } from "date-fns";
import { happyHuesColors, happyHuesStyles } from "../styles/happyHues";


// 車両詳細コンテンツコンポーネント
function VehicleDetailContent({
    vehicleId,
    user,
    vehicleStatus,
    completeMutation,
    archiveMutation,
    uncompleteMutation,
    unarchiveMutation
}: {
    vehicleId: number;
    user: any;
    vehicleStatus?: "in_progress" | "completed" | "archived";
    completeMutation?: any;
    archiveMutation?: any;
    uncompleteMutation?: any;
    unarchiveMutation?: any;
}) {
    const { data: vehicle, refetch: refetchVehicle } = trpc.vehicles.get.useQuery({ id: vehicleId });
    const { data: attentionPoints, refetch: refetchAttentionPoints } = trpc.vehicles.getAttentionPoints.useQuery(
        { vehicleId },
        { enabled: !!vehicleId }
    );
    const addAttentionPointMutation = trpc.vehicles.addAttentionPoint.useMutation({
        onSuccess: () => {
            toast.success("注意ポイントを追加しました");
            refetchAttentionPoints();
        },
        onError: (error) => {
            toast.error(error.message || "注意ポイントの追加に失敗しました");
        },
    });

    const deleteAttentionPointMutation = trpc.vehicles.deleteAttentionPoint.useMutation({
        onSuccess: () => {
            toast.success("注意ポイントを削除しました");
            refetchAttentionPoints();
        },
        onError: (error) => {
            toast.error(error.message || "注意ポイントの削除に失敗しました");
        },
    });

    const [isAttentionPointDialogOpen, setIsAttentionPointDialogOpen] = useState(false);
    const [attentionPointContent, setAttentionPointContent] = useState("");
    const [isMemoDialogOpen, setIsMemoDialogOpen] = useState(false);
    const [memoContent, setMemoContent] = useState("");

    const addMemoMutation = trpc.vehicles.addMemo.useMutation({
        onSuccess: () => {
            toast.success("メモを追加しました");
            refetchVehicle();
        },
        onError: (error) => {
            toast.error(error.message || "メモの追加に失敗しました");
        },
    });

    const updateAttentionPointMutation = trpc.vehicles.updateAttentionPoint.useMutation({
        onSuccess: () => {
            toast.success("注意ポイントを更新しました");
            refetchAttentionPoints();
        },
        onError: (error) => {
            toast.error(error.message || "注意ポイントの更新に失敗しました");
        },
    });


    if (!vehicle) {
        return (
            <CardContent className="p-4">
                <p className="text-center text-sm text-[hsl(var(--muted-foreground))]">読み込み中...</p>
            </CardContent>
        );
    }

    return (
        <CardContent className="p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4 border-t bg-gray-50/50 w-full max-w-full overflow-hidden">
            {/* 指示書 */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 md:gap-4 w-full">
                {/* 指示書 */}
                <Card className="flex-1 min-w-0 sm:min-w-[200px] max-w-full overflow-hidden">
                    <CardHeader className="p-2 sm:p-3">
                        <CardTitle className="text-xs sm:text-sm">指示書</CardTitle>
                    </CardHeader>
                    <CardContent className="p-2 sm:p-3 space-y-1.5">
                        {vehicle.instructionSheetUrl ? (
                            <a
                                href={vehicle.instructionSheetUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 sm:gap-2 text-blue-600 hover:text-blue-800 underline text-xs sm:text-sm"
                            >
                                <FileText className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                                指示書を表示
                            </a>
                        ) : (
                            <p className="text-[10px] sm:text-xs text-[hsl(var(--muted-foreground))]">
                                指示書がアップロードされていません
                            </p>
                        )}
                        {(user?.role === "admin" || user?.role === "sub_admin") && (
                            <p className="text-[9px] sm:text-[10px] text-[hsl(var(--muted-foreground))] leading-tight">
                                指示書ファイルはサーバー更新のタイミングで消えることがあります。
                                消えていた場合は「車両編集」画面の指示書欄から
                                再アップロードしてください。
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>



            {/* メモ */}
            <Card className="border-2">
                <CardHeader className="p-2 sm:p-3 md:p-4 bg-white border-b">
                    <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-xs sm:text-sm font-semibold">メモ</CardTitle>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                                setMemoContent("");
                                setIsMemoDialogOpen(true);
                            }}
                            className="h-5 sm:h-6 px-1.5 sm:px-2 text-[10px] sm:text-xs flex-shrink-0"
                        >
                            <Plus className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                            追加
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-2 sm:p-3 md:p-4">
                    {vehicle.memos && vehicle.memos.length > 0 ? (
                        <div className="flex flex-col sm:flex-row gap-2 sm:gap-2 overflow-x-auto">
                            {vehicle.memos.map((memo: any) => (
                                <div
                                    key={memo.id}
                                    className="flex-1 sm:flex-shrink-0 sm:min-w-[200px] p-2 sm:p-3 border border-[hsl(var(--border))] rounded-lg bg-white"
                                >
                                    <p className="text-[10px] sm:text-xs mb-1 break-words">{memo.content}</p>
                                    <p className="text-[10px] sm:text-xs text-[hsl(var(--muted-foreground))]">
                                        {format(new Date(memo.createdAt), "yyyy-MM-dd HH:mm")} - {memo.userName}
                                    </p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-center py-1 sm:py-2 text-[10px] sm:text-xs text-[hsl(var(--muted-foreground))]">
                            メモがありません
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* 注意ポイント（下の段に配置） */}
            <Card className="border-2">
                <CardHeader className="p-2 sm:p-3 md:p-4 bg-white border-b">
                    <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-xs sm:text-sm font-semibold">注意ポイント</CardTitle>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                                setAttentionPointContent("");
                                setIsAttentionPointDialogOpen(true);
                            }}
                            className="h-5 sm:h-6 px-1.5 sm:px-2 text-[10px] sm:text-xs flex-shrink-0"
                        >
                            <Plus className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                            追加
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-2 sm:p-3 md:p-4 max-h-[200px] overflow-y-auto">
                    {attentionPoints && attentionPoints.length > 0 ? (
                        <div className="space-y-1.5 sm:space-y-2">
                            {attentionPoints.map((ap) => (
                                <div
                                    key={ap.id}
                                    className="p-1.5 sm:p-2 border border-[hsl(var(--border))] rounded-lg bg-yellow-50 break-words"
                                >
                                    <p className="text-[10px] sm:text-xs break-words overflow-wrap-anywhere word-break-break-word whitespace-pre-wrap">
                                        {ap.content}
                                    </p>
                                    <div className="flex items-center justify-between mt-0.5 sm:mt-1 gap-1">
                                        <p className="text-[10px] sm:text-xs text-[hsl(var(--muted-foreground))] truncate flex-1 min-w-0">
                                            {format(new Date(ap.createdAt), "yyyy-MM-dd HH:mm")} - {ap.userName}
                                        </p>
                                        {user?.role === "admin" && (
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => {
                                                    if (confirm("この注意ポイントを削除しますか？")) {
                                                        deleteAttentionPointMutation.mutate({ id: ap.id });
                                                    }
                                                }}
                                                className="h-4 sm:h-5 px-0.5 sm:px-1 text-red-600 hover:text-red-800 flex-shrink-0"
                                            >
                                                <Trash2 className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-[10px] sm:text-xs text-[hsl(var(--muted-foreground))]">
                            注意ポイントがありません
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* アクションボタン（一番下） */}
            {user?.role === "admin" && vehicleStatus && completeMutation && archiveMutation && uncompleteMutation && unarchiveMutation && (
                <div className="flex flex-col gap-1.5 sm:gap-2 pt-2 border-t">
                    {vehicleStatus === "in_progress" && (
                        <div className="flex gap-1.5 sm:gap-2">
                            <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 text-[10px] sm:text-xs md:text-sm h-7 sm:h-8"
                                onClick={() => {
                                    if (confirm("この車両を完成にしますか？")) {
                                        completeMutation.mutate({ id: vehicleId });
                                    }
                                }}
                            >
                                <Check className="h-3 w-3 sm:h-4 sm:w-4 mr-0.5 sm:mr-1" />
                                完成
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 text-[10px] sm:text-xs md:text-sm h-7 sm:h-8"
                                onClick={() => {
                                    if (confirm("この車両を保管にしますか？")) {
                                        archiveMutation.mutate({ id: vehicleId });
                                    }
                                }}
                            >
                                <Archive className="h-3 w-3 sm:h-4 sm:w-4 mr-0.5 sm:mr-1" />
                                保管
                            </Button>
                        </div>
                    )}
                    {vehicleStatus === "completed" && (
                        <div className="flex gap-1.5 sm:gap-2">
                            <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 text-[10px] sm:text-xs h-7 sm:h-8"
                                onClick={() => {
                                    if (confirm("この車両を作業中に戻しますか？")) {
                                        uncompleteMutation.mutate({ id: vehicleId });
                                    }
                                }}
                            >
                                作業中に戻す
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 text-[10px] sm:text-xs h-7 sm:h-8"
                                onClick={() => {
                                    if (confirm("この車両を保管にしますか？")) {
                                        archiveMutation.mutate({ id: vehicleId });
                                    }
                                }}
                            >
                                <Archive className="h-3 w-3 sm:h-4 sm:w-4 mr-0.5 sm:mr-1" />
                                保管
                            </Button>
                        </div>
                    )}
                    {vehicleStatus === "archived" && (
                        <Button
                            size="sm"
                            variant="outline"
                            className="w-full text-[10px] sm:text-xs h-7 sm:h-8"
                            onClick={() => {
                                if (confirm("この車両を完成に戻しますか？")) {
                                    unarchiveMutation.mutate({ id: vehicleId });
                                }
                            }}
                        >
                            完成に戻す
                        </Button>
                    )}
                </div>
            )}

            {/* 注意ポイント追加ダイアログ */}
            {isAttentionPointDialogOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
                    <Card className="w-full max-w-md min-w-0 my-auto">
                        <CardHeader className="p-3 sm:p-4">
                            <CardTitle className="text-sm">注意ポイントを追加</CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 sm:p-4 space-y-3">
                            <div className="min-w-0">
                                <label className="text-xs font-medium block mb-1">注意ポイント *</label>
                                <textarea
                                    value={attentionPointContent}
                                    onChange={(e) => setAttentionPointContent(e.target.value)}
                                    placeholder="注意ポイントを入力してください"
                                    className="flex min-h-[100px] w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-2 py-1 text-xs"
                                    required
                                />
                            </div>
                            <div className="flex gap-2 pt-2">
                                <Button
                                    size="sm"
                                    className="flex-1 h-8 text-xs"
                                    onClick={() => {
                                        if (!attentionPointContent.trim()) {
                                            toast.error("注意ポイントを入力してください");
                                            return;
                                        }
                                        addAttentionPointMutation.mutate({
                                            vehicleId,
                                            content: attentionPointContent,
                                        });
                                        setIsAttentionPointDialogOpen(false);
                                        setAttentionPointContent("");
                                    }}
                                    disabled={addAttentionPointMutation.isPending}
                                >
                                    {addAttentionPointMutation.isPending ? "追加中..." : "追加"}
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="flex-1 h-8 text-xs"
                                    onClick={() => {
                                        setIsAttentionPointDialogOpen(false);
                                        setAttentionPointContent("");
                                    }}
                                >
                                    キャンセル
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* メモ追加ダイアログ */}
            {isMemoDialogOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
                    <Card className="w-full max-w-md min-w-0 my-auto">
                        <CardHeader className="p-3 sm:p-4">
                            <CardTitle className="text-sm">メモを追加</CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 sm:p-4 space-y-3">
                            <div className="min-w-0">
                                <label className="text-xs font-medium block mb-1">メモ *</label>
                                <textarea
                                    value={memoContent}
                                    onChange={(e) => setMemoContent(e.target.value)}
                                    placeholder="メモを入力してください"
                                    className="flex min-h-[100px] w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-2 py-1 text-xs"
                                    required
                                />
                            </div>
                            <div className="flex gap-2 pt-2">
                                <Button
                                    size="sm"
                                    className="flex-1 h-8 text-xs"
                                    onClick={() => {
                                        if (!memoContent.trim()) {
                                            toast.error("メモを入力してください");
                                            return;
                                        }
                                        addMemoMutation.mutate({
                                            vehicleId,
                                            content: memoContent,
                                        });
                                        setIsMemoDialogOpen(false);
                                        setMemoContent("");
                                    }}
                                    disabled={addMemoMutation.isPending}
                                >
                                    {addMemoMutation.isPending ? "追加中..." : "追加"}
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="flex-1 h-8 text-xs"
                                    onClick={() => {
                                        setIsMemoDialogOpen(false);
                                        setMemoContent("");
                                    }}
                                >
                                    キャンセル
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </CardContent>
    );
}

export default function Vehicles() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<"in_progress" | "completed" | "archived">("in_progress");
    const [searchQuery, setSearchQuery] = useState("");
    const [isRegisterDialogOpen, setIsRegisterDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isBroadcastDialogOpen, setIsBroadcastDialogOpen] = useState(false);
    const [broadcastingVehicleId, setBroadcastingVehicleId] = useState<number | null>(null);
    const [broadcastMessage, setBroadcastMessage] = useState("");
    const [editingVehicle, setEditingVehicle] = useState<any>(null);
    const [vehicleNumber, setVehicleNumber] = useState("");
    const [vehicleTypeId, setVehicleTypeId] = useState("");
    const [category, setCategory] = useState<"一般" | "キャンパー" | "中古" | "修理" | "クレーム">("キャンパー");
    const [customerName, setCustomerName] = useState("");
    const [desiredDeliveryDate, setDesiredDeliveryDate] = useState("");
    const [checkDueDate, setCheckDueDate] = useState("");
    const [reserveDate, setReserveDate] = useState("");
    const [reserveRound, setReserveRound] = useState("");
    const [hasCoating, setHasCoating] = useState<"yes" | "no" | "">("");
    const [hasLine, setHasLine] = useState<"yes" | "no" | "">("");
    const [hasPreferredNumber, setHasPreferredNumber] = useState<"yes" | "no" | "">("");
    const [hasTireReplacement, setHasTireReplacement] = useState<"summer" | "winter" | "no" | "">("");
    const [instructionSheetFile, setInstructionSheetFile] = useState<File | null>(null);
    const [outsourcing, setOutsourcing] = useState<Array<{ destination: string; startDate: string; endDate: string }>>([
        { destination: "", startDate: "", endDate: "" },
    ]);
    const { data: vehicles, refetch } = trpc.vehicles.list.useQuery({
        status: activeTab,
    });
    const { data: vehicleTypes } = trpc.vehicleTypes.list.useQuery();

    // 分数を「〜時間〜分」に整形
    const formatMinutes = (minutes: number | null | undefined) => {
        if (minutes == null || minutes <= 0) return "0分";
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        if (h === 0) return `${m}分`;
        if (m === 0) return `${h}時間`;
        return `${h}時間${m}分`;
    };

    const registerMutation = trpc.vehicles.create.useMutation({
        onSuccess: () => {
            toast.success("車両を登録しました");
            setIsRegisterDialogOpen(false);
            setVehicleNumber("");
            setVehicleTypeId("");
            setCategory("キャンパー");
            setCustomerName("");
            setDesiredDeliveryDate("");
            setCheckDueDate("");
            refetch();
        },
        onError: (error) => {
            toast.error(error.message || "車両の登録に失敗しました");
        },
    });

    const updateMutation = trpc.vehicles.update.useMutation({
        onSuccess: () => {
            toast.success("車両を更新しました");
            setIsEditDialogOpen(false);
            setEditingVehicle(null);
            setVehicleNumber("");
            setVehicleTypeId("");
            setCustomerName("");
            setDesiredDeliveryDate("");
            setCheckDueDate("");
            setInstructionSheetFile(null);
            setOutsourcing([{ destination: "", startDate: "", endDate: "" }]);
            refetch();
        },
        onError: (error: any) => {
            toast.error(error.message || "車両の更新に失敗しました");
        },
    });

    const uploadInstructionSheetMutation = trpc.vehicles.uploadInstructionSheet.useMutation({
        onSuccess: () => {
            toast.success("指示書をアップロードしました");
            setInstructionSheetFile(null);
            refetch();
        },
        onError: (error: any) => {
            toast.error(error.message || "指示書のアップロードに失敗しました");
        },
    });

    const completeMutation = trpc.vehicles.complete.useMutation({
        onSuccess: () => {
            toast.success("車両を完成にしました");
            refetch();
        },
        onError: (error: any) => {
            toast.error(error.message || "車両の完成処理に失敗しました");
        },
    });

    const uncompleteMutation = trpc.vehicles.uncomplete.useMutation({
        onSuccess: () => {
            toast.success("車両を作業中に戻しました");
            refetch();
        },
        onError: (error: any) => {
            toast.error(error.message || "車両の取り消し処理に失敗しました");
        },
    });

    const archiveMutation = trpc.vehicles.archive.useMutation({
        onSuccess: () => {
            toast.success("車両を保管にしました");
            refetch();
        },
        onError: (error: any) => {
            toast.error(error.message || "車両の保管処理に失敗しました");
        },
    });

    const unarchiveMutation = trpc.vehicles.unarchive.useMutation({
        onSuccess: () => {
            toast.success("車両を完成に戻しました");
            refetch();
        },
        onError: (error: any) => {
            toast.error(error.message || "車両の取り出し処理に失敗しました");
        },
    });

    const deleteMutation = trpc.vehicles.delete.useMutation({
        onSuccess: () => {
            toast.success("車両を削除しました");
            setIsEditDialogOpen(false);
            setEditingVehicle(null);
            refetch();
        },
        onError: (error: any) => {
            toast.error(error.message || "車両の削除に失敗しました");
        },
    });

    const createBroadcastMutation = trpc.salesBroadcasts.create.useMutation({
        onSuccess: () => {
            toast.success("拡散項目を送信しました");
            setIsBroadcastDialogOpen(false);
            setBroadcastingVehicleId(null);
            setBroadcastMessage("");
        },
        onError: (error: any) => {
            toast.error(error.message || "拡散項目の送信に失敗しました");
        },
    });

    const setVehicleOutsourcingMutation = trpc.vehicles.setVehicleOutsourcing.useMutation({
        onSuccess: () => {
            toast.success("外注先を更新しました");
            refetch();
        },
        onError: (error: any) => {
            toast.error(error.message || "外注先の更新に失敗しました");
        },
    });

    const getCategoryBadgeClass = (category?: string | null) => {
        switch (category) {
            case "キャンパー":
                return "bg-orange-500 text-white";
            case "一般":
                return "bg-blue-600 text-white";
            case "中古":
                return "bg-purple-600 text-white";
            case "修理":
                return "bg-red-600 text-white";
            case "クレーム":
                return "bg-gray-700 text-white";
            default:
                return "bg-gray-300 text-gray-900";
        }
    };

    const filteredVehicles = vehicles?.filter((vehicle) => {
        const query = searchQuery.toLowerCase();
        const vehicleTypeName =
            vehicleTypes?.find((vt) => vt.id === vehicle.vehicleTypeId)?.name || "";
        return (
            vehicle.vehicleNumber.toLowerCase().includes(query) ||
            (vehicle.customerName && vehicle.customerName.toLowerCase().includes(query)) ||
            vehicleTypeName.toLowerCase().includes(query)
        );
    });

    // ソートロジック：1. 「一般」カテゴリーを最上部に、2. 作業中で作業時間が多い車両を上に
    const sortedVehicles = filteredVehicles ? [...filteredVehicles].sort((a, b) => {
        // 1. 「一般」カテゴリーを最上部に
        const aIsGeneral = a.category === "一般";
        const bIsGeneral = b.category === "一般";
        if (aIsGeneral && !bIsGeneral) return -1;
        if (!aIsGeneral && bIsGeneral) return 1;

        // 2. 作業中で作業時間が多い車両を上に
        const aIsInProgress = a.status === "in_progress";
        const bIsInProgress = b.status === "in_progress";
        if (aIsInProgress && !bIsInProgress) return -1;
        if (!aIsInProgress && bIsInProgress) return 1;

        // 両方とも作業中の場合は、作業時間が多い順
        if (aIsInProgress && bIsInProgress) {
            const aWorkMinutes = a.totalWorkMinutes || 0;
            const bWorkMinutes = b.totalWorkMinutes || 0;
            return bWorkMinutes - aWorkMinutes;
        }

        // その他の場合は元の順序を維持
        return 0;
    }) : [];

    const handleRegister = () => {
        if (!vehicleTypeId) {
            toast.error("車種を入力してください");
            return;
        }

        registerMutation.mutate({
            vehicleNumber: vehicleNumber.trim() || undefined,
            vehicleTypeId: parseInt(vehicleTypeId),
            category,
            customerName: customerName || undefined,
            desiredDeliveryDate: desiredDeliveryDate ? new Date(desiredDeliveryDate) : undefined,
            checkDueDate: checkDueDate ? new Date(checkDueDate) : undefined,
            reserveDate: reserveDate ? new Date(reserveDate) : undefined,
            reserveRound: reserveRound || undefined,
            hasCoating: hasCoating || undefined,
            hasLine: hasLine || undefined,
            hasPreferredNumber: hasPreferredNumber || undefined,
            hasTireReplacement: hasTireReplacement || undefined,
        });
    };

    const handleEdit = (vehicle: any) => {
        setEditingVehicle(vehicle);
        setVehicleNumber(vehicle.vehicleNumber);
        setVehicleTypeId(vehicle.vehicleTypeId.toString());
        setCategory(vehicle.category || "キャンパー");
        setCustomerName(vehicle.customerName || "");
        setDesiredDeliveryDate(
            vehicle.desiredDeliveryDate
                ? format(new Date(vehicle.desiredDeliveryDate), "yyyy-MM-dd")
                : ""
        );
        setCheckDueDate(
            vehicle.checkDueDate
                ? format(new Date(vehicle.checkDueDate), "yyyy-MM-dd")
                : ""
        );
        setReserveDate(
            vehicle.reserveDate
                ? format(new Date(vehicle.reserveDate), "yyyy-MM-dd")
                : ""
        );
        setReserveRound(vehicle.reserveRound || "");
        setHasCoating(vehicle.hasCoating || "");
        setHasLine(vehicle.hasLine || "");
        setHasPreferredNumber(vehicle.hasPreferredNumber || "");
        setHasTireReplacement(vehicle.hasTireReplacement || "");
        // 外注先を取得（新しいAPIを使用）
        if (vehicle.outsourcing && vehicle.outsourcing.length > 0) {
            setOutsourcing(
                vehicle.outsourcing.map((o: any) => ({
                    destination: o.destination || "",
                    startDate: o.startDate ? format(new Date(o.startDate), "yyyy-MM-dd") : "",
                    endDate: o.endDate ? format(new Date(o.endDate), "yyyy-MM-dd") : "",
                }))
            );
        } else {
            // 後方互換性: 古いフィールドから移行
            setOutsourcing([
                {
                    destination: vehicle.outsourcingDestination || "",
                    startDate: vehicle.outsourcingStartDate
                        ? format(new Date(vehicle.outsourcingStartDate), "yyyy-MM-dd")
                        : "",
                    endDate: vehicle.outsourcingEndDate
                        ? format(new Date(vehicle.outsourcingEndDate), "yyyy-MM-dd")
                        : "",
                },
            ]);
        }
        setInstructionSheetFile(null);
        setIsEditDialogOpen(true);
    };

    const handleUpdate = () => {
        if (!vehicleNumber || !vehicleTypeId) {
            toast.error("車両番号と車種を入力してください");
            return;
        }

        const updateData: any = {
            id: editingVehicle.id,
            vehicleNumber,
            vehicleTypeId: parseInt(vehicleTypeId),
            category,
        };

        if (customerName) {
            updateData.customerName = customerName;
        }

        if (desiredDeliveryDate) {
            const date = new Date(desiredDeliveryDate);
            if (!isNaN(date.getTime())) {
                updateData.desiredDeliveryDate = date;
            }
        }

        if (checkDueDate) {
            const date = new Date(checkDueDate);
            if (!isNaN(date.getTime())) {
                updateData.checkDueDate = date;
            }
        }

        if (reserveDate) {
            const date = new Date(reserveDate);
            if (!isNaN(date.getTime())) {
                updateData.reserveDate = date;
            }
        }

        if (reserveRound) {
            updateData.reserveRound = reserveRound;
        }

        if (hasCoating) {
            updateData.hasCoating = hasCoating as "yes" | "no";
        }

        if (hasLine) {
            updateData.hasLine = hasLine as "yes" | "no";
        }

        if (hasPreferredNumber) {
            updateData.hasPreferredNumber = hasPreferredNumber as "yes" | "no";
        }

        if (hasTireReplacement) {
            updateData.hasTireReplacement = hasTireReplacement as "summer" | "winter" | "no";
        }

        updateMutation.mutate(updateData);

        // 外注先を別途更新（最大2個）
        const validOutsourcing = outsourcing
            .filter((o) => o.destination.trim() !== "")
            .slice(0, 2) // 最大2個
            .map((o) => ({
                destination: o.destination.trim(),
                startDate: o.startDate ? new Date(o.startDate) : undefined,
                endDate: o.endDate ? new Date(o.endDate) : undefined,
            }));

        if (validOutsourcing.length > 0 || outsourcing.some((o) => o.destination.trim() !== "")) {
            setVehicleOutsourcingMutation.mutate({
                vehicleId: editingVehicle.id,
                outsourcing: validOutsourcing,
            });
        }

        // 指示書ファイルが選択されている場合はアップロード
        if (instructionSheetFile && editingVehicle) {
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = reader.result as string;
                const fileType = instructionSheetFile.type;
                if (fileType === "image/jpeg" || fileType === "image/jpg" || fileType === "application/pdf") {
                    uploadInstructionSheetMutation.mutate({
                        vehicleId: editingVehicle.id,
                        fileData: base64,
                        fileName: instructionSheetFile.name,
                        fileType: fileType as "image/jpeg" | "image/jpg" | "application/pdf",
                    });
                } else {
                    toast.error("PDFまたはJPGファイルを選択してください");
                }
            };
            reader.readAsDataURL(instructionSheetFile);
        }
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
                        車両管理
                    </h1>
                    <p 
                        className="mt-2 text-sm sm:text-base"
                        style={{ color: happyHuesColors.paragraph, opacity: 0.8 }}
                    >
                        車両の一覧、登録、編集を行います
                    </p>
                </div>
                <Button onClick={() => setIsRegisterDialogOpen(true)} className="w-full sm:w-auto">
                    <Plus className="h-4 w-4 mr-2" />
                    車両登録
                </Button>
            </div>

            {/* 検索 */}
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                    <Input
                        placeholder="車両番号、お客様名、車種で検索..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
            </div>

            {/* タブ */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                <TabsList className="w-full grid grid-cols-3">
                    <TabsTrigger value="in_progress" className="text-xs sm:text-sm">作業中</TabsTrigger>
                    <TabsTrigger value="completed" className="text-xs sm:text-sm">完成</TabsTrigger>
                    <TabsTrigger value="archived" className="text-xs sm:text-sm">保管</TabsTrigger>
                </TabsList>

                <TabsContent value={activeTab} className="mt-4">
                    {sortedVehicles && sortedVehicles.length > 0 ? (
                        // 画面幅が中途半端なときにカードが細くなりすぎないよう、3列表示はより広い画面のみ
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6 w-full">
                            {sortedVehicles.map((vehicle) => (
                                <Card key={vehicle.id} className="overflow-hidden w-full max-w-full card-md-static">
                                    <CardHeader className="p-4 sm:p-5 md:p-6 bg-gradient-to-r from-[hsl(var(--google-blue-50))] to-[hsl(var(--google-indigo-50))] border-b-2 border-[hsl(var(--google-blue-200))]">
                                        <div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-4">
                                            <div className="flex-1 min-w-0 w-full sm:w-auto">
                                                <div className="mb-2 sm:mb-3">
                                                    <CardTitle className="text-xl sm:text-2xl md:text-3xl font-black leading-tight break-words mb-1 sm:mb-2 text-black tracking-tight">
                                                        {vehicle.vehicleNumber}
                                                    </CardTitle>
                                                    <p className="text-xs sm:text-sm text-black opacity-60 font-mono leading-tight">
                                                        ID: {vehicle.id}
                                                    </p>
                                                </div>
                                                {vehicle.customerName && (
                                                    <p
                                                        className="text-sm sm:text-base md:text-lg font-semibold text-black mb-2 sm:mb-3 leading-snug break-words"
                                                        title={vehicle.customerName}
                                                    >
                                                        {
                                                            // 改行をスペースに変換して、縦にバラバラにならないようにする
                                                            vehicle.customerName.replace(/[\r\n]+/g, " ")
                                                        }
                                                    </p>
                                                )}
                                                <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                                                    <span className="inline-flex items-center max-w-full px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium bg-white text-black border-2 border-[hsl(var(--google-gray-300))] break-words shadow-sm">
                                                        {vehicleTypes?.find((vt) => vt.id === vehicle.vehicleTypeId)?.name || "不明"}
                                                    </span>
                                                    {vehicle.category && (
                                                        <span
                                                            className={`inline-flex items-center max-w-full px-3 py-1.5 rounded-md text-xs sm:text-sm font-semibold break-words shadow-sm ${getCategoryBadgeClass(
                                                                vehicle.category
                                                            )}`}
                                                        >
                                                            {vehicle.category}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end sm:items-start gap-2 sm:gap-3 flex-shrink-0 w-full sm:w-auto">
                                                <div className="flex flex-col gap-1 w-full sm:w-auto">
                                                    <Link href="/vehicle-checks" className="w-full sm:w-auto">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-6 px-2 text-[11px] w-full sm:w-auto btn-md-outlined"
                                                            title="車両チェック"
                                                        >
                                                            <ClipboardCheck className="h-2.5 w-2.5 mr-1" />
                                                            チェック
                                                        </Button>
                                                    </Link>
                                                    {(user?.role === "admin" || user?.role === "sub_admin") && (
                                                        <>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handleEdit(vehicle)}
                                                                className="h-6 w-full sm:w-auto px-2 text-[11px] btn-md-outlined"
                                                                title="編集"
                                                            >
                                                                <Edit className="h-2.5 w-2.5 mr-1" />
                                                                編集
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => {
                                                                    setBroadcastingVehicleId(vehicle.id);
                                                                    setBroadcastMessage("");
                                                                    setIsBroadcastDialogOpen(true);
                                                                }}
                                                                className="h-6 px-2 text-[11px] w-full sm:w-auto btn-md-outlined"
                                                                title="拡散項目"
                                                            >
                                                                拡散項目
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                                {(typeof (vehicle as any).totalWorkMinutes === "number" ||
                                                    typeof vehicle.targetTotalMinutes === "number") && (
                                                        <div className="text-right sm:text-left text-sm sm:text-base text-black leading-snug">
                                                            <div className="font-medium mb-1">
                                                                合計作業時間:
                                                            </div>
                                                            <div>
                                                                <span className="text-xl sm:text-2xl font-bold text-[hsl(var(--google-blue-600))]">
                                                                    {formatMinutes((vehicle as any).totalWorkMinutes)}
                                                                </span>
                                                            </div>
                                                            <div className="mt-2 font-medium">
                                                                目標:
                                                            </div>
                                                            <div>
                                                                <span className="text-xl sm:text-2xl font-bold text-black">
                                                                    {vehicle.targetTotalMinutes
                                                                        ? formatMinutes(vehicle.targetTotalMinutes as any)
                                                                        : "未設定"}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )}
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-4 sm:p-5 md:p-6 space-y-4 sm:space-y-5 bg-white">
                                        {/* 基本情報セクション */}
                                        <div className="space-y-3 sm:space-y-4">
                                            <div className="grid grid-cols-1 gap-3 sm:gap-4">
                                                {vehicle.desiredDeliveryDate && (
                                                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 bg-[hsl(var(--google-gray-50))] rounded-lg">
                                                        <span className="text-xs sm:text-sm font-semibold text-black opacity-70 sm:min-w-[100px]">
                                                            希望納期:
                                                        </span>
                                                        <span className="text-sm sm:text-base font-bold text-black">
                                                            {format(new Date(vehicle.desiredDeliveryDate), "yyyy年MM月dd日")}
                                                        </span>
                                                    </div>
                                                )}
                                                {vehicle.checkDueDate && (
                                                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 bg-[hsl(var(--google-orange-50))] rounded-lg border-l-4 border-[hsl(var(--google-orange-500))]">
                                                        <span className="text-xs sm:text-sm font-semibold text-black opacity-70 sm:min-w-[100px]">
                                                            チェック期限:
                                                        </span>
                                                        <span className="text-sm sm:text-base font-bold text-[hsl(var(--google-orange-700))]">
                                                            {format(new Date(vehicle.checkDueDate), "yyyy年MM月dd日")}
                                                        </span>
                                                    </div>
                                                )}
                                                {vehicle.reserveDate && (
                                                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 bg-[hsl(var(--google-gray-50))] rounded-lg">
                                                        <span className="text-xs sm:text-sm font-semibold text-black opacity-70 sm:min-w-[100px]">
                                                            予備権:
                                                        </span>
                                                        <span className="text-sm sm:text-base font-bold text-black">
                                                            {format(new Date(vehicle.reserveDate), "yyyy年MM月dd日")}
                                                            {vehicle.reserveRound && (
                                                                <span className="ml-2 px-2 py-1 bg-[hsl(var(--google-blue-100))] text-[hsl(var(--google-blue-700))] rounded-md text-xs sm:text-sm font-semibold">
                                                                    {vehicle.reserveRound}
                                                                </span>
                                                            )}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* 外注情報 */}
                                        {vehicle.outsourcing && vehicle.outsourcing.length > 0 && (
                                            <div className="pt-4 border-t-2 border-[hsl(var(--google-gray-200))]">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <span className="text-sm sm:text-base font-bold text-black">外注情報:</span>
                                                </div>
                                                <div className="flex flex-col gap-3">
                                                    {vehicle.outsourcing.map((o: any, index: number) => (
                                                        <div key={o.id || index} className="flex flex-wrap gap-2 p-3 bg-[hsl(var(--google-purple-50))] rounded-lg border-l-4 border-[hsl(var(--google-purple-500))]">
                                                            {o.destination && (
                                                                <span className="inline-flex items-center px-3 py-1.5 rounded-md text-xs sm:text-sm font-semibold bg-white text-[hsl(var(--google-purple-700))] border-2 border-[hsl(var(--google-purple-300))] break-words shadow-sm">
                                                                    先: {o.destination}
                                                                </span>
                                                            )}
                                                            {o.startDate && o.endDate && (
                                                                <span className="inline-flex items-center px-3 py-1.5 rounded-md text-xs sm:text-sm font-semibold bg-white text-[hsl(var(--google-indigo-700))] border-2 border-[hsl(var(--google-indigo-300))] whitespace-nowrap shadow-sm">
                                                                    {format(new Date(o.startDate), "yyyy/MM/dd")} - {format(new Date(o.endDate), "yyyy/MM/dd")}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {/* 後方互換性: 古いフィールドを表示 */}
                                        {(!vehicle.outsourcing || vehicle.outsourcing.length === 0) &&
                                            (vehicle.outsourcingDestination || vehicle.outsourcingStartDate || vehicle.outsourcingEndDate) && (
                                                <div className="pt-2 border-t">
                                                    <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
                                                        <span className="text-[10px] sm:text-xs font-semibold text-gray-700">外注情報:</span>
                                                    </div>
                                                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                                                        {vehicle.outsourcingDestination && (
                                                            <span className="inline-flex items-center px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md text-[10px] sm:text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200 break-words">
                                                                外注先: {vehicle.outsourcingDestination}
                                                            </span>
                                                        )}
                                                        {vehicle.outsourcingStartDate && vehicle.outsourcingEndDate && (
                                                            <span className="inline-flex items-center px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md text-[10px] sm:text-xs font-medium bg-indigo-100 text-indigo-800 border border-indigo-200 whitespace-nowrap">
                                                                {format(new Date(vehicle.outsourcingStartDate), "yyyy/MM/dd")} - {format(new Date(vehicle.outsourcingEndDate), "yyyy/MM/dd")}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                        {/* オプション情報バッジ */}
                                        {(vehicle.hasCoating || vehicle.hasLine || vehicle.hasPreferredNumber || vehicle.hasTireReplacement) && (
                                            <div className="flex flex-wrap gap-2 sm:gap-3 pt-4 border-t-2 border-[hsl(var(--google-gray-200))]">
                                                {vehicle.hasCoating && (
                                                    <span className="inline-flex items-center px-3 py-1.5 rounded-md text-xs sm:text-sm font-semibold bg-[hsl(var(--google-blue-100))] text-[hsl(var(--google-blue-700))] border-2 border-[hsl(var(--google-blue-300))] shadow-sm">
                                                        外壁仕上げ{vehicle.hasCoating === "yes" ? "あり" : "なし"}
                                                    </span>
                                                )}
                                                {vehicle.hasLine && (
                                                    <span className="inline-flex items-center px-3 py-1.5 rounded-md text-xs sm:text-sm font-semibold bg-[hsl(var(--google-green-100))] text-[hsl(var(--google-green-700))] border-2 border-[hsl(var(--google-green-300))] shadow-sm">
                                                        内装仕様{vehicle.hasLine === "yes" ? "あり" : "なし"}
                                                    </span>
                                                )}
                                                {vehicle.hasPreferredNumber && (
                                                    <span className="inline-flex items-center px-3 py-1.5 rounded-md text-xs sm:text-sm font-semibold bg-[hsl(var(--google-purple-100))] text-[hsl(var(--google-purple-700))] border-2 border-[hsl(var(--google-purple-300))] shadow-sm">
                                                        特別仕様{vehicle.hasPreferredNumber === "yes" ? "あり" : "なし"}
                                                    </span>
                                                )}
                                                {vehicle.hasTireReplacement && (
                                                    <span className="inline-flex items-center px-3 py-1.5 rounded-md text-xs sm:text-sm font-semibold bg-[hsl(var(--google-orange-100))] text-[hsl(var(--google-orange-700))] border-2 border-[hsl(var(--google-orange-300))] shadow-sm">
                                                        完成時期
                                                        {vehicle.hasTireReplacement === "summer"
                                                            ? "（早期完成）"
                                                            : vehicle.hasTireReplacement === "winter"
                                                                ? "（遅延予定）"
                                                                : "（通常）"}
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                    </CardContent>

                                    <VehicleDetailContent
                                        vehicleId={vehicle.id}
                                        user={user}
                                        vehicleStatus={vehicle.status}
                                        completeMutation={completeMutation}
                                        archiveMutation={archiveMutation}
                                        uncompleteMutation={uncompleteMutation}
                                        unarchiveMutation={unarchiveMutation}
                                    />
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-[hsl(var(--muted-foreground))]">
                            車両が見つかりません
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {/* 車両登録ダイアログ */}
            {
                isRegisterDialogOpen && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <Card className="w-full max-w-md mx-4">
                            <CardHeader>
                                <CardTitle>車両登録</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium">車両番号（自動生成されます）</label>
                                    <Input
                                        value={vehicleNumber}
                                        onChange={(e) => setVehicleNumber(e.target.value)}
                                        placeholder="未入力の場合は自動生成（例: 2025-28）"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        未入力の場合、年ごとの連番が自動生成されます（例: 2025-28, 2026-1）
                                    </p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium">車種 *</label>
                                    <select
                                        className="flex h-10 w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                                        value={vehicleTypeId}
                                        onChange={(e) => setVehicleTypeId(e.target.value)}
                                        required
                                    >
                                        <option value="">選択してください</option>
                                        {vehicleTypes?.map((vt) => (
                                            <option key={vt.id} value={vt.id}>
                                                {vt.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium">お客様名</label>
                                    <Input
                                        value={customerName}
                                        onChange={(e) => setCustomerName(e.target.value)}
                                        placeholder="お客様名を入力"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium">希望納期</label>
                                    <Input
                                        type="date"
                                        value={desiredDeliveryDate}
                                        onChange={(e) => setDesiredDeliveryDate(e.target.value)}
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        className="flex-1"
                                        onClick={handleRegister}
                                        disabled={registerMutation.isPending}
                                    >
                                        登録
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="flex-1"
                                        onClick={() => {
                                            setIsRegisterDialogOpen(false);
                                            setVehicleNumber("");
                                            setVehicleTypeId("");
                                            setCategory("一般");
                                            setCustomerName("");
                                            setDesiredDeliveryDate("");
                                        }}
                                    >
                                        キャンセル
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )
            }

            {/* 車両編集ダイアログ */}
            {
                isEditDialogOpen && editingVehicle && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
                        <Card className="w-full max-w-md min-w-0 my-auto max-h-[90vh] flex flex-col">
                            <CardHeader className="p-3 sm:p-4 md:p-6 flex-shrink-0">
                                <CardTitle className="text-base sm:text-lg md:text-xl">車両編集</CardTitle>
                            </CardHeader>
                            <CardContent className="p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4 overflow-y-auto flex-1">
                                <div className="min-w-0">
                                    <label className="text-sm font-medium block mb-1">車両番号 *</label>
                                    <Input
                                        value={vehicleNumber}
                                        onChange={(e) => setVehicleNumber(e.target.value)}
                                        placeholder="例: ABC-001"
                                        required
                                        className="w-full min-w-0"
                                    />
                                </div>
                                <div className="min-w-0">
                                    <label className="text-sm font-medium block mb-1">車種 *</label>
                                    <select
                                        className="flex h-10 w-full min-w-0 rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                                        value={vehicleTypeId}
                                        onChange={(e) => setVehicleTypeId(e.target.value)}
                                        required
                                    >
                                        <option value="">選択してください</option>
                                        {vehicleTypes?.map((vt) => (
                                            <option key={vt.id} value={vt.id}>
                                                {vt.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="min-w-0">
                                    <label className="text-sm font-medium block mb-1">区分 *</label>
                                    <select
                                        className="flex h-10 w-full min-w-0 rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value as any)}
                                        required
                                    >
                                        <option value="キャンパー">キャンパー</option>
                                        <option value="一般">一般</option>
                                        <option value="中古">中古</option>
                                        <option value="修理">修理</option>
                                        <option value="クレーム">クレーム</option>
                                    </select>
                                </div>
                                <div className="min-w-0">
                                    <label className="text-sm font-medium block mb-1">お客様名</label>
                                    <Input
                                        value={customerName}
                                        onChange={(e) => setCustomerName(e.target.value)}
                                        placeholder="お客様名を入力"
                                        className="w-full min-w-0"
                                    />
                                </div>
                                <div className="min-w-0">
                                    <label className="text-sm font-medium block mb-1">希望納期</label>
                                    <Input
                                        type="date"
                                        value={desiredDeliveryDate}
                                        onChange={(e) => setDesiredDeliveryDate(e.target.value)}
                                        className="w-full min-w-0"
                                    />
                                </div>
                                <div className="min-w-0">
                                    <label className="text-sm font-medium block mb-1">チェック期限</label>
                                    <Input
                                        type="date"
                                        value={checkDueDate}
                                        onChange={(e) => setCheckDueDate(e.target.value)}
                                        className="w-full min-w-0"
                                    />
                                </div>
                                <div className="min-w-0">
                                    <label className="text-sm font-medium block mb-1">予備権の日付</label>
                                    <Input
                                        type="date"
                                        value={reserveDate}
                                        onChange={(e) => setReserveDate(e.target.value)}
                                        className="w-full min-w-0"
                                    />
                                </div>
                                <div className="min-w-0">
                                    <label className="text-sm font-medium block mb-1">予備権のR</label>
                                    <Input
                                        value={reserveRound}
                                        onChange={(e) => setReserveRound(e.target.value)}
                                        placeholder="例: 1R, 2R"
                                        className="w-full min-w-0"
                                    />
                                </div>
                                <div className="min-w-0">
                                    <label className="text-sm font-medium block mb-1">外壁仕上げ</label>
                                    <select
                                        className="flex h-10 w-full min-w-0 rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                                        value={hasCoating}
                                        onChange={(e) => setHasCoating(e.target.value as "yes" | "no" | "")}
                                    >
                                        <option value="">選択してください</option>
                                        <option value="yes">あり</option>
                                        <option value="no">なし</option>
                                    </select>
                                </div>
                                <div className="min-w-0">
                                    <label className="text-sm font-medium block mb-1">内装仕様</label>
                                    <select
                                        className="flex h-10 w-full min-w-0 rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                                        value={hasLine}
                                        onChange={(e) => setHasLine(e.target.value as "yes" | "no" | "")}
                                    >
                                        <option value="">選択してください</option>
                                        <option value="yes">あり</option>
                                        <option value="no">なし</option>
                                    </select>
                                </div>
                                <div className="min-w-0">
                                    <label className="text-sm font-medium block mb-1">特別仕様</label>
                                    <select
                                        className="flex h-10 w-full min-w-0 rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                                        value={hasPreferredNumber}
                                        onChange={(e) => setHasPreferredNumber(e.target.value as "yes" | "no" | "")}
                                    >
                                        <option value="">選択してください</option>
                                        <option value="yes">あり</option>
                                        <option value="no">なし</option>
                                    </select>
                                </div>
                                <div className="min-w-0">
                                    <label className="text-sm font-medium block mb-1">完成時期</label>
                                    <select
                                        className="flex h-10 w-full min-w-0 rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                                        value={hasTireReplacement}
                                        onChange={(e) => setHasTireReplacement(e.target.value as "summer" | "winter" | "no" | "")}
                                    >
                                        <option value="">選択してください</option>
                                        <option value="summer">早期完成</option>
                                        <option value="winter">遅延予定</option>
                                        <option value="no">通常</option>
                                    </select>
                                </div>
                                {user?.role === "admin" && (
                                    <div className="min-w-0">
                                        <label className="text-sm font-medium block mb-1">指示書（PDF/JPG）</label>
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                            <Input
                                                type="file"
                                                accept=".pdf,.jpg,.jpeg"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        setInstructionSheetFile(file);
                                                    }
                                                }}
                                                className="w-full min-w-0"
                                            />
                                            {editingVehicle?.instructionSheetUrl && (
                                                <a
                                                    href={editingVehicle.instructionSheetUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-xs text-blue-600 hover:text-blue-800 underline"
                                                >
                                                    現在の指示書を表示
                                                </a>
                                            )}
                                        </div>
                                        <p className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))] leading-snug">
                                            サーバーの入れ替えや再デプロイの際に、アップロード済みの指示書ファイルが
                                            消えてしまう場合があります。その場合は、お手数ですがここから
                                            再度アップロードしてください。
                                        </p>
                                    </div>
                                )}
                                <div className="min-w-0 space-y-3">
                                    <label className="text-sm font-medium block mb-2">外注先（最大2個）</label>
                                    {outsourcing.map((o, index) => (
                                        <div key={index} className="space-y-2 p-3 border border-[hsl(var(--border))] rounded-lg">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
                                                    外注先 {index + 1}
                                                </span>
                                                {index > 0 && (
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => {
                                                            setOutsourcing(outsourcing.filter((_, i) => i !== index));
                                                        }}
                                                        className="h-6 px-2 text-xs text-red-600 hover:text-red-800"
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                        削除
                                                    </Button>
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <label className="text-xs font-medium block mb-1">外注先</label>
                                                <Input
                                                    value={o.destination}
                                                    onChange={(e) => {
                                                        const newOutsourcing = [...outsourcing];
                                                        newOutsourcing[index].destination = e.target.value;
                                                        setOutsourcing(newOutsourcing);
                                                    }}
                                                    placeholder="外注先を入力"
                                                    className="w-full min-w-0"
                                                />
                                            </div>
                                            <div className="min-w-0">
                                                <label className="text-xs font-medium block mb-1">外注開始日</label>
                                                <Input
                                                    type="date"
                                                    value={o.startDate}
                                                    onChange={(e) => {
                                                        const newOutsourcing = [...outsourcing];
                                                        newOutsourcing[index].startDate = e.target.value;
                                                        setOutsourcing(newOutsourcing);
                                                    }}
                                                    className="w-full min-w-0"
                                                />
                                            </div>
                                            <div className="min-w-0">
                                                <label className="text-xs font-medium block mb-1">外注終了日</label>
                                                <Input
                                                    type="date"
                                                    value={o.endDate}
                                                    onChange={(e) => {
                                                        const newOutsourcing = [...outsourcing];
                                                        newOutsourcing[index].endDate = e.target.value;
                                                        setOutsourcing(newOutsourcing);
                                                    }}
                                                    className="w-full min-w-0"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                    {outsourcing.length < 2 && (
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                                setOutsourcing([...outsourcing, { destination: "", startDate: "", endDate: "" }]);
                                            }}
                                            className="w-full text-xs"
                                        >
                                            <Plus className="h-3 w-3 mr-1" />
                                            外注先を追加
                                        </Button>
                                    )}
                                </div>
                                <div className="flex flex-col gap-2 pt-2 flex-shrink-0">
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <Button
                                            className="flex-1 w-full sm:w-auto"
                                            onClick={handleUpdate}
                                            disabled={updateMutation.isPending}
                                        >
                                            更新
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="flex-1 w-full sm:w-auto"
                                            onClick={() => {
                                                setIsEditDialogOpen(false);
                                                setEditingVehicle(null);
                                                setVehicleNumber("");
                                                setVehicleTypeId("");
                                                setCustomerName("");
                                                setDesiredDeliveryDate("");
                                                setCheckDueDate("");
                                                setReserveDate("");
                                                setReserveRound("");
                                                setHasCoating("");
                                                setHasLine("");
                                                setHasPreferredNumber("");
                                                setHasTireReplacement("");
                                                setOutsourcing([{ destination: "", startDate: "", endDate: "" }]);
                                            }}
                                        >
                                            キャンセル
                                        </Button>
                                    </div>
                                    {user?.role === "admin" && (
                                        <Button
                                            variant="destructive"
                                            className="w-full text-xs"
                                            onClick={() => {
                                                if (!editingVehicle) return;
                                                if (
                                                    window.confirm(
                                                        "この車両を削除すると元に戻せません。消せないですけど大丈夫ですか？"
                                                    )
                                                ) {
                                                    deleteMutation.mutate({ id: editingVehicle.id });
                                                }
                                            }}
                                            disabled={deleteMutation.isPending}
                                        >
                                            車両を削除
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )
            }

            {/* 拡散項目ダイアログ */}
            {
                isBroadcastDialogOpen && broadcastingVehicleId && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
                        <Card className="w-full max-w-md min-w-0 my-auto">
                            <CardHeader className="p-3 sm:p-4 md:p-6">
                                <CardTitle className="text-base sm:text-lg md:text-xl">拡散項目</CardTitle>
                            </CardHeader>
                            <CardContent className="p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4">
                                <div className="min-w-0">
                                    <label className="text-sm font-medium block mb-1">コメント *</label>
                                    <textarea
                                        value={broadcastMessage}
                                        onChange={(e) => setBroadcastMessage(e.target.value)}
                                        placeholder="全員に通知するコメントを入力してください"
                                        className="flex min-h-[120px] w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                                        required
                                    />
                                    <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                                        このコメントは全員のダッシュボードに通知されます。一週間後に自動で削除されます。
                                    </p>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                                    <Button
                                        className="flex-1 w-full sm:w-auto"
                                        onClick={() => {
                                            if (!broadcastMessage.trim()) {
                                                toast.error("コメントを入力してください");
                                                return;
                                            }
                                            createBroadcastMutation.mutate({
                                                vehicleId: broadcastingVehicleId,
                                                message: broadcastMessage,
                                            });
                                        }}
                                        disabled={createBroadcastMutation.isPending}
                                    >
                                        {createBroadcastMutation.isPending ? "送信中..." : "送信"}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="flex-1 w-full sm:w-auto"
                                        onClick={() => {
                                            setIsBroadcastDialogOpen(false);
                                            setBroadcastingVehicleId(null);
                                            setBroadcastMessage("");
                                        }}
                                    >
                                        キャンセル
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )
            }
        </div >
    );
}

