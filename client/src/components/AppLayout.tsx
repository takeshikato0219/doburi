import React, { useState, useEffect, useMemo } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "../hooks/useAuth";
import { trpc } from "../lib/trpc";
import { Button } from "./ui/button";
import {
    LayoutDashboard,
    Calendar,
    Car,
    Clock,
    BarChart3,
    LogOut,
    Menu,
    X,
    Download,
    Settings,
    Users,
    CheckSquare,
    ClipboardCheck,
    Coffee,
    CalendarDays,
    Database,
    Timer,
    GripVertical,
} from "lucide-react";

interface AppLayoutProps {
    children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
    const { user } = useAuth();
    const [location] = useLocation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

    // ルートが変わったときにモバイルメニューを閉じる（デスクトップでは影響なし）
    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [location]);

    const logoutMutation = trpc.auth.logout.useMutation({
        onSuccess: () => {
            window.location.href = "/login";
        },
    });

    // 一般メニュー（externalユーザーは除外）
    const defaultMenuItems: Array<{
        icon: any;
        label: string;
        path: string;
        admin: boolean;
        excludeExternal?: boolean;
    }> = [
            { icon: LayoutDashboard, label: "マイダッシュボード", path: "/", admin: false, excludeExternal: true },
            { icon: Calendar, label: "出退勤記録", path: "/my-attendance", admin: false, excludeExternal: true },
            { icon: Clock, label: "作業記録管理", path: "/work-records", admin: false, excludeExternal: true },
            { icon: Car, label: "現場/車両/案件/管理", path: "/vehicles", admin: false, excludeExternal: true },
            { icon: ClipboardCheck, label: "チェック事項", path: "/vehicle-checks", admin: false, excludeExternal: true },
            { icon: CalendarDays, label: "スタッフ休み予定一覧", path: "/staff-schedule", admin: false, excludeExternal: true },
            { icon: Timer, label: "制作時間確認", path: "/vehicle-production", admin: false, excludeExternal: true },
            { icon: BarChart3, label: "統計・分析", path: "/analytics", admin: false, excludeExternal: true },
        ];

    // ローカルストレージから保存された順序を読み込む
    const [menuOrder, setMenuOrder] = useState<string[] | null>(null);
    
    useEffect(() => {
        const savedOrder = localStorage.getItem("menuOrder");
        if (savedOrder) {
            try {
                setMenuOrder(JSON.parse(savedOrder));
            } catch (error) {
                setMenuOrder(null);
            }
        }
    }, []);
    
    const menuItems = useMemo(() => {
        if (menuOrder) {
            const ordered = menuOrder
                .map((path: string) => defaultMenuItems.find(item => item.path === path))
                .filter((item) => item !== undefined);
            
            // 新しいメニュー項目があれば追加
            const newItems = defaultMenuItems.filter(item => !menuOrder.includes(item.path));
            return [...ordered, ...newItems];
        }
        return defaultMenuItems;
    }, [menuOrder]);

    const adminMenuItems = [
        { icon: Calendar, label: "出退勤管理", path: "/admin/attendance", admin: true },
        { icon: Clock, label: "作業記録管理", path: "/admin/work-records", admin: true },
        { icon: Timer, label: "作業掲載ページ", path: "/admin/work-display", admin: true },
        { icon: Download, label: "CSV出力", path: "/admin/csv-export", admin: true },
        { icon: Settings, label: "工程管理", path: "/admin/processes", admin: true },
        { icon: Car, label: "車種管理", path: "/admin/vehicle-types", admin: true },
        { icon: CheckSquare, label: "チェック項目管理", path: "/admin/check-items", admin: true },
        { icon: CalendarDays, label: "スタッフ休み予定一覧（管理）", path: "/admin/staff-schedule", admin: true },
        { icon: Database, label: "バックアップ管理", path: "/admin/backup", admin: true },
    ];

    // 管理者専用メニュー（準管理者には表示しない）
    const superAdminMenuItems = [
        { icon: Coffee, label: "休憩時間管理", path: "/admin/break-times", admin: true },
        { icon: Users, label: "ユーザー管理", path: "/admin/users", admin: true },
    ];

    const handleLogout = () => {
        logoutMutation.mutate();
    };

    return (
        <div className="min-h-screen bg-[hsl(var(--google-gray-50))]">
            {/* ヘッダー */}
            <header className="sticky top-0 z-30 w-full border-b-2 border-[hsl(var(--google-gray-200))] bg-white" style={{ boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)' }}>
                <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 gap-2">
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="md:hidden flex-shrink-0 hover:bg-[hsl(var(--google-gray-100))]"
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        >
                            {isMobileMenuOpen ? <X className="h-6 w-6 text-black" /> : <Menu className="h-6 w-6 text-black" />}
                        </Button>
                        <Link href="/" className="min-w-0 flex-1 flex items-center gap-2">
                            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-black truncate cursor-pointer hover:opacity-80 transition-opacity font-['Noto_Sans_JP']">
                                donburi
                            </h1>
                        </Link>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                        <span className="text-sm sm:text-base text-black font-medium truncate max-w-[100px] sm:max-w-none">
                            {user?.name || user?.username}さん
                        </span>
                        <Button variant="ghost" size="sm" onClick={handleLogout} className="px-3 sm:px-4 hover:bg-[hsl(var(--google-gray-100))] text-black font-medium">
                            <LogOut className="h-4 w-4 sm:mr-2" />
                            <span className="hidden sm:inline">ログアウト</span>
                        </Button>
                    </div>
                </div>
            </header>

            <div className="flex">
                {/* サイドバー */}
                <aside
                    className={`w-64 bg-white border-r border-[hsl(var(--google-gray-200))] min-h-[calc(100vh-4rem)] fixed md:sticky top-16 left-0 bottom-0 z-30 transition-transform duration-300 md:transition-none overflow-y-auto ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0
                        `}
                >
                    <nav className="p-4 space-y-2">
                        {menuItems
                            .filter((item) => {
                                // externalユーザーの場合は、excludeExternalがfalseのもののみ表示
                                if (user?.role === "external") {
                                    return !item.excludeExternal;
                                }
                                return true;
                            })
                            .map((item, index) => {
                                const Icon = item.icon;
                                const isActive = location === item.path;
                                const isDragging = draggedIndex === index;
                                const isDragOver = dragOverIndex === index;
                                
                                return (
                                    <div
                                        key={item.path}
                                        draggable
                                        onDragStart={() => setDraggedIndex(index)}
                                        onDragEnd={() => {
                                            setDraggedIndex(null);
                                            setDragOverIndex(null);
                                        }}
                                        onDragOver={(e) => {
                                            e.preventDefault();
                                            if (draggedIndex !== null && draggedIndex !== index) {
                                                setDragOverIndex(index);
                                            }
                                        }}
                                        onDragLeave={() => {
                                            if (dragOverIndex === index) {
                                                setDragOverIndex(null);
                                            }
                                        }}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            if (draggedIndex !== null && draggedIndex !== index) {
                                                const currentOrder = menuOrder || menuItems.map((m: any) => m.path);
                                                const newOrder = [...currentOrder];
                                                [newOrder[draggedIndex], newOrder[index]] = [newOrder[index], newOrder[draggedIndex]];
                                                localStorage.setItem("menuOrder", JSON.stringify(newOrder));
                                                setMenuOrder(newOrder); // 状態を更新して再レンダリング
                                            }
                                            setDraggedIndex(null);
                                            setDragOverIndex(null);
                                        }}
                                        className={`${isDragging ? "opacity-50" : ""} ${isDragOver ? "border-2 border-blue-500 rounded-lg" : ""}`}
                                    >
                                        <Link href={item.path}>
                                            <div
                                                className={`flex items-center gap-4 px-4 py-3.5 rounded-lg transition-all duration-200 cursor-pointer ${isActive
                                                    ? "bg-[hsl(var(--google-blue-500))] text-white font-semibold shadow-lg"
                                                    : "text-black font-medium hover:bg-[hsl(var(--google-gray-100))] hover:font-semibold"
                                                    }`}
                                                onClick={() => setIsMobileMenuOpen(false)}
                                            >
                                                <GripVertical className={`h-5 w-5 ${isActive ? "text-white opacity-70" : "text-gray-400"} cursor-move`} />
                                                <Icon className={`h-6 w-6 ${isActive ? "text-white" : "text-black"}`} strokeWidth={isActive ? 2.5 : 2} />
                                                <span className={`text-base font-normal flex-1 ${isActive ? "text-white" : "text-black"}`}>
                                                    {item.label}
                                                </span>
                                            </div>
                                        </Link>
                                    </div>
                                );
                            })}

                        {(user?.role === "admin" || user?.role === "sub_admin") && (
                            <>
                                <div className="pt-8 mt-8 border-t-2 border-[hsl(var(--google-gray-200))]">
                                    <p className="px-4 text-xs font-bold text-black opacity-60 uppercase tracking-wider mb-3">
                                        管理者メニュー
                                    </p>
                                </div>
                                {adminMenuItems.map((item) => {
                                    const Icon = item.icon;
                                    const isActive = location === item.path;
                                    return (
                                        <Link key={item.path} href={item.path}>
                                        <div
                                            className={`flex items-center gap-4 px-4 py-3.5 rounded-lg transition-all duration-200 cursor-pointer ${isActive
                                                ? "bg-[hsl(var(--google-blue-500))] text-white font-semibold shadow-lg"
                                                : "text-black font-medium hover:bg-[hsl(var(--google-gray-100))] hover:font-semibold"
                                                }`}
                                            onClick={() => setIsMobileMenuOpen(false)}
                                        >
                                            <Icon className={`h-6 w-6 ${isActive ? "text-white" : "text-black"}`} strokeWidth={isActive ? 2.5 : 2} />
                                            <span className={`text-base font-normal ${isActive ? "text-white" : "text-black"}`}>
                                                {item.label}
                                            </span>
                                        </div>
                                        </Link>
                                    );
                                })}
                            </>
                        )}
                        {user?.role === "admin" && (
                            <>
                                <div className="pt-4 mt-4 border-t border-[hsl(var(--google-gray-200))]">
                                    <p className="px-3 text-xs font-medium text-[hsl(var(--google-gray-600))] uppercase tracking-wider">
                                        管理者専用メニュー
                                    </p>
                                </div>
                                {superAdminMenuItems.map((item) => {
                                    const Icon = item.icon;
                                    const isActive = location === item.path;
                                    return (
                                        <Link key={item.path} href={item.path}>
                                        <div
                                            className={`flex items-center gap-4 px-4 py-3.5 rounded-lg transition-all duration-200 cursor-pointer ${isActive
                                                ? "bg-[hsl(var(--google-blue-500))] text-white font-semibold shadow-lg"
                                                : "text-black font-medium hover:bg-[hsl(var(--google-gray-100))] hover:font-semibold"
                                                }`}
                                            onClick={() => setIsMobileMenuOpen(false)}
                                        >
                                            <Icon className={`h-6 w-6 ${isActive ? "text-white" : "text-black"}`} strokeWidth={isActive ? 2.5 : 2} />
                                            <span className={`text-base font-normal ${isActive ? "text-white" : "text-black"}`}>
                                                {item.label}
                                            </span>
                                        </div>
                                        </Link>
                                    );
                                })}
                            </>
                        )}
                    </nav>
                </aside>

                {/* メインコンテンツ */}
                <main className="flex-1 p-2 sm:p-4 md:p-6 lg:p-8">{children}</main>
            </div>

            {/* モバイルメニューのオーバーレイ */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-10 md:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}
        </div>
    );
}

