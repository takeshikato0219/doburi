import React, { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { trpc } from "../../lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Plus, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "../../components/ui/table";
import { happyHuesColors, happyHuesStyles } from "../../styles/happyHues";

export default function ProcessManagement() {
    const { user } = useAuth();

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

    const { data: processes, refetch } = trpc.processes.list.useQuery();
    const [localProcesses, setLocalProcesses] = useState<any[]>([]);
    const [draggingId, setDraggingId] = useState<number | null>(null);

    // 大区分の候補
    const majorCategoryOptions = [
        "キャンパー",
        "一般",
        "家具",
        "開発",
        "展示車",
        "修理",
        "クレーム",
        "外注管理",
        "車移動",
        "掃除",
        "その他",
    ];

    // 小分類の候補（既存データから自動生成）
    const minorCategoryOptions = Array.from(
        new Set(
            (localProcesses || [])
                .map((p) => p.minorCategory as string | undefined)
                .filter((v): v is string => !!v)
        )
    );

    useEffect(() => {
        if (processes) {
            // 表示順でソートしつつローカル状態にコピー
            const sorted = [...processes].sort(
                (a, b) => (a.displayOrder || 0) - (b.displayOrder || 0)
            );
            setLocalProcesses(sorted);
        }
    }, [processes]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingProcess, setEditingProcess] = useState<{
        id?: number;
        name: string;
        description: string;
        majorCategory: string;
        minorCategory: string;
        displayOrder: string;
    } | null>(null);
    const [useCustomMajor, setUseCustomMajor] = useState(false);
    const [useCustomMinor, setUseCustomMinor] = useState(false);

    const createMutation = trpc.processes.create.useMutation({
        onSuccess: () => {
            toast.success("工程を登録しました");
            setIsDialogOpen(false);
            setEditingProcess(null);
            refetch();
        },
        onError: (error) => {
            toast.error(error.message || "工程の登録に失敗しました");
        },
    });

    const updateMutation = trpc.processes.update.useMutation({
        onSuccess: () => {
            toast.success("工程を更新しました");
            setIsDialogOpen(false);
            setEditingProcess(null);
            refetch();
        },
        onError: (error) => {
            toast.error(error.message || "工程の更新に失敗しました");
        },
    });

    const deleteMutation = trpc.processes.delete.useMutation({
        onSuccess: () => {
            toast.success("工程を削除しました");
            refetch();
        },
        onError: (error) => {
            toast.error(error.message || "工程の削除に失敗しました");
        },
    });

    const reorderMutation = trpc.processes.reorder.useMutation({
        onError: (error) => {
            toast.error(error.message || "並び順の更新に失敗しました");
        },
    });

    const handleEdit = (process: any) => {
        setEditingProcess({
            id: process.id,
            name: process.name || "",
            description: process.description || "",
            majorCategory: process.majorCategory || "",
            minorCategory: process.minorCategory || "",
            displayOrder: process.displayOrder?.toString() || "0",
        });
        setUseCustomMajor(
            !!process.majorCategory && !majorCategoryOptions.includes(process.majorCategory)
        );
        setUseCustomMinor(
            !!process.minorCategory && !minorCategoryOptions.includes(process.minorCategory)
        );
        setIsDialogOpen(true);
    };

    const handleSave = () => {
        if (!editingProcess || !editingProcess.name) {
            toast.error("工程名を入力してください");
            return;
        }

        if (editingProcess.id) {
            updateMutation.mutate({
                id: editingProcess.id,
                name: editingProcess.name,
                description: editingProcess.description || undefined,
                majorCategory: editingProcess.majorCategory || undefined,
                minorCategory: editingProcess.minorCategory || undefined,
                displayOrder: editingProcess.displayOrder ? parseInt(editingProcess.displayOrder) : undefined,
            });
        } else {
            createMutation.mutate({
                name: editingProcess.name,
                description: editingProcess.description || undefined,
                majorCategory: editingProcess.majorCategory || undefined,
                minorCategory: editingProcess.minorCategory || undefined,
                displayOrder: editingProcess.displayOrder ? parseInt(editingProcess.displayOrder) : undefined,
            });
        }
    };

    const handleDelete = (id: number) => {
        if (confirm("本当に削除しますか？")) {
            deleteMutation.mutate({ id });
        }
    };

    return (
        <div 
            className="min-h-screen p-4 sm:p-6 space-y-6"
            style={{ 
            }}
        >
            <div className="flex items-center justify-between">
                <div>
                    <h1 
                        className="text-3xl font-bold"
                        style={{ color: happyHuesColors.headline, letterSpacing: '-0.02em' }}
                    >
                        工程管理
                    </h1>
                    <p 
                        className="mt-2"
                        style={{ color: happyHuesColors.paragraph, opacity: 0.8 }}
                    >
                        工程の追加・編集・削除を行います
                    </p>
                </div>
                <Button
                    onClick={() => {
                        setEditingProcess({
                            name: "",
                            description: "",
                            // デフォルトで「キャンパー」
                            majorCategory: "キャンパー",
                            minorCategory: "",
                            displayOrder: "0",
                        });
                        setUseCustomMajor(false);
                        setUseCustomMinor(false);
                        setIsDialogOpen(true);
                    }}
                >
                    <Plus className="h-4 w-4 mr-2" />
                    工程追加
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-xl sm:text-2xl">工程一覧</CardTitle>
                </CardHeader>
                <CardContent className="text-base sm:text-lg">
                    {localProcesses && localProcesses.length > 0 ? (
                        <Table>
                            <TableHeader className="text-base sm:text-lg">
                                <TableRow>
                                    <TableHead className="w-8">並び替え</TableHead>
                                    <TableHead>表示順</TableHead>
                                    <TableHead>工程名</TableHead>
                                    <TableHead>大分類</TableHead>
                                    <TableHead>小分類</TableHead>
                                    <TableHead>説明</TableHead>
                                    <TableHead>操作</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {localProcesses.map((process, index) => (
                                    <TableRow
                                        key={process.id}
                                        draggable
                                        onDragStart={() => setDraggingId(process.id)}
                                        onDragOver={(e) => e.preventDefault()}
                                        onDrop={() => {
                                            if (draggingId == null || draggingId === process.id) return;
                                            const sourceId = draggingId;
                                            const targetId = process.id;
                                            setDraggingId(null);

                                            setLocalProcesses((current) => {
                                                const list = [...current];
                                                const fromIndex = list.findIndex((p) => p.id === sourceId);
                                                const toIndex = list.findIndex((p) => p.id === targetId);
                                                if (fromIndex === -1 || toIndex === -1) return current;

                                                const [moved] = list.splice(fromIndex, 1);
                                                list.splice(toIndex, 0, moved);

                                                const withOrder = list.map((p, i) => ({
                                                    ...p,
                                                    displayOrder: i + 1,
                                                }));

                                                // サーバー側の表示順も更新
                                                reorderMutation.mutate({
                                                    items: withOrder.map((p) => ({
                                                        id: p.id,
                                                        displayOrder: p.displayOrder || 0,
                                                    })),
                                                });

                                                return withOrder;
                                            });
                                        }}
                                        className={draggingId === process.id ? "bg-blue-50" : ""}
                                    >
                                        <TableCell className="cursor-move text-center text-xs text-[hsl(var(--muted-foreground))]">
                                            ⋮⋮
                                        </TableCell>
                                        <TableCell>{process.displayOrder || index + 1}</TableCell>
                                        <TableCell className="font-medium">{process.name}</TableCell>
                                        <TableCell>{process.majorCategory || "-"}</TableCell>
                                        <TableCell>{process.minorCategory || "-"}</TableCell>
                                        <TableCell>{process.description || "-"}</TableCell>
                                        <TableCell>
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleEdit(process)}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    onClick={() => handleDelete(process.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <p className="text-center py-4 text-[hsl(var(--muted-foreground))]">
                            工程がありません
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* 編集ダイアログ */}
            {isDialogOpen && editingProcess && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <Card className="w-full max-w-md mx-4">
                        <CardHeader>
                            <CardTitle>{editingProcess.id ? "工程を編集" : "工程を追加"}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="text-sm font-medium">工程名 *</label>
                                <Input
                                    value={editingProcess.name}
                                    onChange={(e) =>
                                        setEditingProcess({ ...editingProcess, name: e.target.value })
                                    }
                                    placeholder="工程名を入力"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">大分類</label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                                    value={
                                        useCustomMajor
                                            ? "__custom__"
                                            : editingProcess.majorCategory || ""
                                    }
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        if (value === "__custom__") {
                                            // 「新しい区分を追加」が選ばれたら、下のテキスト入力で指定
                                            setUseCustomMajor(true);
                                            setEditingProcess({
                                                ...editingProcess,
                                                majorCategory: "",
                                            });
                                        } else {
                                            setUseCustomMajor(false);
                                            setEditingProcess({
                                                ...editingProcess,
                                                majorCategory: value,
                                            });
                                        }
                                    }}
                                >
                                    <option value="">選択してください</option>
                                    {majorCategoryOptions.map((opt) => (
                                        <option key={opt} value={opt}>
                                            {opt}
                                        </option>
                                    ))}
                                    <option value="__custom__">新しい区分を追加</option>
                                </select>
                                {useCustomMajor && (
                                    <Input
                                        className="mt-2"
                                        value={editingProcess.majorCategory}
                                        onChange={(e) =>
                                            setEditingProcess({
                                                ...editingProcess,
                                                majorCategory: e.target.value,
                                            })
                                        }
                                        placeholder="大分類を入力"
                                    />
                                )}
                            </div>
                            <div>
                                <label className="text-sm font-medium">小分類</label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                                    value={
                                        useCustomMinor
                                            ? "__custom__"
                                            : editingProcess.minorCategory || ""
                                    }
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        if (value === "__custom__") {
                                            setUseCustomMinor(true);
                                            setEditingProcess({
                                                ...editingProcess,
                                                minorCategory: "",
                                            });
                                        } else {
                                            setUseCustomMinor(false);
                                            setEditingProcess({
                                                ...editingProcess,
                                                minorCategory: value,
                                            });
                                        }
                                    }}
                                >
                                    <option value="">選択してください</option>
                                    {minorCategoryOptions.map((opt) => (
                                        <option key={opt} value={opt}>
                                            {opt}
                                        </option>
                                    ))}
                                    <option value="__custom__">新しい小分類を追加</option>
                                </select>
                                {useCustomMinor && (
                                    <Input
                                        className="mt-2"
                                        value={editingProcess.minorCategory}
                                        onChange={(e) =>
                                            setEditingProcess({
                                                ...editingProcess,
                                                minorCategory: e.target.value,
                                            })
                                        }
                                        placeholder="小分類を入力"
                                    />
                                )}
                            </div>
                            <div>
                                <label className="text-sm font-medium">説明</label>
                                <textarea
                                    className="flex min-h-[80px] w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                                    value={editingProcess.description}
                                    onChange={(e) =>
                                        setEditingProcess({ ...editingProcess, description: e.target.value })
                                    }
                                    placeholder="説明を入力"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">表示順</label>
                                <Input
                                    type="number"
                                    value={editingProcess.displayOrder}
                                    onChange={(e) =>
                                        setEditingProcess({ ...editingProcess, displayOrder: e.target.value })
                                    }
                                    placeholder="0"
                                />
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    className="flex-1"
                                    onClick={handleSave}
                                    disabled={createMutation.isPending || updateMutation.isPending}
                                >
                                    保存
                                </Button>
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => {
                                        setIsDialogOpen(false);
                                        setEditingProcess(null);
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