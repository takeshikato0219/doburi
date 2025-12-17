import React, { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { trpc } from "../../lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { TimePicker } from "../../components/TimePicker";
import { Plus, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "../../components/ui/table";
import { happyHuesColors, happyHuesStyles } from "../../styles/happyHues";

export default function BreakTimeManagement() {
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

    const { data: breakTimes, refetch } = trpc.breakTimes.list.useQuery();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingBreakTime, setEditingBreakTime] = useState<{
        id?: number;
        name: string;
        startTime: string;
        endTime: string;
        durationMinutes: string;
        isActive: "true" | "false";
    } | null>(null);

    const createMutation = trpc.breakTimes.create.useMutation({
        onSuccess: () => {
            toast.success("休憩時間を登録しました");
            setIsDialogOpen(false);
            setEditingBreakTime(null);
            refetch();
        },
        onError: (error) => {
            toast.error(error.message || "休憩時間の登録に失敗しました");
        },
    });

    const updateMutation = trpc.breakTimes.update.useMutation({
        onSuccess: () => {
            toast.success("休憩時間を更新しました");
            setIsDialogOpen(false);
            setEditingBreakTime(null);
            refetch();
        },
        onError: (error) => {
            toast.error(error.message || "休憩時間の更新に失敗しました");
        },
    });

    const deleteMutation = trpc.breakTimes.delete.useMutation({
        onSuccess: () => {
            toast.success("休憩時間を削除しました");
            refetch();
        },
        onError: (error) => {
            toast.error(error.message || "休憩時間の削除に失敗しました");
        },
    });

    const handleEdit = (breakTime: any) => {
        setEditingBreakTime({
            id: breakTime.id,
            name: breakTime.name || "",
            startTime: breakTime.startTime || "",
            endTime: breakTime.endTime || "",
            durationMinutes: breakTime.durationMinutes?.toString() || "0",
            isActive: breakTime.isActive || "true",
        });
        setIsDialogOpen(true);
    };

    const calculateDuration = (startTime: string, endTime: string): number => {
        if (!startTime || !endTime) return 0;
        const [startHour, startMinute] = startTime.split(":").map(Number);
        const [endHour, endMinute] = endTime.split(":").map(Number);

        let startTotalMinutes = startHour * 60 + startMinute;
        let endTotalMinutes = endHour * 60 + endMinute;

        // 日を跨ぐ場合（例: 23:00 - 01:00）
        if (endTotalMinutes < startTotalMinutes) {
            endTotalMinutes += 24 * 60;
        }

        return endTotalMinutes - startTotalMinutes;
    };

    const handleSave = () => {
        if (!editingBreakTime || !editingBreakTime.name || !editingBreakTime.startTime || !editingBreakTime.endTime) {
            toast.error("休憩名、開始時刻、終了時刻を入力してください");
            return;
        }

        // 自動計算されたdurationMinutesを使用
        const calculatedDuration = calculateDuration(editingBreakTime.startTime, editingBreakTime.endTime);
        if (calculatedDuration <= 0) {
            toast.error("終了時刻は開始時刻より後である必要があります");
            return;
        }

        if (editingBreakTime.id) {
            updateMutation.mutate({
                id: editingBreakTime.id,
                name: editingBreakTime.name,
                startTime: editingBreakTime.startTime,
                endTime: editingBreakTime.endTime,
                durationMinutes: calculatedDuration,
                isActive: editingBreakTime.isActive,
            });
        } else {
            createMutation.mutate({
                name: editingBreakTime.name,
                startTime: editingBreakTime.startTime,
                endTime: editingBreakTime.endTime,
                durationMinutes: calculatedDuration,
                isActive: editingBreakTime.isActive,
            });
        }
    };

    const handleDelete = (id: number) => {
        if (confirm("本当に削除しますか？")) {
            deleteMutation.mutate({ id });
        }
    };

    const formatDuration = (minutes: number) => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return hours > 0 ? `${hours}時間${mins}分` : `${mins}分`;
    };

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
                        休憩時間管理
                    </h1>
                    <p 
                        className="mt-2"
                        style={{ color: happyHuesColors.paragraph, opacity: 0.8 }}
                    >
                        休憩時間の追加・編集・削除を行います。作業時間が日を跨ぐ場合、跨いだ分だけ休憩時間が引かれます。
                    </p>
                </div>
                <Button
                    onClick={() => {
                        setEditingBreakTime({
                            name: "",
                            startTime: "",
                            endTime: "",
                            durationMinutes: "0",
                            isActive: "true",
                        });
                        setIsDialogOpen(true);
                    }}
                >
                    <Plus className="h-4 w-4 mr-2" />
                    休憩時間追加
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>休憩時間一覧</CardTitle>
                </CardHeader>
                <CardContent>
                    {breakTimes && breakTimes.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>休憩名</TableHead>
                                    <TableHead>開始時刻</TableHead>
                                    <TableHead>終了時刻</TableHead>
                                    <TableHead>休憩時間</TableHead>
                                    <TableHead>状態</TableHead>
                                    <TableHead>操作</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {breakTimes.map((breakTime) => (
                                    <TableRow key={breakTime.id}>
                                        <TableCell className="font-medium">{breakTime.name}</TableCell>
                                        <TableCell>{breakTime.startTime}</TableCell>
                                        <TableCell>{breakTime.endTime}</TableCell>
                                        <TableCell>{formatDuration(breakTime.durationMinutes)}</TableCell>
                                        <TableCell>
                                            <span
                                                className={`px-2 py-1 rounded text-xs ${breakTime.isActive === "true"
                                                    ? "bg-green-100 text-green-800"
                                                    : "bg-gray-100 text-gray-800"
                                                    }`}
                                            >
                                                {breakTime.isActive === "true" ? "有効" : "無効"}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleEdit(breakTime)}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    onClick={() => handleDelete(breakTime.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <p className="text-center py-4 text-[hsl(var(--muted-foreground))]">
                            休憩時間がありません
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* 編集ダイアログ */}
            {isDialogOpen && editingBreakTime && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <Card className="w-full max-w-md mx-4">
                        <CardHeader>
                            <CardTitle>
                                {editingBreakTime.id ? "休憩時間を編集" : "休憩時間を追加"}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="text-sm font-medium">休憩名 *</label>
                                <Input
                                    value={editingBreakTime.name}
                                    onChange={(e) =>
                                        setEditingBreakTime({ ...editingBreakTime, name: e.target.value })
                                    }
                                    placeholder="例: 昼休憩"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">開始時刻 * (HH:MM形式)</label>
                                <TimePicker
                                    value={editingBreakTime.startTime}
                                    onChange={(newStartTime) => {
                                        setEditingBreakTime({
                                            ...editingBreakTime,
                                            startTime: newStartTime,
                                            durationMinutes: calculateDuration(
                                                newStartTime,
                                                editingBreakTime.endTime
                                            ).toString(),
                                        });
                                    }}
                                    className="w-full"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">終了時刻 * (HH:MM形式)</label>
                                <TimePicker
                                    value={editingBreakTime.endTime}
                                    onChange={(newEndTime) => {
                                        setEditingBreakTime({
                                            ...editingBreakTime,
                                            endTime: newEndTime,
                                            durationMinutes: calculateDuration(
                                                editingBreakTime.startTime,
                                                newEndTime
                                            ).toString(),
                                        });
                                    }}
                                    className="w-full"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">休憩時間（自動計算）</label>
                                <Input
                                    type="text"
                                    value={formatDuration(parseInt(editingBreakTime.durationMinutes) || 0)}
                                    disabled
                                    className="bg-gray-100"
                                />
                                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                                    開始時刻と終了時刻から自動計算されます
                                </p>
                            </div>
                            <div>
                                <label className="text-sm font-medium">状態</label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                                    value={editingBreakTime.isActive}
                                    onChange={(e) =>
                                        setEditingBreakTime({
                                            ...editingBreakTime,
                                            isActive: e.target.value as "true" | "false",
                                        })
                                    }
                                >
                                    <option value="true">有効</option>
                                    <option value="false">無効</option>
                                </select>
                            </div>
                            <div className="flex gap-2">
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
                                        setIsDialogOpen(false);
                                        setEditingBreakTime(null);
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

