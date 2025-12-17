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

export default function UserManagement() {
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

    const { data: users, refetch } = trpc.users.list.useQuery();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<{
        id?: number;
        username: string;
        password: string;
        name: string;
        role: "field_worker" | "sales_office" | "sub_admin" | "admin" | "external";
        category: "elephant" | "squirrel" | null;
    } | null>(null);

    // ワングラムアカウント用の状態
    const [wangramAccount1, setWangramAccount1] = useState({
        username: "",
        password: "",
        name: "",
    });
    const [wangramAccount2, setWangramAccount2] = useState({
        username: "",
        password: "",
        name: "",
    });

    const createMutation = trpc.users.create.useMutation({
        onSuccess: () => {
            toast.success("ユーザーを登録しました");
            setIsDialogOpen(false);
            setEditingUser(null);
            refetch();
        },
        onError: (error) => {
            toast.error(error.message || "ユーザーの登録に失敗しました");
        },
    });

    // ワングラムアカウント作成用のハンドラー
    const handleCreateWangramAccount = (account: { username: string; password: string; name: string }, accountNumber: number) => {
        if (!account.username || !account.password) {
            toast.error("ユーザー名とパスワードを入力してください");
            return;
        }

        createMutation.mutate({
            username: account.username,
            password: account.password,
            name: account.name || undefined,
            role: "external",
        }, {
            onSuccess: () => {
                toast.success(`ワングラムアカウント${accountNumber}を登録しました`);
                if (accountNumber === 1) {
                    setWangramAccount1({ username: "", password: "", name: "" });
                } else {
                    setWangramAccount2({ username: "", password: "", name: "" });
                }
                refetch();
            },
        });
    };

    const updateMutation = trpc.users.update.useMutation({
        onSuccess: (_, variables) => {
            // パスワードが変更されたかどうかを確認
            const passwordChanged = variables.password && variables.password.trim() !== "";
            const message = passwordChanged 
                ? "ユーザーを更新しました（パスワードも変更されました）"
                : "ユーザーを更新しました";
            toast.success(message);
            setIsDialogOpen(false);
            setEditingUser(null);
            refetch();
        },
        onError: (error) => {
            // 401エラーの場合は特別なメッセージを表示
            if (error.data?.code === "UNAUTHORIZED" || error.data?.httpStatus === 401) {
                toast.error("認証が期限切れです。再ログインしてください", {
                    duration: 5000,
                });
            } else {
                toast.error(error.message || "ユーザーの更新に失敗しました");
            }
        },
    });

    const deleteMutation = trpc.users.delete.useMutation({
        onSuccess: () => {
            toast.success("ユーザーを削除しました");
            refetch();
        },
        onError: (error) => {
            toast.error(error.message || "ユーザーの削除に失敗しました");
        },
    });

    const handleEdit = (userData: any) => {
        setEditingUser({
            id: userData.id,
            username: userData.username || "",
            password: "",
            // 表示名（社員名）はDBのnameをそのまま使う。未設定なら空。
            name: userData.name || "",
            role: userData.role || "field_worker",
            category: userData.category || null,
        });
        setIsDialogOpen(true);
    };

    const handleSave = () => {
        if (!editingUser || !editingUser.username) {
            toast.error("ユーザー名を入力してください");
            return;
        }

        if (!editingUser.id && !editingUser.password) {
            toast.error("パスワードを入力してください");
            return;
        }

        if (editingUser.id) {
            // パスワードが空文字列の場合は undefined を送る（パスワードを変更しない）
            // パスワードが入力されている場合のみ送信
            const passwordToSend = editingUser.password.trim() === "" ? undefined : editingUser.password.trim();
            
            updateMutation.mutate({
                id: editingUser.id,
                username: editingUser.username,
                password: passwordToSend,
                // 表示名（社員名）はそのまま保存。空ならundefinedで変更なし。
                name: editingUser.name || undefined,
                role: editingUser.role,
                category: editingUser.category,
            });
        } else {
            createMutation.mutate({
                username: editingUser.username,
                password: editingUser.password.trim(),
                name: editingUser.name || undefined,
                role: editingUser.role,
                category: editingUser.category || undefined,
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
                        ユーザー管理
                    </h1>
                    <p 
                        className="mt-2"
                        style={{ color: happyHuesColors.paragraph, opacity: 0.8 }}
                    >
                        ユーザーの追加・編集・削除を行います
                    </p>
                </div>
                <Button
                    onClick={() => {
                        setEditingUser({
                            username: "",
                            password: "",
                            name: "",
                            role: "field_worker",
                            category: null,
                        });
                        setIsDialogOpen(true);
                    }}
                >
                    <Plus className="h-4 w-4 mr-2" />
                    ユーザー追加
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>ユーザー一覧</CardTitle>
                </CardHeader>
                <CardContent>
                    {users && users.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>ID</TableHead>
                                    <TableHead>ユーザー名</TableHead>
                                    <TableHead>表示名</TableHead>
                                    <TableHead>ロール</TableHead>
                                    <TableHead>操作</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users.map((userData) => (
                                    <TableRow key={userData.id}>
                                        <TableCell>{userData.id}</TableCell>
                                        <TableCell className="font-medium">{userData.username}</TableCell>
                                        {/* 表示名（社員名）。未設定なら - を表示 */}
                                        <TableCell>{userData.name || "-"}</TableCell>
                                        <TableCell>
                                            <span
                                                className={`px-2 py-1 rounded text-xs ${userData.role === "admin"
                                                    ? "bg-purple-100 text-purple-800"
                                                    : userData.role === "sub_admin"
                                                        ? "bg-blue-100 text-blue-800"
                                                        : userData.role === "sales_office"
                                                            ? "bg-green-100 text-green-800"
                                                            : userData.role === "external"
                                                                ? "bg-orange-100 text-orange-800"
                                                            : "bg-gray-100 text-gray-800"
                                                    }`}
                                            >
                                                {userData.role === "admin"
                                                    ? "管理人"
                                                    : userData.role === "sub_admin"
                                                        ? "準管理人"
                                                        : userData.role === "sales_office"
                                                            ? "営業事務"
                                                            : userData.role === "external"
                                                                ? "社外（ワングラム）"
                                                            : "現場staff"}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleEdit(userData)}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    onClick={() => handleDelete(userData.id)}
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
                            ユーザーがありません
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* ワングラムアカウント追加セクション */}
            <Card className="mt-6 border-orange-200 bg-orange-50/50">
                <CardHeader>
                    <CardTitle className="text-lg">ワングラムアカウント追加</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* ワングラムアカウント1 */}
                        <div className="space-y-2 p-4 border border-orange-200 rounded-lg bg-white">
                            <h3 className="font-semibold text-sm">ワングラムアカウント 1</h3>
                            <Input
                                placeholder="ユーザー名"
                                value={wangramAccount1.username}
                                onChange={(e) =>
                                    setWangramAccount1({ ...wangramAccount1, username: e.target.value })
                                }
                            />
                            <Input
                                type="password"
                                placeholder="パスワード"
                                value={wangramAccount1.password}
                                onChange={(e) =>
                                    setWangramAccount1({ ...wangramAccount1, password: e.target.value })
                                }
                            />
                            <Input
                                placeholder="表示名（任意）"
                                value={wangramAccount1.name}
                                onChange={(e) =>
                                    setWangramAccount1({ ...wangramAccount1, name: e.target.value })
                                }
                            />
                            <Button
                                className="w-full"
                                onClick={() => handleCreateWangramAccount(wangramAccount1, 1)}
                                disabled={createMutation.isPending || !wangramAccount1.username || !wangramAccount1.password}
                            >
                                追加
                            </Button>
                        </div>

                        {/* ワングラムアカウント2 */}
                        <div className="space-y-2 p-4 border border-orange-200 rounded-lg bg-white">
                            <h3 className="font-semibold text-sm">ワングラムアカウント 2</h3>
                            <Input
                                placeholder="ユーザー名"
                                value={wangramAccount2.username}
                                onChange={(e) =>
                                    setWangramAccount2({ ...wangramAccount2, username: e.target.value })
                                }
                            />
                            <Input
                                type="password"
                                placeholder="パスワード"
                                value={wangramAccount2.password}
                                onChange={(e) =>
                                    setWangramAccount2({ ...wangramAccount2, password: e.target.value })
                                }
                            />
                            <Input
                                placeholder="表示名（任意）"
                                value={wangramAccount2.name}
                                onChange={(e) =>
                                    setWangramAccount2({ ...wangramAccount2, name: e.target.value })
                                }
                            />
                            <Button
                                className="w-full"
                                onClick={() => handleCreateWangramAccount(wangramAccount2, 2)}
                                disabled={createMutation.isPending || !wangramAccount2.username || !wangramAccount2.password}
                            >
                                追加
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* 編集ダイアログ */}
            {isDialogOpen && editingUser && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <Card className="w-full max-w-md mx-4">
                        <CardHeader>
                            <CardTitle>{editingUser.id ? "ユーザーを編集" : "ユーザーを追加"}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="text-sm font-medium">ユーザー名 *</label>
                                <Input
                                    value={editingUser.username}
                                    onChange={(e) =>
                                        setEditingUser({ ...editingUser, username: e.target.value })
                                    }
                                    placeholder="ユーザー名を入力"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">
                                    パスワード {editingUser.id ? "（変更する場合のみ）" : "*"}
                                </label>
                                <Input
                                    type="password"
                                    value={editingUser.password}
                                    onChange={(e) =>
                                        setEditingUser({ ...editingUser, password: e.target.value })
                                    }
                                    placeholder="パスワードを入力"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">表示名（社員名）</label>
                                <Input
                                    value={editingUser.name}
                                    onChange={(e) =>
                                        setEditingUser({ ...editingUser, name: e.target.value })
                                    }
                                    placeholder="社員の名前を入力してください"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">ロール</label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm"
                                    value={editingUser.role}
                                    onChange={(e) =>
                                        setEditingUser({
                                            ...editingUser,
                                            role: e.target.value as "field_worker" | "sales_office" | "sub_admin" | "admin",
                                        })
                                    }
                                >
                                    <option value="field_worker">現場staff</option>
                                    <option value="sales_office">営業事務</option>
                                    <option value="sub_admin">準管理人</option>
                                    <option value="admin">管理人</option>
                                    <option value="external">社外アカウント（ワングラム）</option>
                                </select>
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
                                        setEditingUser(null);
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

