import { useState, useMemo } from "react";
import { trpc } from "../lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { format } from "date-fns";
import { happyHuesColors, happyHuesStyles } from "../styles/happyHues";

export default function DeliverySchedulesPublic() {
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [isCalendarMode, setIsCalendarMode] = useState(false);

    const { data, isLoading, isError, error } = trpc.deliverySchedules.publicList.useQuery({ year, month });

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

    const groupedByDay = useMemo(() => {
        const map = new Map<string, any[]>();
        (data || []).forEach((item: any) => {
            const d = item.deliveryPlannedDate ? new Date(item.deliveryPlannedDate) : null;
            const key = d ? format(d, "yyyy-MM-dd") : "未設定";
            const list = map.get(key) || [];
            list.push(item);
            map.set(key, list);
        });
        return Array.from(map.entries()).sort(([a], [b]) =>
            a === "未設定" ? 1 : b === "未設定" ? -1 : a.localeCompare(b)
        );
    }, [data]);

    const activeItems = (data || []).filter((item: any) => item.status !== "completed");
    const completedItems = (data || []).filter((item: any) => item.status === "completed");

    return (
        <div 
            className="min-h-screen flex items-start justify-center py-4 px-2 sm:px-4"
            style={{ 
            }}
        >
            <div className="w-full max-w-6xl">
                <header className="mb-3 sm:mb-4 flex flex-col gap-2">
                    <h1 
                        className="text-xl sm:text-2xl font-bold text-center"
                        style={{ color: happyHuesColors.headline, letterSpacing: '-0.02em' }}
                    >
                        ワングラム製造スケジュール（外部公開）
                    </h1>
                    <p className="text-[11px] sm:text-xs text-[hsl(var(--muted-foreground))] text-center">
                        このページは社外から閲覧できる製造・納車スケジュールです。スマホ・PC両対応です。
                    </p>
                </header>

                <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                    {/* 左側: 年月表示と今月ボタン */}
                    <div className="flex items-center gap-1">
                        <span className="font-semibold text-lg whitespace-nowrap">
                            {year}年{month}月
                        </span>
                        <Button variant="outline" size="sm" onClick={handleCurrentMonth} className="ml-1">
                            今月
                        </Button>
                    </div>

                    {/* 右側: 矢印ボタン */}
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" onClick={handlePrevMonth}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" onClick={handleNextMonth}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                <Card>
                    <CardHeader className="p-3 sm:p-4">
                        <CardTitle className="text-base sm:text-lg">
                            {isCalendarMode ? (
                                <>一覧ビューモード</>
                            ) : (
                                <>今月のワングラム製造スケジュール</>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 sm:p-4 space-y-2 sm:space-y-3">
                        {isLoading ? (
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">読み込み中...</p>
                        ) : isError ? (
                            <p className="text-sm text-red-600">
                                エラーが発生しました: {error?.message || "不明なエラー"}
                            </p>
                        ) : !data || data.length === 0 ? (
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                この月の納車スケジュールはありません
                            </p>
                        ) : isCalendarMode ? (
                            <div className="space-y-3">
                                {groupedByDay.map(([day, items]) => (
                                    <div key={day} className="border border-[hsl(var(--border))] rounded-lg">
                                        <div className="px-2 sm:px-3 py-1.5 sm:py-2 bg-[hsl(var(--muted))] text-xs sm:text-sm font-semibold flex items-center justify-between">
                                            <span>{day === "未設定" ? "日付未設定" : format(new Date(day), "M月d日")}</span>
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
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {/* 進行中の車両 */}
                                {activeItems.length > 0 && (
                                    <div className="space-y-2">
                                        <h2 className="text-sm sm:text-base font-semibold">進行中の車両</h2>
                                        <div className="flex flex-col gap-2">
                                            {activeItems.map((item: any) => {
                                                // 納期計算
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
                                                    <div
                                                        key={item.id}
                                                        className="border border-[hsl(var(--border))] rounded-lg p-3 sm:p-4 flex flex-col gap-2"
                                                    >
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="min-w-0 flex-1">
                                                                <p className="font-bold text-base sm:text-lg break-words">
                                                                    {item.vehicleName}
                                                                    {item.customerName && ` / ${item.customerName}様`}
                                                                    {item.productionMonth && ` / ${item.productionMonth}`}
                                                                </p>
                                                                <p className="text-xs sm:text-sm text-[hsl(var(--muted-foreground))] break-words">
                                                                    {item.vehicleType || "車種未設定"}
                                                                </p>
                                                            </div>
                                                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                                                {desiredDate && (
                                                                    <span className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-bold ${isOverdue ? "bg-red-600 text-white" : "bg-blue-600 text-white"}`}>
                                                                        {format(desiredDate, "M月d日")} 希望納期 {daysText}
                                                                    </span>
                                                                )}
                                                                <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-800 text-xs font-semibold">
                                                                    {statusLabel(item.status)}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm">
                                                            {item.incomingPlannedDate && (
                                                                <div>
                                                                    <span className="font-semibold">ワングラム完成予定日: </span>
                                                                    <span>{format(new Date(item.incomingPlannedDate), "M月d日")}</span>
                                                                </div>
                                                            )}
                                                            {item.shippingPlannedDate && (
                                                                <div>
                                                                    <span className="font-semibold">ワングラム様に引き取りに行く日: </span>
                                                                    <span>{format(new Date(item.shippingPlannedDate), "M月d日")}</span>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {item.comment && (
                                                            <div className="text-xs sm:text-sm text-[hsl(var(--muted-foreground))]">
                                                                <span className="font-semibold">メモ: </span>
                                                                {item.comment}
                                                            </div>
                                                        )}

                                                        {item.oemComment && (
                                                            <div className="text-xs sm:text-sm text-[hsl(var(--muted-foreground))]">
                                                                <span className="font-semibold">ワングラム側メモ: </span>
                                                                {item.oemComment}
                                                            </div>
                                                        )}

                                                        {item.specSheetUrl && (
                                                            <a
                                                                href={item.specSheetUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 underline"
                                                            >
                                                                <FileText className="h-3 w-3" />
                                                                製造注意仕様書を表示
                                                            </a>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* 完成した車両 */}
                                {completedItems.length > 0 && (
                                    <div className="space-y-2">
                                        <h2 className="text-sm sm:text-base font-semibold mt-4">完成した車両</h2>
                                        <div className="flex flex-col gap-2">
                                            {completedItems.map((item: any) => (
                                                <div
                                                    key={item.id}
                                                    className="border border-[hsl(var(--border))] rounded-lg p-3 sm:p-4 flex flex-col gap-2 bg-green-50"
                                                >
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="min-w-0 flex-1">
                                                            <p className="font-bold text-base sm:text-lg break-words">
                                                                {item.vehicleName}
                                                                {item.customerName && ` / ${item.customerName}様`}
                                                            </p>
                                                            <p className="text-xs sm:text-sm text-[hsl(var(--muted-foreground))] break-words">
                                                                {item.vehicleType || "車種未設定"}
                                                            </p>
                                                        </div>
                                                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">
                                                                状態: 完成
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {item.claimComment && (
                                                        <div className="text-xs sm:text-sm text-red-600">
                                                            <span className="font-semibold">クレーム・傷: </span>
                                                            {item.claimComment}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
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
                    >
                        {isCalendarMode ? "カード表示" : "一覧ビューモード"}
                    </Button>
                </div>
            </div>
        </div>
    );
}
