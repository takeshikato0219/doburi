import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { trpc } from "../../lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Download, RotateCcw, FileText, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { toast } from "sonner";
import { happyHuesColors, happyHuesStyles } from "../../styles/happyHues";

export default function BackupManagement() {
    const { user } = useAuth();
    const [isRestoring, setIsRestoring] = useState<string | null>(null);

    const { data: backups, isLoading, refetch } = trpc.backup.listBackups.useQuery(undefined, {
        enabled: user?.role === "admin",
    });

    const createBackupMutation = trpc.backup.createBackup.useMutation({
        onSuccess: (result) => {
            if (result.cloudUploaded) {
                toast.success(`バックアップを作成しました（クラウドにも保存済み）: ${result.fileName}`);
            } else {
                toast.success(`バックアップを作成しました: ${result.fileName}`, {
                    description: "クラウドへのアップロードはスキップされました",
                });
            }
            refetch();
        },
        onError: (error) => {
            toast.error(`バックアップの作成に失敗しました: ${error.message}`);
        },
    });

    const restoreBackupMutation = trpc.backup.restoreBackup.useMutation({
        onSuccess: () => {
            toast.success("バックアップから復元しました");
            setIsRestoring(null);
            refetch();
        },
        onError: (error) => {
            toast.error(`復元に失敗しました: ${error.message}`);
            setIsRestoring(null);
        },
    });

    const downloadBackupMutation = trpc.backup.downloadBackup.useMutation({
        onSuccess: (result) => {
            const blob = new Blob([result.content], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = result.fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success("バックアップファイルをダウンロードしました");
        },
        onError: (error) => {
            toast.error(`ダウンロードに失敗しました: ${error.message}`);
        },
    });

    if (user?.role !== "admin") {
        return (
            <div className="text-center py-8">
                <p className="text-red-500">このページは管理者のみアクセスできます</p>
            </div>
        );
    }

    const handleCreateBackup = () => {
        if (confirm("バックアップを作成しますか？")) {
            createBackupMutation.mutate();
        }
    };

    const handleRestore = (fileName: string) => {
        if (
            confirm(
                "警告: バックアップから復元すると、現在のデータが上書きされる可能性があります。\n復元前に自動バックアップが作成されます。\n続行しますか？"
            )
        ) {
            setIsRestoring(fileName);
            restoreBackupMutation.mutate({ fileName });
        }
    };

    const handleDownload = (fileName: string) => {
        downloadBackupMutation.mutate({ fileName });
    };

    return (
        <div 
            className="min-h-screen p-4 sm:p-6 space-y-6"
            style={{ 
            }}
        >
            <div className="flex items-center justify-between">
                <h1 
                    className="text-3xl font-bold"
                    style={{ color: happyHuesColors.headline, letterSpacing: '-0.02em' }}
                >
                    バックアップ管理
                </h1>
                <Button onClick={handleCreateBackup} disabled={createBackupMutation.isPending}>
                    <FileText className="h-4 w-4 mr-2" />
                    バックアップを作成
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>バックアップ一覧</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="text-center py-8">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[hsl(var(--primary))] mx-auto"></div>
                            <p className="mt-4">読み込み中...</p>
                        </div>
                    ) : backups && backups.length > 0 ? (
                        <div className="space-y-4">
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
                                <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                                <div className="text-sm text-yellow-800">
                                    <p className="font-semibold mb-1">重要な注意事項</p>
                                    <ul className="list-disc list-inside space-y-1">
                                        <li>バックアップは毎日午前3時に自動的に作成されます</li>
                                        <li>クラウドストレージ（AWS S3）への自動アップロードが有効な場合、バックアップは自動的にクラウドにも保存されます</li>
                                        <li>30日以上前のバックアップは自動的に削除されます</li>
                                        <li>復元操作は慎重に行ってください</li>
                                        <li>復元前に自動バックアップが作成されます</li>
                                    </ul>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="text-left p-2">ファイル名</th>
                                            <th className="text-left p-2">作成日時</th>
                                            <th className="text-left p-2">サイズ</th>
                                            <th className="text-left p-2">操作</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {backups.map((backup) => (
                                            <tr key={backup.fileName} className="border-b hover:bg-[hsl(var(--muted))]">
                                                <td className="p-2 font-mono text-sm">{backup.fileName}</td>
                                                <td className="p-2">
                                                    {format(backup.createdAt, "yyyy年MM月dd日 HH:mm:ss", { locale: ja })}
                                                </td>
                                                <td className="p-2">{(backup.size / 1024).toFixed(2)} KB</td>
                                                <td className="p-2">
                                                    <div className="flex gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handleDownload(backup.fileName)}
                                                            disabled={downloadBackupMutation.isPending}
                                                        >
                                                            <Download className="h-4 w-4 mr-1" />
                                                            ダウンロード
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handleRestore(backup.fileName)}
                                                            disabled={isRestoring === backup.fileName || restoreBackupMutation.isPending}
                                                        >
                                                            <RotateCcw className="h-4 w-4 mr-1" />
                                                            {isRestoring === backup.fileName ? "復元中..." : "復元"}
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-[hsl(var(--muted-foreground))]">
                            <p>バックアップがありません</p>
                            <p className="text-sm mt-2">「バックアップを作成」ボタンから手動でバックアップを作成できます</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

