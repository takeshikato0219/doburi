import { useMemo, useState, useEffect } from "react";
import { Link } from "wouter";
import { trpc } from "../lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { format } from "date-fns";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { happyHuesColors, happyHuesStyles } from "../styles/happyHues";

const statusLabel = (status: string) => {
    const labels: Record<string, string> = {
        katomo_stock: "katomo在庫中",
        wg_storage: "ワングラム保管中",
        wg_production: "ワングラム製作中",
        wg_wait_pickup: "ワングラム完成引き取り待ち",
        katomo_picked_up: "katomo引き取り済み",
        katomo_checked: "katomoチェック済み",
        completed: "完成",
    };
    return labels[status] || status;
};

export default function DeliveryDelayedList() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // 現在の年月のデータを取得（遅延判定に使用）
    const { data, isLoading, isError, error } = trpc.deliverySchedules.list.useQuery({
        year: currentYear,
        month: currentMonth,
    });

    // 遅延車両をフィルタリング
    const delayedItems = useMemo(() => {
        if (!data) return [];
        
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
    }, [data, currentYear, currentMonth]);

    // 制作月ごとにグループ化
    const groupedByProductionMonth = useMemo(() => {
        const map = new Map<string, any[]>();
        delayedItems.forEach((item: any) => {
            const key = item.productionMonth || "制作月未設定";
            const list = map.get(key) || [];
            list.push(item);
            map.set(key, list);
        });
        return Array.from(map.entries()).sort(([a], [b]) => {
            const aMatch = a.match(/^(\d+)月/);
            const bMatch = b.match(/^(\d+)月/);
            const aMonth = aMatch ? parseInt(aMatch[1], 10) : 999;
            const bMonth = bMatch ? parseInt(bMatch[1], 10) : 999;
            return aMonth - bMonth;
        });
    }, [delayedItems]);

    return (
        <div 
            className="min-h-screen p-4 sm:p-6 space-y-6"
            style={{ 
            }}
        >
            <div className="flex items-center gap-4">
                <Link href="/delivery-schedules">
                    <Button variant="outline" size="sm">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        戻る
                    </Button>
                </Link>
                <div className="flex items-center gap-2">
                    <AlertTriangle className="h-6 w-6" style={{ color: happyHuesColors.accent1 }} />
                    <h1 
                        className="text-2xl font-bold"
                        style={{ color: happyHuesColors.headline, letterSpacing: '-0.02em' }}
                    >
                        遅延車両一覧
                    </h1>
                </div>
            </div>

            {isLoading ? (
                <Card>
                    <CardContent className="p-6">
                        <p className="text-center text-[hsl(var(--muted-foreground))]">読み込み中...</p>
                    </CardContent>
                </Card>
            ) : isError ? (
                <Card>
                    <CardContent className="p-6">
                        <p className="text-center text-red-600">エラーが発生しました: {error?.message}</p>
                    </CardContent>
                </Card>
            ) : delayedItems.length === 0 ? (
                <Card>
                    <CardContent className="p-6">
                        <p className="text-center text-[hsl(var(--muted-foreground))]">
                            遅延している車両はありません
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {groupedByProductionMonth.map(([productionMonth, items]) => (
                        <Card key={productionMonth}>
                            <CardHeader className="p-4 bg-orange-50">
                                <CardTitle className="text-lg font-semibold text-orange-900">
                                    {productionMonth} - {items.length}台
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4">
                                <div className="space-y-3">
                                    {items.map((item: any) => {
                                        // 状態ごとの背景色を決定
                                        let bgColor = "";
                                        if (item.status === "katomo_stock") {
                                            bgColor = "bg-blue-50";
                                        } else if (item.status === "wg_storage") {
                                            bgColor = "bg-cyan-50";
                                        } else if (item.status === "wg_production") {
                                            bgColor = "bg-amber-50";
                                        }

                                        return (
                                            <div
                                                key={item.id}
                                                className={`border rounded-lg p-4 ${bgColor}`}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0 flex-1">
                                                        <p className="font-bold text-xl break-words">
                                                            {item.vehicleName}
                                                            {item.customerName && ` / ${item.customerName}様`}
                                                        </p>
                                                        <p className="text-sm text-[hsl(var(--muted-foreground))] break-words mt-1">
                                                            {item.vehicleType || "車種未設定"}
                                                        </p>
                                                        <div className="mt-2 flex flex-wrap items-center gap-2">
                                                            <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-800 text-xs font-semibold">
                                                                {statusLabel(item.status)}
                                                            </span>
                                                            {item.inCharge && (
                                                                <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs">
                                                                    担当: {item.inCharge}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                                        {item.desiredIncomingPlannedDate && (
                                                            <div className="text-right">
                                                                <p className="text-xs text-[hsl(var(--muted-foreground))]">希望納期</p>
                                                                <p className="text-sm font-semibold">
                                                                    {format(new Date(item.desiredIncomingPlannedDate), "yyyy年M月d日")}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                {item.comment && (
                                                    <div className="mt-3 pt-3 border-t border-gray-200">
                                                        <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                                            <span className="font-semibold">メモ:</span> {item.comment}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
