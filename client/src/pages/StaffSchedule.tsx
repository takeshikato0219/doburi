import React, { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { trpc } from "../lib/trpc";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { format, parse, addMonths, subMonths } from "date-fns";
import { ja } from "date-fns/locale";
import { happyHuesColors, happyHuesStyles } from "../styles/happyHues";

type ScheduleStatus = "work" | "rest" | "request" | "exhibition" | "other" | "morning" | "afternoon" | "business_trip" | "exhibition_duty" | "paid_leave" | "delivery" | "payment_date";

// デフォルトの色設定（データベースから取得できない場合のフォールバック）
const DEFAULT_STATUS_COLORS: Record<ScheduleStatus, string> = {
    work: "bg-blue-100", // 水色 = 出勤
    rest: "bg-pink-200", // ピンク = 休み
    request: "bg-pink-300", // ピンク = 希望休
    exhibition: "bg-green-100", // 薄緑 = 展示会
    other: "bg-green-50", // 薄緑 = その他業務
    morning: "bg-yellow-100", // 黄色 = 午前出
    afternoon: "bg-orange-100", // オレンジ = 午後出
    business_trip: "bg-purple-100", // 紫 = 出張
    exhibition_duty: "bg-cyan-100", // シアン = 展示場当番
    paid_leave: "bg-red-100", // 赤 = 有給
    delivery: "bg-indigo-100", // インディゴ = 納車
    payment_date: "bg-amber-100", // アンバー = 支払日
};

const STATUS_LABELS: Record<ScheduleStatus, string> = {
    work: "出勤",
    rest: "休",
    request: "希望",
    exhibition: "展",
    other: "その他",
    morning: "午前出",
    afternoon: "午後出",
    business_trip: "出張",
    exhibition_duty: "展示場当番",
    paid_leave: "有給",
    delivery: "納車",
    payment_date: "支払日",
};

export default function StaffSchedule() {
    const { user } = useAuth();
    const [baseDate, setBaseDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
    // フィルタは一旦「全員表示」のみ（スタッフは独立管理のため）

    const { data: scheduleData, isLoading, error, isError } = trpc.staffSchedule.getPublishedSchedule.useQuery(
        { baseDate },
        {
            retry: false,
            onError: (err) => {
                console.error("[StaffSchedule] エラー:", err);
            },
        }
    );

    // 色設定を取得
    const { data: statusColors } = trpc.staffSchedule.getStatusColors.useQuery();

    // 実際に使用する色設定（データベースから取得、なければデフォルト）
    const STATUS_COLORS = React.useMemo(() => {
        if (!statusColors) return DEFAULT_STATUS_COLORS;
        return { ...DEFAULT_STATUS_COLORS, ...statusColors } as Record<ScheduleStatus, string>;
    }, [statusColors]);

    if (isLoading) {
        return (
            <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 w-12 border-b-2 border-[hsl(var(--google-blue-500))] mx-auto"></div>
                <p className="mt-4 text-black font-medium">読み込み中...</p>
            </div>
        );
    }

    if (isError || error) {
        const errorMessage = error?.message || "不明なエラー";
        return (
            <Card className="card-md-static">
                <CardContent className="p-6">
                    <div className="text-center space-y-4">
                        <div className="text-[hsl(var(--google-red-500))]">
                            <p className="font-medium text-lg text-black">エラーが発生しました</p>
                            <p className="mt-2 text-black opacity-70">{errorMessage}</p>
                        </div>
                        <div className="text-sm text-black opacity-70 space-y-2 text-left max-w-2xl mx-auto">
                            <p className="font-medium">考えられる原因：</p>
                            <ul className="list-disc list-inside space-y-1 ml-4">
                                <li>データベースのテーブルが作成されていない</li>
                                <li>データベース接続エラー</li>
                                <li>サーバーエラー</li>
                            </ul>
                            <p className="mt-4 font-medium">解決方法：</p>
                            <p className="font-mono bg-[hsl(var(--google-gray-100))] p-3 rounded-lg mt-2 text-black">pnpm db:push</p>
                            <p className="text-xs mt-2">を実行してマイグレーションを実行してください</p>
                        </div>
                        <details className="mt-4 text-left max-w-2xl mx-auto">
                            <summary className="cursor-pointer text-sm text-black opacity-70 hover:opacity-100">
                                エラー詳細を表示
                            </summary>
                            <pre className="mt-2 p-4 bg-[hsl(var(--google-gray-100))] rounded-lg text-xs overflow-auto text-black">
                                {JSON.stringify(error, null, 2)}
                            </pre>
                        </details>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (!scheduleData) {
        return (
            <Card className="card-md-static">
                <CardContent className="p-6">
                    <div className="text-center py-8 text-black font-medium">データがありません</div>
                </CardContent>
            </Card>
        );
    }

    // フィルタリングされたユーザーリスト（現状は全員）
    const filteredUsers = scheduleData.users;

    // フィルタリングされたスケジュールデータ
    const filteredScheduleData = scheduleData.scheduleData.map((day) => ({
        ...day,
        userEntries: day.userEntries.filter((entry) =>
            filteredUsers.some((u) => u.id === entry.userId)
        ),
    }));

    // フィルタリングされた集計データ
    const filteredSummary = scheduleData.summary.filter((s) =>
        filteredUsers.some((u) => u.id === s.userId)
    );

    const baseDateObj = parse(baseDate, "yyyy-MM-dd", new Date());

    const handlePrevMonth = () => {
        const prev = subMonths(baseDateObj, 1);
        setBaseDate(format(prev, "yyyy-MM-dd"));
    };

    const handleNextMonth = () => {
        const next = addMonths(baseDateObj, 1);
        setBaseDate(format(next, "yyyy-MM-dd"));
    };

    return (
        <div 
            className="min-h-screen p-4 sm:p-6 space-y-6"
            style={{ 
            }}
        >
            {/* ヘッダーセクション */}
            <Card className="card-md-static">
                <CardContent className="p-6">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-4 flex-wrap">
                            <Link href="/">
                                <Button variant="outline" size="sm" className="btn-md-outlined">
                                    <ArrowLeft className="h-4 w-4 mr-2" />
                                    戻る
                                </Button>
                            </Link>
                            <div>
                                <h1 className="text-2xl sm:text-3xl font-medium text-black">スタッフ休み予定一覧</h1>
                                <p className="text-black opacity-70 mt-2 text-sm sm:text-base">
                                    期間: {format(parse(scheduleData.period.start, "yyyy-MM-dd", new Date()), "yyyy年MM月dd日")} ～{" "}
                                    {format(parse(scheduleData.period.end, "yyyy-MM-dd", new Date()), "yyyy年MM月dd日")}
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <Button variant="outline" size="sm" onClick={handlePrevMonth} className="btn-md-outlined">
                                前月へ
                            </Button>
                            <span className="text-base sm:text-lg font-medium text-black px-3">
                                {format(baseDateObj, "yyyy年MM月", { locale: ja })}
                            </span>
                            <Button variant="outline" size="sm" onClick={handleNextMonth} className="btn-md-outlined">
                                次月へ
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* スケジュール表 */}
            <Card className="card-md-static overflow-hidden">
                <CardContent className="p-0">
                    <div className="staff-schedule-table-wrapper" style={{ overflowY: 'visible' }}>
                        <table className="w-full border-collapse text-base">
                            <thead>
                                <tr>
                                    <th 
                                        className="border-r border-b border-[hsl(var(--google-gray-200))] p-4 min-w-[90px] bg-[hsl(var(--google-gray-50))] font-medium text-black text-base"
                                        style={{ 
                                            position: 'sticky', 
                                            left: 0, 
                                            top: 0, 
                                            zIndex: 60,
                                            backgroundColor: 'hsl(var(--google-gray-50))'
                                        }}
                                    >
                                        日付
                                    </th>
                                    {filteredUsers.map((u) => (
                                        <th
                                            key={u.id}
                                            className="border-r border-b border-[hsl(var(--google-gray-200))] p-4 min-w-[100px] sm:min-w-[120px] bg-[hsl(var(--google-gray-50))] font-medium text-black"
                                            style={{ 
                                                position: 'sticky', 
                                                top: 0, 
                                                zIndex: 50,
                                                backgroundColor: 'hsl(var(--google-gray-50))'
                                            }}
                                        >
                                            <span className="text-sm sm:text-base">{u.name}</span>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredScheduleData.map((day) => (
                                    <tr key={day.date} className="hover:bg-[hsl(var(--google-gray-50))] transition-colors">
                                        <td
                                            className={`border-r border-b border-[hsl(var(--google-gray-200))] p-3 sm:p-4 text-sm sticky left-0 z-10 font-medium ${day.isWeekend ? "bg-pink-100" : "bg-white"
                                                }`}
                                        >
                                            <div className="text-black text-base">{format(day.dateObj, "MM/dd", { locale: ja })}</div>
                                            <div className="text-xs text-black opacity-60 mt-1">
                                                {format(day.dateObj, "E", { locale: ja })}
                                            </div>
                                        </td>
                                        {day.userEntries.map((entry) => (
                                            <td
                                                key={entry.userId}
                                                className={`border-r border-b border-[hsl(var(--google-gray-200))] p-3 text-center ${STATUS_COLORS[entry.status as ScheduleStatus]
                                                    }`}
                                            >
                                                {entry.status === "business_trip" && entry.comment ? (
                                                    // 出張で県名がある場合は表示し、「出張」ラベルは非表示
                                                    <div className="text-sm font-medium text-center text-black">
                                                        {entry.comment}
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="text-sm font-medium text-black">
                                                            {STATUS_LABELS[entry.status as ScheduleStatus]}
                                                        </div>
                                                        {entry.comment && (
                                                            <div className="text-xs text-black opacity-70 mt-1 truncate">
                                                                {entry.comment}
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                            {/* 集計行 */}
                            <tfoot>
                                <tr className="bg-yellow-50">
                                    <td className="border-r border-b border-[hsl(var(--google-gray-200))] p-4 text-base font-semibold text-black sticky left-0 z-10 bg-yellow-50">
                                        休みの数
                                    </td>
                                    {filteredSummary.map((s) => (
                                        <td key={s.userId} className="border-r border-b border-[hsl(var(--google-gray-200))] p-4 text-base text-center font-medium text-black bg-yellow-50">
                                            {s.restDays || 0}
                                        </td>
                                    ))}
                                </tr>
                                <tr className="bg-[hsl(var(--google-gray-50))]">
                                    <td className="border-r border-b border-[hsl(var(--google-gray-200))] p-4 text-base font-semibold text-black sticky left-0 z-10 bg-[hsl(var(--google-gray-50))]">
                                        合計
                                    </td>
                                    {filteredSummary.map((s) => (
                                        <td key={s.userId} className="border-r border-b border-[hsl(var(--google-gray-200))] p-4 text-base text-center font-medium text-black bg-[hsl(var(--google-gray-50))]">
                                            {s.totalRest}
                                        </td>
                                    ))}
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

