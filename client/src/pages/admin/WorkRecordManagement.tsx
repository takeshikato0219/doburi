import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { trpc } from "../../lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { TimePicker } from "../../components/TimePicker";
import { Edit, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "../../components/ui/table";
import { happyHuesColors, happyHuesStyles } from "../../styles/happyHues";

export default function WorkRecordManagement() {
    const { user } = useAuth();

    // 管理者・準管理者のみアクセス可能
    if (user?.role !== "admin" && user?.role !== "sub_admin") {
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

    const [startDate, setStartDate] = useState(() => {
        const date = new Date();
        date.setDate(date.getDate() - 7);
        return formatDateForInput(date);
    });
    const [endDate, setEndDate] = useState(() => formatDateForInput(new Date()));
    const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
    const [selectedProcessId, setSelectedProcessId] = useState<string>("");
    const [selectedUserId, setSelectedUserId] = useState<string>("");
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [newRecord, setNewRecord] = useState({
        userId: "",
        vehicleId: "",
        processId: "",
        workDate: formatDateForInput(new Date()),
        startTime: "",
        endTime: "",
        workDescription: "",
    });

    const [editingRecord, setEditingRecord] = useState<{
        id: number;
        vehicleId: string;
        processId: string;
        startDate: string;
        startTime: string;
        endDate: string;
        endTime: string;
        workDescription: string;
    } | null>(null);

    const { data: vehicles } = trpc.vehicles.list.useQuery({});
    const { data: processes } = trpc.processes.list.useQuery();
    const { data: users } = trpc.users.list.useQuery();

    // 作業記録を取得（管理者専用：全スタッフの記録を取得）
    const { data: allWorkRecords, refetch } = trpc.workRecords.getAllRecords.useQuery();

    // フィルタリングされた作業記録
    const filteredRecords = allWorkRecords?.filter((record) => {
        const recordDate = format(new Date(record.startTime), "yyyy-MM-dd");
        if (recordDate < startDate || recordDate > endDate) return false;
        if (selectedVehicleId && record.vehicleId !== parseInt(selectedVehicleId)) return false;
        if (selectedProcessId && record.processId !== parseInt(selectedProcessId)) return false;
        if (selectedUserId && record.userId !== parseInt(selectedUserId)) return false;
        return true;
    });

    // スタッフごとにグループ化してソート
    const groupedByStaff = filteredRecords?.reduce((acc, record) => {
        const staffName = record.userName || "不明";
        if (!acc[staffName]) {
            acc[staffName] = [];
        }
        acc[staffName].push(record);
        return acc;
    }, {} as Record<string, typeof filteredRecords>);

    // 各スタッフの記録を開始時刻でソート
    const sortedGroupedRecords = groupedByStaff ? Object.entries(groupedByStaff).map(([staffName, records]) => ({
        staffName,
        records: [...records].sort((a, b) => {
            const timeA = new Date(a.startTime).getTime();
            const timeB = new Date(b.startTime).getTime();
            return timeA - timeB;
        }),
    })).sort((a, b) => {
        // スタッフ名でソート（アルファベット順）
        return a.staffName.localeCompare(b.staffName, 'ja');
    }) : [];

    const updateMutation = trpc.workRecords.update.useMutation({
        onSuccess: () => {
            toast.success("作業記録を更新しました");
            setEditingRecord(null);
            refetch();
        },
        onError: (error) => {
            toast.error(error.message || "更新に失敗しました");
        },
    });

    const deleteMutation = trpc.workRecords.delete.useMutation({
        onSuccess: () => {
            toast.success("作業記録を削除しました");
            refetch();
        },
        onError: (error) => {
            toast.error(error.message || "削除に失敗しました");
        },
    });

    const createMutation = trpc.workRecords.create.useMutation({
        onSuccess: () => {
            toast.success("作業記録を追加しました");
            setIsAddDialogOpen(false);
            setNewRecord({
                userId: "",
                vehicleId: "",
                processId: "",
                workDate: formatDateForInput(new Date()),
                startTime: "",
                endTime: "",
                workDescription: "",
            });
            refetch();
        },
        onError: (error) => {
            toast.error(error.message || "追加に失敗しました");
        },
    });

    const handleEdit = (record: any) => {
        const startDate = new Date(record.startTime);
        const endDate = record.endTime ? new Date(record.endTime) : new Date();

        setEditingRecord({
            id: record.id,
            vehicleId: record.vehicleId.toString(),
            processId: record.processId.toString(),
            startDate: formatDateForInput(startDate),
            startTime: format(startDate, "HH:mm"),
            endDate: formatDateForInput(endDate),
            endTime: record.endTime ? format(endDate, "HH:mm") : "",
            workDescription: record.workDescription || "",
        });
    };

    const handleSaveEdit = () => {
        if (!editingRecord) return;

        const startDateTime = `${editingRecord.startDate}T${editingRecord.startTime}:00+09:00`;
        const endDateTime = editingRecord.endTime
            ? `${editingRecord.endDate}T${editingRecord.endTime}:00+09:00`
            : undefined;

        updateMutation.mutate({
            id: editingRecord.id,
            vehicleId: parseInt(editingRecord.vehicleId),
            processId: parseInt(editingRecord.processId),
            startTime: startDateTime,
            endTime: endDateTime,
            workDescription: editingRecord.workDescription || undefined,
        });
    };

    const handleDelete = (id: number) => {
        if (confirm("本当に削除しますか？")) {
            deleteMutation.mutate({ id });
        }
    };

    const handleAdd = () => {
        if (!newRecord.userId || !newRecord.vehicleId || !newRecord.processId || !newRecord.workDate || !newRecord.startTime) {
            toast.error("スタッフ、車両、工程、日付、開始時刻を入力してください");
            return;
        }

        const startDateTime = `${newRecord.workDate}T${newRecord.startTime}:00+09:00`;
        const endDateTime = newRecord.endTime ? `${newRecord.workDate}T${newRecord.endTime}:00+09:00` : undefined;

        createMutation.mutate({
            userId: parseInt(newRecord.userId),
            vehicleId: parseInt(newRecord.vehicleId),
            processId: parseInt(newRecord.processId),
            startTime: startDateTime,
            endTime: endDateTime,
            workDescription: newRecord.workDescription || undefined,
        });
    };

    const formatTime = (date: Date | string) => {
        const d = typeof date === "string" ? new Date(date) : date;
        return format(d, "HH:mm");
    };

    const formatDuration = (minutes: number | null) => {
        if (!minutes) return "0分";
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
            <div>
                <h1 
                    className="text-3xl font-bold"
                    style={{ color: happyHuesColors.headline, letterSpacing: '-0.02em' }}
                >
                    作業記録管理（管理者・準管理者）
                </h1>
                <p 
                    className="mt-2"
                    style={{ color: happyHuesColors.paragraph, opacity: 0.8 }}
                >
                    全スタッフの作業記録を閲覧・編集・削除します
                </p>
            </div>

            {/* フィルター */}
            <Card>
                <CardHeader>
                    <CardTitle>フィルター</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium">開始日</label>
                            <Input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">終了日</label>
                            <Input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">車両</label>
                            <select
                                className="flex h-10 w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                                value={selectedVehicleId}
                                onChange={(e) => setSelectedVehicleId(e.target.value)}
                            >
                                <option value="">全車両</option>
                                {vehicles?.map((v) => (
                                    <option key={v.id} value={v.id}>
                                        {v.vehicleNumber}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-sm font-medium">工程</label>
                            <select
                                className="flex h-10 w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                                value={selectedProcessId}
                                onChange={(e) => setSelectedProcessId(e.target.value)}
                            >
                                <option value="">全工程</option>
                                {processes?.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-sm font-medium">スタッフ</label>
                            <select
                                className="flex h-10 w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                                value={selectedUserId}
                                onChange={(e) => setSelectedUserId(e.target.value)}
                            >
                                <option value="">全スタッフ</option>
                                {users?.filter((u) => u.role !== "external").map((u) => (
                                    <option key={u.id} value={u.id}>
                                        {u.name || u.username}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* 作業記録一覧 */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>作業記録一覧</CardTitle>
                        <Button
                            onClick={() => setIsAddDialogOpen(true)}
                            className="flex items-center gap-2"
                        >
                            <Plus className="h-4 w-4" />
                            追加
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {sortedGroupedRecords && sortedGroupedRecords.length > 0 ? (
                        <div className="space-y-6">
                            {sortedGroupedRecords.map((group) => (
                                <div key={group.staffName} className="space-y-2">
                                    <div className="sticky top-0 bg-[hsl(var(--background))] z-10 py-2 border-b">
                                        <h3 className="text-lg font-semibold">{group.staffName}</h3>
                                    </div>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>日付</TableHead>
                                                <TableHead>車両</TableHead>
                                                <TableHead>工程</TableHead>
                                                <TableHead>開始時刻</TableHead>
                                                <TableHead>終了時刻</TableHead>
                                                <TableHead>作業時間</TableHead>
                                                <TableHead>操作</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {group.records.map((record) => (
                                                <TableRow key={record.id}>
                                                    <TableCell>{format(new Date(record.startTime), "yyyy-MM-dd")}</TableCell>
                                                    <TableCell>{record.vehicleNumber || "不明"}</TableCell>
                                                    <TableCell>{record.processName || "不明"}</TableCell>
                                                    <TableCell>{formatTime(record.startTime)}</TableCell>
                                                    <TableCell>
                                                        {record.endTime ? formatTime(record.endTime) : "作業中"}
                                                    </TableCell>
                                                    <TableCell>{formatDuration(record.durationMinutes)}</TableCell>
                                                    <TableCell>
                                                        <div className="flex gap-2">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handleEdit(record)}
                                                            >
                                                                <Edit className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="destructive"
                                                                onClick={() => handleDelete(record.id)}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
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

            {/* 編集ダイアログ */}
            {editingRecord && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <Card className="w-full max-w-md mx-4">
                        <CardHeader>
                            <CardTitle>作業記録を編集</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="text-sm font-medium">車両</label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                                    value={editingRecord.vehicleId}
                                    onChange={(e) =>
                                        setEditingRecord({ ...editingRecord, vehicleId: e.target.value })
                                    }
                                >
                                    {vehicles?.map((v) => (
                                        <option key={v.id} value={v.id}>
                                            {v.vehicleNumber}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-medium">工程</label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                                    value={editingRecord.processId}
                                    onChange={(e) =>
                                        setEditingRecord({ ...editingRecord, processId: e.target.value })
                                    }
                                >
                                    {processes?.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium">開始日</label>
                                    <Input
                                        type="date"
                                        value={editingRecord.startDate}
                                        onChange={(e) =>
                                            setEditingRecord({ ...editingRecord, startDate: e.target.value })
                                        }
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium">開始時刻</label>
                                    <TimePicker
                                        value={editingRecord.startTime}
                                        onChange={(value) =>
                                            setEditingRecord({ ...editingRecord, startTime: value })
                                        }
                                        className="w-full"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium">終了日</label>
                                    <Input
                                        type="date"
                                        value={editingRecord.endDate}
                                        onChange={(e) =>
                                            setEditingRecord({ ...editingRecord, endDate: e.target.value })
                                        }
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium">終了時刻</label>
                                    <TimePicker
                                        value={editingRecord.endTime}
                                        onChange={(value) =>
                                            setEditingRecord({ ...editingRecord, endTime: value })
                                        }
                                        className="w-full"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium">作業内容</label>
                                <textarea
                                    className="flex min-h-[80px] w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                                    value={editingRecord.workDescription}
                                    onChange={(e) =>
                                        setEditingRecord({ ...editingRecord, workDescription: e.target.value })
                                    }
                                />
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    className="flex-1"
                                    onClick={handleSaveEdit}
                                    disabled={updateMutation.isPending}
                                >
                                    保存
                                </Button>
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => setEditingRecord(null)}
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
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <Card className="w-full max-w-md mx-4">
                        <CardHeader>
                            <CardTitle>作業記録を追加</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="text-sm font-medium">スタッフ</label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                                    value={newRecord.userId}
                                    onChange={(e) =>
                                        setNewRecord({ ...newRecord, userId: e.target.value })
                                    }
                                >
                                    <option value="">選択してください</option>
                                    {users?.filter((u) => u.role !== "external").map((u) => (
                                        <option key={u.id} value={u.id}>
                                            {u.name || u.username}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-medium">車両</label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                                    value={newRecord.vehicleId}
                                    onChange={(e) =>
                                        setNewRecord({ ...newRecord, vehicleId: e.target.value })
                                    }
                                >
                                    <option value="">選択してください</option>
                                    {vehicles?.map((v) => (
                                        <option key={v.id} value={v.id}>
                                            {v.vehicleNumber}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-medium">工程</label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                                    value={newRecord.processId}
                                    onChange={(e) =>
                                        setNewRecord({ ...newRecord, processId: e.target.value })
                                    }
                                >
                                    <option value="">選択してください</option>
                                    {processes?.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium">作業日</label>
                                    <Input
                                        type="date"
                                        value={newRecord.workDate}
                                        onChange={(e) =>
                                            setNewRecord({ ...newRecord, workDate: e.target.value })
                                        }
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium">開始時刻</label>
                                    <TimePicker
                                        value={newRecord.startTime}
                                        onChange={(value) =>
                                            setNewRecord({ ...newRecord, startTime: value })
                                        }
                                        className="w-full"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium">終了時刻（任意）</label>
                                <TimePicker
                                    value={newRecord.endTime}
                                    onChange={(value) =>
                                        setNewRecord({ ...newRecord, endTime: value })
                                    }
                                    className="w-full"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">作業内容（任意）</label>
                                <textarea
                                    className="flex min-h-[80px] w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                                    value={newRecord.workDescription}
                                    onChange={(e) =>
                                        setNewRecord({ ...newRecord, workDescription: e.target.value })
                                    }
                                />
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    className="flex-1"
                                    onClick={handleAdd}
                                    disabled={createMutation.isPending}
                                >
                                    追加
                                </Button>
                                <Button
                                    variant="outline"
                                    className="flex-1"
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