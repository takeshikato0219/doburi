import { trpc } from "../../lib/trpc";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

// Happy Hues風カラーパレット
const colors = {
    background: '#fffffe',
    headline: '#272343',
    paragraph: '#2d334a',
    button: '#ffd803',
    buttonText: '#272343',
    main: '#fffffe',
    highlight: '#ffd803',
    secondary: '#e3f6f5',
    tertiary: '#bae8e8',
    red: '#DC0000',
    lightRed: '#FF3838',
    // Happy Hues追加カラー
    accent1: '#ff6e6c',
    accent2: '#ffd93d',
    accent3: '#6bcf7f',
    accent4: '#4d96ff',
    accent5: '#c44569',
};

export default function WorkDisplay() {
    const { data: activeVehicles, isLoading: isLoadingVehicles } = trpc.analytics.getActiveVehiclesWithWorkTime.useQuery(undefined, {
        refetchInterval: 30000,
    });

    const { data: workRecordIssues, isLoading: isLoadingIssues } = trpc.analytics.getWorkRecordIssues.useQuery(undefined, {
        refetchInterval: 30000,
    });

    const { data: unreadBroadcasts, isLoading: isLoadingBroadcasts } = trpc.salesBroadcasts.getUnread.useQuery(undefined, {
        refetchInterval: 30000,
    });

    const { data: workTimeByMajorCategory, isLoading: isLoadingWorkTime } = trpc.analytics.getWorkTimeByMajorCategoryTodayYesterday.useQuery(undefined, {
        refetchInterval: 30000,
    });

    const [currentVehiclePage, setCurrentVehiclePage] = useState(0);
    const [currentScreen, setCurrentScreen] = useState<"vehicles" | "issues">("vehicles");

    const formatDuration = (minutes: number) => {
        if (!minutes) return "0分";
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return hours > 0 ? `${hours}時間${mins}分` : `${mins}分`;
    };

    const formatDate = (date: string | Date | null | undefined) => {
        if (!date) return "未設定";
        try {
            const dateObj = typeof date === "string" ? new Date(date) : date;
            return format(dateObj, "yyyy年MM月dd日");
        } catch {
            return "未設定";
        }
    };

    // 車両を4列でページ分け
    const vehiclesPerPage = 4;
    const totalVehiclePages = activeVehicles ? Math.max(1, Math.ceil(activeVehicles.length / vehiclesPerPage)) : 1;

    // 20秒ごとに自動切り替え
    useEffect(() => {
        const timer = setInterval(() => {
            if (currentScreen === "vehicles") {
                // 車両ページ内で全ページをスライド
                if (totalVehiclePages > 1) {
                    const nextPage = (currentVehiclePage + 1) % totalVehiclePages;
                    setCurrentVehiclePage(nextPage);
                    
                    // 最後のページに到達したら不備ページへ（不備がある場合のみ）
                    if (nextPage === 0 && workRecordIssues && workRecordIssues.length > 0) {
                        setTimeout(() => {
                            setCurrentScreen("issues");
                        }, 1000);
                    }
                } else if (workRecordIssues && workRecordIssues.length > 0) {
                    // 車両が1ページしかない場合は不備ページへ
                    setCurrentScreen("issues");
                }
            } else {
                // 不備ページから車両ページへ（最初のページから）
                setCurrentScreen("vehicles");
                setCurrentVehiclePage(0);
            }
        }, 20000);
        return () => clearInterval(timer);
    }, [currentScreen, currentVehiclePage, totalVehiclePages, workRecordIssues]);

    if (isLoadingVehicles || isLoadingIssues || isLoadingBroadcasts || isLoadingWorkTime) {
        return (
            <div 
                className="flex items-center justify-center h-screen" 
                style={{ 
                    fontFamily: "'Noto Sans JP', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                    background: `linear-gradient(135deg, ${colors.background} 0%, ${colors.secondary} 100%)`
                }}
            >
                <p className="text-6xl font-bold" style={{ color: colors.headline }}>読み込み中...</p>
            </div>
        );
    }

    // 不備ページ（4列を1ページで表示）
    if (currentScreen === "issues") {
        const workRecordIssuesList = workRecordIssues || [];
        const broadcastsList = unreadBroadcasts || [];
        const yesterdayWorkTime = workTimeByMajorCategory?.yesterday || [];
        const dayBeforeYesterdayWorkTime = workTimeByMajorCategory?.dayBeforeYesterday || [];

        return (
            <div 
                className="h-screen w-screen p-8 overflow-hidden" 
                style={{ 
                    fontFamily: "'Noto Sans JP', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                    background: `linear-gradient(135deg, ${colors.background} 0%, ${colors.secondary} 50%, ${colors.tertiary} 100%)`
                }}
            >
                <div className="h-full grid grid-cols-4 gap-6">
                    {/* 不備一覧 */}
                    <div 
                        className="bg-white rounded-[2rem] p-8 flex flex-col backdrop-blur-sm" 
                        style={{ 
                            boxShadow: '0 10px 40px rgba(220, 0, 0, 0.15), 0 4px 12px rgba(220, 0, 0, 0.1)',
                            border: `3px solid ${colors.lightRed}`,
                            background: 'rgba(255, 255, 255, 0.95)'
                        }}
                    >
                        <h2 className="font-bold mb-6" style={{ fontSize: '9.6rem', color: colors.red, letterSpacing: '-0.02em' }}>不備一覧</h2>
                        <div className="flex-1 overflow-y-auto space-y-4">
                            {workRecordIssuesList.length === 0 ? (
                                <p style={{ fontSize: '6.4rem', color: colors.paragraph }}>不備はありません</p>
                            ) : (
                                workRecordIssuesList.map((issue, index) => (
                                    <div 
                                        key={index} 
                                        className="rounded-[1.5rem] p-4 transition-all hover:scale-[1.02]" 
                                        style={{ 
                                            background: `linear-gradient(135deg, ${colors.lightRed}15 0%, ${colors.lightRed}25 100%)`,
                                            border: `2px solid ${colors.lightRed}`,
                                            boxShadow: '0 4px 12px rgba(255, 56, 56, 0.1)'
                                        }}
                                    >
                                        <p className="font-bold mb-2" style={{ fontSize: '8rem', color: colors.red, letterSpacing: '-0.01em' }}>{issue.userName}</p>
                                        <div className="space-y-1">
                                            {issue.dates.map((date, idx) => (
                                                <p key={idx} className="font-bold" style={{ fontSize: '4.8rem', color: colors.lightRed, letterSpacing: '-0.01em' }}>
                                                    {format(new Date(date), "MM/dd(E)", { locale: ja })}
                                                </p>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* 連絡一覧 */}
                    <div 
                        className="bg-white rounded-[2rem] p-8 flex flex-col backdrop-blur-sm" 
                        style={{ 
                            boxShadow: '0 10px 40px rgba(39, 35, 67, 0.15), 0 4px 12px rgba(39, 35, 67, 0.1)',
                            border: `3px solid ${colors.tertiary}`,
                            background: 'rgba(255, 255, 255, 0.95)'
                        }}
                    >
                        <h2 className="font-bold mb-6" style={{ fontSize: '9.6rem', color: colors.headline, letterSpacing: '-0.02em' }}>連絡一覧</h2>
                        <div className="flex-1 overflow-y-auto space-y-4">
                            {broadcastsList.length === 0 ? (
                                <p style={{ fontSize: '6.4rem', color: colors.paragraph }}>連絡事項はありません</p>
                            ) : (
                                broadcastsList.map((broadcast, index) => (
                                    <div 
                                        key={index} 
                                        className="rounded-[1.5rem] p-4 transition-all hover:scale-[1.02]" 
                                        style={{ 
                                            background: `linear-gradient(135deg, ${colors.secondary} 0%, ${colors.tertiary} 100%)`,
                                            border: `2px solid ${colors.tertiary}`,
                                            boxShadow: '0 4px 12px rgba(186, 232, 232, 0.2)'
                                        }}
                                    >
                                        <p className="font-bold mb-2" style={{ fontSize: '6rem', color: colors.headline, letterSpacing: '-0.01em' }}>
                                            {broadcast.vehicle?.vehicleNumber || `車両ID: ${broadcast.vehicleId}`}
                                        </p>
                                        {broadcast.vehicle?.customerName && (
                                            <p className="mb-2" style={{ fontSize: '4rem', color: colors.paragraph, letterSpacing: '-0.01em' }}>
                                                {broadcast.vehicle.customerName}
                                            </p>
                                        )}
                                        <p className="mb-2" style={{ fontSize: '3.2rem', color: colors.paragraph }}>
                                            {broadcast.createdByUser?.name || broadcast.createdByUser?.username || "不明"}さんから
                                        </p>
                                        <p className="font-bold" style={{ fontSize: '3.2rem', color: colors.headline }}>{broadcast.message}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* 昨日の作業時間 */}
                    <div 
                        className="bg-white rounded-[2rem] p-8 flex flex-col backdrop-blur-sm" 
                        style={{ 
                            boxShadow: '0 10px 40px rgba(39, 35, 67, 0.15), 0 4px 12px rgba(39, 35, 67, 0.1)',
                            border: `3px solid ${colors.accent4}`,
                            background: 'rgba(255, 255, 255, 0.95)'
                        }}
                    >
                        <h2 className="font-bold mb-4" style={{ fontSize: '9.6rem', color: colors.headline, letterSpacing: '-0.02em' }}>昨日の作業時間</h2>
                        <div className="flex-1 overflow-y-auto space-y-3">
                            {yesterdayWorkTime.length === 0 ? (
                                <p style={{ fontSize: '6.4rem', color: colors.paragraph }}>作業記録なし</p>
                            ) : (
                                yesterdayWorkTime.map((item: { majorCategory: string; totalMinutes: number }, index: number) => (
                                    <div 
                                        key={index} 
                                        className="rounded-[1.5rem] p-4 transition-all hover:scale-[1.02]" 
                                        style={{ 
                                            background: `linear-gradient(135deg, ${colors.accent4}15 0%, ${colors.accent4}25 100%)`,
                                            border: `2px solid ${colors.accent4}`,
                                            boxShadow: '0 4px 12px rgba(77, 150, 255, 0.15)'
                                        }}
                                    >
                                        <p className="font-bold mb-2" style={{ fontSize: '6rem', color: colors.headline, letterSpacing: '-0.01em' }}>{item.majorCategory}</p>
                                        <p className="font-bold" style={{ fontSize: '5rem', color: colors.paragraph }}>
                                            {formatDuration(item.totalMinutes)}
                                        </p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* 一昨日の作業時間 */}
                    <div 
                        className="bg-white rounded-[2rem] p-8 flex flex-col backdrop-blur-sm" 
                        style={{ 
                            boxShadow: '0 10px 40px rgba(39, 35, 67, 0.15), 0 4px 12px rgba(39, 35, 67, 0.1)',
                            border: `3px solid ${colors.accent3}`,
                            background: 'rgba(255, 255, 255, 0.95)'
                        }}
                    >
                        <h2 className="font-bold mb-4" style={{ fontSize: '9.6rem', color: colors.headline, letterSpacing: '-0.02em' }}>一昨日の作業時間</h2>
                        <div className="flex-1 overflow-y-auto space-y-3">
                            {dayBeforeYesterdayWorkTime.length === 0 ? (
                                <p style={{ fontSize: '6.4rem', color: colors.paragraph }}>作業記録なし</p>
                            ) : (
                                dayBeforeYesterdayWorkTime.map((item: { majorCategory: string; totalMinutes: number }, index: number) => (
                                    <div 
                                        key={index} 
                                        className="rounded-[1.5rem] p-4 transition-all hover:scale-[1.02]" 
                                        style={{ 
                                            background: `linear-gradient(135deg, ${colors.accent3}15 0%, ${colors.accent3}25 100%)`,
                                            border: `2px solid ${colors.accent3}`,
                                            boxShadow: '0 4px 12px rgba(107, 207, 127, 0.15)'
                                        }}
                                    >
                                        <p className="font-bold mb-2" style={{ fontSize: '6rem', color: colors.headline, letterSpacing: '-0.01em' }}>{item.majorCategory}</p>
                                        <p className="font-bold" style={{ fontSize: '5rem', color: colors.paragraph }}>
                                            {formatDuration(item.totalMinutes)}
                                        </p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // 車両ページ
    if (!activeVehicles || activeVehicles.length === 0) {
        return (
            <div 
                className="flex items-center justify-center h-screen" 
                style={{ 
                    fontFamily: "'Noto Sans JP', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                    background: `linear-gradient(135deg, ${colors.background} 0%, ${colors.secondary} 100%)`
                }}
            >
                <p className="text-8xl font-bold" style={{ color: colors.headline, letterSpacing: '-0.02em' }}>現在作業中の車両はありません</p>
            </div>
        );
    }

    return (
        <div 
            className="h-screen w-screen p-8 overflow-hidden" 
            style={{ 
                fontFamily: "'Noto Sans JP', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                background: `linear-gradient(135deg, ${colors.background} 0%, ${colors.secondary} 50%, ${colors.tertiary} 100%)`
            }}
        >
            <div className="h-full flex flex-col">
                {/* ヘッダー */}
                <div className="text-center mb-8">
                    <h1 className="text-9xl font-bold mb-4" style={{ color: colors.headline, letterSpacing: '-0.03em' }}>作業掲載ページ</h1>
                </div>

                {/* 車両カードグリッド（4列、全ページをスライド表示） */}
                <div className="flex-1 overflow-hidden relative" style={{ width: '100%' }}>
                    <div 
                        className="flex h-full"
                        style={{ 
                            transform: `translateX(-${currentVehiclePage * (100 / totalVehiclePages)}%)`,
                            transition: 'transform 1s ease-in-out',
                            width: `${totalVehiclePages * 100}%`
                        }}
                    >
                        {Array.from({ length: totalVehiclePages }).map((_, pageIndex) => {
                            const startIndex = pageIndex * vehiclesPerPage;
                            const endIndex = startIndex + vehiclesPerPage;
                            const pageVehicles = activeVehicles.slice(startIndex, endIndex);
                            
                            return (
                                <div 
                                    key={pageIndex}
                                    className="grid grid-cols-4 gap-6 h-full"
                                    style={{ 
                                        width: `${100 / totalVehiclePages}%`,
                                        flexShrink: 0,
                                        minWidth: `${100 / totalVehiclePages}%`
                                    }}
                                >
                                    {pageVehicles.map((vehicle) => (
                        <div
                            key={vehicle.id}
                            className="bg-white rounded-[2rem] p-6 flex flex-col justify-between backdrop-blur-sm transition-all hover:scale-[1.02]"
                            style={{ 
                                boxShadow: '0 10px 40px rgba(39, 35, 67, 0.15), 0 4px 12px rgba(39, 35, 67, 0.1)',
                                border: `3px solid ${colors.tertiary}`,
                                background: 'rgba(255, 255, 255, 0.95)'
                            }}
                        >
                            <div className="flex-1">
                                <div className="mb-6">
                                    {/* 車両番号、お客様名、車種を同じサイズで表示 */}
                                    <p className="text-7xl font-bold mb-3" style={{ color: colors.headline, letterSpacing: '-0.02em' }}>
                                        {vehicle.vehicleNumber}
                                    </p>
                                    {vehicle.customerName && (
                                        <p className="text-7xl font-bold mb-3" style={{ color: colors.headline, letterSpacing: '-0.02em' }}>
                                            {vehicle.customerName}
                                        </p>
                                    )}
                                    <p className="text-7xl font-bold mb-6" style={{ color: colors.headline, letterSpacing: '-0.02em' }}>
                                        {vehicle.vehicleTypeName}
                                    </p>

                                    {/* 作業者ごとの作業時間 */}
                                    {vehicle.userWorkTimes && vehicle.userWorkTimes.length > 0 && (
                                        <div className="mb-4">
                                            <p className="text-4xl font-semibold mb-4" style={{ color: colors.paragraph }}>作業者別時間</p>
                                            <div className="space-y-3">
                                                {vehicle.userWorkTimes.map((userWork, index) => (
                                                    <div
                                                        key={index}
                                                        className="flex justify-between items-center p-4 rounded-[1.5rem] transition-all hover:scale-[1.02]"
                                                        style={{ 
                                                            background: `linear-gradient(135deg, ${colors.secondary} 0%, ${colors.tertiary} 100%)`,
                                                            border: `2px solid ${colors.tertiary}`,
                                                            boxShadow: '0 4px 12px rgba(186, 232, 232, 0.2)'
                                                        }}
                                                    >
                                                        <span className="text-6xl font-bold" style={{ color: colors.headline, letterSpacing: '-0.01em' }}>
                                                            {userWork.userName}
                                                        </span>
                                                        <span className="text-5xl font-bold" style={{ color: colors.paragraph }}>
                                                            {formatDuration(userWork.minutes)}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="mt-auto space-y-4">
                                {/* 希望納期 */}
                                <div 
                                    className="p-3 rounded-[1.5rem] transition-all hover:scale-[1.02]" 
                                    style={{ 
                                        background: `linear-gradient(135deg, ${colors.secondary} 0%, ${colors.tertiary} 100%)`,
                                        border: `2px solid ${colors.tertiary}`,
                                        boxShadow: '0 4px 12px rgba(186, 232, 232, 0.2)'
                                    }}
                                >
                                    <p className="text-4xl mb-1 font-semibold" style={{ color: colors.paragraph }}>希望納期</p>
                                    <p className="text-6xl font-bold" style={{ color: colors.headline, letterSpacing: '-0.01em' }}>
                                        {formatDate(vehicle.desiredDeliveryDate)}
                                    </p>
                                </div>

                                {/* メモ */}
                                <div 
                                    className="p-3 rounded-[1.5rem] transition-all hover:scale-[1.02]" 
                                    style={{ 
                                        background: `linear-gradient(135deg, ${colors.secondary} 0%, ${colors.tertiary} 100%)`,
                                        border: `2px solid ${colors.tertiary}`,
                                        boxShadow: '0 4px 12px rgba(186, 232, 232, 0.2)'
                                    }}
                                >
                                    <p className="text-4xl mb-1 font-semibold" style={{ color: colors.paragraph }}>メモ</p>
                                    {vehicle.memos && vehicle.memos.length > 0 ? (
                                        <div className="space-y-2">
                                            {vehicle.memos.map((memo: string, index: number) => (
                                                <p key={index} className="text-4xl" style={{ color: colors.headline }}>
                                                    {memo}
                                                </p>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-4xl" style={{ color: colors.paragraph }}>メモがありません</p>
                                    )}
                                </div>

                                {/* 注意ポイント */}
                                <div 
                                    className="p-3 rounded-[1.5rem] transition-all hover:scale-[1.02]" 
                                    style={{ 
                                        background: `linear-gradient(135deg, ${colors.lightRed}20 0%, ${colors.lightRed}30 100%)`,
                                        border: `2px solid ${colors.lightRed}`,
                                        boxShadow: '0 4px 12px rgba(255, 56, 56, 0.15)'
                                    }}
                                >
                                    <p className="text-4xl mb-1 font-semibold" style={{ color: colors.red }}>注意ポイント</p>
                                    {vehicle.attentionPoints && vehicle.attentionPoints.length > 0 ? (
                                        <div className="space-y-2">
                                            {vehicle.attentionPoints.map((ap: string, index: number) => (
                                                <p key={index} className="text-4xl" style={{ color: colors.red }}>
                                                    {ap}
                                                </p>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-4xl" style={{ color: colors.paragraph }}>注意ポイントがありません</p>
                                    )}
                                </div>

                                {/* 累計作業時間 */}
                                <div 
                                    className="rounded-[1.5rem] p-8 transition-all hover:scale-[1.02]" 
                                    style={{ 
                                        background: `linear-gradient(135deg, ${colors.highlight} 0%, ${colors.accent2} 100%)`,
                                        border: `3px solid ${colors.headline}`,
                                        boxShadow: '0 8px 24px rgba(255, 216, 3, 0.3)'
                                    }}
                                >
                                    <p className="text-5xl mb-3 font-semibold" style={{ color: colors.buttonText }}>累計作業時間</p>
                                    <p className="text-9xl font-bold" style={{ color: colors.buttonText, letterSpacing: '-0.03em' }}>
                                        {formatDuration(vehicle.totalMinutes)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ページインジケーターとナビゲーションボタン */}
                {totalVehiclePages > 1 && (
                    <div className="mt-8 flex items-center justify-center gap-8">
                        <button
                            onClick={() => setCurrentVehiclePage((prev) => (prev - 1 + totalVehiclePages) % totalVehiclePages)}
                            className="px-8 py-4 rounded-[1.5rem] text-4xl font-bold transition-all"
                            style={{ 
                                background: `linear-gradient(135deg, ${colors.button} 0%, ${colors.accent2} 100%)`,
                                color: colors.buttonText,
                                boxShadow: '0 6px 20px rgba(255, 216, 3, 0.4)',
                                border: `2px solid ${colors.headline}`
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'scale(1.08)';
                                e.currentTarget.style.boxShadow = '0 8px 24px rgba(255, 216, 3, 0.5)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'scale(1)';
                                e.currentTarget.style.boxShadow = '0 6px 20px rgba(255, 216, 3, 0.4)';
                            }}
                        >
                            ← 前へ
                        </button>
                        <p className="text-5xl font-bold" style={{ color: colors.headline, letterSpacing: '-0.01em' }}>
                            {currentVehiclePage + 1} / {totalVehiclePages}
                        </p>
                        <button
                            onClick={() => setCurrentVehiclePage((prev) => (prev + 1) % totalVehiclePages)}
                            className="px-8 py-4 rounded-[1.5rem] text-4xl font-bold transition-all"
                            style={{ 
                                background: `linear-gradient(135deg, ${colors.button} 0%, ${colors.accent2} 100%)`,
                                color: colors.buttonText,
                                boxShadow: '0 6px 20px rgba(255, 216, 3, 0.4)',
                                border: `2px solid ${colors.headline}`
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'scale(1.08)';
                                e.currentTarget.style.boxShadow = '0 8px 24px rgba(255, 216, 3, 0.5)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'scale(1)';
                                e.currentTarget.style.boxShadow = '0 6px 20px rgba(255, 216, 3, 0.4)';
                            }}
                        >
                            次へ →
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
