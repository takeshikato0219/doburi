import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { trpc } from "../../lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Plus, Edit, Trash2, Upload, Download } from "lucide-react";
import { toast } from "sonner";
import { happyHuesColors, happyHuesStyles } from "../../styles/happyHues";

const CATEGORIES = ["一般", "キャンパー", "中古", "修理", "クレーム"] as const;

export default function CheckItemManagement() {
    const { user } = useAuth();
    const [selectedCategory, setSelectedCategory] = useState<typeof CATEGORIES[number]>("一般");
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);
    const [itemName, setItemName] = useState("");
    const [majorCategory, setMajorCategory] = useState("");
    const [minorCategory, setMinorCategory] = useState("");
    const [itemDescription, setItemDescription] = useState("");
    const [displayOrder, setDisplayOrder] = useState(0);
    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
    const [csvText, setCsvText] = useState("");

    const { data: checkItems, refetch } = trpc.checks.listCheckItems.useQuery({
        category: selectedCategory,
    });

    // 既存の大カテゴリと小カテゴリの一覧を取得
    const existingMajorCategories = checkItems
        ? [...new Set(checkItems.map((item) => item.majorCategory).filter((cat): cat is string => !!cat))]
        : [];
    const existingMinorCategories = checkItems
        ? [...new Set(checkItems.map((item) => item.minorCategory).filter((cat): cat is string => !!cat))]
        : [];

    const createMutation = trpc.checks.createCheckItem.useMutation({
        onSuccess: () => {
            toast.success("チェック項目を追加しました");
            setIsAddDialogOpen(false);
            setItemName("");
            setItemDescription("");
            setDisplayOrder(0);
            refetch();
        },
        onError: (error) => {
            toast.error(error.message || "チェック項目の追加に失敗しました");
        },
    });

    const updateMutation = trpc.checks.updateCheckItem.useMutation({
        onSuccess: () => {
            toast.success("チェック項目を更新しました");
            setIsEditDialogOpen(false);
            setEditingItem(null);
            refetch();
        },
        onError: (error) => {
            toast.error(error.message || "チェック項目の更新に失敗しました");
        },
    });

    const deleteMutation = trpc.checks.deleteCheckItem.useMutation({
        onSuccess: () => {
            toast.success("チェック項目を削除しました");
            refetch();
        },
        onError: (error) => {
            toast.error(error.message || "チェック項目の削除に失敗しました");
        },
    });

    const importMutation = trpc.checks.importFromCSV.useMutation({
        onSuccess: (data) => {
            toast.success(`${data.count}件のチェック項目をインポートしました`);
            setIsImportDialogOpen(false);
            setCsvText("");
            refetch();
        },
        onError: (error) => {
            toast.error(error.message || "CSVインポートに失敗しました");
        },
    });

    const handleAdd = () => {
        if (!itemName.trim()) {
            toast.error("項目名を入力してください");
            return;
        }

        createMutation.mutate({
            category: selectedCategory,
            majorCategory: majorCategory && majorCategory !== "__new__" ? majorCategory : undefined,
            minorCategory: minorCategory && minorCategory !== "__new__" ? minorCategory : undefined,
            name: itemName,
            description: itemDescription || undefined,
            displayOrder,
        });
    };

    const handleEdit = (item: any) => {
        setEditingItem(item);
        setItemName(item.name);
        setMajorCategory(item.majorCategory || "");
        setMinorCategory(item.minorCategory || "");
        setItemDescription(item.description || "");
        setDisplayOrder(item.displayOrder || 0);
        setIsEditDialogOpen(true);
    };

    const handleUpdate = () => {
        if (!editingItem || !itemName.trim()) {
            toast.error("項目名を入力してください");
            return;
        }

        updateMutation.mutate({
            id: editingItem.id,
            name: itemName,
            majorCategory: majorCategory && majorCategory !== "__new__" ? majorCategory : undefined,
            minorCategory: minorCategory && minorCategory !== "__new__" ? minorCategory : undefined,
            description: itemDescription || undefined,
            displayOrder,
        });
    };

    const handleCSVImport = () => {
        if (!csvText.trim()) {
            toast.error("CSVデータを入力してください");
            return;
        }

        try {
            const lines = csvText.trim().split("\n");
            const items = [];

            // ヘッダー行をスキップ（最初の行がヘッダーの場合）
            const startIndex = lines[0]?.includes("区分") || lines[0]?.includes("category") ? 1 : 0;

            for (let i = startIndex; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                // CSVをパース（カンマ区切り、ダブルクォート対応）
                const values: string[] = [];
                let current = "";
                let inQuotes = false;

                for (let j = 0; j < line.length; j++) {
                    const char = line[j];
                    if (char === '"') {
                        inQuotes = !inQuotes;
                    } else if (char === "," && !inQuotes) {
                        values.push(current.trim());
                        current = "";
                    } else {
                        current += char;
                    }
                }
                values.push(current.trim());

                // カラム順序: 区分, 大カテゴリ, 小カテゴリ, 項目名, 説明, 表示順
                if (values.length < 4) {
                    toast.error(`行 ${i + 1}: カラム数が不足しています（区分、大カテゴリ、小カテゴリ、項目名は必須）`);
                    return;
                }

                const category = values[0]?.trim();
                if (!CATEGORIES.includes(category as any)) {
                    toast.error(`行 ${i + 1}: 無効な区分です（${CATEGORIES.join(", ")}のいずれか）`);
                    return;
                }

                items.push({
                    category: category as typeof CATEGORIES[number],
                    majorCategory: values[1]?.trim() || undefined,
                    minorCategory: values[2]?.trim() || undefined,
                    name: values[3]?.trim(),
                    description: values[4]?.trim() || undefined,
                    displayOrder: parseInt(values[5]?.trim() || "0") || 0,
                });
            }

            if (items.length === 0) {
                toast.error("有効なデータがありません");
                return;
            }

            importMutation.mutate({ items });
        } catch (error: any) {
            toast.error(`CSVの解析に失敗しました: ${error.message}`);
        }
    };

    const handleExportCSV = () => {
        if (!checkItems || checkItems.length === 0) {
            toast.error("エクスポートするデータがありません");
            return;
        }

        const header = "区分,大カテゴリ,小カテゴリ,項目名,説明,表示順\n";
        const rows = checkItems.map((item) => {
            const category = item.category || "";
            const majorCategory = item.majorCategory || "";
            const minorCategory = item.minorCategory || "";
            const name = `"${(item.name || "").replace(/"/g, '""')}"`;
            const description = `"${(item.description || "").replace(/"/g, '""')}"`;
            const displayOrder = item.displayOrder || 0;
            return `${category},${majorCategory},${minorCategory},${name},${description},${displayOrder}`;
        });

        const csv = header + rows.join("\n");
        const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `checkItems_${selectedCategory}_${new Date().toISOString().split("T")[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const handleDelete = (id: number) => {
        if (window.confirm("本当にこのチェック項目を削除しますか？")) {
            deleteMutation.mutate({ id });
        }
    };

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

    return (
        <div 
            className="min-h-screen p-4 sm:p-6 space-y-6"
            style={{ 
            }}
        >
            <div>
                <h1 
                    className="text-2xl sm:text-3xl font-bold"
                    style={{ color: happyHuesColors.headline, letterSpacing: '-0.02em' }}
                >
                    チェック項目管理
                </h1>
                <p 
                    className="mt-2 text-sm sm:text-base"
                    style={{ color: happyHuesColors.paragraph, opacity: 0.8 }}
                >
                    区分ごとのチェック項目を管理します
                </p>
            </div>

            <Tabs value={selectedCategory} onValueChange={(v) => setSelectedCategory(v as any)}>
                <TabsList className="grid w-full grid-cols-3 sm:grid-cols-5 gap-1 sm:gap-2 overflow-x-auto">
                    {CATEGORIES.map((cat) => (
                        <TabsTrigger key={cat} value={cat} className="text-xs sm:text-sm whitespace-nowrap">
                            {cat}
                        </TabsTrigger>
                    ))}
                </TabsList>

                {CATEGORIES.map((category) => (
                    <TabsContent key={category} value={category} className="mt-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                            <h2 className="text-lg font-semibold">{category}のチェック項目</h2>
                            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                                <Button
                                    variant="outline"
                                    onClick={handleExportCSV}
                                    className="w-full sm:w-auto"
                                >
                                    <Download className="h-4 w-4 mr-2" />
                                    CSV出力
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setCsvText("");
                                        setIsImportDialogOpen(true);
                                    }}
                                    className="w-full sm:w-auto"
                                >
                                    <Upload className="h-4 w-4 mr-2" />
                                    CSVインポート
                                </Button>
                                <Button
                                    onClick={() => {
                                        setItemName("");
                                        setMajorCategory("");
                                        setMinorCategory("");
                                        setItemDescription("");
                                        setDisplayOrder(0);
                                        setIsAddDialogOpen(true);
                                    }}
                                    className="w-full sm:w-auto"
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    項目追加
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            {checkItems && checkItems.length > 0 ? (
                                checkItems.map((item) => (
                                    <Card key={item.id}>
                                        <CardContent className="p-3 sm:p-4">
                                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                                <div className="flex-1">
                                                    <p className="font-semibold text-sm sm:text-base">{item.name}</p>
                                                    {(item.majorCategory || item.minorCategory) && (
                                                        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                                                            {item.majorCategory && <span>大: {item.majorCategory}</span>}
                                                            {item.majorCategory && item.minorCategory && " / "}
                                                            {item.minorCategory && <span>小: {item.minorCategory}</span>}
                                                        </p>
                                                    )}
                                                    {item.description && (
                                                        <p className="text-xs sm:text-sm text-[hsl(var(--muted-foreground))] mt-1">
                                                            {item.description}
                                                        </p>
                                                    )}
                                                    <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                                                        表示順: {item.displayOrder}
                                                    </p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleEdit(item)}
                                                    >
                                                        <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="destructive"
                                                        onClick={() => handleDelete(item.id)}
                                                    >
                                                        <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))
                            ) : (
                                <Card>
                                    <CardContent className="p-4 text-center text-[hsl(var(--muted-foreground))]">
                                        チェック項目がありません
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </TabsContent>
                ))}
            </Tabs>

            {/* 項目追加ダイアログ */}
            {isAddDialogOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
                    <Card className="w-full max-w-md min-w-0 my-auto">
                        <CardHeader className="p-3 sm:p-4 md:p-6">
                            <CardTitle className="text-base sm:text-lg md:text-xl">
                                {selectedCategory}のチェック項目を追加
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4">
                            <div className="min-w-0">
                                <label className="text-sm font-medium block mb-1">項目名 *</label>
                                <Input
                                    value={itemName}
                                    onChange={(e) => setItemName(e.target.value)}
                                    placeholder="チェック項目名を入力"
                                    className="w-full min-w-0"
                                />
                            </div>
                            <div className="min-w-0">
                                <label className="text-sm font-medium block mb-1">大カテゴリ</label>
                                <Input
                                    value={majorCategory}
                                    onChange={(e) => setMajorCategory(e.target.value)}
                                    placeholder="大カテゴリを入力（任意）"
                                    className="w-full min-w-0"
                                />
                            </div>
                            <div className="min-w-0">
                                <label className="text-sm font-medium block mb-1">小カテゴリ</label>
                                <Input
                                    value={minorCategory}
                                    onChange={(e) => setMinorCategory(e.target.value)}
                                    placeholder="小カテゴリを入力（任意）"
                                    className="w-full min-w-0"
                                />
                            </div>
                            <div className="min-w-0">
                                <label className="text-sm font-medium block mb-1">説明</label>
                                <Input
                                    value={itemDescription}
                                    onChange={(e) => setItemDescription(e.target.value)}
                                    placeholder="説明を入力（任意）"
                                    className="w-full min-w-0"
                                />
                            </div>
                            <div className="min-w-0">
                                <label className="text-sm font-medium block mb-1">表示順</label>
                                <Input
                                    type="number"
                                    value={displayOrder}
                                    onChange={(e) => setDisplayOrder(parseInt(e.target.value) || 0)}
                                    className="w-full min-w-0"
                                />
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2 pt-2">
                                <Button
                                    className="flex-1 w-full sm:w-auto"
                                    onClick={handleAdd}
                                    disabled={createMutation.isPending}
                                >
                                    追加
                                </Button>
                                <Button
                                    variant="outline"
                                    className="flex-1 w-full sm:w-auto"
                                    onClick={() => setIsAddDialogOpen(false)}
                                >
                                    キャンセル
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* 項目編集ダイアログ */}
            {isEditDialogOpen && editingItem && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
                    <Card className="w-full max-w-md min-w-0 my-auto">
                        <CardHeader className="p-3 sm:p-4 md:p-6">
                            <CardTitle className="text-base sm:text-lg md:text-xl">チェック項目を編集</CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4">
                            <div className="min-w-0">
                                <label className="text-sm font-medium block mb-1">項目名 *</label>
                                <Input
                                    value={itemName}
                                    onChange={(e) => setItemName(e.target.value)}
                                    placeholder="チェック項目名を入力"
                                    className="w-full min-w-0"
                                />
                            </div>
                            <div className="min-w-0">
                                <label className="text-sm font-medium block mb-1">大カテゴリ</label>
                                <select
                                    className="flex h-10 w-full min-w-0 rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-2 sm:px-3 py-2 text-sm"
                                    value={majorCategory}
                                    onChange={(e) => setMajorCategory(e.target.value)}
                                >
                                    <option value="">選択してください（任意）</option>
                                    {existingMajorCategories.map((cat) => (
                                        <option key={cat} value={cat}>
                                            {cat}
                                        </option>
                                    ))}
                                    <option value="__new__">（新規追加）</option>
                                </select>
                                {majorCategory === "__new__" && (
                                    <Input
                                        value=""
                                        onChange={(e) => setMajorCategory(e.target.value)}
                                        placeholder="新しい大カテゴリを入力"
                                        className="w-full min-w-0 mt-2"
                                        autoFocus
                                    />
                                )}
                            </div>
                            <div className="min-w-0">
                                <label className="text-sm font-medium block mb-1">小カテゴリ</label>
                                <select
                                    className="flex h-10 w-full min-w-0 rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-2 sm:px-3 py-2 text-sm"
                                    value={minorCategory}
                                    onChange={(e) => setMinorCategory(e.target.value)}
                                >
                                    <option value="">選択してください（任意）</option>
                                    {existingMinorCategories.map((cat) => (
                                        <option key={cat} value={cat}>
                                            {cat}
                                        </option>
                                    ))}
                                    <option value="__new__">（新規追加）</option>
                                </select>
                                {minorCategory === "__new__" && (
                                    <Input
                                        value=""
                                        onChange={(e) => setMinorCategory(e.target.value)}
                                        placeholder="新しい小カテゴリを入力"
                                        className="w-full min-w-0 mt-2"
                                        autoFocus
                                    />
                                )}
                            </div>
                            <div className="min-w-0">
                                <label className="text-sm font-medium block mb-1">説明</label>
                                <Input
                                    value={itemDescription}
                                    onChange={(e) => setItemDescription(e.target.value)}
                                    placeholder="説明を入力（任意）"
                                    className="w-full min-w-0"
                                />
                            </div>
                            <div className="min-w-0">
                                <label className="text-sm font-medium block mb-1">表示順</label>
                                <Input
                                    type="number"
                                    value={displayOrder}
                                    onChange={(e) => setDisplayOrder(parseInt(e.target.value) || 0)}
                                    className="w-full min-w-0"
                                />
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2 pt-2">
                                <Button
                                    className="flex-1 w-full sm:w-auto"
                                    onClick={handleUpdate}
                                    disabled={updateMutation.isPending}
                                >
                                    更新
                                </Button>
                                <Button
                                    variant="outline"
                                    className="flex-1 w-full sm:w-auto"
                                    onClick={() => {
                                        setIsEditDialogOpen(false);
                                        setEditingItem(null);
                                    }}
                                >
                                    キャンセル
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* CSVインポートダイアログ */}
            {isImportDialogOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
                    <Card className="w-full max-w-2xl min-w-0 my-auto max-h-[90vh] overflow-y-auto">
                        <CardHeader className="p-3 sm:p-4 md:p-6">
                            <CardTitle className="text-base sm:text-lg md:text-xl">CSVインポート</CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4">
                            <div className="min-w-0">
                                <label className="text-sm font-medium block mb-1">
                                    CSVデータ（区分, 大カテゴリ, 小カテゴリ, 項目名, 説明, 表示順）
                                </label>
                                <textarea
                                    value={csvText}
                                    onChange={(e) => setCsvText(e.target.value)}
                                    placeholder={`区分,大カテゴリ,小カテゴリ,項目名,説明,表示順
${selectedCategory},外装,塗装,塗装チェック,塗装状態を確認,1
${selectedCategory},内装,床,床材チェック,床材の状態を確認,2`}
                                    className="flex min-h-[200px] w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm font-mono"
                                />
                                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                                    現在の区分: {selectedCategory}
                                </p>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2 pt-2">
                                <Button
                                    className="flex-1 w-full sm:w-auto"
                                    onClick={handleCSVImport}
                                    disabled={importMutation.isPending}
                                >
                                    {importMutation.isPending ? "インポート中..." : "インポート"}
                                </Button>
                                <Button
                                    variant="outline"
                                    className="flex-1 w-full sm:w-auto"
                                    onClick={() => {
                                        setIsImportDialogOpen(false);
                                        setCsvText("");
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