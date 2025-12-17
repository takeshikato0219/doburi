import React, { useMemo, useState, useEffect } from "react";
import { trpc } from "../lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { format, differenceInCalendarDays } from "date-fns";
import { happyHuesColors, happyHuesStyles } from "../styles/happyHues";

export default function VehicleProductionTime() {
  const { data: vehicles } = trpc.analytics.getVehicleProductionTimes.useQuery();
  const [isListMode, setIsListMode] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);

  // 10秒ごとにページ送り（一覧モード時のみ）
  useEffect(() => {
    if (!isListMode || !vehicles || vehicles.length === 0) return;
    const timer = setInterval(() => {
      const pageCount = Math.ceil(vehicles.length / 4) || 1;
      setPageIndex((prev) => (prev + 1) % pageCount);
    }, 10000);
    return () => clearInterval(timer);
  }, [isListMode, vehicles]);

  const formatDuration = (minutes: number) => {
    if (!minutes) return "0分";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}時間${mins}分` : `${mins}分`;
  };

  const formatDate = (value: string | Date | null | undefined) => {
    if (!value) return "-";
    const d = typeof value === "string" ? new Date(value) : value;
    if (Number.isNaN(d.getTime())) return "-";
    return format(d, "yyyy-MM-dd");
  };

  const renderDeliveryInfo = (v: any) => {
    const desired = v.desiredDeliveryDate ? new Date(v.desiredDeliveryDate) : null;
    const completed = v.completionDate ? new Date(v.completionDate) : null;

    if (completed) {
      return (
        <span className="text-base sm:text-2xl font-semibold text-[hsl(var(--muted-foreground))]">
          納車日: {format(completed, "yyyy-MM-dd")}
        </span>
      );
    }

    if (desired) {
      const today = new Date();
      const days = differenceInCalendarDays(desired, today);
      const suffix = days > 0 ? `（あと${days}日）` : days === 0 ? "（本日）" : `（${Math.abs(days)}日前）`;
      return (
        <span className="text-base sm:text-2xl font-semibold text-[hsl(var(--muted-foreground))]">
          納車予定: {format(desired, "yyyy-MM-dd")} {suffix}
        </span>
      );
    }

    return (
      <span className="text-base sm:text-2xl font-semibold text-[hsl(var(--muted-foreground))]">
        納車予定: 未設定
      </span>
    );
  };

  const pagedVehicles = useMemo(() => {
    if (!vehicles) return [];
    if (!isListMode) return vehicles;
    const start = pageIndex * 4;
    return vehicles.slice(start, start + 4);
  }, [vehicles, isListMode, pageIndex]);

  const [selected, setSelected] = useState<{
    vehicleId: number;
    processId: number;
  } | null>(null);

  const selectedProcess = useMemo(() => {
    if (!vehicles || !selected) return null;
    const v = vehicles.find((x) => x.vehicleId === selected.vehicleId);
    const p = v?.processes.find((pp: any) => pp.processId === selected.processId);
    return v && p ? { vehicle: v, process: p } : null;
  }, [vehicles, selected]);

  return (
    <div 
      className="w-full h-full flex flex-col gap-6 text-lg sm:text-2xl min-h-screen p-4 sm:p-6"
      style={{ 
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 
            className="text-2xl sm:text-3xl font-bold"
            style={{ color: happyHuesColors.headline, letterSpacing: '-0.02em' }}
          >
            制作時間確認
          </h1>
          <p 
            className="mt-2 text-sm sm:text-base"
            style={{ color: happyHuesColors.paragraph, opacity: 0.8 }}
          >
            1台ごとの累計作業時間と工程別時間を確認できます（全期間）。
          </p>
        </div>
        <Button
          variant={isListMode ? "default" : "outline"}
          onClick={() => setIsListMode((v) => !v)}
          className="text-sm sm:text-base px-4 py-2"
        >
          {isListMode ? "通常モード" : "一覧モード"}
        </Button>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
        {pagedVehicles && pagedVehicles.length > 0 ? (
          pagedVehicles.map((v: any) => (
            <Card key={v.vehicleId} className="flex flex-col h-full">
              <CardHeader className="pb-2">
                <CardTitle className="flex flex-col gap-1">
                  <span className="text-2xl sm:text-3xl font-bold">
                    {v.vehicleNumber}
                  </span>
                  {v.customerName && (
                    <span className="text-2xl sm:text-3xl text-[hsl(var(--muted-foreground))]">
                      {v.customerName}
                    </span>
                  )}
                  <span className="text-base sm:text-2xl text-blue-600 font-semibold">
                    合計 {formatDuration(v.totalMinutes)}
                  </span>
                  {renderDeliveryInfo(v)}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-auto">
                {v.processes && v.processes.length > 0 ? (
                  <table className="w-full text-base sm:text-2xl">
                    <thead>
                      <tr className="border-b border-[hsl(var(--border))]">
                        <th className="text-left py-2 pr-4">工程</th>
                        <th className="text-right py-2">時間</th>
                      </tr>
                    </thead>
                    <tbody>
                      {v.processes.map((p: any) => (
                        <tr
                          key={p.processId}
                          className="border-b border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] cursor-pointer"
                          onClick={() => setSelected({ vehicleId: v.vehicleId, processId: p.processId })}
                        >
                          <td className="py-2 pr-4 whitespace-nowrap">
                            {p.processName}
                          </td>
                          <td className="py-2 text-right font-medium">
                            {formatDuration(p.totalMinutes)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-[hsl(var(--muted-foreground))] text-base sm:text-2xl">
                    作業記録がありません
                  </p>
                )}
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full flex items-center justify-center text-[hsl(var(--muted-foreground))]">
            データがありません
          </div>
        )}
      </div>

      {selectedProcess && (
        <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] flex flex-col text-lg sm:text-2xl">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-2xl sm:text-3xl">
                  {selectedProcess.vehicle.vehicleNumber} / {selectedProcess.process.processName}
                </CardTitle>
                <p className="text-base sm:text-2xl text-[hsl(var(--muted-foreground))] mt-2">
                  誰が・いつ・何分作業したかの一覧
                </p>
              </div>
              <Button variant="outline" onClick={() => setSelected(null)}>
                閉じる
              </Button>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto">
              <table className="w-full text-base sm:text-2xl">
                <thead>
                  <tr className="border-b border-[hsl(var(--border))]">
                    <th className="text-left py-2 pr-4">日付</th>
                    <th className="text-left py-2 pr-4">担当者</th>
                    <th className="text-right py-2">時間</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedProcess.process.details.map((d: any, idx: number) => (
                    <tr key={idx} className="border-b border-[hsl(var(--border))]">
                      <td className="py-2 pr-4 whitespace-nowrap">{d.workDate}</td>
                      <td className="py-2 pr-4 whitespace-nowrap">{d.userName}</td>
                      <td className="py-2 text-right font-medium">
                        {formatDuration(d.minutes)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

