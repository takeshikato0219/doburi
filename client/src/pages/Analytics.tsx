import { useState } from "react";
import { trpc } from "../lib/trpc";
import { useAuth } from "../hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "../components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../components/ui/select";
import { ChevronDown, X } from "lucide-react";
import { toast } from "sonner";
import { happyHuesColors, happyHuesStyles } from "../styles/happyHues";

export default function Analytics() {
    const { user } = useAuth();
    const [selectedVehicleIds, setSelectedVehicleIds] = useState<number[]>([]);
    const [isVehicleSelectionOpen, setIsVehicleSelectionOpen] = useState(false);
    const [vehicleNotes, setVehicleNotes] = useState<Record<number, string>>({});
    const [selectedMajorCategory, setSelectedMajorCategory] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState<string>("today");
    const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
    const [editingProcessId, setEditingProcessId] = useState<number | null>(null);

    const { data: vehicles, error: vehiclesError, isLoading: vehiclesLoading } = trpc.vehicles.list.useQuery({});
    const { data: processes } = trpc.processes.list.useQuery();

    // エラーログ出力
    if (vehiclesError) {
        console.error("[Analytics] 車両取得エラー:", vehiclesError);
    }

    const { data: vehicleTypeStats } = trpc.analytics.getVehicleTypeStats.useQuery(
        selectedVehicleIds.length > 0 ? { vehicleIds: selectedVehicleIds } : undefined
    );
    const { data: processStats } = trpc.analytics.getProcessStats.useQuery(
        selectedVehicleIds.length > 0 ? { vehicleIds: selectedVehicleIds } : undefined
    );
    const { data: vehicleTypeProcessStats } = trpc.analytics.getVehicleTypeProcessStats.useQuery(
        selectedVehicleIds.length > 0 ? { vehicleIds: selectedVehicleIds } : undefined
    );
    const { data: workTimeByMajorCategory } = trpc.analytics.getWorkTimeByMajorCategory.useQuery();
    
    // 12月の車両別作業時間一覧を取得
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    const decemberYear = currentMonth === 12 ? currentYear : currentYear - 1; // 12月が現在の月でない場合は前年
    const { data: vehicleWorkTimeDecember } = trpc.analytics.getVehicleWorkTimeByMonth.useQuery(
        { year: decemberYear, month: 12 },
        { enabled: true }
    );
    
    const { data: workDetailsByMajorCategory, refetch: refetchWorkDetails } = trpc.analytics.getWorkDetailsByMajorCategory.useQuery(
        {
            majorCategory: selectedMajorCategory || "",
            date: selectedDate,
        },
        {
            enabled: !!selectedMajorCategory && isDetailDialogOpen,
        }
    );

    const updateWorkRecordMutation = trpc.workRecords.update.useMutation({
        onSuccess: () => {
            toast.success("工程を更新しました");
            setEditingProcessId(null);
            refetchWorkDetails();
        },
        onError: (error) => {
            toast.error(`工程の更新に失敗しました: ${error.message}`);
        },
    });

    const canEdit = user?.role === "admin" || user?.role === "sub_admin";

    const handleProcessChange = (workRecordId: number, newProcessId: number) => {
        if (!canEdit) {
            toast.error("編集権限がありません");
            return;
        }
        updateWorkRecordMutation.mutate({
            id: workRecordId,
            processId: newProcessId,
        });
    };

    const formatDuration = (minutes: number) => {
        if (!minutes) return "0分";
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return hours > 0 ? `${hours}時間${mins}分` : `${mins}分`;
    };

    const handleVehicleToggle = (vehicleId: number) => {
        setSelectedVehicleIds((prev) =>
            prev.includes(vehicleId)
                ? prev.filter((id) => id !== vehicleId)
                : [...prev, vehicleId]
        );
    };

    const handleNoteChange = (vehicleId: number, note: string) => {
        setVehicleNotes((prev) => ({
            ...prev,
            [vehicleId]: note,
        }));
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
                    統計・分析
                </h1>
                <p 
                    className="mt-2"
                    style={{ color: happyHuesColors.paragraph, opacity: 0.8 }}
                >
                    車種別・工程別の作業時間を集計します
                </p>
            </div>

            {/* 車両選択 */}
            <Card>
                <CardHeader>
                    <button
                        onClick={() => setIsVehicleSelectionOpen(!isVehicleSelectionOpen)}
                        className="flex items-center justify-between w-full text-left hover:opacity-80 transition-opacity cursor-pointer"
                    >
                        <CardTitle className="text-lg">分析対象車両の選択</CardTitle>
                        <ChevronDown
                            className={`h-5 w-5 transition-transform ${isVehicleSelectionOpen ? "transform rotate-180" : ""
                                }`}
                        />
                    </button>
                </CardHeader>
                {isVehicleSelectionOpen && (
                    <CardContent>
                        {vehiclesLoading ? (
                            <div className="text-center py-4">
                                <p className="text-[hsl(var(--muted-foreground))]">読み込み中...</p>
                            </div>
                        ) : vehiclesError ? (
                            <div className="text-center py-4">
                                <p className="text-red-500">エラー: 車両の取得に失敗しました</p>
                                <p className="text-sm text-[hsl(var(--muted-foreground))] mt-2">
                                    {vehiclesError.message || "不明なエラー"}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="text-sm text-[hsl(var(--muted-foreground))]">
                                    {selectedVehicleIds.length > 0
                                        ? `${selectedVehicleIds.length}台を選択中`
                                        : "車両を選択してください"}
                                </div>
                                <div className="max-h-96 overflow-y-auto border border-[hsl(var(--border))] rounded-md p-4">
                                    {(() => {
                                        const inProgressVehicles = vehicles?.filter((v) => v.status === "in_progress") || [];
                                        const completedVehicles = vehicles?.filter((v) => v.status === "completed") || [];
                                        const archivedVehicles = vehicles?.filter((v) => v.status === "archived") || [];

                                        return (
                                            <div className="space-y-4">
                                                {inProgressVehicles.length > 0 && (
                                                    <div>
                                                        <h4 className="font-semibold text-sm mb-2 text-green-600">作業中</h4>
                                                        <div className="space-y-3">
                                                            {inProgressVehicles.map((vehicle) => (
                                                                <div
                                                                    key={vehicle.id}
                                                                    className="border border-[hsl(var(--border))] rounded-md p-3 space-y-2"
                                                                >
                                                                    <div className="flex items-center gap-2">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={selectedVehicleIds.includes(vehicle.id)}
                                                                            onChange={() => handleVehicleToggle(vehicle.id)}
                                                                            className="h-4 w-4 rounded border-gray-300"
                                                                        />
                                                                        <span className="text-sm font-medium">{vehicle.vehicleNumber}</span>
                                                                        {vehicle.customerName && (
                                                                            <span className="text-xs text-[hsl(var(--muted-foreground))]">
                                                                                ({vehicle.customerName})
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <textarea
                                                                        placeholder={selectedVehicleIds.includes(vehicle.id)
                                                                            ? "対象内にする理由を記入してください"
                                                                            : "対象外にする理由を記入してください（任意）"}
                                                                        value={vehicleNotes[vehicle.id] || ""}
                                                                        onChange={(e) => handleNoteChange(vehicle.id, e.target.value)}
                                                                        className="w-full min-h-[60px] rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 resize-y"
                                                                    />
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {completedVehicles.length > 0 && (
                                                    <div>
                                                        <h4 className="font-semibold text-sm mb-2 text-blue-600">完成済み</h4>
                                                        <div className="space-y-3">
                                                            {completedVehicles.map((vehicle) => (
                                                                <div
                                                                    key={vehicle.id}
                                                                    className="border border-[hsl(var(--border))] rounded-md p-3 space-y-2"
                                                                >
                                                                    <div className="flex items-center gap-2">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={selectedVehicleIds.includes(vehicle.id)}
                                                                            onChange={() => handleVehicleToggle(vehicle.id)}
                                                                            className="h-4 w-4 rounded border-gray-300"
                                                                        />
                                                                        <span className="text-sm font-medium">{vehicle.vehicleNumber}</span>
                                                                        {vehicle.customerName && (
                                                                            <span className="text-xs text-[hsl(var(--muted-foreground))]">
                                                                                ({vehicle.customerName})
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <textarea
                                                                        placeholder={selectedVehicleIds.includes(vehicle.id)
                                                                            ? "対象内にする理由を記入してください"
                                                                            : "対象外にする理由を記入してください（任意）"}
                                                                        value={vehicleNotes[vehicle.id] || ""}
                                                                        onChange={(e) => handleNoteChange(vehicle.id, e.target.value)}
                                                                        className="w-full min-h-[60px] rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 resize-y"
                                                                    />
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {archivedVehicles.length > 0 && (
                                                    <div>
                                                        <h4 className="font-semibold text-sm mb-2 text-gray-600">保管済み</h4>
                                                        <div className="space-y-3">
                                                            {archivedVehicles.map((vehicle) => (
                                                                <div
                                                                    key={vehicle.id}
                                                                    className="border border-[hsl(var(--border))] rounded-md p-3 space-y-2"
                                                                >
                                                                    <div className="flex items-center gap-2">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={selectedVehicleIds.includes(vehicle.id)}
                                                                            onChange={() => handleVehicleToggle(vehicle.id)}
                                                                            className="h-4 w-4 rounded border-gray-300"
                                                                        />
                                                                        <span className="text-sm font-medium">{vehicle.vehicleNumber}</span>
                                                                        {vehicle.customerName && (
                                                                            <span className="text-xs text-[hsl(var(--muted-foreground))]">
                                                                                ({vehicle.customerName})
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <textarea
                                                                        placeholder={selectedVehicleIds.includes(vehicle.id)
                                                                            ? "対象内にする理由を記入してください"
                                                                            : "対象外にする理由を記入してください（任意）"}
                                                                        value={vehicleNotes[vehicle.id] || ""}
                                                                        onChange={(e) => handleNoteChange(vehicle.id, e.target.value)}
                                                                        className="w-full min-h-[60px] rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 resize-y"
                                                                    />
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {(!vehicles || vehicles.length === 0) && (
                                                    <p className="text-center text-[hsl(var(--muted-foreground))] py-4">
                                                        車両がありません
                                                    </p>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        )}
                    </CardContent>
                )}
            </Card>

            {/* 大分類別作業時間 */}
            {workTimeByMajorCategory && (
                <>
                    {/* 今日の大分類別作業時間 */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle>今日の総合作業時間（大分類別）</CardTitle>
                                <div className="text-lg font-semibold">
                                    合計: {formatDuration(
                                        workTimeByMajorCategory.today?.reduce((sum: number, item: any) => sum + item.totalMinutes, 0) || 0
                                    )}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>大分類</TableHead>
                                        <TableHead>総合作業時間</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {workTimeByMajorCategory.today && workTimeByMajorCategory.today.length > 0 ? (
                                        workTimeByMajorCategory.today.map((item: any, index: number) => (
                                            <TableRow
                                                key={index}
                                                className="cursor-pointer hover:bg-gray-100"
                                                onClick={() => {
                                                    setSelectedMajorCategory(item.majorCategory);
                                                    setSelectedDate("today");
                                                    setIsDetailDialogOpen(true);
                                                }}
                                            >
                                                <TableCell>{item.majorCategory}</TableCell>
                                                <TableCell>{formatDuration(item.totalMinutes)}</TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={2} className="text-center text-[hsl(var(--muted-foreground))]">
                                                データがありません
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    {/* 昨日の大分類別作業時間 */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle>昨日の総合作業時間（大分類別）</CardTitle>
                                <div className="text-lg font-semibold">
                                    合計: {formatDuration(
                                        workTimeByMajorCategory.yesterday?.reduce((sum: number, item: any) => sum + item.totalMinutes, 0) || 0
                                    )}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>大分類</TableHead>
                                        <TableHead>総合作業時間</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {workTimeByMajorCategory.yesterday && workTimeByMajorCategory.yesterday.length > 0 ? (
                                        workTimeByMajorCategory.yesterday.map((item: any, index: number) => (
                                            <TableRow
                                                key={index}
                                                className="cursor-pointer hover:bg-gray-100"
                                                onClick={() => {
                                                    setSelectedMajorCategory(item.majorCategory);
                                                    setSelectedDate("yesterday");
                                                    setIsDetailDialogOpen(true);
                                                }}
                                            >
                                                <TableCell>{item.majorCategory}</TableCell>
                                                <TableCell>{formatDuration(item.totalMinutes)}</TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={2} className="text-center text-[hsl(var(--muted-foreground))]">
                                                データがありません
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    {/* 一昨日の大分類別作業時間 */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle>一昨日の総合作業時間（大分類別）</CardTitle>
                                <div className="text-lg font-semibold">
                                    合計: {formatDuration(
                                        workTimeByMajorCategory.dayBeforeYesterday?.reduce((sum: number, item: any) => sum + item.totalMinutes, 0) || 0
                                    )}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>大分類</TableHead>
                                        <TableHead>総合作業時間</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {workTimeByMajorCategory.dayBeforeYesterday && workTimeByMajorCategory.dayBeforeYesterday.length > 0 ? (
                                        workTimeByMajorCategory.dayBeforeYesterday.map((item: any, index: number) => (
                                            <TableRow key={index}>
                                                <TableCell>{item.majorCategory}</TableCell>
                                                <TableCell>{formatDuration(item.totalMinutes)}</TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={2} className="text-center text-[hsl(var(--muted-foreground))]">
                                                データがありません
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    {/* 3日前の大分類別作業時間 */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle>3日前の総合作業時間（大分類別）</CardTitle>
                                <div className="text-lg font-semibold">
                                    合計: {formatDuration(
                                        workTimeByMajorCategory.threeDaysAgo?.reduce((sum: number, item: any) => sum + item.totalMinutes, 0) || 0
                                    )}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>大分類</TableHead>
                                        <TableHead>総合作業時間</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {workTimeByMajorCategory.threeDaysAgo && workTimeByMajorCategory.threeDaysAgo.length > 0 ? (
                                        workTimeByMajorCategory.threeDaysAgo.map((item: any, index: number) => (
                                            <TableRow key={index}>
                                                <TableCell>{item.majorCategory}</TableCell>
                                                <TableCell>{formatDuration(item.totalMinutes)}</TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={2} className="text-center text-[hsl(var(--muted-foreground))]">
                                                データがありません
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    {/* 一週間の大分類別作業時間 */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle>一週間の総合作業時間（大分類別）</CardTitle>
                                <div className="text-lg font-semibold">
                                    合計: {formatDuration(
                                        workTimeByMajorCategory.week?.reduce((sum: number, item: any) => sum + item.totalMinutes, 0) || 0
                                    )}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>大分類</TableHead>
                                        <TableHead>総合作業時間</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {workTimeByMajorCategory.week && workTimeByMajorCategory.week.length > 0 ? (
                                        workTimeByMajorCategory.week.map((item: any, index: number) => (
                                            <TableRow key={index}>
                                                <TableCell>{item.majorCategory}</TableCell>
                                                <TableCell>{formatDuration(item.totalMinutes)}</TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={2} className="text-center text-[hsl(var(--muted-foreground))]">
                                                データがありません
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    {/* 11月の大分類別作業時間 */}
                    <Card>
                        <CardHeader>
                            <CardTitle>11月の総合作業時間（大分類別）</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>大分類</TableHead>
                                        <TableHead>総合作業時間</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {workTimeByMajorCategory.november && workTimeByMajorCategory.november.length > 0 ? (
                                        workTimeByMajorCategory.november.map((item: any, index: number) => (
                                            <TableRow key={index}>
                                                <TableCell>{item.majorCategory}</TableCell>
                                                <TableCell>{formatDuration(item.totalMinutes)}</TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={2} className="text-center text-[hsl(var(--muted-foreground))]">
                                                データがありません
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </>
            )}

            {/* 12月の車両別作業時間一覧 */}
            <Card>
                <CardHeader>
                    <CardTitle>12月の車両別作業時間一覧（現段階）</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>車両番号</TableHead>
                                <TableHead>お客様名</TableHead>
                                <TableHead>車種</TableHead>
                                <TableHead>総合作業時間</TableHead>
                                <TableHead>備考</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {vehicleWorkTimeDecember && vehicleWorkTimeDecember.length > 0 ? (
                                vehicleWorkTimeDecember.map((item: any) => (
                                    <TableRow key={item.vehicleId}>
                                        <TableCell>{item.vehicleNumber}</TableCell>
                                        <TableCell>{item.customerName || "-"}</TableCell>
                                        <TableCell>{item.vehicleTypeName || "-"}</TableCell>
                                        <TableCell>{formatDuration(item.totalMinutes)}</TableCell>
                                        <TableCell>
                                            {item.isCrossMonth ? (
                                                <span className="text-orange-600 font-semibold">跨ぎ</span>
                                            ) : (
                                                <span className="text-gray-500">-</span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center text-[hsl(var(--muted-foreground))]">
                                        データがありません
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* 車種別統計 */}
            <Card>
                <CardHeader>
                    <CardTitle>車種別統計</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>車種</TableHead>
                                <TableHead>車両数</TableHead>
                                <TableHead>合計作業時間</TableHead>
                                <TableHead>平均作業時間</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {vehicleTypeStats && vehicleTypeStats.length > 0 ? (
                                vehicleTypeStats.map((stat) => (
                                    <TableRow key={stat.vehicleTypeId}>
                                        <TableCell>{stat.vehicleTypeName}</TableCell>
                                        <TableCell>{stat.vehicleCount}台</TableCell>
                                        <TableCell>{formatDuration(stat.totalMinutes)}</TableCell>
                                        <TableCell>{formatDuration(stat.averageMinutes)}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center text-[hsl(var(--muted-foreground))]">
                                        データがありません
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* 工程別統計 */}
            <Card>
                <CardHeader>
                    <CardTitle>工程別統計</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>工程</TableHead>
                                <TableHead>作業回数</TableHead>
                                <TableHead>合計作業時間</TableHead>
                                <TableHead>平均作業時間</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {processStats && processStats.length > 0 ? (
                                processStats.map((stat) => (
                                    <TableRow key={stat.processId}>
                                        <TableCell>{stat.processName}</TableCell>
                                        <TableCell>{stat.workCount}回</TableCell>
                                        <TableCell>{formatDuration(stat.totalMinutes)}</TableCell>
                                        <TableCell>{formatDuration(stat.averageMinutes)}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center text-[hsl(var(--muted-foreground))]">
                                        データがありません
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* 車種別・工程別統計 */}
            <Card>
                <CardHeader>
                    <CardTitle>車種別・工程別統計</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>車種</TableHead>
                                <TableHead>工程</TableHead>
                                <TableHead>作業回数</TableHead>
                                <TableHead>平均作業時間</TableHead>
                                <TableHead>標準時間</TableHead>
                                <TableHead>差異</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {vehicleTypeProcessStats && vehicleTypeProcessStats.length > 0 ? (
                                vehicleTypeProcessStats.map((stat) => {
                                    const difference = stat.averageMinutes - (stat.standardMinutes || 0);
                                    const differencePercent = stat.standardMinutes
                                        ? ((difference / stat.standardMinutes) * 100).toFixed(1)
                                        : "-";

                                    return (
                                        <TableRow key={`${stat.vehicleTypeId}-${stat.processId}`}>
                                            <TableCell>{stat.vehicleTypeName}</TableCell>
                                            <TableCell>{stat.processName}</TableCell>
                                            <TableCell>{stat.workCount}回</TableCell>
                                            <TableCell>{formatDuration(stat.averageMinutes)}</TableCell>
                                            <TableCell>
                                                {stat.standardMinutes ? formatDuration(stat.standardMinutes) : "-"}
                                            </TableCell>
                                            <TableCell>
                                                {stat.standardMinutes ? (
                                                    <span
                                                        className={
                                                            difference > 0 ? "text-red-500" : "text-green-500"
                                                        }
                                                    >
                                                        {difference > 0 ? "+" : ""}
                                                        {formatDuration(Math.abs(difference))} ({differencePercent}%)
                                                    </span>
                                                ) : (
                                                    "-"
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center text-[hsl(var(--muted-foreground))]">
                                        データがありません
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* 詳細モーダル */}
            {isDetailDialogOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-5xl w-full max-h-[80vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold">
                                {selectedMajorCategory} - {selectedDate === "today" ? "今日" : selectedDate === "yesterday" ? "昨日" : selectedDate}の作業詳細
                            </h2>
                            <button
                                onClick={() => setIsDetailDialogOpen(false)}
                                className="p-2 hover:bg-gray-100 rounded"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="mt-4">
                            {workDetailsByMajorCategory && workDetailsByMajorCategory.length > 0 ? (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>時刻</TableHead>
                                            <TableHead>担当者</TableHead>
                                            <TableHead>車両</TableHead>
                                            <TableHead>工程</TableHead>
                                            <TableHead>作業内容</TableHead>
                                            <TableHead>作業時間</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {workDetailsByMajorCategory.map((detail: any) => (
                                            <TableRow key={detail.id}>
                                                <TableCell>
                                                    {detail.startTimeStr && detail.endTimeStr
                                                        ? `${detail.startTimeStr} - ${detail.endTimeStr}`
                                                        : "-"}
                                                </TableCell>
                                                <TableCell>{detail.userName}</TableCell>
                                                <TableCell>
                                                    {detail.vehicleNumber}
                                                    {detail.customerName && ` (${detail.customerName})`}
                                                </TableCell>
                                                <TableCell>
                                                    {editingProcessId === detail.id && canEdit ? (
                                                        <Select
                                                            value={detail.processId?.toString() || ""}
                                                            onValueChange={(value) => {
                                                                handleProcessChange(detail.id, parseInt(value));
                                                            }}
                                                            onOpenChange={(open) => {
                                                                if (!open) {
                                                                    setEditingProcessId(null);
                                                                }
                                                            }}
                                                        >
                                                            <SelectTrigger className="w-[200px]">
                                                                <SelectValue placeholder="工程を選択" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {processes?.map((process) => (
                                                                    <SelectItem key={process.id} value={process.id.toString()}>
                                                                        {process.name}
                                                                        {process.minorCategory && ` (${process.minorCategory})`}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    ) : (
                                                        <span
                                                            className={canEdit ? "cursor-pointer hover:underline" : ""}
                                                            onClick={() => {
                                                                if (canEdit) {
                                                                    setEditingProcessId(detail.id);
                                                                }
                                                            }}
                                                        >
                                                    {detail.processName}
                                                    {detail.minorCategory && ` (${detail.minorCategory})`}
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell>{detail.workDescription || "-"}</TableCell>
                                                <TableCell>{formatDuration(detail.durationMinutes)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            ) : (
                                <p className="text-center text-[hsl(var(--muted-foreground))] py-4">
                                    データがありません
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

