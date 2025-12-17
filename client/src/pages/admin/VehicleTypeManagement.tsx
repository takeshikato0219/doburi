import React, { useState } from "react";
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

export default function VehicleTypeManagement() {
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

    const { data: vehicleTypes, refetch } = trpc.vehicleTypes.list.useQuery();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingVehicleType, setEditingVehicleType] = useState<{
        id?: number;
        name: string;
        description: string;
        standardTotalMinutes: string;
    } | null>(null);

    const createMutation = trpc.vehicleTypes.create.useMutation({
        onSuccess: () => {
            toast.success("車種を登録しました");
            setIsDialogOpen(false);
            setEditingVehicleType(null);
            refetch();
        },
        onError: (error) => {
            toast.error(error.message || "車種の登録に失敗しました");
        },
    });

    const updateMutation = trpc.vehicleTypes.update.useMutation({
        onSuccess: () => {
            toast.success("車種を更新しました");
            setIsDialogOpen(false);
            setEditingVehicleType(null);
            refetch();
        },
        onError: (error) => {
            toast.error(error.message || "車種の更新に失敗しました");
        },
    });

    const deleteMutation = trpc.vehicleTypes.delete.useMutation({
        onSuccess: () => {
            toast.success("車種を削除しました");
            refetch();
        },
        onError: (error) => {
            toast.error(error.message || "車種の削除に失敗しました");
        },
    });

    const handleEdit = (vehicleType: any) => {
        setEditingVehicleType({
            id: vehicleType.id,
            name: vehicleType.name || "",
            description: vehicleType.description || "",
            standardTotalMinutes: vehicleType.standardTotalMinutes?.toString() || "",
        });
        setIsDialogOpen(true);
    };

    const handleSave = () => {
        if (!editingVehicleType || !editingVehicleType.name) {
            toast.error("車種名を入力してください");
            return;
        }

        if (editingVehicleType.id) {
            updateMutation.mutate({
                id: editingVehicleType.id,
                name: editingVehicleType.name,
                description: editingVehicleType.description || undefined,
                standardTotalMinutes: editingVehicleType.standardTotalMinutes
                    ? parseInt(editingVehicleType.standardTotalMinutes)
                    : undefined,
            });
        } else {
            createMutation.mutate({
                name: editingVehicleType.name,
                description: editingVehicleType.description || undefined,
                standardTotalMinutes: editingVehicleType.standardTotalMinutes
                    ? parseInt(editingVehicleType.standardTotalMinutes)
                    : undefined,
            });
        }
    };

    const handleDelete = (id: number) => {
        if (confirm("本当に削除しますか？")) {
            deleteMutation.mutate({ id });
        }
    };

    const formatDuration = (minutes: number | null) => {
        if (!minutes) return "-";
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return hours > 0 ? `${hours}時間${mins}分` : `${mins}分`;
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
                        車種管理
                    </h1>
                    <p 
                        className="mt-2"
                        style={{ color: happyHuesColors.paragraph, opacity: 0.8 }}
                    >
                        車種の追加・編集・削除を行います
                    </p>
                </div>
                <Button
                    onClick={() => {
                        setEditingVehicleType({
                            name: "",
                            description: "",
                            standardTotalMinutes: "",
                        });
                        setIsDialogOpen(true);
                    }}
                >
                    <Plus className="h-4 w-4 mr-2" />
                    車種追加
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>車種一覧</CardTitle>
                </CardHeader>
                <CardContent>
                    {vehicleTypes && vehicleTypes.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>車種名</TableHead>
                                    <TableHead>説明</TableHead>
                                    <TableHead>標準合計時間</TableHead>
                                    <TableHead>操作</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {vehicleTypes.map((vehicleType) => (
                                    <TableRow key={vehicleType.id}>
                                        <TableCell className="font-medium">{vehicleType.name}</TableCell>
                                        <TableCell>{vehicleType.description || "-"}</TableCell>
                                        <TableCell>
                                            {formatDuration(vehicleType.standardTotalMinutes)}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleEdit(vehicleType)}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    onClick={() => handleDelete(vehicleType.id)}
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
                            車種がありません
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* 編集ダイアログ */}
            {isDialogOpen && editingVehicleType && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <Card className="w-full max-w-md mx-4">
                        <CardHeader>
                            <CardTitle>
                                {editingVehicleType.id ? "車種を編集" : "車種を追加"}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="text-sm font-medium">車種名 *</label>
                                <Input
                                    value={editingVehicleType.name}
                                    onChange={(e) =>
                                        setEditingVehicleType({ ...editingVehicleType, name: e.target.value })
                                    }
                                    placeholder="車種名を入力"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">説明</label>
                                <textarea
                                    className="flex min-h-[80px] w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                                    value={editingVehicleType.description}
                                    onChange={(e) =>
                                        setEditingVehicleType({ ...editingVehicleType, description: e.target.value })
                                    }
                                    placeholder="説明を入力"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">標準合計時間（分）</label>
                                <Input
                                    type="number"
                                    value={editingVehicleType.standardTotalMinutes}
                                    onChange={(e) =>
                                        setEditingVehicleType({
                                            ...editingVehicleType,
                                            standardTotalMinutes: e.target.value,
                                        })
                                    }
                                    placeholder="例: 1200"
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
                                        setEditingVehicleType(null);
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