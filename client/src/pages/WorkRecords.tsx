import { useState, useMemo } from "react";
import { useAuth } from "../hooks/useAuth";
import { trpc } from "../lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { TimePicker } from "../components/TimePicker";
import { Plus, Edit, Trash2, ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { toast } from "sonner";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, addWeeks, subWeeks, getHours, getMinutes } from "date-fns";
import { ja } from "date-fns/locale/ja";

export default function WorkRecords() {
    const { user } = useAuth();
    const [currentWeek, setCurrentWeek] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [selectedVehicleId, setSelectedVehicleId] = useState("");
    const [selectedProcessId, setSelectedProcessId] = useState("");
    const [workDate, setWorkDate] = useState(() => {
        const today = new Date();
        return format(today, "yyyy-MM-dd");
    });
    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");
    const [workDescription, setWorkDescription] = useState("");
    const [editingRecord, setEditingRecord] = useState<{
        id: number;
        vehicleId: string;
        processId: string;
        workDate: string;
        startTime: string;
        endTime: string;
        workDescription: string;
    } | null>(null);

    const { data: workRecords, refetch } = trpc.workRecords.getTodayRecords.useQuery();
    const { data: vehicles } = trpc.vehicles.list.useQuery({});
    const { data: processes } = trpc.processes.list.useQuery();

    // 週の日付配列を生成（日曜日から土曜日まで）
    const weekDates = useMemo(() => {
        const start = startOfWeek(currentWeek, { weekStartsOn: 0 }); // 日曜日開始
        const end = endOfWeek(currentWeek, { weekStartsOn: 0 }); // 土曜日終了
        return eachDayOfInterval({ start, end });
    }, [currentWeek]);

    // 時間帯の配列（6時〜22時、30分刻み）
    const timeSlots = useMemo(() => {
        const slots = [];
        for (let hour = 6; hour <= 22; hour++) {
            slots.push(`${String(hour).padStart(2, "0")}:00`);
            slots.push(`${String(hour).padStart(2, "0")}:30`);
        }
        return slots;
    }, []);

    // 日付ごとに作業記録をグループ化
    const recordsByDate = useMemo(() => {
        if (!workRecords) return new Map<string, typeof workRecords>();
        
        const map = new Map<string, typeof workRecords>();
        workRecords.forEach((record) => {
            const date = new Date(record.startTime);
            const dateKey = format(date, "yyyy-MM-dd");
            if (!map.has(dateKey)) {
                map.set(dateKey, []);
            }
            map.get(dateKey)!.push(record);
        });
        return map;
    }, [workRecords]);

    // 選択された日の作業記録
    const selectedDateRecords = useMemo(() => {
        if (!selectedDate) return [];
        const dateKey = format(selectedDate, "yyyy-MM-dd");
        return recordsByDate.get(dateKey) || [];
    }, [selectedDate, recordsByDate]);

    // 1日の合計作業時間を計算
    const getTotalMinutes = (records: typeof workRecords) => {
        if (!records) return 0;
        return records.reduce((total, record) => {
            if (record.durationMinutes) {
                return total + record.durationMinutes;
            }
            return total;
        }, 0);
    };

    const formatDuration = (minutes: number) => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return hours > 0 ? `${hours}時間${mins}分` : `${mins}分`;
    };

    const formatTime = (time: Date | string) => {
        const date = typeof time === "string" ? new Date(time) : time;
        return format(date, "HH:mm");
    };

    // 時間スロットから分に変換
    const timeSlotToMinutes = (timeSlot: string) => {
        const [hours, minutes] = timeSlot.split(":").map(Number);
        return hours * 60 + minutes;
    };

    // 分から時間スロットの位置を計算（6:00を0として）
    const minutesToPosition = (minutes: number) => {
        const baseMinutes = 6 * 60; // 6:00を基準
        return ((minutes - baseMinutes) / 30) * 20; // 30分 = 20px
    };

    // 作業記録の位置と高さを計算
    const getRecordPosition = (record: any) => {
        const startDate = new Date(record.startTime);
        const startMinutes = getHours(startDate) * 60 + getMinutes(startDate);
        const startPos = minutesToPosition(startMinutes);
        
        let height = 40; // デフォルトの高さ
        if (record.endTime) {
            const endDate = new Date(record.endTime);
            const endMinutes = getHours(endDate) * 60 + getMinutes(endDate);
            const duration = endMinutes - startMinutes;
            height = Math.max(40, (duration / 30) * 20); // 30分 = 20px
        }
        
        return { top: startPos, height };
    };

    const handlePrevWeek = () => {
        setCurrentWeek(subWeeks(currentWeek, 1));
    };

    const handleNextWeek = () => {
        setCurrentWeek(addWeeks(currentWeek, 1));
    };

    const handleToday = () => {
        const today = new Date();
        setCurrentWeek(today);
        setSelectedDate(today);
    };

    const handleDateClick = (date: Date) => {
        setSelectedDate(date);
        setWorkDate(format(date, "yyyy-MM-dd"));
    };

    const handleOpenAddDialog = (date?: Date) => {
        const targetDate = date || selectedDate || new Date();
        setWorkDate(format(targetDate, "yyyy-MM-dd"));
        setStartTime("08:35");
        setEndTime("");
        setSelectedVehicleId("");
        setSelectedProcessId("");
        setWorkDescription("");
        setIsAddDialogOpen(true);
    };

    const createWorkRecordMutation = trpc.workRecords.create.useMutation({
        onSuccess: () => {
            toast.success("作業記録を追加しました");
            setIsAddDialogOpen(false);
            refetch();
            setSelectedVehicleId("");
            setSelectedProcessId("");
            setStartTime("");
            setEndTime("");
            setWorkDescription("");
        },
        onError: (error) => {
            toast.error(error.message || "作業記録の追加に失敗しました");
        },
    });

    const updateWorkRecordMutation = trpc.workRecords.updateMyRecord.useMutation({
        onSuccess: () => {
            toast.success("作業記録を更新しました");
            setIsEditDialogOpen(false);
            setEditingRecord(null);
            refetch();
        },
        onError: (error) => {
            toast.error(error.message || "作業記録の更新に失敗しました");
        },
    });

    const deleteWorkRecordMutation = trpc.workRecords.deleteMyRecord.useMutation({
        onSuccess: () => {
            toast.success("作業記録を削除しました");
            refetch();
        },
        onError: (error) => {
            toast.error(error.message || "作業記録の削除に失敗しました");
        },
    });

    const handleAddWork = () => {
        if (!selectedVehicleId || !selectedProcessId || !workDate || !startTime) {
            toast.error("車両、工程、日付、開始時刻を入力してください");
            return;
        }

        const startDateTime = `${workDate}T${startTime}:00+09:00`;
        const endDateTime = endTime ? `${workDate}T${endTime}:00+09:00` : undefined;

        createWorkRecordMutation.mutate({
            userId: user!.id,
            vehicleId: parseInt(selectedVehicleId),
            processId: parseInt(selectedProcessId),
            startTime: startDateTime,
            endTime: endDateTime,
            workDescription: workDescription.trim() || undefined,
        });
    };

    const handleEdit = (record: any) => {
        const startDate = new Date(record.startTime);
        const endDate = record.endTime ? new Date(record.endTime) : new Date();

        setEditingRecord({
            id: record.id,
            vehicleId: record.vehicleId.toString(),
            processId: record.processId.toString(),
            workDate: format(startDate, "yyyy-MM-dd"),
            startTime: format(startDate, "HH:mm"),
            endTime: record.endTime ? format(endDate, "HH:mm") : "",
            workDescription: record.workDescription || "",
        });
        setIsEditDialogOpen(true);
    };

    const handleSaveEdit = () => {
        if (!editingRecord) return;

        if (!editingRecord.vehicleId || !editingRecord.processId || !editingRecord.workDate || !editingRecord.startTime) {
            toast.error("車両、工程、日付、開始時刻を入力してください");
            return;
        }

        const startDateTime = `${editingRecord.workDate}T${editingRecord.startTime}:00+09:00`;
        const endDateTime = editingRecord.endTime
            ? `${editingRecord.workDate}T${editingRecord.endTime}:00+09:00`
            : undefined;

        updateWorkRecordMutation.mutate({
            id: editingRecord.id,
            vehicleId: parseInt(editingRecord.vehicleId),
            processId: parseInt(editingRecord.processId),
            startTime: startDateTime,
            endTime: endDateTime,
            workDescription: editingRecord.workDescription || undefined,
        });
    };

    const handleDelete = (id: number) => {
        if (window.confirm("本当にこの作業記録を削除しますか？")) {
            deleteWorkRecordMutation.mutate({ id });
        }
    };

    const weekDayLabels = ["日", "月", "火", "水", "木", "金", "土"];

    return (
        <div className="min-h-screen p-4 sm:p-6 space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl sm:text-3xl font-bold text-[hsl(var(--headline))]">作業記録</h1>
                <Button onClick={() => handleOpenAddDialog()} className="bg-[hsl(var(--button))] text-[hsl(var(--button-text))] hover:opacity-90">
                    <Plus className="h-4 w-4 mr-2" />
                    作業を追加
                </Button>
            </div>

            {/* 週のタイムラインカレンダー */}
            <Card className="border-2 border-[hsl(var(--google-gray-300))] shadow-lg">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handlePrevWeek}
                                className="border-[hsl(var(--google-gray-300))]"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <CardTitle className="text-xl font-bold text-[hsl(var(--headline))]">
                                {format(weekDates[0], "yyyy年M月d日", { locale: ja })} 〜 {format(weekDates[6], "M月d日", { locale: ja })}
                            </CardTitle>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleNextWeek}
                                className="border-[hsl(var(--google-gray-300))]"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleToday}
                            className="border-[hsl(var(--google-gray-300))]"
                        >
                            <Calendar className="h-4 w-4 mr-1" />
                            今日
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <div className="min-w-[800px]">
                            {/* ヘッダー行 */}
                            <div className="grid grid-cols-8 gap-2 mb-2 border-b-2 border-[hsl(var(--google-gray-300))] pb-2">
                                <div className="text-sm font-semibold text-[hsl(var(--paragraph))]">時間</div>
                                {weekDates.map((date, index) => {
                                    const isToday = isSameDay(date, new Date());
                                    const isSelected = selectedDate && isSameDay(date, selectedDate);
                                    return (
                                        <button
                                            key={index}
                                            onClick={() => handleDateClick(date)}
                                            className={`text-center text-sm font-semibold py-2 rounded transition-all ${
                                                isToday
                                                    ? "bg-[hsl(var(--google-blue-100))] text-[hsl(var(--google-blue-800))] border-2 border-[hsl(var(--google-blue-500))]"
                                                    : isSelected
                                                    ? "bg-[hsl(var(--google-blue-50))] text-[hsl(var(--google-blue-700))] border-2 border-[hsl(var(--google-blue-300))]"
                                                    : "border-2 border-transparent hover:border-[hsl(var(--google-gray-300))]"
                                            }`}
                                        >
                                            <div>{weekDayLabels[index]}</div>
                                            <div className="text-xs">{format(date, "M/d")}</div>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* タイムライングリッド */}
                            <div className="relative" style={{ minHeight: `${timeSlots.length * 20}px` }}>
                                {/* 時間軸 */}
                                <div className="absolute left-0 top-0 bottom-0 w-16 border-r-2 border-[hsl(var(--google-gray-300))]">
                                    {timeSlots.map((slot, index) => {
                                        if (slot.endsWith(":30")) return null; // 30分は表示しない
                        return (
                                            <div
                                                key={slot}
                                                className="absolute text-xs text-[hsl(var(--muted-foreground))] pr-2"
                                                style={{ top: `${index * 20}px`, transform: "translateY(-50%)" }}
                                            >
                                                {slot}
                                        </div>
                                        );
                                    })}
                                </div>

                                {/* 各日のタイムライン */}
                                <div className="grid grid-cols-7 gap-2 ml-16">
                                    {weekDates.map((date, dateIndex) => {
                                        const dateKey = format(date, "yyyy-MM-dd");
                                        const dayRecords = recordsByDate.get(dateKey) || [];
                                        const isToday = isSameDay(date, new Date());
                                        const isSelected = selectedDate && isSameDay(date, selectedDate);

                                        return (
                                            <div
                                                key={dateIndex}
                                                className={`relative border-2 rounded-lg p-1 min-h-[${timeSlots.length * 20}px] ${
                                                    isToday
                                                        ? "border-[hsl(var(--google-blue-500))] bg-[hsl(var(--google-blue-50))]"
                                                        : isSelected
                                                        ? "border-[hsl(var(--google-blue-300))] bg-[hsl(var(--google-blue-25))]"
                                                        : "border-[hsl(var(--google-gray-200))] bg-white"
                                                }`}
                                                style={{ minHeight: `${timeSlots.length * 20}px` }}
                                            >
                                                {/* 時間グリッド線 */}
                                                {timeSlots.map((slot, slotIndex) => {
                                                    if (slot.endsWith(":30")) return null;
                                                    return (
                                                        <div
                                                            key={slot}
                                                            className="absolute left-0 right-0 border-t border-[hsl(var(--google-gray-200))]"
                                                            style={{ top: `${slotIndex * 20}px` }}
                                                        />
                                                    );
                                                })}

                                                {/* 作業記録 */}
                                                {dayRecords.map((record) => {
                                                    const { top, height } = getRecordPosition(record);
                                                    const startDate = new Date(record.startTime);
                                                    const endDate = record.endTime ? new Date(record.endTime) : new Date();
                                                    
                                                    return (
                                                        <div
                                                            key={record.id}
                                                            className="absolute left-1 right-1 rounded-md p-1.5 shadow-sm border-2 cursor-pointer hover:shadow-md transition-all z-10"
                                                            style={{
                                                                top: `${top}px`,
                                                                height: `${height}px`,
                                                                backgroundColor: record.endTime
                                                                    ? "hsl(var(--google-blue-100))"
                                                                    : "hsl(var(--google-green-100))",
                                                                borderColor: record.endTime
                                                                    ? "hsl(var(--google-blue-300))"
                                                                    : "hsl(var(--google-green-300))",
                                                            }}
                                                            onClick={() => handleEdit(record)}
                                                            title={`${record.vehicleNumber} - ${record.processName}\n${formatTime(startDate)} - ${record.endTime ? formatTime(endDate) : "作業中"}`}
                                                        >
                                                            <div className="text-xs font-semibold truncate text-[hsl(var(--google-blue-800))]">
                                                                {record.processName}
                                                            </div>
                                                            <div className="text-[10px] truncate text-[hsl(var(--google-blue-700))]">
                                                                {record.vehicleNumber}
                                                            </div>
                                                            <div className="text-[10px] text-[hsl(var(--google-blue-600))] mt-0.5">
                                                                {formatTime(startDate)}
                                                                {record.endTime ? `-${formatTime(endDate)}` : ""}
                                                            </div>
                                                        </div>
                                                    );
                                                })}

                                                {/* 空の日のメッセージ */}
                                                {dayRecords.length === 0 && (
                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                        <button
                                                            onClick={() => handleOpenAddDialog(date)}
                                                            className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--google-blue-600))] transition-colors"
                                                        >
                                                            <Plus className="h-4 w-4 mx-auto mb-1" />
                                                            追加
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* 選択された日の詳細 */}
            {selectedDate && (
                <Card className="border-2 border-[hsl(var(--google-gray-300))] shadow-lg">
                    <CardHeader>
                        <CardTitle className="text-xl font-bold text-[hsl(var(--headline))]">
                            {format(selectedDate, "yyyy年M月d日(E)", { locale: ja })}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {selectedDateRecords.length === 0 ? (
                            <div className="text-center py-8 text-[hsl(var(--muted-foreground))]">
                                <p>この日の作業記録はありません</p>
                                <Button
                                    onClick={() => handleOpenAddDialog(selectedDate)}
                                    className="mt-4 bg-[hsl(var(--button))] text-[hsl(var(--button-text))] hover:opacity-90"
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    作業を追加
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="text-sm text-[hsl(var(--paragraph))]">
                                        合計: {formatDuration(getTotalMinutes(selectedDateRecords))}
                                    </div>
                                    <Button
                                        onClick={() => handleOpenAddDialog(selectedDate)}
                                        size="sm"
                                        className="bg-[hsl(var(--button))] text-[hsl(var(--button-text))] hover:opacity-90"
                                    >
                                        <Plus className="h-4 w-4 mr-1" />
                                        追加
                                    </Button>
                                </div>
                                {selectedDateRecords
                                    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                                    .map((record) => (
                                        <div
                                            key={record.id}
                                            className="p-4 rounded-lg border-2 border-[hsl(var(--google-gray-200))] bg-white hover:shadow-md transition-shadow"
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className="font-bold text-lg text-[hsl(var(--headline))]">
                                                            {record.vehicleNumber}
                                                        </span>
                                                        <span className="px-2 py-1 rounded-md bg-[hsl(var(--google-blue-100))] text-[hsl(var(--google-blue-800))] text-sm font-semibold">
                                                        {record.processName}
                                                        </span>
                                                </div>
                                                    {record.workDescription && (
                                                        <p className="text-sm text-[hsl(var(--paragraph))] mb-2">
                                                            {record.workDescription}
                                                        </p>
                                                    )}
                                                    <div className="flex items-center gap-4 text-sm text-[hsl(var(--muted-foreground))]">
                                                        <span>
                                                            {formatTime(record.startTime)} - {record.endTime ? formatTime(record.endTime) : "作業中"}
                                                        </span>
                                                        {record.durationMinutes && (
                                                            <span className="font-semibold text-[hsl(var(--google-green-700))]">
                                                                {formatDuration(record.durationMinutes)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                        <Button
                                                        variant="outline"
                                                            size="sm"
                                                            onClick={() => handleEdit(record)}
                                                        className="border-[hsl(var(--google-gray-300))]"
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                        variant="outline"
                                                            size="sm"
                                                            onClick={() => handleDelete(record.id)}
                                                        className="border-[hsl(var(--google-red-300))] text-[hsl(var(--google-red-700))] hover:bg-[hsl(var(--google-red-50))]"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                </CardContent>
            </Card>
            )}

            {/* 作業追加ダイアログ */}
            {isAddDialogOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-md">
                        <CardHeader>
                            <CardTitle>作業記録を追加</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="text-sm font-medium block mb-1">日付</label>
                                <Input
                                    type="date"
                                    value={workDate}
                                    onChange={(e) => setWorkDate(e.target.value)}
                                    className="w-full"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium block mb-1">車両</label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                                    value={selectedVehicleId}
                                    onChange={(e) => setSelectedVehicleId(e.target.value)}
                                >
                                    <option value="">選択してください</option>
                                    {vehicles?.map((v) => (
                                        <option key={v.id} value={v.id}>
                                            {v.vehicleNumber} - {v.customerName || ""}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-medium block mb-1">工程</label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
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
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                <label className="text-sm font-medium block mb-1">開始時刻</label>
                                    <TimePicker
                                        value={startTime}
                                        onChange={setStartTime}
                                />
                            </div>
                                <div>
                                <label className="text-sm font-medium block mb-1">終了時刻</label>
                                    <TimePicker
                                        value={endTime}
                                        onChange={setEndTime}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium block mb-1">作業内容（任意）</label>
                                <Input
                                    value={workDescription}
                                    onChange={(e) => setWorkDescription(e.target.value)}
                                    placeholder="作業内容を入力"
                                    className="w-full"
                                />
                            </div>
                        </CardContent>
                        <div className="flex gap-2 p-4 pt-0">
                            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} className="flex-1">
                                キャンセル
                                </Button>
                                <Button
                                onClick={handleAddWork}
                                disabled={createWorkRecordMutation.isPending}
                                className="flex-1 bg-[hsl(var(--button))] text-[hsl(var(--button-text))] hover:opacity-90"
                            >
                                {createWorkRecordMutation.isPending ? "追加中..." : "追加"}
                                </Button>
                            </div>
                    </Card>
                </div>
            )}

            {/* 作業編集ダイアログ */}
            {isEditDialogOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-md">
                        <CardHeader>
                            <CardTitle>作業記録を編集</CardTitle>
                        </CardHeader>
                        {editingRecord && (
                            <CardContent className="space-y-4">
                                <div>
                                <label className="text-sm font-medium block mb-1">日付</label>
                                <Input
                                    type="date"
                                        value={editingRecord.workDate}
                                        onChange={(e) => setEditingRecord({ ...editingRecord, workDate: e.target.value })}
                                        className="w-full"
                                />
                            </div>
                                <div>
                                <label className="text-sm font-medium block mb-1">車両</label>
                                <select
                                        className="flex h-10 w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                                        value={editingRecord.vehicleId}
                                        onChange={(e) => setEditingRecord({ ...editingRecord, vehicleId: e.target.value })}
                                >
                                    <option value="">選択してください</option>
                                    {vehicles?.map((v) => (
                                        <option key={v.id} value={v.id}>
                                                {v.vehicleNumber} - {v.customerName || ""}
                                        </option>
                                    ))}
                                </select>
                                </div>
                                <div>
                                        <label className="text-sm font-medium block mb-1">工程</label>
                                        <select
                                        className="flex h-10 w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                                        value={editingRecord.processId}
                                        onChange={(e) => setEditingRecord({ ...editingRecord, processId: e.target.value })}
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
                                <label className="text-sm font-medium block mb-1">開始時刻</label>
                                <TimePicker
                                            value={editingRecord.startTime}
                                            onChange={(value) => setEditingRecord({ ...editingRecord, startTime: value })}
                                />
                            </div>
                                    <div>
                                <label className="text-sm font-medium block mb-1">終了時刻</label>
                                <TimePicker
                                            value={editingRecord.endTime}
                                            onChange={(value) => setEditingRecord({ ...editingRecord, endTime: value })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm font-medium block mb-1">作業内容（任意）</label>
                                    <Input
                                        value={editingRecord.workDescription}
                                        onChange={(e) => setEditingRecord({ ...editingRecord, workDescription: e.target.value })}
                                        placeholder="作業内容を入力"
                                        className="w-full"
                                    />
                                </div>
                            </CardContent>
                        )}
                        <div className="flex gap-2 p-4 pt-0">
                            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="flex-1">
                                キャンセル
                                </Button>
                                <Button
                                onClick={handleSaveEdit}
                                disabled={updateWorkRecordMutation.isPending}
                                className="flex-1 bg-[hsl(var(--button))] text-[hsl(var(--button-text))] hover:opacity-90"
                            >
                                {updateWorkRecordMutation.isPending ? "更新中..." : "更新"}
                                </Button>
                            </div>
                    </Card>
                </div>
            )}
        </div>
    );
}
