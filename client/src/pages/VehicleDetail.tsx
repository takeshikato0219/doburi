import { useState } from "react";
import { useRoute } from "wouter";
import { useAuth } from "../hooks/useAuth";
import { trpc } from "../lib/trpc";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { ArrowLeft, Check, UserPlus, AlertCircle, FileText, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";
import { toast } from "sonner";
import { happyHuesColors, happyHuesStyles } from "../styles/happyHues";

export default function VehicleDetail() {
    const [, params] = useRoute("/vehicles/:id");
    const vehicleId = params ? parseInt(params.id) : 0;
    const { user } = useAuth();

    const [checkingItemId, setCheckingItemId] = useState<number | null>(null);
    const [checkNotes, setCheckNotes] = useState("");
    const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
    const [requestedToUserId, setRequestedToUserId] = useState("");
    const [requestMessage, setRequestMessage] = useState("");
    const [requestCheckItemId, setRequestCheckItemId] = useState("");
    const [isAttentionPointDialogOpen, setIsAttentionPointDialogOpen] = useState(false);
    const [attentionPointContent, setAttentionPointContent] = useState("");

    const { data: vehicle } = trpc.vehicles.get.useQuery({ id: vehicleId });
    const { data: attentionPoints, refetch: refetchAttentionPoints } = trpc.vehicles.getAttentionPoints.useQuery(
        { vehicleId },
        { enabled: !!vehicleId }
    );
    const { data: checkData, refetch: refetchChecks } = trpc.checks.getVehicleChecks.useQuery(
        { vehicleId },
        { enabled: !!vehicleId }
    );
    const { data: users } = trpc.users.list.useQuery(undefined, { enabled: user?.role === "admin" });
    const { data: myCheckRequests, refetch: refetchRequests } = trpc.checks.getMyCheckRequests.useQuery();

    const checkMutation = trpc.checks.checkVehicle.useMutation({
        onSuccess: () => {
            toast.success("チェックを完了しました");
            setCheckingItemId(null);
            setCheckNotes("");
            refetchChecks();
            refetchRequests();
        },
        onError: (error) => {
            toast.error(error.message || "チェックの実行に失敗しました");
        },
    });

    const requestCheckMutation = trpc.checks.requestCheck.useMutation({
        onSuccess: () => {
            toast.success("チェック依頼を送信しました");
            setIsRequestDialogOpen(false);
            setRequestedToUserId("");
            setRequestMessage("");
            refetchRequests();
        },
        onError: (error) => {
            toast.error(error.message || "チェック依頼の送信に失敗しました");
        },
    });

    const completeRequestMutation = trpc.checks.completeCheckRequest.useMutation({
        onSuccess: () => {
            toast.success("チェック依頼を完了しました");
            refetchChecks();
            refetchRequests();
        },
        onError: (error) => {
            toast.error(error.message || "チェック依頼の完了に失敗しました");
        },
    });

    const addAttentionPointMutation = trpc.vehicles.addAttentionPoint.useMutation({
        onSuccess: () => {
            toast.success("注意ポイントを追加しました");
            setIsAttentionPointDialogOpen(false);
            setAttentionPointContent("");
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

    const handleCheck = (itemId: number) => {
        setCheckingItemId(itemId);
        setCheckNotes("");
    };

    const handleSubmitCheck = () => {
        if (!checkingItemId) return;

        checkMutation.mutate({
            vehicleId,
            checkItemId: checkingItemId,
            notes: checkNotes || undefined,
        });
    };

    const handleRequestCheck = () => {
        if (!requestedToUserId) {
            toast.error("依頼先ユーザーを選択してください");
            return;
        }

        if (!requestCheckItemId) {
            toast.error("チェック項目を選択してください");
            return;
        }

        requestCheckMutation.mutate({
            vehicleId,
            checkItemId: parseInt(requestCheckItemId),
            requestedTo: parseInt(requestedToUserId),
            message: requestMessage || undefined,
        });
    };

    // この車両に対する未完了のチェック依頼を取得
    const pendingRequestsForThisVehicle = myCheckRequests?.filter(
        (req) => req.vehicleId === vehicleId && req.status === "pending"
    ) || [];

    const formatDuration = (minutes: number | null) => {
        if (!minutes) return "0分";
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return hours > 0 ? `${hours}時間${mins}分` : `${mins}分`;
    };

    if (!vehicle) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div>読み込み中...</div>
            </div>
        );
    }

    return (
        <div 
            className="min-h-screen p-4 sm:p-6 space-y-6"
            style={{ 
            }}
        >
            <div className="flex items-center gap-4">
                <Link href="/vehicles">
                    <Button variant="outline" size="sm">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        戻る
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold">{vehicle.vehicleNumber}</h1>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                        {vehicle.category && (
                            <span className="inline-block px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                                {vehicle.category}
                            </span>
                        )}
                        <p className="text-sm sm:text-base text-[hsl(var(--muted-foreground))]">
                            {vehicle.customerName || "お客様名未設定"}
                        </p>
                    </div>
                </div>
            </div>

            {/* 車両情報 */}
            <Card>
                <CardHeader>
                    <CardTitle>車両情報</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">ステータス</p>
                            <p className="font-semibold">
                                {vehicle.status === "in_progress"
                                    ? "作業中"
                                    : vehicle.status === "completed"
                                        ? "完成"
                                        : "保管"}
                            </p>
                        </div>
                        {vehicle.desiredDeliveryDate && (
                            <div>
                                <p className="text-sm text-[hsl(var(--muted-foreground))]">希望納期</p>
                                <p className="font-semibold">
                                    {format(new Date(vehicle.desiredDeliveryDate), "yyyy年MM月dd日")}
                                </p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* 指示書と注意ポイント */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 指示書 */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base sm:text-lg">指示書</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {vehicle.instructionSheetUrl ? (
                            <div className="space-y-2">
                                <a
                                    href={vehicle.instructionSheetUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-blue-600 hover:text-blue-800 underline"
                                >
                                    <FileText className="h-4 w-4" />
                                    指示書を表示
                                </a>
                            </div>
                        ) : (
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">指示書がアップロードされていません</p>
                        )}
                    </CardContent>
                </Card>

                {/* 注意ポイント */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base sm:text-lg">注意ポイント</CardTitle>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                    setAttentionPointContent("");
                                    setIsAttentionPointDialogOpen(true);
                                }}
                            >
                                <Plus className="h-4 w-4 mr-1" />
                                追加
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {attentionPoints && attentionPoints.length > 0 ? (
                            <div className="space-y-2">
                                {attentionPoints.map((ap) => (
                                    <div
                                        key={ap.id}
                                        className="p-3 border border-[hsl(var(--border))] rounded-lg bg-yellow-50"
                                    >
                                        <p className="text-sm">{ap.content}</p>
                                        <div className="flex items-center justify-between mt-2">
                                            <p className="text-xs text-[hsl(var(--muted-foreground))]">
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
                                                    className="h-6 px-2 text-red-600 hover:text-red-800"
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">注意ポイントがありません</p>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* 作業履歴 */}
            <Card>
                <CardHeader>
                    <CardTitle>作業履歴</CardTitle>
                </CardHeader>
                <CardContent>
                    {vehicle.workRecords && vehicle.workRecords.length > 0 ? (
                        <div className="space-y-2">
                            {vehicle.workRecords.map((record) => (
                                <div
                                    key={record.id}
                                    className="flex items-center justify-between p-3 border border-[hsl(var(--border))] rounded-lg"
                                >
                                    <div>
                                        <p className="font-semibold">{record.processName}</p>
                                        <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                            {record.userName} - {format(new Date(record.startTime), "yyyy-MM-dd HH:mm")}
                                            {record.endTime
                                                ? ` - ${format(new Date(record.endTime), "HH:mm")}`
                                                : " (作業中)"}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-semibold">{formatDuration(record.durationMinutes)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-center py-4 text-[hsl(var(--muted-foreground))]">
                            作業記録がありません
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* チェック項目 */}
            {checkData && (
                <Card>
                    <CardHeader className="p-4 sm:p-6">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <CardTitle className="text-lg sm:text-xl">チェック項目</CardTitle>
                            {pendingRequestsForThisVehicle.length > 0 && (
                                <div className="flex items-center gap-2 text-orange-600 text-sm">
                                    <AlertCircle className="h-4 w-4" />
                                    <span>チェック依頼が{pendingRequestsForThisVehicle.length}件あります</span>
                                </div>
                            )}
                            {user?.role === "admin" && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setIsRequestDialogOpen(true)}
                                >
                                    <UserPlus className="h-4 w-4 mr-2" />
                                    チェック依頼
                                </Button>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-6">
                        {checkData.checkStatus && checkData.checkStatus.length > 0 ? (
                            <div className="space-y-3">
                                {checkData.checkStatus.map((status: any) => (
                                    <div
                                        key={status.checkItem.id}
                                        className={`p-3 border rounded-lg ${status.checked
                                            ? "bg-green-50 border-green-200"
                                            : "bg-gray-50 border-gray-200"
                                            }`}
                                    >
                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    {status.checked ? (
                                                        <Check className="h-5 w-5 text-green-600" />
                                                    ) : (
                                                        <div className="h-5 w-5 border-2 border-gray-300 rounded" />
                                                    )}
                                                    <div>
                                                        <p className="font-semibold text-sm sm:text-base">
                                                            {status.checkItem.name}
                                                        </p>
                                                        {status.checkItem.description && (
                                                            <p className="text-xs sm:text-sm text-[hsl(var(--muted-foreground))] mt-1">
                                                                {status.checkItem.description}
                                                            </p>
                                                        )}
                                                        {status.checked && status.checkedBy && (
                                                            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                                                                チェック済み: {status.checkedBy.name || status.checkedBy.username} (
                                                                {status.checkedAt
                                                                    ? format(new Date(status.checkedAt), "yyyy-MM-dd HH:mm")
                                                                    : ""}
                                                                )
                                                            </p>
                                                        )}
                                                        {status.notes && (
                                                            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                                                                メモ: {status.notes}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                {!status.checked && (
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleCheck(status.checkItem.id)}
                                                        className="w-full sm:w-auto"
                                                    >
                                                        チェック
                                                    </Button>
                                                )}
                                                {/* チェック依頼がある場合、完了ボタンを表示 */}
                                                {pendingRequestsForThisVehicle.length > 0 &&
                                                    !status.checked && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => {
                                                                const request = pendingRequestsForThisVehicle[0];
                                                                if (request) {
                                                                    completeRequestMutation.mutate({
                                                                        requestId: request.id,
                                                                    });
                                                                }
                                                            }}
                                                            className="w-full sm:w-auto"
                                                        >
                                                            依頼完了
                                                        </Button>
                                                    )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-center py-4 text-[hsl(var(--muted-foreground))]">
                                チェック項目が設定されていません
                            </p>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* メモ */}
            <Card>
                <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="text-lg sm:text-xl">メモ</CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                    {vehicle.memos && vehicle.memos.length > 0 ? (
                        <div className="space-y-2">
                            {vehicle.memos.map((memo) => (
                                <div
                                    key={memo.id}
                                    className="border-b border-[hsl(var(--border))] pb-2"
                                >
                                    <p className="text-sm">{memo.content}</p>
                                    <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                                        {format(new Date(memo.createdAt), "yyyy-MM-dd HH:mm")} - {memo.userName}
                                    </p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-center py-4 text-[hsl(var(--muted-foreground))]">
                            メモがありません
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* チェック実行ダイアログ */}
            {checkingItemId && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
                    <Card className="w-full max-w-md min-w-0 my-auto">
                        <CardHeader className="p-3 sm:p-4 md:p-6">
                            <CardTitle className="text-base sm:text-lg md:text-xl">チェックを実行</CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4">
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
                                        setCheckingItemId(null);
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
            {isRequestDialogOpen && (
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
                                    value={requestCheckItemId}
                                    onChange={(e) => setRequestCheckItemId(e.target.value)}
                                >
                                    <option value="">選択してください</option>
                                    {checkData?.checkStatus?.map((status: any) => (
                                        <option key={status.checkItem.id} value={status.checkItem.id}>
                                            {status.checkItem.name}
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
                                    {users?.map((u) => (
                                        <option key={u.id} value={u.id}>
                                            {u.name || u.username}
                                        </option>
                                    ))}
                                </select>
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
                                    onClick={handleRequestCheck}
                                    disabled={requestCheckMutation.isPending}
                                >
                                    依頼送信
                                </Button>
                                <Button
                                    variant="outline"
                                    className="flex-1 w-full sm:w-auto"
                                    onClick={() => {
                                        setIsRequestDialogOpen(false);
                                        setRequestedToUserId("");
                                        setRequestMessage("");
                                        setRequestCheckItemId("");
                                    }}
                                >
                                    キャンセル
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* 注意ポイント追加ダイアログ */}
            {isAttentionPointDialogOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
                    <Card className="w-full max-w-md min-w-0 my-auto">
                        <CardHeader className="p-3 sm:p-4 md:p-6">
                            <CardTitle className="text-base sm:text-lg md:text-xl">注意ポイントを追加</CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4">
                            <div className="min-w-0">
                                <label className="text-sm font-medium block mb-1">注意ポイント *</label>
                                <textarea
                                    value={attentionPointContent}
                                    onChange={(e) => setAttentionPointContent(e.target.value)}
                                    placeholder="注意ポイントを入力してください"
                                    className="flex min-h-[120px] w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                                    required
                                />
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2 pt-2">
                                <Button
                                    className="flex-1 w-full sm:w-auto"
                                    onClick={() => {
                                        if (!attentionPointContent.trim()) {
                                            toast.error("注意ポイントを入力してください");
                                            return;
                                        }
                                        addAttentionPointMutation.mutate({
                                            vehicleId,
                                            content: attentionPointContent,
                                        });
                                    }}
                                    disabled={addAttentionPointMutation.isPending}
                                >
                                    {addAttentionPointMutation.isPending ? "追加中..." : "追加"}
                                </Button>
                                <Button
                                    variant="outline"
                                    className="flex-1 w-full sm:w-auto"
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
        </div>
    );
}

