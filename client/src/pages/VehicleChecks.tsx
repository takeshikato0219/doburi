import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { trpc } from "../lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Check, AlertCircle, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Link } from "wouter";
import { happyHuesColors, happyHuesStyles } from "../styles/happyHues";

const CATEGORIES = ["一般", "キャンパー", "中古", "修理", "クレーム"] as const;

// チェック依頼ダイアログコンポーネント
function CheckRequestDialog({
    vehicleId,
    checkItemId,
    users,
    requestedToUserId,
    setRequestedToUserId,
    requestDueDate,
    setRequestDueDate,
    requestMessage,
    setRequestMessage,
    onSubmit,
    onCancel,
    isPending,
}: {
    vehicleId: number;
    checkItemId?: number;
    users: any[];
    requestedToUserId: string;
    setRequestedToUserId: (value: string) => void;
    requestDueDate: string;
    setRequestDueDate: (value: string) => void;
    requestMessage: string;
    setRequestMessage: (value: string) => void;
    onSubmit: (selectedCheckItemId?: number) => void;
    onCancel: () => void;
    isPending: boolean;
}) {
    const { data: checkData } = trpc.checks.getVehicleChecks.useQuery({
        vehicleId,
    });

    const checkItems = checkData?.checkStatus?.map((s: any) => s.checkItem) || [];
    const [selectedCheckItemId, setSelectedCheckItemId] = useState<string>(
        checkItemId ? checkItemId.toString() : ""
    );

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
            <Card className="w-full max-w-md min-w-0 my-auto">
                <CardHeader className="p-3 sm:p-4 md:p-6">
                    <CardTitle className="text-base sm:text-lg md:text-xl">チェック依頼</CardTitle>
                </CardHeader>
                <CardContent className="p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4">
                    <div className="min-w-0">
                        <label className="text-sm font-medium block mb-1">チェック項目 *</label>
                        <select
                            className="flex h-10 w-full min-w-0 rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-2 sm:px-3 py-2 text-sm"
                            value={selectedCheckItemId}
                            onChange={(e) => setSelectedCheckItemId(e.target.value)}
                            disabled={!!checkItemId}
                        >
                            <option value="">選択してください</option>
                            {checkItems.map((item: any) => (
                                <option key={item.id} value={item.id}>
                                    {item.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="min-w-0">
                        <label className="text-sm font-medium block mb-1">依頼先ユーザー *</label>
                        <select
                            className="flex h-10 w-full min-w-0 rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-2 sm:px-3 py-2 text-sm"
                            value={requestedToUserId}
                            onChange={(e) => setRequestedToUserId(e.target.value)}
                        >
                            <option value="">選択してください</option>
                            {users.map((u) => (
                                <option key={u.id} value={u.id}>
                                    {u.name || u.username}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="min-w-0">
                        <label className="text-sm font-medium block mb-1">期限日（任意）</label>
                        <Input
                            type="date"
                            value={requestDueDate}
                            onChange={(e) => setRequestDueDate(e.target.value)}
                            className="w-full min-w-0"
                        />
                    </div>
                    <div className="min-w-0">
                        <label className="text-sm font-medium block mb-1">メッセージ（任意）</label>
                        <Input
                            value={requestMessage}
                            onChange={(e) => setRequestMessage(e.target.value)}
                            placeholder="依頼メッセージを入力"
                            className="w-full min-w-0"
                        />
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 pt-2">
                        <Button
                            className="flex-1 w-full sm:w-auto"
                            onClick={() => {
                                const itemIdToUse = checkItemId || (selectedCheckItemId ? parseInt(selectedCheckItemId) : undefined);
                                if (!itemIdToUse) {
                                    toast.error("チェック項目を選択してください");
                                    return;
                                }
                                onSubmit(itemIdToUse);
                            }}
                            disabled={isPending}
                        >
                            依頼送信
                        </Button>
                        <Button variant="outline" className="flex-1 w-full sm:w-auto" onClick={onCancel}>
                            キャンセル
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

// 車両チェックカードコンポーネント
function VehicleCheckCard({
    vehicle,
    onCheck,
    onRequestCheck,
    onCheckAll,
    isAdmin,
    pendingRequests,
}: {
    vehicle: any;
    onCheck: (vehicleId: number, itemId: number, status: "checked" | "needs_recheck" | "unchecked", notes?: string) => void;
    onRequestCheck: (vehicleId: number, checkItemId?: number) => void;
    onCheckAll: (vehicleId: number, itemIds: number[]) => void;
    isAdmin: boolean;
    pendingRequests: any[];
}) {
    const { data: checkData } = trpc.checks.getVehicleChecks.useQuery({
        vehicleId: vehicle.id,
    });

    const pendingRequestsForVehicle = pendingRequests.filter((req) => req.vehicleId === vehicle.id);

    // 未チェック項目のIDリスト
    const uncheckedItemIds = checkData?.checkStatus
        ?.filter((s: any) => s.status === "unchecked")
        .map((s: any) => s.checkItem.id) || [];

    return (
        <Card>
            <CardHeader className="p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex-1 min-w-0">
                        <CardTitle className="text-base sm:text-lg truncate">{vehicle.vehicleNumber}</CardTitle>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                            {vehicle.category && (
                                <span className="inline-block px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                                    {vehicle.category}
                                </span>
                            )}
                            {vehicle.customerName && (
                                <span className="text-xs sm:text-sm text-[hsl(var(--muted-foreground))]">
                                    {vehicle.customerName}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                        {uncheckedItemIds.length > 0 && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onCheckAll(vehicle.id, uncheckedItemIds)}
                                className="w-full sm:w-auto text-sm h-9 touch-manipulation"
                                style={{ touchAction: 'manipulation' }}
                            >
                                車両にチェック
                            </Button>
                        )}
                        {isAdmin && (
                            <>
                                <Button 
                                    size="sm" 
                                    variant="outline" 
                                    onClick={() => onRequestCheck(vehicle.id)}
                                    className="w-full sm:w-auto text-sm h-9 touch-manipulation"
                                    style={{ touchAction: 'manipulation' }}
                                >
                                    <UserPlus className="h-4 w-4 mr-2" />
                                    依頼
                                </Button>
                            </>
                        )}
                    </div>
                </div>
                {pendingRequestsForVehicle.length > 0 && (
                    <div className="flex items-center gap-2 text-orange-600 text-xs sm:text-sm mt-2">
                        <AlertCircle className="h-4 w-4" />
                        <span>チェック依頼あり</span>
                    </div>
                )}
            </CardHeader>
            <CardContent className="p-3 sm:p-4">
                {checkData && checkData.checkStatus && checkData.checkStatus.length > 0 ? (
                    <div className="space-y-2">
                        {[...checkData.checkStatus].sort((a: any, b: any) => {
                            // チェック済み（checked）を下に、それ以外を上に
                            if (a.status === "checked" && b.status !== "checked") return 1;
                            if (a.status !== "checked" && b.status === "checked") return -1;
                            // 要再チェック（needs_recheck）を未チェック（unchecked）より上に
                            if (a.status === "needs_recheck" && b.status === "unchecked") return -1;
                            if (a.status === "unchecked" && b.status === "needs_recheck") return 1;
                            return 0;
                        }).map((status: any) => {
                            const getStatusLabel = (statusValue: string) => {
                                switch (statusValue) {
                                    case "checked":
                                        return "チェック済み";
                                    case "needs_recheck":
                                        return "要再チェック";
                                    case "unchecked":
                                    default:
                                        return "未チェック";
                                }
                            };

                            const getStatusColor = (statusValue: string) => {
                                switch (statusValue) {
                                    case "checked":
                                        return "bg-green-50 border-green-200";
                                    case "needs_recheck":
                                        return "bg-orange-50 border-orange-200";
                                    case "unchecked":
                                    default:
                                        return "bg-gray-50 border-gray-200";
                                }
                            };

                            const getStatusIcon = (statusValue: string) => {
                                switch (statusValue) {
                                    case "checked":
                                        return <Check className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0 mt-0.5" />;
                                    case "needs_recheck":
                                        return <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600 flex-shrink-0 mt-0.5" />;
                                    case "unchecked":
                                    default:
                                        return <div className="h-4 w-4 sm:h-5 sm:w-5 border-2 border-gray-300 rounded flex-shrink-0 mt-0.5" />;
                                }
                            };

                            return (
                                <div
                                    key={status.checkItem.id}
                                    className={`p-3 sm:p-4 border rounded-lg ${getStatusColor(status.status)}`}
                                >
                                    <div className="flex flex-col gap-3">
                                        <div className="flex items-start gap-2 flex-1 min-w-0">
                                            {getStatusIcon(status.status)}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <p className="font-semibold text-base sm:text-lg">{status.checkItem.name}</p>
                                                    <span className={`text-xs sm:text-sm px-2 py-1 rounded ${status.status === "checked" ? "bg-green-100 text-green-800" :
                                                        status.status === "needs_recheck" ? "bg-orange-100 text-orange-800" :
                                                            "bg-gray-100 text-gray-800"
                                                        }`}>
                                                        {getStatusLabel(status.status)}
                                                    </span>
                                                </div>
                                                {status.checkItem.description && (
                                                    <p className="text-xs sm:text-sm text-[hsl(var(--muted-foreground))] mt-1">
                                                        {status.checkItem.description}
                                                    </p>
                                                )}
                                                {status.status !== "unchecked" && status.checkedBy && (
                                                    <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                                                        {getStatusLabel(status.status)}: {status.checkedBy.name || status.checkedBy.username} (
                                                        {status.checkedAt
                                                            ? format(new Date(status.checkedAt), "yyyy-MM-dd HH:mm")
                                                            : ""}
                                                        )
                                                    </p>
                                                )}
                                                {/* このチェック項目への依頼一覧（誰が誰に依頼したかが分かるように表示） */}
                                                {status.requests && status.requests.length > 0 && (
                                                    <div className="mt-1 space-y-0.5">
                                                        {status.requests.map((req: any) => (
                                                            <p
                                                                key={req.id}
                                                                className="text-[10px] sm:text-xs text-orange-700 flex flex-wrap gap-1"
                                                            >
                                                                <span>
                                                                    依頼:
                                                                    {req.requestedBy?.name ||
                                                                        req.requestedBy?.username ||
                                                                        "不明"}
                                                                    さん →{" "}
                                                                    {req.requestedTo?.name ||
                                                                        req.requestedTo?.username ||
                                                                        "不明"}
                                                                    さん
                                                                </span>
                                                                {req.dueDate && (
                                                                    <span>
                                                                        （期限:
                                                                        {format(
                                                                            new Date(req.dueDate),
                                                                            "yyyy-MM-dd"
                                                                        )}
                                                                        ）
                                                                    </span>
                                                                )}
                                                            </p>
                                                        ))}
                                                    </div>
                                                )}
                                                {status.notes && (
                                                    <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                                                        メモ: {status.notes}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="border-t pt-3 mt-3 sm:border-t-0 sm:pt-0 sm:mt-0">
                                            <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2 flex-shrink-0 w-full sm:w-auto">
                                            <Button
                                                size="sm"
                                                onClick={() => onCheck(vehicle.id, status.checkItem.id, "checked")}
                                                    className="w-full text-xs sm:text-sm h-9 sm:h-9 touch-manipulation"
                                                variant={status.status === "checked" ? "default" : "outline"}
                                                    style={{ touchAction: 'manipulation' }}
                                            >
                                                チェック
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => onCheck(vehicle.id, status.checkItem.id, "needs_recheck")}
                                                    className={`w-full text-xs sm:text-sm h-9 sm:h-9 touch-manipulation ${status.status === "needs_recheck"
                                                    ? "bg-orange-600 hover:bg-orange-700 text-white border-orange-600"
                                                    : ""
                                                    }`}
                                                    style={{ touchAction: 'manipulation' }}
                                            >
                                                要再チェック
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => onCheck(vehicle.id, status.checkItem.id, "unchecked")}
                                                    className={`w-full text-xs sm:text-sm h-9 sm:h-9 touch-manipulation ${status.status === "unchecked"
                                                    ? "bg-gray-600 hover:bg-gray-700 text-white border-gray-600"
                                                    : ""
                                                    }`}
                                                    style={{ touchAction: 'manipulation' }}
                                            >
                                                未チェック
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => onRequestCheck(vehicle.id, status.checkItem.id)}
                                                    className="w-full sm:w-auto text-xs sm:text-sm h-9 sm:h-9 touch-manipulation"
                                                    style={{ touchAction: 'manipulation' }}
                                            >
                                                    依頼
                                            </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="text-center py-4 text-[hsl(var(--muted-foreground))] text-sm">
                        チェック項目が設定されていません
                    </p>
                )}
            </CardContent>
        </Card>
    );
}

export default function VehicleChecks() {
    const { user } = useAuth();
    const [selectedCategory, setSelectedCategory] = useState<typeof CATEGORIES[number] | "all">("all");
    const [checkingVehicleId, setCheckingVehicleId] = useState<number | null>(null);
    const [checkingItemId, setCheckingItemId] = useState<number | null>(null);
    const [checkStatus, setCheckStatus] = useState<"checked" | "needs_recheck" | "unchecked">("checked");
    const [checkNotes, setCheckNotes] = useState("");
    const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
    const [requestingVehicleId, setRequestingVehicleId] = useState<number | null>(null);
    const [requestingCheckItemId, setRequestingCheckItemId] = useState<number | undefined>(undefined);
    const [requestedToUserId, setRequestedToUserId] = useState("");
    const [requestMessage, setRequestMessage] = useState("");
    const [requestDueDate, setRequestDueDate] = useState("");
    // 上段の一覧で選択中の車両ID（その車両だけのチェックを1ページに表示）
    const [activeVehicleId, setActiveVehicleId] = useState<number | null>(null);

    // 現在製作中（in_progress）の車両のみ取得
    const { data: vehicles } = trpc.vehicles.list.useQuery({ status: "in_progress" });
    const { data: users } = trpc.users.list.useQuery(undefined, { enabled: user?.role === "admin" || user?.role === "sub_admin" });
    const { data: myCheckRequests } = trpc.checks.getMyCheckRequests.useQuery();

    // カテゴリでフィルタリング
    const filteredVehicles = (vehicles || []).filter((v) => {
        if (selectedCategory === "all") return true;
        return v.category === selectedCategory;
    });

    const activeVehicle =
        activeVehicleId != null
            ? filteredVehicles.find((v) => v.id === activeVehicleId) || null
            : null;

    const utils = trpc.useUtils();
    const checkMutation = trpc.checks.checkVehicle.useMutation({
        onSuccess: async (_, variables) => {
            const statusLabel = variables.status === "checked" ? "チェック済み" : variables.status === "needs_recheck" ? "要再チェック" : "未チェック";
            toast.success(`${statusLabel}に更新しました`);
            setCheckingVehicleId(null);
            setCheckingItemId(null);
            setCheckStatus("checked");
            setCheckNotes("");
            // 全ての車両チェックデータと自分宛てチェック依頼を再取得
            await Promise.all([
                utils.checks.getVehicleChecks.invalidate(),
                utils.checks.getMyCheckRequests.invalidate(),
            ]);
        },
        onError: (error) => {
            toast.error(error.message || "チェックの実行に失敗しました");
        },
    });

    const requestCheckMutation = trpc.checks.requestCheck.useMutation({
        onSuccess: () => {
            toast.success("チェック依頼を送信しました");
            setIsRequestDialogOpen(false);
            setRequestingVehicleId(null);
            setRequestingCheckItemId(undefined);
            setRequestedToUserId("");
            setRequestMessage("");
            setRequestDueDate("");
            utils.checks.getMyCheckRequests.invalidate();
        },
        onError: (error) => {
            toast.error(error.message || "チェック依頼の送信に失敗しました");
        },
    });

    const handleCheck = (vehicleId: number, itemId: number, status: "checked" | "needs_recheck" | "unchecked", notes?: string) => {
        checkMutation.mutate({
            vehicleId,
            checkItemId: itemId,
            status,
            notes: notes || undefined,
        });
    };

    const handleSubmitCheck = () => {
        if (!checkingVehicleId || !checkingItemId) return;

        checkMutation.mutate({
            vehicleId: checkingVehicleId,
            checkItemId: checkingItemId,
            status: checkStatus,
            notes: checkNotes || undefined,
        });
    };

    const handleRequestCheck = (vehicleId: number, checkItemId?: number) => {
        setRequestingVehicleId(vehicleId);
        setRequestingCheckItemId(checkItemId);
        setRequestDueDate("");
        setIsRequestDialogOpen(true);
    };

    const handleCheckAll = async (vehicleId: number, itemIds: number[]) => {
        if (itemIds.length === 0) {
            toast.info("チェックする項目がありません");
            return;
        }

        // 全ての未チェック項目を順番にチェック
        for (const itemId of itemIds) {
            try {
                await checkMutation.mutateAsync({
                    vehicleId,
                    checkItemId: itemId,
                    notes: undefined,
                });
            } catch (error) {
                console.error("チェックエラー:", error);
            }
        }
        toast.success(`${itemIds.length}件のチェックを完了しました`);
    };

    const handleSubmitRequest = (selectedCheckItemId?: number) => {
        if (!requestingVehicleId || !requestedToUserId) {
            toast.error("依頼先ユーザーを選択してください");
            return;
        }

        const checkItemIdToUse = selectedCheckItemId || requestingCheckItemId;
        if (!checkItemIdToUse) {
            toast.error("チェック項目を選択してください");
            return;
        }

        requestCheckMutation.mutate({
            vehicleId: requestingVehicleId,
            checkItemId: checkItemIdToUse,
            requestedTo: parseInt(requestedToUserId),
            dueDate: requestDueDate ? new Date(requestDueDate) : undefined,
            message: requestMessage || undefined,
        });
    };

    // 未完了のチェック依頼を取得
    const pendingCheckRequests = myCheckRequests?.filter((req) => req.status === "pending") || [];

    return (
        <div 
            className="min-h-screen p-4 sm:p-6 space-y-6"
            style={{ 
            }}
        >
            <div>
                <h1 
                    className="text-2xl sm:text-3xl font-bold"
                    style={{ color: happyHuesColors.headline, letterSpacing: '-0.02em' }}
                >
                    車両チェック
                </h1>
                <p 
                    className="mt-2 text-sm sm:text-base"
                    style={{ color: happyHuesColors.paragraph, opacity: 0.8 }}
                >
                    登録された車両のチェック項目を確認・実行します
                </p>
            </div>

            {/* 上段：現在製作中の車両一覧（選択するとその車のチェックだけ表示） */}
            <Card>
                <CardHeader className="p-3 sm:p-4">
                    <CardTitle className="text-base sm:text-lg">現在製作中の車両</CardTitle>
                </CardHeader>
                <CardContent className="p-3 sm:p-4">
                    {filteredVehicles.length > 0 ? (
                        <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-2 -mx-3 sm:-mx-4 px-3 sm:px-4">
                            {filteredVehicles.map((v) => (
                                <button
                                    key={v.id}
                                    type="button"
                                    onClick={() => setActiveVehicleId(v.id)}
                                    className={`px-4 py-3 rounded-lg border text-left min-w-[160px] sm:min-w-[180px] flex-shrink-0 touch-manipulation ${activeVehicleId === v.id
                                        ? "bg-blue-600 text-white border-blue-600 shadow-md"
                                        : "bg-white text-[hsl(var(--foreground))] border-[hsl(var(--border))] hover:bg-gray-50 active:bg-gray-100"
                                        }`}
                                    style={{ touchAction: 'manipulation' }}
                                >
                                    <div className="font-semibold text-sm sm:text-base truncate">{v.vehicleNumber}</div>
                                    {v.customerName && (
                                        <div className="text-xs sm:text-sm text-[hsl(var(--muted-foreground))] truncate mt-1">
                                            {v.customerName}
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm sm:text-base text-[hsl(var(--muted-foreground))]">
                            現在、製作中の車両はありません
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* カテゴリタブ */}
            <Tabs value={selectedCategory} onValueChange={(v) => setSelectedCategory(v as any)}>
                <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
                    <TabsList className="inline-flex w-auto min-w-full sm:w-full sm:grid sm:grid-cols-3 md:grid-cols-6 gap-1 sm:gap-2">
                        <TabsTrigger value="all" className="text-sm sm:text-base px-4 sm:px-3 py-2 whitespace-nowrap flex-shrink-0 touch-manipulation" style={{ touchAction: 'manipulation' }}>全て</TabsTrigger>
                    {CATEGORIES.map((cat) => (
                            <TabsTrigger key={cat} value={cat} className="text-sm sm:text-base px-4 sm:px-3 py-2 whitespace-nowrap flex-shrink-0 touch-manipulation" style={{ touchAction: 'manipulation' }}>
                            {cat}
                        </TabsTrigger>
                    ))}
                </TabsList>
                </div>

                <TabsContent value={selectedCategory} className="mt-4">
                    {activeVehicle ? (
                        <div className="space-y-4">
                            <VehicleCheckCard
                                vehicle={activeVehicle}
                                onCheck={handleCheck}
                                onRequestCheck={handleRequestCheck}
                                onCheckAll={handleCheckAll}
                                isAdmin={(user?.role === "admin" || user?.role === "sub_admin") || false}
                                pendingRequests={pendingCheckRequests}
                            />
                        </div>
                    ) : (
                        <Card>
                            <CardContent className="p-4 text-center text-[hsl(var(--muted-foreground))]">
                                上の「現在製作中の車両」から車両を選択してください
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>
            </Tabs>

            {/* 下段：チェック依頼通知（どの車両のどの項目か分かるように表示） */}
            {pendingCheckRequests.length > 0 && (
                <Card className="border-orange-300 bg-orange-50">
                    <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-orange-900 text-sm sm:text-base">
                                    チェック依頼が{pendingCheckRequests.length}件あります
                                </p>
                                <div className="mt-2 space-y-1">
                                    {pendingCheckRequests.slice(0, 5).map((request) => (
                                        <div
                                            key={request.id}
                                            className="flex flex-wrap items-center gap-1 text-xs sm:text-sm text-orange-900"
                                        >
                                            <span className="font-semibold">
                                                {request.vehicle?.vehicleNumber || "車両ID: " + request.vehicleId}
                                            </span>
                                            {request.checkItem?.name && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-white text-orange-800 text-[10px] sm:text-xs">
                                                    項目: {request.checkItem.name}
                                                </span>
                                            )}
                                            <span>
                                                （
                                                {request.requestedByUser?.name ||
                                                    request.requestedByUser?.username ||
                                                    "不明"}
                                                さんから依頼）
                                            </span>
                                        </div>
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

            {/* チェック実行ダイアログ */}
            {checkingVehicleId && checkingItemId && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
                    <Card className="w-full max-w-md min-w-0 my-auto">
                        <CardHeader className="p-3 sm:p-4 md:p-6">
                            <CardTitle className="text-base sm:text-lg md:text-xl">チェックを実行</CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4">
                            <div className="min-w-0">
                                <label className="text-sm font-medium block mb-1">チェック状態 *</label>
                                <select
                                    className="flex h-10 w-full min-w-0 rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-2 sm:px-3 py-2 text-sm"
                                    value={checkStatus}
                                    onChange={(e) => setCheckStatus(e.target.value as "checked" | "needs_recheck" | "unchecked")}
                                >
                                    <option value="checked">チェック済み</option>
                                    <option value="needs_recheck">要再チェック</option>
                                    <option value="unchecked">未チェック</option>
                                </select>
                            </div>
                            <div className="min-w-0">
                                <label className="text-sm font-medium block mb-1">メモ（任意）</label>
                                <Input
                                    value={checkNotes}
                                    onChange={(e) => setCheckNotes(e.target.value)}
                                    placeholder="メモを入力"
                                    className="w-full min-w-0"
                                />
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2 pt-2">
                                <Button
                                    className="flex-1 w-full sm:w-auto"
                                    onClick={handleSubmitCheck}
                                    disabled={checkMutation.isPending}
                                >
                                    チェック完了
                                </Button>
                                <Button
                                    variant="outline"
                                    className="flex-1 w-full sm:w-auto"
                                    onClick={() => {
                                        setCheckingVehicleId(null);
                                        setCheckingItemId(null);
                                        setCheckStatus("checked");
                                        setCheckNotes("");
                                    }}
                                >
                                    キャンセル
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* チェック依頼ダイアログ */}
            {isRequestDialogOpen && requestingVehicleId && (
                <CheckRequestDialog
                    vehicleId={requestingVehicleId}
                    checkItemId={requestingCheckItemId}
                    users={users || []}
                    requestedToUserId={requestedToUserId}
                    setRequestedToUserId={setRequestedToUserId}
                    requestDueDate={requestDueDate}
                    setRequestDueDate={setRequestDueDate}
                    requestMessage={requestMessage}
                    setRequestMessage={setRequestMessage}
                    onSubmit={handleSubmitRequest}
                    onCancel={() => {
                        setIsRequestDialogOpen(false);
                        setRequestingVehicleId(null);
                        setRequestingCheckItemId(undefined);
                        setRequestedToUserId("");
                        setRequestMessage("");
                        setRequestDueDate("");
                    }}
                    isPending={requestCheckMutation.isPending}
                />
            )}
        </div>
    );
}

